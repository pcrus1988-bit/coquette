import { MedusaError } from "@medusajs/framework/utils"
import { buildProductImportPlan } from "../migration/import-plan"
import {
  buildMigrationInputReconciliation,
  type CaptureIngestionReportForReconciliation,
  type MigrationInputReconciliation,
} from "../migration/migration-input-reconciliation"
import type { RecoveryProductCandidate } from "../migration/recovery-candidates"
import {
  buildReconstructionReviewPlan,
  type ReviewDecision,
} from "../migration/review-decisions"
import type { ReconstructionUrlUniverse } from "../migration/url-universe"

function unexpectedState(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function capturedUrlUniverse(
  candidates: RecoveryProductCandidate[]
): ReconstructionUrlUniverse {
  const urls = [
    ...new Set(
      candidates
        .map((candidate) => candidate.selected.sourceId?.trim())
        .filter((url): url is string => Boolean(url))
    ),
  ].sort()

  return {
    entries: urls.map((url) => ({
      url,
      status: "captured" as const,
      canonicalUrl: url,
      evidence: [
        {
          source: "direct_capture" as const,
          observedAt: "2026-08-27T07:00:00.000Z",
          captureStatus: "captured",
          httpStatus: 200,
          pageType: "product",
          checksum: `ci-${Buffer.from(url).toString("base64url").slice(0, 24)}`,
        },
      ],
    })),
    totals: {
      captured: urls.length,
      skipped: 0,
      error: 0,
      indexed_only: 0,
      unavailable: 0,
    },
    unresolved: 0,
    isFullyClassified: true,
  }
}

function automaticTestDecisions(input: {
  candidates: RecoveryProductCandidate[]
  productPlan: ReturnType<typeof buildProductImportPlan>
}) {
  const reviewPlan = buildReconstructionReviewPlan(input)
  const decisions: ReviewDecision[] = []

  for (const item of reviewPlan.items) {
    if (item.issueType !== "localization_pairing_missing") {
      throw unexpectedState(
        `CI staging migration fixture has unexpected unresolved review item ${item.reviewKey} (${item.issueType})`
      )
    }
    decisions.push({
      reviewKey: item.reviewKey,
      evidenceChecksum: item.evidenceChecksum,
      action: "mark_unavailable",
      decidedBy: "coquette-ci",
      decidedAt: "2026-08-27T07:01:00.000Z",
      rationale:
        "Synthetic CI fixture intentionally has no alternate-locale legacy PDP.",
    })
  }

  return decisions
}

export function buildReadyStagingMigrationInputFixture(input: {
  candidates: RecoveryProductCandidate[]
  captureId?: string
}): MigrationInputReconciliation {
  const productPlan = buildProductImportPlan(input.candidates)
  const report: CaptureIngestionReportForReconciliation = {
    schemaVersion: 3,
    generatedAt: "2026-08-27T07:02:00.000Z",
    capture: {
      captureId: input.captureId ?? "coquette-ci-reconciled-staging-input",
      source: "https://coquetteconcept.gr/",
      startedAt: "2026-08-27T07:00:00.000Z",
      completedAt: "2026-08-27T07:02:00.000Z",
      declaredComplete: true,
      validation: { isValid: true },
      evidencePackage: {
        isValid: true,
        packageChecksum: "c".repeat(64),
        provenanceMode: "operator_local_browser",
        transport: "browser",
        browserMode: "headed",
        codeRevision: "ci-synthetic-fixture",
        files: 6,
        bytes: 4096,
      },
    },
    candidates: { records: input.candidates },
    importPlan: productPlan,
    urlUniverse: capturedUrlUniverse(input.candidates),
  }
  const decisions = automaticTestDecisions({
    candidates: input.candidates,
    productPlan,
  })
  const bundle = buildMigrationInputReconciliation({
    report,
    decisions,
    generatedAt: "2026-08-27T07:03:00.000Z",
  })

  if (!bundle.isReadyForStagingExecution) {
    throw unexpectedState(
      `CI staging migration fixture did not reconcile: ${bundle.globalBlockers.join(", ")}`
    )
  }
  return bundle
}
