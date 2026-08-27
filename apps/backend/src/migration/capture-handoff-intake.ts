import { MedusaError } from "@medusajs/framework/utils"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { gunzipSync } from "node:zlib"
import { verifyCaptureHandoffArchive } from "./capture-handoff"
import { sourceChecksum } from "./checksum"
import { buildDependencyRequirements, type DependencyRequirement } from "./dependency-mapping-reconciliation"
import {
  buildMigrationInputReconciliation,
  verifyMigrationInputReconciliationBundle,
  type CaptureIngestionReportForReconciliation,
  type MigrationInputReconciliation,
} from "./migration-input-reconciliation"
import type { ReviewDecision } from "./review-decisions"

export type CaptureHandoffIntake = {
  schemaVersion: 1
  archiveChecksum: string
  handoffChecksum: string
  captureId: string
  captureEvidencePackageChecksum: string
  migrationInput: MigrationInputReconciliation
  dependencyRequirements: DependencyRequirement[]
  reviewWorklist: Array<{
    reviewKey: string
    issueType: string
    state: string
    candidateKey?: string
    field?: string
    evidenceChecksum: string
    blockers: string[]
  }>
  unresolvedUrls: number
  globalBlockers: string[]
  intakeChecksum: string
  isReadyForDependencyProvisioning: boolean
  isExecutable: false
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function safeRelativePath(value: string) {
  const normalized = value.replace(/\\/g, "/")
  return (
    normalized.length > 0 &&
    !normalized.startsWith("/") &&
    !normalized.split("/").includes("..") &&
    !/^[a-zA-Z]:\//.test(normalized)
  )
}

function parseOctal(value: Buffer) {
  const text = value.toString("ascii").replace(/\0.*$/, "").trim()
  return text ? Number.parseInt(text, 8) : 0
}

function parseTarArchive(buffer: Buffer) {
  const entries = new Map<string, Buffer>()
  let offset = 0

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break

    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "")
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "")
    const path = prefix ? `${prefix}/${name}` : name
    if (!safeRelativePath(path)) {
      throw unexpected(`Unsafe path in verified capture handoff: ${path}`)
    }
    if (entries.has(path)) {
      throw unexpected(`Duplicate path in verified capture handoff: ${path}`)
    }

    const size = parseOctal(header.subarray(124, 136))
    const dataStart = offset + 512
    const dataEnd = dataStart + size
    if (dataEnd > buffer.length) {
      throw unexpected(`Truncated verified capture handoff entry: ${path}`)
    }

    entries.set(path, Buffer.from(buffer.subarray(dataStart, dataEnd)))
    offset = dataStart + Math.ceil(size / 512) * 512
  }

  return entries
}

export async function readVerifiedCaptureHandoffReport(path: string) {
  const resolved = resolve(path)
  const verification = await verifyCaptureHandoffArchive(resolved)
  if (!verification.valid || !verification.manifest) {
    throw unexpected(
      `Capture handoff is not verified: ${verification.errors.join(", ")}`
    )
  }

  let entries: Map<string, Buffer>
  try {
    entries = parseTarArchive(gunzipSync(await readFile(resolved)))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw unexpected(`Unable to read verified capture handoff: ${message}`)
  }

  const reportRaw = entries.get("ingestion-report.json")
  if (!reportRaw) {
    throw unexpected("Verified capture handoff is missing ingestion-report.json")
  }

  let report: CaptureIngestionReportForReconciliation
  try {
    report = JSON.parse(reportRaw.toString("utf8")) as CaptureIngestionReportForReconciliation
  } catch {
    throw unexpected("Verified capture handoff ingestion report is invalid JSON")
  }

  if (report.capture?.captureId !== verification.manifest.captureId) {
    throw unexpected("Verified capture handoff report captureId mismatch")
  }
  if (
    report.capture?.evidencePackage?.packageChecksum !==
    verification.manifest.evidencePackageChecksum
  ) {
    throw unexpected("Verified capture handoff report evidence checksum mismatch")
  }

  return {
    archiveChecksum: verification.archiveChecksum,
    manifest: verification.manifest,
    report,
  }
}

function intakePayload(value: Omit<CaptureHandoffIntake, "intakeChecksum">) {
  return {
    schemaVersion: value.schemaVersion,
    archiveChecksum: value.archiveChecksum,
    handoffChecksum: value.handoffChecksum,
    captureId: value.captureId,
    captureEvidencePackageChecksum: value.captureEvidencePackageChecksum,
    migrationInputBundleChecksum: value.migrationInput.bundleChecksum,
    dependencyRequirements: value.dependencyRequirements,
    reviewWorklist: value.reviewWorklist,
    unresolvedUrls: value.unresolvedUrls,
    globalBlockers: value.globalBlockers,
    isReadyForDependencyProvisioning: value.isReadyForDependencyProvisioning,
    isExecutable: value.isExecutable,
  }
}

export async function buildCaptureHandoffIntake(input: {
  handoffPath: string
  decisions?: ReviewDecision[]
  generatedAt?: string
}): Promise<CaptureHandoffIntake> {
  const verified = await readVerifiedCaptureHandoffReport(input.handoffPath)
  const migrationInput = buildMigrationInputReconciliation({
    report: verified.report,
    decisions: input.decisions ?? [],
    generatedAt: input.generatedAt,
  })
  const bundleVerification = verifyMigrationInputReconciliationBundle(migrationInput)
  if (!bundleVerification.valid) {
    throw unexpected(
      `Phase 4N bundle generated from verified handoff failed verification: ${bundleVerification.errors.join(", ")}`
    )
  }
  if (
    migrationInput.captureEvidencePackageChecksum !==
    verified.manifest.evidencePackageChecksum
  ) {
    throw unexpected(
      "Phase 4N bundle evidence package checksum does not match verified handoff"
    )
  }

  const dependencyRequirements = migrationInput.isReadyForStagingExecution
    ? buildDependencyRequirements(migrationInput)
    : []
  const reviewWorklist = migrationInput.reviewPlan.items
    .filter((item) => item.state !== "decided")
    .map((item) => ({
      reviewKey: item.reviewKey,
      issueType: item.issueType,
      state: item.state,
      ...(item.candidateKey ? { candidateKey: item.candidateKey } : {}),
      ...(item.field ? { field: item.field } : {}),
      evidenceChecksum: item.evidenceChecksum,
      blockers: [...item.blockers],
    }))
    .sort((left, right) => left.reviewKey.localeCompare(right.reviewKey))

  const withoutChecksum: Omit<CaptureHandoffIntake, "intakeChecksum"> = {
    schemaVersion: 1,
    archiveChecksum: verified.archiveChecksum,
    handoffChecksum: verified.manifest.handoffChecksum,
    captureId: verified.manifest.captureId,
    captureEvidencePackageChecksum:
      verified.manifest.evidencePackageChecksum,
    migrationInput,
    dependencyRequirements,
    reviewWorklist,
    unresolvedUrls: migrationInput.urlUniverse.unresolved,
    globalBlockers: [...migrationInput.globalBlockers],
    isReadyForDependencyProvisioning:
      migrationInput.isReadyForStagingExecution,
    isExecutable: false,
  }

  return {
    ...withoutChecksum,
    intakeChecksum: sourceChecksum(intakePayload(withoutChecksum)),
  }
}
