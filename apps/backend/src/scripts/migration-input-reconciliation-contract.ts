import assert from "node:assert/strict"
import { buildProductImportPlan } from "../migration/import-plan"
import {
  buildMigrationInputReconciliation,
  verifyMigrationInputReconciliationBundle,
  type CaptureIngestionReportForReconciliation,
  type MigrationInputReconciliation,
} from "../migration/migration-input-reconciliation"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"
import {
  buildReconstructionReviewPlan,
  type ReviewDecision,
} from "../migration/review-decisions"
import type { ReconstructionUrlUniverse } from "../migration/url-universe"

const sourceUrl = "https://coquetteconcept.gr/default/phase-4n-contract.html"
const categorySourceUrl =
  "https://coquetteconcept.gr/default/clothing/phase-4n-contract.html"
const mediaSourceUrl =
  "https://coquetteconcept.gr/media/catalog/product/phase-4n-contract.jpg"

function observation(
  overrides: Partial<RecoveryProductObservation["fields"]> = {}
): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt: "2026-08-27T06:30:00.000Z",
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku: "PHASE-4N-1",
      name: "Phase 4N Reconciliation Fixture",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      categorySourceIds: [categorySourceUrl],
      optionValues: { size: "S" },
      mediaSourceIds: [mediaSourceUrl],
      stockState: "in_stock",
      regularPrice: 129,
      salePrice: 99,
      currencyCode: "EUR",
      ...overrides,
    },
  }
}

function classifiedUrlUniverse(): ReconstructionUrlUniverse {
  return {
    entries: [
      {
        url: sourceUrl,
        status: "captured",
        canonicalUrl: sourceUrl,
        evidence: [
          {
            source: "direct_capture",
            observedAt: "2026-08-27T06:30:00.000Z",
            captureStatus: "captured",
            httpStatus: 200,
            pageType: "product",
            checksum: "fixture-page-checksum",
          },
        ],
      },
    ],
    totals: {
      captured: 1,
      skipped: 0,
      error: 0,
      indexed_only: 0,
      unavailable: 0,
    },
    unresolved: 0,
    isFullyClassified: true,
  }
}

function fixture(
  fieldOverrides: Partial<RecoveryProductObservation["fields"]> = {}
) {
  const candidate = buildRecoveryProductCandidate("phase-4n-fixture", [
    observation(fieldOverrides),
  ])
  const importPlan = buildProductImportPlan([candidate])
  const report: CaptureIngestionReportForReconciliation = {
    schemaVersion: 3,
    generatedAt: "2026-08-27T06:31:00.000Z",
    capture: {
      captureId: "phase-4n-contract-capture",
      source: "operator-browser",
      startedAt: "2026-08-27T06:29:00.000Z",
      completedAt: "2026-08-27T06:31:00.000Z",
      declaredComplete: true,
      validation: { isValid: true },
    },
    candidates: {
      records: [candidate],
    },
    importPlan,
    urlUniverse: classifiedUrlUniverse(),
  }
  return { candidate, importPlan, report }
}

function localizationUnavailableDecision(input: ReturnType<typeof fixture>): ReviewDecision {
  const reviewPlan = buildReconstructionReviewPlan({
    candidates: [input.candidate],
    productPlan: input.importPlan,
  })
  const item = reviewPlan.items.find(
    (entry) => entry.issueType === "localization_pairing_missing"
  )
  assert.ok(item)
  return {
    reviewKey: item.reviewKey,
    evidenceChecksum: item.evidenceChecksum,
    action: "mark_unavailable",
    decidedBy: "ci-reviewer",
    decidedAt: "2026-08-27T06:32:00.000Z",
    rationale: "No alternate-locale legacy PDP is present in the complete capture.",
  }
}

function buildReady(
  input = fixture(),
  generatedAt = "2026-08-27T06:33:00.000Z"
) {
  return buildMigrationInputReconciliation({
    report: input.report,
    decisions: [localizationUnavailableDecision(input)],
    generatedAt,
  })
}

const readyFixture = fixture()
const ready = buildReady(readyFixture)
assert.equal(ready.isReconciled, true)
assert.equal(ready.isReadyForStagingExecution, true)
assert.equal(ready.isExecutable, false)
assert.deepEqual(ready.globalBlockers, [])
assert.equal(ready.productPlan.isExecutable, true)
assert.equal(ready.pricePlan.isReconciled, true)
assert.equal(ready.pricePlan.totals.ready, 1)
assert.equal(ready.inventoryPlan.isReconciled, true)
assert.equal(ready.inventoryPlan.totals.state_only, 1)
assert.equal(ready.inventoryPlan.isExecutable, false)
assert.deepEqual(ready.inventoryPlan.runtimeManifestEntries, [])
assert.equal(ready.reviewPlan.totals.open, 0)
assert.equal(ready.reviewPlan.totals.deferred, 0)
assert.equal(ready.reviewPlan.totals.invalid, 0)
assert.equal(verifyMigrationInputReconciliationBundle(ready).valid, true)

const regeneratedAtDifferentTime = buildReady(
  readyFixture,
  "2026-08-27T08:00:00.000Z"
)
assert.equal(
  regeneratedAtDifferentTime.bundleChecksum,
  ready.bundleChecksum,
  "generatedAt must not make the frozen migration input identity unstable"
)

const noDecision = buildMigrationInputReconciliation({
  report: readyFixture.report,
  decisions: [],
  generatedAt: "2026-08-27T06:33:00.000Z",
})
assert.equal(noDecision.isReadyForStagingExecution, false)
assert.ok(noDecision.globalBlockers.includes("review_items_remain_open"))

const localizationItem = buildReconstructionReviewPlan({
  candidates: [readyFixture.candidate],
  productPlan: readyFixture.importPlan,
}).items.find((entry) => entry.issueType === "localization_pairing_missing")
assert.ok(localizationItem)
const deferred = buildMigrationInputReconciliation({
  report: readyFixture.report,
  decisions: [
    {
      reviewKey: localizationItem.reviewKey,
      evidenceChecksum: localizationItem.evidenceChecksum,
      action: "defer",
      decidedBy: "ci-reviewer",
      decidedAt: "2026-08-27T06:32:00.000Z",
      rationale: "Deliberately deferred for contract coverage.",
    },
  ],
})
assert.equal(deferred.isReadyForStagingExecution, false)
assert.ok(deferred.globalBlockers.includes("review_items_remain_deferred"))

const incompleteInput = fixture()
incompleteInput.report.capture = {
  ...incompleteInput.report.capture,
  declaredComplete: false,
}
const incomplete = buildMigrationInputReconciliation({
  report: incompleteInput.report,
  decisions: [localizationUnavailableDecision(incompleteInput)],
})
assert.equal(incomplete.isReadyForStagingExecution, false)
assert.ok(incomplete.globalBlockers.includes("direct_capture_must_be_declared_complete"))

const invalidInput = fixture()
invalidInput.report.capture = {
  ...invalidInput.report.capture,
  validation: { isValid: false },
}
const invalidCapture = buildMigrationInputReconciliation({
  report: invalidInput.report,
  decisions: [localizationUnavailableDecision(invalidInput)],
})
assert.ok(invalidCapture.globalBlockers.includes("capture_artifact_validation_must_pass"))

const unresolvedInput = fixture()
unresolvedInput.report.urlUniverse = {
  ...classifiedUrlUniverse(),
  entries: [
    {
      url: sourceUrl,
      status: "indexed_only",
      evidence: [{ source: "public_search_index" }],
    },
  ],
  totals: {
    captured: 0,
    skipped: 0,
    error: 0,
    indexed_only: 1,
    unavailable: 0,
  },
  unresolved: 1,
  isFullyClassified: false,
}
const unresolved = buildMigrationInputReconciliation({
  report: unresolvedInput.report,
  decisions: [localizationUnavailableDecision(unresolvedInput)],
})
assert.ok(
  unresolved.globalBlockers.includes(
    "reconstruction_url_universe_not_fully_classified"
  )
)

const stalePlanInput = fixture()
stalePlanInput.report.importPlan = JSON.parse(
  JSON.stringify(stalePlanInput.importPlan)
) as typeof stalePlanInput.importPlan
stalePlanInput.report.importPlan.entries[0].planningChecksum = "stale-plan-checksum"
const stalePlan = buildMigrationInputReconciliation({
  report: stalePlanInput.report,
  decisions: [localizationUnavailableDecision(stalePlanInput)],
})
assert.ok(
  stalePlan.globalBlockers.includes("capture_product_plan_does_not_match_candidates")
)

const noPublicPriceFixture = fixture({
  regularPrice: undefined,
  salePrice: undefined,
  currencyCode: undefined,
  stockState: undefined,
})
const noPublicPrice = buildReady(noPublicPriceFixture)
assert.equal(noPublicPrice.isReadyForStagingExecution, true)
assert.equal(noPublicPrice.pricePlan.totals.unavailable, 1)
assert.equal(noPublicPrice.inventoryPlan.totals.unavailable, 1)
assert.ok(noPublicPrice.warnings.some((warning) => warning.includes("price")))
assert.ok(noPublicPrice.warnings.some((warning) => warning.includes("inventory")))
assert.equal("quantity" in noPublicPrice.inventoryPlan.entries[0], false)

const changedPriceFixture = fixture({ regularPrice: 139, salePrice: 109 })
const changedPrice = buildReady(changedPriceFixture)
assert.notEqual(changedPrice.bundleChecksum, ready.bundleChecksum)
assert.equal(
  changedPrice.productPlan.entries[0].sourceChecksum,
  ready.productPlan.entries[0].sourceChecksum,
  "price-only changes must not alter structural product checksum"
)
assert.notEqual(
  changedPrice.pricePlan.entries[0].sourceChecksum,
  ready.pricePlan.entries[0].sourceChecksum
)

const tampered = JSON.parse(JSON.stringify(ready)) as MigrationInputReconciliation
assert.ok(tampered.productPlan.entries[0].normalizedProduct)
tampered.productPlan.entries[0].normalizedProduct!.name = "Tampered after reconciliation"
const tamperedVerification = verifyMigrationInputReconciliationBundle(tampered)
assert.equal(tamperedVerification.valid, false)
assert.ok(tamperedVerification.errors.includes("productPlan_checksum_mismatch"))
assert.ok(
  tamperedVerification.errors.includes("migration_input_bundle_checksum_mismatch")
)

console.log(
  "COQUETTE Phase 4N migration input reconciliation contract passed with checksum-bound staging readiness"
)
