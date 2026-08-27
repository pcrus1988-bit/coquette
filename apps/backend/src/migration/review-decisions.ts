import { sourceChecksum } from "./checksum"
import type { ProductImportPlan, ProductImportPlanEntry } from "./import-plan"
import type {
  RecoveryCandidateConflict,
  RecoveryConflictObservation,
  RecoveryProductCandidate,
} from "./recovery-candidates"

export const reviewDomains = [
  "publication_visibility",
  "localization",
  "variant_identity",
  "structural_evidence",
] as const
export type ReviewDomain = (typeof reviewDomains)[number]

export const reviewIssueTypes = [
  "structural_conflict",
  "missing_required_field",
  "localization_pairing_missing",
  "unknown_product_type",
  "configurable_variant_structure",
  "duplicate_product_identity",
  "structural_blocker",
] as const
export type ReviewIssueType = (typeof reviewIssueTypes)[number]

export const reviewActions = [
  "select_observed_value",
  "record_target_policy",
  "mark_unavailable",
  "defer",
] as const
export type ReviewAction = (typeof reviewActions)[number]

export type ReviewObservationChoice = {
  observationChecksum: string
  authority: RecoveryConflictObservation["authority"]
  sourceUrl: string
  observedAt?: string
  value: unknown
}

export type ReviewItem = {
  reviewKey: string
  candidateKey: string
  domain: ReviewDomain
  issueType: ReviewIssueType
  field?: string
  message: string
  evidenceChecksum: string
  allowedActions: ReviewAction[]
  observationChoices: ReviewObservationChoice[]
  recoveryCanBeUnblockedByDecision: boolean
}

export type ReviewDecision = {
  reviewKey: string
  evidenceChecksum: string
  action: ReviewAction
  decidedBy: string
  decidedAt: string
  rationale: string
  selectedObservationChecksum?: string
  targetValue?: string
}

export type ReviewDecisionState =
  | "open"
  | "decided"
  | "deferred"
  | "invalid"

export type EvaluatedReviewItem = ReviewItem & {
  state: ReviewDecisionState
  effect?: "evidence_selection" | "policy_only" | "unavailable" | "deferred"
  decision?: ReviewDecision
  errors: string[]
}

export type ReconstructionReviewPlan = {
  schemaVersion: 1
  items: EvaluatedReviewItem[]
  totals: Record<ReviewDecisionState, number>
  duplicateReviewKeys: string[]
  duplicateDecisionKeys: string[]
  orphanDecisionKeys: string[]
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

const publicationFields = new Set(["status", "visibility"])
const variantIdentityFields = new Set(["sku", "type", "optionValues"])

function duplicateValues(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort()
}

function reviewDomainForField(field?: string): ReviewDomain {
  if (field && publicationFields.has(field)) return "publication_visibility"
  if (field === "alternateLocaleUrl") return "localization"
  if (field && variantIdentityFields.has(field)) return "variant_identity"
  return "structural_evidence"
}

function candidateReviewChecksum(candidate: RecoveryProductCandidate) {
  return sourceChecksum({
    candidateKey: candidate.candidateKey,
    disposition: candidate.disposition,
    selected: candidate.selected,
    missingRequiredFields: candidate.missingRequiredFields,
    blockers: candidate.blockers,
    conflicts: candidate.conflicts,
    evidence: candidate.evidence,
  })
}

function observationChoice(
  field: string,
  observation: RecoveryConflictObservation
): ReviewObservationChoice {
  return {
    observationChecksum: sourceChecksum({
      field,
      authority: observation.authority,
      sourceUrl: observation.sourceUrl,
      observedAt: observation.observedAt,
      value: observation.value,
    }),
    authority: observation.authority,
    sourceUrl: observation.sourceUrl,
    observedAt: observation.observedAt,
    value: observation.value,
  }
}

function itemChecksum(
  candidateChecksum: string,
  issueType: ReviewIssueType,
  field: string | undefined,
  payload: unknown
) {
  return sourceChecksum({
    candidateChecksum,
    issueType,
    field,
    payload,
  })
}

function conflictReviewItem(
  candidate: RecoveryProductCandidate,
  conflict: RecoveryCandidateConflict
): ReviewItem {
  const field = conflict.field
  const choices = conflict.observations.map((observation) =>
    observationChoice(field, observation)
  )
  const allowedActions: ReviewAction[] = ["select_observed_value", "defer"]
  if (field === "alternateLocaleUrl") allowedActions.splice(1, 0, "mark_unavailable")

  return {
    reviewKey: `${candidate.candidateKey}|conflict|${field}`,
    candidateKey: candidate.candidateKey,
    domain: reviewDomainForField(field),
    issueType: "structural_conflict",
    field,
    message: conflict.message,
    evidenceChecksum: itemChecksum(
      candidateReviewChecksum(candidate),
      "structural_conflict",
      field,
      conflict
    ),
    allowedActions,
    observationChoices: choices,
    recoveryCanBeUnblockedByDecision: true,
  }
}

function missingFieldReviewItem(
  candidate: RecoveryProductCandidate,
  field: string
): ReviewItem {
  const publication = publicationFields.has(field)
  return {
    reviewKey: `${candidate.candidateKey}|missing|${field}`,
    candidateKey: candidate.candidateKey,
    domain: reviewDomainForField(field),
    issueType: "missing_required_field",
    field,
    message: `Required reconstruction field ${field} is not recoverable from current evidence.`,
    evidenceChecksum: itemChecksum(
      candidateReviewChecksum(candidate),
      "missing_required_field",
      field,
      { missing: true }
    ),
    allowedActions: publication
      ? ["record_target_policy", "defer"]
      : ["defer"],
    observationChoices: [],
    recoveryCanBeUnblockedByDecision: false,
  }
}

function localizationReviewItem(candidate: RecoveryProductCandidate): ReviewItem {
  return {
    reviewKey: `${candidate.candidateKey}|localization|alternateLocaleUrl`,
    candidateKey: candidate.candidateKey,
    domain: "localization",
    issueType: "localization_pairing_missing",
    field: "alternateLocaleUrl",
    message:
      "No alternate-locale product URL is recoverable from current evidence; record it unavailable or defer pairing.",
    evidenceChecksum: itemChecksum(
      candidateReviewChecksum(candidate),
      "localization_pairing_missing",
      "alternateLocaleUrl",
      { alternateLocaleUrl: undefined }
    ),
    allowedActions: ["mark_unavailable", "defer"],
    observationChoices: [],
    recoveryCanBeUnblockedByDecision: false,
  }
}

function blockerReviewItem(
  candidate: RecoveryProductCandidate,
  blocker: string
): ReviewItem {
  const unknownType = blocker === "product_type_requires_mapping"
  return {
    reviewKey: `${candidate.candidateKey}|blocker|${blocker}`,
    candidateKey: candidate.candidateKey,
    domain: unknownType ? "variant_identity" : "structural_evidence",
    issueType: unknownType ? "unknown_product_type" : "structural_blocker",
    field: unknownType ? "type" : undefined,
    message: `Recovery blocker requires explicit evidence/review: ${blocker}.`,
    evidenceChecksum: itemChecksum(
      candidateReviewChecksum(candidate),
      unknownType ? "unknown_product_type" : "structural_blocker",
      unknownType ? "type" : undefined,
      { blocker }
    ),
    allowedActions: ["defer"],
    observationChoices: [],
    recoveryCanBeUnblockedByDecision: false,
  }
}

function productPlanReviewItems(
  entry: ProductImportPlanEntry,
  candidateChecksum: string
): ReviewItem[] {
  const items: ReviewItem[] = []

  for (const issue of entry.validationIssues) {
    if (
      issue.field === "type" &&
      issue.message.includes("Configurable products cannot be imported automatically")
    ) {
      items.push({
        reviewKey: `${entry.candidateKey}|variant|configurable-children`,
        candidateKey: entry.candidateKey,
        domain: "variant_identity",
        issueType: "configurable_variant_structure",
        field: "type",
        message: issue.message,
        evidenceChecksum: itemChecksum(
          candidateChecksum,
          "configurable_variant_structure",
          "type",
          { sourceChecksum: entry.sourceChecksum, validation: issue.message }
        ),
        allowedActions: ["defer"],
        observationChoices: [],
        recoveryCanBeUnblockedByDecision: false,
      })
    }
  }

  for (const blocker of entry.blockers) {
    if (
      blocker === "duplicate_sku_requires_product_identity_resolution" ||
      blocker === "duplicate_source_key_requires_evidence_resolution" ||
      blocker === "duplicate_runtime_manifest_key"
    ) {
      items.push({
        reviewKey: `${entry.candidateKey}|identity|${blocker}`,
        candidateKey: entry.candidateKey,
        domain: "variant_identity",
        issueType: "duplicate_product_identity",
        field: blocker.includes("sku") ? "sku" : undefined,
        message: `Automatic import identity is ambiguous: ${blocker}.`,
        evidenceChecksum: itemChecksum(
          candidateChecksum,
          "duplicate_product_identity",
          blocker.includes("sku") ? "sku" : undefined,
          { blocker, planningChecksum: entry.planningChecksum }
        ),
        allowedActions: ["defer"],
        observationChoices: [],
        recoveryCanBeUnblockedByDecision: false,
      })
    }
  }

  return items
}

export function buildReconstructionReviewItems(
  candidates: RecoveryProductCandidate[],
  productPlan: ProductImportPlan
): ReviewItem[] {
  const candidateByKey = new Map(
    candidates.map((candidate) => [candidate.candidateKey, candidate])
  )
  const items: ReviewItem[] = []

  for (const candidate of candidates) {
    for (const conflict of candidate.conflicts) {
      if (!nonStructuralConflictFields.has(conflict.field)) {
        items.push(conflictReviewItem(candidate, conflict))
      }
    }
    for (const field of candidate.missingRequiredFields) {
      items.push(missingFieldReviewItem(candidate, field))
    }
    for (const blocker of candidate.blockers) {
      items.push(blockerReviewItem(candidate, blocker))
    }
    if (!candidate.selected.alternateLocaleUrl) {
      items.push(localizationReviewItem(candidate))
    }
  }

  for (const entry of productPlan.entries) {
    const candidate = candidateByKey.get(entry.candidateKey)
    if (!candidate) continue
    items.push(
      ...productPlanReviewItems(entry, candidateReviewChecksum(candidate))
    )
  }

  return items.sort((left, right) => left.reviewKey.localeCompare(right.reviewKey))
}

function validDecisionTimestamp(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed)
}

function validPublicationPolicy(field: string | undefined, value: string | undefined) {
  if (!field || !value) return false
  if (field === "status") return value === "enabled" || value === "disabled"
  if (field === "visibility") {
    return ["catalog_search", "catalog", "search", "not_visible"].includes(value)
  }
  return false
}

function evaluateDecision(
  item: ReviewItem,
  decision: ReviewDecision | undefined
): EvaluatedReviewItem {
  if (!decision) return { ...item, state: "open", errors: [] }

  const errors: string[] = []
  if (decision.evidenceChecksum !== item.evidenceChecksum) {
    errors.push("stale_review_evidence_checksum")
  }
  if (!item.allowedActions.includes(decision.action)) {
    errors.push("review_action_not_allowed")
  }
  if (!decision.decidedBy.trim()) errors.push("decided_by_required")
  if (!validDecisionTimestamp(decision.decidedAt)) {
    errors.push("valid_decided_at_required")
  }
  if (!decision.rationale.trim()) errors.push("decision_rationale_required")

  let effect: EvaluatedReviewItem["effect"]
  if (decision.action === "select_observed_value") {
    if (!decision.selectedObservationChecksum) {
      errors.push("selected_observation_checksum_required")
    } else if (
      !item.observationChoices.some(
        (choice) =>
          choice.observationChecksum === decision.selectedObservationChecksum
      )
    ) {
      errors.push("selected_observation_not_in_review_evidence")
    }
    effect = "evidence_selection"
  } else if (decision.action === "record_target_policy") {
    if (!validPublicationPolicy(item.field, decision.targetValue)) {
      errors.push("invalid_publication_target_policy")
    }
    effect = "policy_only"
  } else if (decision.action === "mark_unavailable") {
    if (item.domain !== "localization" || item.field !== "alternateLocaleUrl") {
      errors.push("mark_unavailable_only_allowed_for_localization_pairing")
    }
    effect = "unavailable"
  } else if (decision.action === "defer") {
    effect = "deferred"
  }

  if (errors.length > 0) {
    return { ...item, state: "invalid", decision, effect, errors }
  }
  if (decision.action === "defer") {
    return { ...item, state: "deferred", decision, effect, errors: [] }
  }
  return { ...item, state: "decided", decision, effect, errors: [] }
}

export function buildReconstructionReviewPlan(input: {
  candidates: RecoveryProductCandidate[]
  productPlan: ProductImportPlan
  decisions?: ReviewDecision[]
}): ReconstructionReviewPlan {
  const items = buildReconstructionReviewItems(input.candidates, input.productPlan)
  const decisions = input.decisions ?? []
  const duplicateReviewKeys = duplicateValues(items.map((item) => item.reviewKey))
  const duplicateDecisionKeys = duplicateValues(
    decisions.map((decision) => decision.reviewKey)
  )
  const itemKeys = new Set(items.map((item) => item.reviewKey))
  const orphanDecisionKeys = [...new Set(
    decisions
      .filter((decision) => !itemKeys.has(decision.reviewKey))
      .map((decision) => decision.reviewKey)
  )].sort()

  const decisionByKey = new Map<string, ReviewDecision>()
  for (const decision of decisions) {
    if (!decisionByKey.has(decision.reviewKey)) {
      decisionByKey.set(decision.reviewKey, decision)
    }
  }

  const evaluated = items.map((item) => {
    if (
      duplicateReviewKeys.includes(item.reviewKey) ||
      duplicateDecisionKeys.includes(item.reviewKey)
    ) {
      return {
        ...item,
        state: "invalid" as const,
        decision: decisionByKey.get(item.reviewKey),
        errors: [
          duplicateReviewKeys.includes(item.reviewKey)
            ? "duplicate_review_key"
            : "duplicate_decision_key",
        ],
      }
    }
    return evaluateDecision(item, decisionByKey.get(item.reviewKey))
  })

  const totals = Object.fromEntries(
    (["open", "decided", "deferred", "invalid"] as ReviewDecisionState[]).map(
      (state) => [state, evaluated.filter((item) => item.state === state).length]
    )
  ) as Record<ReviewDecisionState, number>

  return {
    schemaVersion: 1,
    items: evaluated,
    totals,
    duplicateReviewKeys,
    duplicateDecisionKeys,
    orphanDecisionKeys,
    isReconciled:
      totals.invalid === 0 &&
      duplicateReviewKeys.length === 0 &&
      duplicateDecisionKeys.length === 0 &&
      orphanDecisionKeys.length === 0,
    isExecutable: false,
  }
}
