import type { ReconciliationResult } from "./types"

export type MagentoSnapshotDescriptor = {
  source: "magento"
  snapshotId: string
  capturedAt: string
  importerCommitSha: string
  magentoVersion?: string
  databaseSha256?: string
  mediaSha256?: string
}

export type MigrationRunStatus = "running" | "completed" | "needs_review"

export type MigrationRunManifest = {
  runId: string
  snapshot: MagentoSnapshotDescriptor
  startedAt: string
  completedAt?: string
  status: MigrationRunStatus
  reconciliation: ReconciliationResult[]
  warnings: string[]
}

const SAFE_ARTIFACT_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

function assertSafeArtifactSegment(value: string, label: string): void {
  if (!SAFE_ARTIFACT_SEGMENT.test(value)) {
    throw new Error(`${label} contains unsupported characters: ${value}`)
  }
}

export function createMigrationRun(
  runId: string,
  snapshot: MagentoSnapshotDescriptor,
  startedAt: string
): MigrationRunManifest {
  assertSafeArtifactSegment(runId, "runId")
  assertSafeArtifactSegment(snapshot.snapshotId, "snapshotId")

  return {
    runId,
    snapshot,
    startedAt,
    status: "running",
    reconciliation: [],
    warnings: [],
  }
}

export function finalizeMigrationRun(
  run: MigrationRunManifest,
  reconciliation: ReconciliationResult[],
  completedAt: string,
  warnings: string[] = []
): MigrationRunManifest {
  const isComplete =
    reconciliation.length > 0 && reconciliation.every((result) => result.isReconciled)

  return {
    ...run,
    completedAt,
    status: isComplete ? "completed" : "needs_review",
    reconciliation,
    warnings: [...run.warnings, ...warnings],
  }
}

export function privateMigrationArtifactPath(
  runId: string,
  artifactName: string
): string {
  assertSafeArtifactSegment(runId, "runId")
  assertSafeArtifactSegment(artifactName, "artifactName")

  return `migration-runs/${runId}/${artifactName}`
}
