import assert from "node:assert/strict"
import { buildProductImportPlan } from "../migration/import-plan"
import {
  buildInventoryPlan,
  semanticInventoryEvidenceChecksum,
} from "../migration/inventory-plan"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"

const sourceUrl = "https://coquetteconcept.gr/default/inventory-fixture.html"
const categorySourceUrl =
  "https://coquetteconcept.gr/default/clothing/inventory-fixture.html"
const mediaSourceUrl =
  "https://coquetteconcept.gr/media/catalog/product/inventory-fixture.jpg"

function observation(
  overrides: Partial<RecoveryProductObservation["fields"]> = {}
): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt: "2026-08-27T08:00:00.000Z",
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku: "INVENTORY-1",
      name: "Inventory Evidence Fixture",
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

function planFor(observations: RecoveryProductObservation[]) {
  const productPlan = buildProductImportPlan([
    buildRecoveryProductCandidate("inventory-fixture", observations),
  ])
  return { productPlan, inventoryPlan: buildInventoryPlan(productPlan) }
}

const inStock = planFor([observation({ stockState: "in_stock" })])
assert.equal(inStock.productPlan.totals.ready, 1)
assert.equal(inStock.inventoryPlan.totals.state_only, 1)
assert.equal(inStock.inventoryPlan.isReconciled, true)
assert.equal(inStock.inventoryPlan.isExecutable, false)
assert.deepEqual(inStock.inventoryPlan.runtimeManifestEntries, [])
assert.deepEqual(inStock.inventoryPlan.entries[0].reconstructedEvidence, {
  sku: "INVENTORY-1",
  stockState: "in_stock",
  lowStockMessage: undefined,
})
assert.ok(
  inStock.inventoryPlan.entries[0].warnings.includes(
    "exact_inventory_quantity_not_recovered"
  )
)
assert.equal("quantity" in inStock.inventoryPlan.entries[0], false)
assert.equal("inventoryQuantity" in inStock.inventoryPlan.entries[0], false)

const outOfStock = planFor([observation({ stockState: "out_of_stock" })])
assert.equal(outOfStock.inventoryPlan.totals.state_only, 1)
assert.equal(outOfStock.inventoryPlan.runtimeManifestEntries.length, 0)
assert.equal(
  outOfStock.inventoryPlan.entries[0].evidenceChecksum,
  semanticInventoryEvidenceChecksum({
    sku: "INVENTORY-1",
    stockState: "out_of_stock",
  })
)
assert.notEqual(
  outOfStock.inventoryPlan.entries[0].evidenceChecksum,
  inStock.inventoryPlan.entries[0].evidenceChecksum
)

const lowStock = planFor([
  observation({ stockState: "in_stock", lowStockMessage: "Only a few left" }),
])
assert.equal(lowStock.inventoryPlan.totals.state_only, 1)
assert.equal(
  lowStock.inventoryPlan.entries[0].reconstructedEvidence?.lowStockMessage,
  "Only a few left"
)
assert.equal(lowStock.inventoryPlan.runtimeManifestEntries.length, 0)

const noInventory = planFor([observation()])
assert.equal(noInventory.inventoryPlan.totals.unavailable, 1)
assert.equal(noInventory.inventoryPlan.totals.blocked, 0)
assert.deepEqual(noInventory.inventoryPlan.entries[0].warnings, [
  "public_inventory_evidence_not_recovered",
])
assert.equal(noInventory.inventoryPlan.runtimeManifestEntries.length, 0)

const explicitUnknown = planFor([observation({ stockState: "unknown" })])
assert.equal(explicitUnknown.inventoryPlan.totals.unavailable, 1)
assert.deepEqual(explicitUnknown.inventoryPlan.entries[0].warnings, [
  "explicit_stock_state_unknown",
])

const priceChanged = planFor([
  observation({ stockState: "in_stock", regularPrice: 130 }),
])
assert.equal(
  priceChanged.inventoryPlan.entries[0].evidenceChecksum,
  inStock.inventoryPlan.entries[0].evidenceChecksum
)

const copyChanged = planFor([
  observation({ stockState: "in_stock", description: "Changed copy only" }),
])
assert.equal(
  copyChanged.inventoryPlan.entries[0].evidenceChecksum,
  inStock.inventoryPlan.entries[0].evidenceChecksum
)

const unsafeIndexedStock = planFor([
  observation(),
  {
    authority: "public_search_index",
    sourceUrl,
    observedAt: "2026-08-27T08:05:00.000Z",
    freshnessLabel: "today",
    fields: { stockState: "in_stock" },
  },
])
assert.equal(unsafeIndexedStock.productPlan.totals.ready, 1)
assert.equal(unsafeIndexedStock.inventoryPlan.totals.blocked, 1)
assert.ok(
  unsafeIndexedStock.inventoryPlan.entries[0].blockers.includes(
    "inventory_evidence_conflict_requires_review"
  )
)
assert.equal(unsafeIndexedStock.inventoryPlan.runtimeManifestEntries.length, 0)

const conflictingDirectStock = planFor([
  observation({ stockState: "in_stock" }),
  {
    ...observation({ stockState: "out_of_stock" }),
    observedAt: "2026-08-27T08:10:00.000Z",
  },
])
assert.equal(conflictingDirectStock.productPlan.totals.ready, 1)
assert.equal(conflictingDirectStock.inventoryPlan.totals.blocked, 1)
assert.ok(
  conflictingDirectStock.inventoryPlan.entries[0].blockers.includes(
    "inventory_evidence_conflict_requires_review"
  )
)

const structurallyBlocked = planFor([
  {
    ...observation({ stockState: "in_stock" }),
    fields: {
      ...observation({ stockState: "in_stock" }).fields,
      mediaSourceIds: [],
    },
  },
])
assert.equal(structurallyBlocked.productPlan.totals.blocked, 1)
assert.equal(structurallyBlocked.inventoryPlan.totals.blocked, 1)
assert.ok(
  structurallyBlocked.inventoryPlan.entries[0].blockers.includes(
    "structural_product_not_ready"
  )
)

console.log(
  "COQUETTE deterministic inventory evidence contract passed without numeric inventory inference"
)
