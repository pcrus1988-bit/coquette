import { sourceChecksum } from "./checksum"
import { buildProductImportPlan, type ProductImportPlan } from "./import-plan"
import {
  buildReconstructionReviewPlan,
  type ReviewDecision,
} from "./review-decisions"
import type {
  RecoveryProductCandidate,
  RecoveryProductFields,
} from "./recovery-candidates"
import type { NormalizedStorefrontProduct } from "./types"

export type AppliedReviewDecisionAudit = {
  reviewKey: string
  evidenceChecksum: string
  field: string
  selectedObservationChecksum: string
  selectedValueChecksum: string
  decidedBy: string
  decidedAt: string
  rationale: string
}

export type ReviewedRecoveryProductCandidate = RecoveryProductCandidate & {
  reviewDecisionAudit: AppliedReviewDecisionAudit[]
}

export type ReconstructionReviewApplication = {
  schemaVersion: 1
  candidates: ReviewedRecoveryProductCandidate[]
  resultingProductPlan: ProductImportPlan
  appliedEvidenceSelectionCount: number
  skippedNonEvidenceDecisionKeys: string[]
  globalBlockers: string[]
  isReconciled: boolean
  isExecutable: false
}

const nonStructuralConflictFields = new Set([
  "regularPrice",
  "salePrice",
  "currencyCode",
  "stockState",
  "lowStockMessage",
])

function capturedAt(candidate: RecoveryProductCandidate) {
  return candidate.evidence
    .map((entry) => entry.capturedAt)
    .filter((value) => value !== "unknown" && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0]
}

function reviewedCandidate(
  candidate: RecoveryProductCandidate,
  selections: ReturnType<typeof buildReconstructionReviewPlan>["items"]
): ReviewedRecoveryProductCandidate {
  const selected: RecoveryProductFields = { ...candidate.selected }
  let conflicts = [...candidate.conflicts]
  let blockers = [...candidate.blockers]
  const reviewDecisionAudit: AppliedReviewDecisionAudit[] = []

  for (const item of selections) {
    if (
      item.candidateKey !== candidate.candidateKey ||
      item.state !== "decided" ||
      item.effect !== "evidence_selection" ||
      item.decision?.action !== "select_observed_value" ||
      !item.field ||
      !item.decision.selectedObservationChecksum
    ) {
      continue
    }

    const choice = item.observationChoices.find(
      (observation) =>
        observation.observationChecksum ===
        item.decision?.selectedObservationChecksum
    )
    if (!choice) continue

    ;(selected as Record<string, unknown>)[item.field] = choice.value
    conflicts = conflicts.filter((conflict) => conflict.field !== item.field)

    if (item.field === "type" && choice.value !== "unknown") {
      blockers = blockers.filter(
        (blocker) => blocker !== "product_type_requires_mapping"
      )
    }

    reviewDecisionAudit.push({
      reviewKey: item.reviewKey,
      evidenceChecksum: item.evidenceChecksum,
      field: item.field,
      selectedObservationChecksum: choice.observationChecksum,
      selectedValueChecksum: sourceChecksum(choice.value),
      decidedBy: item.decision.decidedBy,
      decidedAt: item.decision.decidedAt,
      rationale: item.decision.rationale,
    })
  }

  const structuralConflicts = conflicts.filter(
    (conflict) => !nonStructuralConflictFields.has(conflict.field)
  )
  const disposition =
    candidate.disposition === "rejected"
      ? "rejected"
      : candidate.missingRequiredFields.length > 0 ||
          blockers.length > 0 ||
          structuralConflicts.length > 0
        ? "needs_review"
        : "ready"

  const normalizedProduct =
    disposition === "ready"
      ? ({
          ...selected,
          evidence: candidate.evidence,
          capturedAt: capturedAt(candidate),
        } as NormalizedStorefrontProduct)
      : undefined

  return {
    ...candidate,
    disposition,
    selected,
    normalizedProduct,
    blockers,
    conflicts,
    reviewDecisionAudit,
  }
}

export function applyReconstructionReviewDecisions(input: {
  candidates: RecoveryProductCandidate[]
  productPlan: ProductImportPlan
  decisions: ReviewDecision[]
}): ReconstructionReviewApplication {
  const reviewPlan = buildReconstructionReviewPlan(input)
  const skippedNonEvidenceDecisionKeys = reviewPlan.items
    .filter(
      (item) =>
        item.decision &&
        !(item.state === "decided" && item.effect === "evidence_selection")
    )
    .map((item) => item.reviewKey)
    .sort()

  if (!reviewPlan.isReconciled) {
    const candidates = input.candidates.map((candidate) => ({
      ...candidate,
      reviewDecisionAudit: [],
    }))
    return {
      schemaVersion: 1,
      candidates,
      resultingProductPlan: input.productPlan,
      appliedEvidenceSelectionCount: 0,
      skippedNonEvidenceDecisionKeys,
      globalBlockers: ["review_decision_plan_not_reconciled"],
      isReconciled: false,
      isExecutable: false,
    }
  }

  const candidates = input.candidates.map((candidate) =>
    reviewedCandidate(candidate, reviewPlan.items)
  )
  const resultingProductPlan = buildProductImportPlan(candidates)
  const appliedEvidenceSelectionCount = candidates.reduce(
    (total, candidate) => total + candidate.reviewDecisionAudit.length,
    0
  )

  return {
    schemaVersion: 1,
    candidates,
    resultingProductPlan,
    appliedEvidenceSelectionCount,
    skippedNonEvidenceDecisionKeys,
    globalBlockers: [],
    isReconciled: true,
    isExecutable: false,
  }
}
