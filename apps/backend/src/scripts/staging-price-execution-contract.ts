import assert from "node:assert/strict"
import { buildProductImportPlan } from "../migration/import-plan"
import { buildPricePlan } from "../migration/price-plan"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"
import { buildStagingPriceExecutionPlan } from "../migration/staging-price-execution"
import type { MigrationManifestEntry } from "../migration/types"

const sourceUrl = "https://coquetteconcept.gr/default/price-execution-fixture.html"
const categorySourceUrl =
  "https://coquetteconcept.gr/default/clothing/price-execution.html"
const mediaSourceUrl =
  "https://coquetteconcept.gr/media/catalog/product/price-execution.jpg"

function observation(
  overrides: Partial<RecoveryProductObservation["fields"]> = {}
): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt: "2026-08-27T06:00:00.000Z",
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku: "PRICE-EXEC-1",
      name: "Price Execution Fixture",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      categorySourceIds: [categorySourceUrl],
      optionValues: { size: "S" },
      mediaSourceIds: [mediaSourceUrl],
      regularPrice: 149,
      salePrice: 119,
      currencyCode: "EUR",
      ...overrides,
    },
  }
}

function plans(item = observation()) {
  const productPlan = buildProductImportPlan([
    buildRecoveryProductCandidate("price-execution", [item]),
  ])
  assert.equal(productPlan.isExecutable, true)
  const pricePlan = buildPricePlan(productPlan)
  assert.equal(pricePlan.isReconciled, true)
  return { productPlan, pricePlan }
}

function importedProductManifest(
  productPlan: ReturnType<typeof buildProductImportPlan>,
  overrides: Partial<MigrationManifestEntry> = {}
): MigrationManifestEntry {
  return {
    ...productPlan.runtimeManifestEntries[0],
    status: "imported",
    targetId: "prod_price_exec",
    attempts: 1,
    firstImportedAt: "2026-08-27T06:05:00.000Z",
    lastAttemptAt: "2026-08-27T06:05:00.000Z",
    ...overrides,
  }
}

const { productPlan, pricePlan } = plans()
assert.equal(pricePlan.totals.ready, 1)
assert.equal(pricePlan.entries[0].productSourceChecksum, productPlan.entries[0].sourceChecksum)

const applyPlan = buildStagingPriceExecutionPlan({
  pricePlan,
  productManifestEntries: [importedProductManifest(productPlan)],
})
assert.equal(applyPlan.isExecutable, true)
assert.equal(applyPlan.totals.apply, 1)
assert.equal(applyPlan.totals.skip, 0)
assert.equal(applyPlan.totals.blocked, 0)
assert.equal(applyPlan.entries[0].action, "apply")
assert.equal(applyPlan.entries[0].productTargetId, "prod_price_exec")
assert.equal(applyPlan.entries[0].reconstructedPrice?.regularPrice, 149)
assert.equal(applyPlan.entries[0].reconstructedPrice?.salePrice, 119)

const missingProductPlan = buildStagingPriceExecutionPlan({
  pricePlan,
  productManifestEntries: [],
})
assert.equal(missingProductPlan.isExecutable, false)
assert.ok(
  missingProductPlan.entries[0].blockers.includes(
    "imported_product_manifest_entry_missing"
  )
)

const pendingProductPlan = buildStagingPriceExecutionPlan({
  pricePlan,
  productManifestEntries: [
    {
      ...importedProductManifest(productPlan),
      status: "pending",
      targetId: undefined,
    },
  ],
})
assert.equal(pendingProductPlan.isExecutable, false)
assert.ok(
  pendingProductPlan.entries[0].blockers.includes(
    "product_manifest_not_imported:pending"
  )
)

const staleProductPlan = buildStagingPriceExecutionPlan({
  pricePlan,
  productManifestEntries: [
    importedProductManifest(productPlan, {
      sourceChecksum: "stale-structural-checksum",
    }),
  ],
})
assert.equal(staleProductPlan.isExecutable, false)
assert.ok(
  staleProductPlan.entries[0].blockers.includes(
    "structural_product_checksum_not_current"
  )
)

const runtimePriceManifest = pricePlan.runtimeManifestEntries[0]
const importedPriceManifest: MigrationManifestEntry = {
  ...runtimePriceManifest,
  status: "imported",
  targetId: "variant_price_exec",
  attempts: 1,
  firstImportedAt: "2026-08-27T06:10:00.000Z",
  lastAttemptAt: "2026-08-27T06:10:00.000Z",
}

const skipPlan = buildStagingPriceExecutionPlan({
  pricePlan,
  productManifestEntries: [importedProductManifest(productPlan)],
  previousPriceManifestEntries: [importedPriceManifest],
})
assert.equal(skipPlan.isExecutable, true)
assert.equal(skipPlan.entries[0].action, "skip")
assert.equal(skipPlan.entries[0].previousPriceManifestEntry?.targetId, "variant_price_exec")

const changedObservation = observation({ regularPrice: 159, salePrice: 129 })
const changedPlans = plans(changedObservation)
const changedPlan = buildStagingPriceExecutionPlan({
  pricePlan: changedPlans.pricePlan,
  productManifestEntries: [importedProductManifest(changedPlans.productPlan)],
  previousPriceManifestEntries: [importedPriceManifest],
})
assert.equal(changedPlan.isExecutable, true)
assert.equal(changedPlan.entries[0].action, "apply")
assert.notEqual(
  changedPlan.entries[0].sourceChecksum,
  importedPriceManifest.sourceChecksum
)

for (const status of ["pending", "error"] as const) {
  const retryPlan = buildStagingPriceExecutionPlan({
    pricePlan,
    productManifestEntries: [importedProductManifest(productPlan)],
    previousPriceManifestEntries: [
      {
        ...runtimePriceManifest,
        status,
        attempts: 1,
        errors: status === "error" ? ["fixture failure"] : [],
      },
    ],
  })
  assert.equal(retryPlan.isExecutable, true)
  assert.equal(retryPlan.entries[0].action, "apply")
}

const skippedManifestPlan = buildStagingPriceExecutionPlan({
  pricePlan,
  productManifestEntries: [importedProductManifest(productPlan)],
  previousPriceManifestEntries: [
    {
      ...runtimePriceManifest,
      status: "skipped",
      attempts: 1,
    },
  ],
})
assert.equal(skippedManifestPlan.isExecutable, false)
assert.ok(
  skippedManifestPlan.entries[0].blockers.includes(
    "previous_price_manifest_requires_reconciliation:skipped"
  )
)

const duplicatePriceManifestPlan = buildStagingPriceExecutionPlan({
  pricePlan,
  productManifestEntries: [importedProductManifest(productPlan)],
  previousPriceManifestEntries: [importedPriceManifest, importedPriceManifest],
})
assert.equal(duplicatePriceManifestPlan.isExecutable, false)
assert.ok(
  duplicatePriceManifestPlan.globalBlockers.includes(
    "duplicate_price_manifest_keys"
  )
)

const unavailablePlans = plans(
  observation({
    regularPrice: undefined,
    salePrice: undefined,
    currencyCode: undefined,
  })
)
assert.equal(unavailablePlans.pricePlan.totals.unavailable, 1)
const unavailableExecution = buildStagingPriceExecutionPlan({
  pricePlan: unavailablePlans.pricePlan,
  productManifestEntries: [],
})
assert.equal(unavailableExecution.isExecutable, true)
assert.equal(unavailableExecution.entries[0].action, "unavailable")
assert.equal(unavailableExecution.totals.unavailable, 1)
assert.equal(unavailableExecution.totals.apply, 0)

console.log("COQUETTE guarded staging price execution preflight contract passed")
