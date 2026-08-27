import assert from "node:assert/strict"
import { buildProductImportPlan } from "../migration/import-plan"
import { applyReconstructionReviewDecisions } from "../migration/review-application"
import {
  buildReconstructionReviewPlan,
  type ReviewDecision,
} from "../migration/review-decisions"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"

const sourceUrl =
  "https://coquetteconcept.gr/default/review-application-fixture.html"
const categorySourceUrl =
  "https://coquetteconcept.gr/default/clothing/review-application-fixture.html"
const mediaSourceUrl =
  "https://coquetteconcept.gr/media/catalog/product/review-application-fixture.jpg"

function observation(
  overrides: Partial<RecoveryProductObservation["fields"]> = {},
  observedAt = "2026-08-27T10:00:00.000Z"
): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt,
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku: "REVIEW-APPLY-1",
      name: "Review Application Fixture",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      categorySourceIds: [categorySourceUrl],
      optionValues: { size: "S" },
      mediaSourceIds: [mediaSourceUrl],
      regularPrice: 120,
      currencyCode: "EUR",
      ...overrides,
    },
  }
}

function fixture(observations: RecoveryProductObservation[]) {
  const candidate = buildRecoveryProductCandidate(
    "review-application-fixture",
    observations
  )
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
    decidedAt: "2026-08-27T10:30:00.000Z",
    rationale: "CI review application contract",
    ...overrides,
  }
}

const conflictFixture = fixture([
  observation({ status: "enabled" }, "2026-08-27T10:00:00.000Z"),
  observation({ status: "disabled" }, "2026-08-27T10:05:00.000Z"),
])
assert.equal(conflictFixture.candidate.disposition, "needs_review")
assert.equal(conflictFixture.productPlan.totals.blocked, 1)

const conflictReview = buildReconstructionReviewPlan({
  candidates: conflictFixture.candidates,
  productPlan: conflictFixture.productPlan,
})
const statusItem = conflictReview.items.find(
  (item) => item.issueType === "structural_conflict" && item.field === "status"
)
assert.ok(statusItem)
const enabledChoice = statusItem.observationChoices.find(
  (choice) => choice.value === "enabled"
)
assert.ok(enabledChoice)

const evidenceSelectionDecision = decisionFor(
  statusItem.reviewKey,
  statusItem.evidenceChecksum,
  {
    action: "select_observed_value",
    selectedObservationChecksum: enabledChoice.observationChecksum,
    rationale: "Select the directly observed enabled state.",
  }
)

const appliedSelection = applyReconstructionReviewDecisions({
  candidates: conflictFixture.candidates,
  productPlan: conflictFixture.productPlan,
  decisions: [evidenceSelectionDecision],
})
assert.equal(appliedSelection.isReconciled, true)
assert.equal(appliedSelection.isExecutable, false)
assert.equal(appliedSelection.appliedEvidenceSelectionCount, 1)
assert.equal(appliedSelection.globalBlockers.length, 0)
assert.equal(appliedSelection.candidates[0].disposition, "ready")
assert.equal(appliedSelection.candidates[0].selected.status, "enabled")
assert.ok(appliedSelection.candidates[0].normalizedProduct)
assert.equal(appliedSelection.candidates[0].reviewDecisionAudit.length, 1)
assert.equal(
  appliedSelection.candidates[0].reviewDecisionAudit[0].reviewKey,
  statusItem.reviewKey
)
assert.equal(
  appliedSelection.candidates[0].reviewDecisionAudit[0]
    .selectedObservationChecksum,
  enabledChoice.observationChecksum
)
assert.equal(appliedSelection.resultingProductPlan.totals.ready, 1)
assert.equal(appliedSelection.resultingProductPlan.totals.blocked, 0)
assert.equal(appliedSelection.resultingProductPlan.isExecutable, true)
assert.notEqual(
  appliedSelection.resultingProductPlan.entries[0].planningChecksum,
  conflictFixture.productPlan.entries[0].planningChecksum
)
assert.ok(appliedSelection.resultingProductPlan.entries[0].sourceChecksum)

const staleApplication = applyReconstructionReviewDecisions({
  candidates: conflictFixture.candidates,
  productPlan: conflictFixture.productPlan,
  decisions: [
    decisionFor(statusItem.reviewKey, "stale-evidence-checksum", {
      action: "select_observed_value",
      selectedObservationChecksum: enabledChoice.observationChecksum,
    }),
  ],
})
assert.equal(staleApplication.isReconciled, false)
assert.equal(staleApplication.appliedEvidenceSelectionCount, 0)
assert.deepEqual(staleApplication.globalBlockers, [
  "review_decision_plan_not_reconciled",
])
assert.equal(staleApplication.candidates[0].disposition, "needs_review")
assert.equal(staleApplication.candidates[0].reviewDecisionAudit.length, 0)
assert.equal(staleApplication.resultingProductPlan.totals.blocked, 1)

const missingVisibilityFixture = fixture([
  observation({ visibility: undefined }),
])
const missingVisibilityReview = buildReconstructionReviewPlan({
  candidates: missingVisibilityFixture.candidates,
  productPlan: missingVisibilityFixture.productPlan,
})
const visibilityItem = missingVisibilityReview.items.find(
  (item) => item.issueType === "missing_required_field" && item.field === "visibility"
)
assert.ok(visibilityItem)
const policyOnlyDecision = decisionFor(
  visibilityItem.reviewKey,
  visibilityItem.evidenceChecksum,
  {
    action: "record_target_policy",
    targetValue: "catalog_search",
    rationale:
      "Set a future COQUETTE target policy without claiming recovered Magento visibility.",
  }
)
const policyOnlyApplication = applyReconstructionReviewDecisions({
  candidates: missingVisibilityFixture.candidates,
  productPlan: missingVisibilityFixture.productPlan,
  decisions: [policyOnlyDecision],
})
assert.equal(policyOnlyApplication.isReconciled, true)
assert.equal(policyOnlyApplication.appliedEvidenceSelectionCount, 0)
assert.ok(
  policyOnlyApplication.skippedNonEvidenceDecisionKeys.includes(
    visibilityItem.reviewKey
  )
)
assert.equal(policyOnlyApplication.candidates[0].selected.visibility, undefined)
assert.equal(policyOnlyApplication.candidates[0].normalizedProduct, undefined)
assert.equal(policyOnlyApplication.candidates[0].disposition, "needs_review")
assert.equal(policyOnlyApplication.resultingProductPlan.totals.blocked, 1)
assert.equal(policyOnlyApplication.resultingProductPlan.isExecutable, false)

const localizationFixture = fixture([observation()])
const localizationReview = buildReconstructionReviewPlan({
  candidates: localizationFixture.candidates,
  productPlan: localizationFixture.productPlan,
})
const localizationItem = localizationReview.items.find(
  (item) => item.issueType === "localization_pairing_missing"
)
assert.ok(localizationItem)
const unavailableLocalizationDecision = decisionFor(
  localizationItem.reviewKey,
  localizationItem.evidenceChecksum,
  {
    action: "mark_unavailable",
    rationale: "No alternate locale URL is recoverable.",
  }
)
const localizationApplication = applyReconstructionReviewDecisions({
  candidates: localizationFixture.candidates,
  productPlan: localizationFixture.productPlan,
  decisions: [unavailableLocalizationDecision],
})
assert.equal(localizationApplication.isReconciled, true)
assert.equal(localizationApplication.appliedEvidenceSelectionCount, 0)
assert.equal(
  localizationApplication.candidates[0].selected.alternateLocaleUrl,
  undefined
)
assert.ok(
  localizationApplication.skippedNonEvidenceDecisionKeys.includes(
    localizationItem.reviewKey
  )
)
assert.equal(localizationApplication.resultingProductPlan.totals.ready, 1)
assert.equal(localizationApplication.resultingProductPlan.isExecutable, true)

const configurableFixture = fixture([
  observation({ type: "configurable", optionValues: {} }),
])
assert.equal(configurableFixture.candidate.disposition, "ready")
assert.equal(configurableFixture.productPlan.totals.blocked, 1)
const configurableReview = buildReconstructionReviewPlan({
  candidates: configurableFixture.candidates,
  productPlan: configurableFixture.productPlan,
})
const configurableItem = configurableReview.items.find(
  (item) => item.issueType === "configurable_variant_structure"
)
assert.ok(configurableItem)
const deferConfigurableDecision = decisionFor(
  configurableItem.reviewKey,
  configurableItem.evidenceChecksum,
  {
    action: "defer",
    rationale: "Child variant identities remain unavailable.",
  }
)
const configurableApplication = applyReconstructionReviewDecisions({
  candidates: configurableFixture.candidates,
  productPlan: configurableFixture.productPlan,
  decisions: [deferConfigurableDecision],
})
assert.equal(configurableApplication.isReconciled, true)
assert.equal(configurableApplication.appliedEvidenceSelectionCount, 0)
assert.equal(configurableApplication.candidates[0].selected.type, "configurable")
assert.equal(configurableApplication.resultingProductPlan.totals.blocked, 1)
assert.equal(configurableApplication.resultingProductPlan.isExecutable, false)
assert.ok(
  configurableApplication.skippedNonEvidenceDecisionKeys.includes(
    configurableItem.reviewKey
  )
)

const priceConflictFixture = fixture([
  observation({ regularPrice: 120 }),
  observation({ regularPrice: 125 }, "2026-08-27T10:05:00.000Z"),
])
assert.equal(priceConflictFixture.candidate.disposition, "ready")
assert.ok(
  priceConflictFixture.candidate.conflicts.some(
    (conflict) => conflict.field === "regularPrice"
  )
)
const priceConflictApplication = applyReconstructionReviewDecisions({
  candidates: priceConflictFixture.candidates,
  productPlan: priceConflictFixture.productPlan,
  decisions: [],
})
assert.equal(priceConflictApplication.isReconciled, true)
assert.equal(priceConflictApplication.candidates[0].disposition, "ready")
assert.ok(
  priceConflictApplication.candidates[0].conflicts.some(
    (conflict) => conflict.field === "regularPrice"
  )
)
assert.equal(priceConflictApplication.resultingProductPlan.totals.ready, 1)

console.log(
  "COQUETTE review evidence-selection application contract passed with policy/defer/no-invention boundaries preserved"
)
