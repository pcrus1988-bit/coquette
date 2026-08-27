import assert from "node:assert/strict"
import { buildProductImportPlan } from "../migration/import-plan"
import {
  buildReconstructionReviewPlan,
  type ReviewDecision,
} from "../migration/review-decisions"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"

const sourceUrl = "https://coquetteconcept.gr/default/review-fixture.html"
const categorySourceUrl =
  "https://coquetteconcept.gr/default/clothing/review-fixture.html"
const mediaSourceUrl =
  "https://coquetteconcept.gr/media/catalog/product/review-fixture.jpg"

function observation(
  overrides: Partial<RecoveryProductObservation["fields"]> = {},
  observedAt = "2026-08-27T09:00:00.000Z"
): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt,
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku: "REVIEW-1",
      name: "Review Decision Fixture",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      categorySourceIds: [categorySourceUrl],
      optionValues: { size: "S" },
      mediaSourceIds: [mediaSourceUrl],
      ...overrides,
    },
  }
}

function build(observations: RecoveryProductObservation[]) {
  const candidate = buildRecoveryProductCandidate("review-fixture", observations)
  const candidates = [candidate]
  const productPlan = buildProductImportPlan(candidates)
  return { candidate, candidates, productPlan }
}

function decisionFor(
  reviewKey: string,
  evidenceChecksum: string,
  overrides: Partial<ReviewDecision> = {}
): ReviewDecision {
  return {
    reviewKey,
    evidenceChecksum,
    action: "defer",
    decidedBy: "ci-reviewer",
    decidedAt: "2026-08-27T09:30:00.000Z",
    rationale: "CI review decision contract",
    ...overrides,
  }
}

const statusConflictFixture = build([
  observation({ status: "enabled" }, "2026-08-27T09:00:00.000Z"),
  observation({ status: "disabled" }, "2026-08-27T09:05:00.000Z"),
])
assert.equal(statusConflictFixture.candidate.disposition, "needs_review")
assert.equal(statusConflictFixture.productPlan.totals.blocked, 1)

const openPlan = buildReconstructionReviewPlan({
  candidates: statusConflictFixture.candidates,
  productPlan: statusConflictFixture.productPlan,
})
assert.equal(openPlan.isExecutable, false)
assert.equal(openPlan.isReconciled, true)
assert.ok(openPlan.totals.open >= 2)

const statusItem = openPlan.items.find(
  (item) => item.issueType === "structural_conflict" && item.field === "status"
)
assert.ok(statusItem)
assert.equal(statusItem.domain, "publication_visibility")
assert.equal(statusItem.recoveryCanBeUnblockedByDecision, true)
assert.equal(statusItem.observationChoices.length, 2)

const enabledChoice = statusItem.observationChoices.find(
  (choice) => choice.value === "enabled"
)
assert.ok(enabledChoice)

const selectedObservedValue = buildReconstructionReviewPlan({
  candidates: statusConflictFixture.candidates,
  productPlan: statusConflictFixture.productPlan,
  decisions: [
    decisionFor(statusItem.reviewKey, statusItem.evidenceChecksum, {
      action: "select_observed_value",
      selectedObservationChecksum: enabledChoice.observationChecksum,
      rationale: "Choose the directly observed enabled state after review.",
    }),
  ],
})
const selectedStatusItem = selectedObservedValue.items.find(
  (item) => item.reviewKey === statusItem.reviewKey
)
assert.equal(selectedStatusItem?.state, "decided")
assert.equal(selectedStatusItem?.effect, "evidence_selection")
assert.equal(selectedObservedValue.isExecutable, false)
assert.equal(statusConflictFixture.productPlan.totals.blocked, 1)

const staleDecision = buildReconstructionReviewPlan({
  candidates: statusConflictFixture.candidates,
  productPlan: statusConflictFixture.productPlan,
  decisions: [
    decisionFor(statusItem.reviewKey, "stale-checksum", {
      action: "select_observed_value",
      selectedObservationChecksum: enabledChoice.observationChecksum,
    }),
  ],
})
assert.equal(
  staleDecision.items.find((item) => item.reviewKey === statusItem.reviewKey)
    ?.state,
  "invalid"
)
assert.ok(
  staleDecision.items
    .find((item) => item.reviewKey === statusItem.reviewKey)
    ?.errors.includes("stale_review_evidence_checksum")
)

const inventedSelection = buildReconstructionReviewPlan({
  candidates: statusConflictFixture.candidates,
  productPlan: statusConflictFixture.productPlan,
  decisions: [
    decisionFor(statusItem.reviewKey, statusItem.evidenceChecksum, {
      action: "select_observed_value",
      selectedObservationChecksum: "invented-observation",
    }),
  ],
})
assert.ok(
  inventedSelection.items
    .find((item) => item.reviewKey === statusItem.reviewKey)
    ?.errors.includes("selected_observation_not_in_review_evidence")
)

const missingVisibilityFixture = build([
  observation({ visibility: undefined }),
])
assert.ok(
  missingVisibilityFixture.candidate.missingRequiredFields.includes("visibility")
)
const missingVisibilityPlan = buildReconstructionReviewPlan({
  candidates: missingVisibilityFixture.candidates,
  productPlan: missingVisibilityFixture.productPlan,
})
const visibilityItem = missingVisibilityPlan.items.find(
  (item) => item.issueType === "missing_required_field" && item.field === "visibility"
)
assert.ok(visibilityItem)
assert.equal(visibilityItem.recoveryCanBeUnblockedByDecision, false)
assert.ok(visibilityItem.allowedActions.includes("record_target_policy"))

const publicationPolicy = buildReconstructionReviewPlan({
  candidates: missingVisibilityFixture.candidates,
  productPlan: missingVisibilityFixture.productPlan,
  decisions: [
    decisionFor(visibilityItem.reviewKey, visibilityItem.evidenceChecksum, {
      action: "record_target_policy",
      targetValue: "catalog_search",
      rationale:
        "Target publication policy only; this does not claim the legacy visibility was recovered.",
    }),
  ],
})
const publicationPolicyItem = publicationPolicy.items.find(
  (item) => item.reviewKey === visibilityItem.reviewKey
)
assert.equal(publicationPolicyItem?.state, "decided")
assert.equal(publicationPolicyItem?.effect, "policy_only")
assert.equal(missingVisibilityFixture.candidate.normalizedProduct, undefined)
assert.equal(missingVisibilityFixture.productPlan.totals.blocked, 1)

const invalidPublicationPolicy = buildReconstructionReviewPlan({
  candidates: missingVisibilityFixture.candidates,
  productPlan: missingVisibilityFixture.productPlan,
  decisions: [
    decisionFor(visibilityItem.reviewKey, visibilityItem.evidenceChecksum, {
      action: "record_target_policy",
      targetValue: "invented_visibility",
    }),
  ],
})
assert.ok(
  invalidPublicationPolicy.items
    .find((item) => item.reviewKey === visibilityItem.reviewKey)
    ?.errors.includes("invalid_publication_target_policy")
)

const localizationFixture = build([observation()])
const localizationPlan = buildReconstructionReviewPlan({
  candidates: localizationFixture.candidates,
  productPlan: localizationFixture.productPlan,
})
const localizationItem = localizationPlan.items.find(
  (item) => item.issueType === "localization_pairing_missing"
)
assert.ok(localizationItem)
assert.equal(localizationItem.domain, "localization")

const unavailableLocalization = buildReconstructionReviewPlan({
  candidates: localizationFixture.candidates,
  productPlan: localizationFixture.productPlan,
  decisions: [
    decisionFor(localizationItem.reviewKey, localizationItem.evidenceChecksum, {
      action: "mark_unavailable",
      rationale: "No alternate-locale URL is recoverable from the current public evidence.",
    }),
  ],
})
assert.equal(
  unavailableLocalization.items.find(
    (item) => item.reviewKey === localizationItem.reviewKey
  )?.effect,
  "unavailable"
)

const configurableFixture = build([
  observation({ type: "configurable", optionValues: {} }),
])
assert.equal(configurableFixture.candidate.disposition, "ready")
assert.equal(configurableFixture.productPlan.totals.blocked, 1)
const configurablePlan = buildReconstructionReviewPlan({
  candidates: configurableFixture.candidates,
  productPlan: configurableFixture.productPlan,
})
const configurableItem = configurablePlan.items.find(
  (item) => item.issueType === "configurable_variant_structure"
)
assert.ok(configurableItem)
assert.equal(configurableItem.domain, "variant_identity")
assert.deepEqual(configurableItem.allowedActions, ["defer"])
assert.equal(configurableItem.recoveryCanBeUnblockedByDecision, false)

const cannotInventVariantDecision = buildReconstructionReviewPlan({
  candidates: configurableFixture.candidates,
  productPlan: configurableFixture.productPlan,
  decisions: [
    decisionFor(configurableItem.reviewKey, configurableItem.evidenceChecksum, {
      action: "record_target_policy",
      targetValue: "simple",
    }),
  ],
})
assert.ok(
  cannotInventVariantDecision.items
    .find((item) => item.reviewKey === configurableItem.reviewKey)
    ?.errors.includes("review_action_not_allowed")
)

const duplicatedDecision = decisionFor(
  localizationItem.reviewKey,
  localizationItem.evidenceChecksum,
  { action: "mark_unavailable" }
)
const duplicateDecisionPlan = buildReconstructionReviewPlan({
  candidates: localizationFixture.candidates,
  productPlan: localizationFixture.productPlan,
  decisions: [duplicatedDecision, duplicatedDecision],
})
assert.deepEqual(duplicateDecisionPlan.duplicateDecisionKeys, [
  localizationItem.reviewKey,
])
assert.equal(duplicateDecisionPlan.isReconciled, false)
assert.equal(
  duplicateDecisionPlan.items.find(
    (item) => item.reviewKey === localizationItem.reviewKey
  )?.state,
  "invalid"
)

const orphanDecisionPlan = buildReconstructionReviewPlan({
  candidates: localizationFixture.candidates,
  productPlan: localizationFixture.productPlan,
  decisions: [
    decisionFor("missing-review-key", "missing-checksum", {
      action: "defer",
    }),
  ],
})
assert.deepEqual(orphanDecisionPlan.orphanDecisionKeys, ["missing-review-key"])
assert.equal(orphanDecisionPlan.isReconciled, false)

console.log(
  "COQUETTE reconstruction review decision contract passed with stale-evidence and no-invention safeguards"
)
