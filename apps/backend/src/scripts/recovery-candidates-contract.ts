import assert from "node:assert/strict"
import { buildIndexedRecoveryProductCandidates } from "../migration/indexed-recovery"
import { buildRecoveryProductCandidate } from "../migration/recovery-candidates"

const directSource = "https://coquetteconcept.gr/default/synthetic-product.html"

const ready = buildRecoveryProductCandidate("synthetic-ready", [
  {
    authority: "direct_storefront",
    sourceUrl: directSource,
    observedAt: "2026-08-26T12:00:00.000Z",
    fields: {
      sourceId: directSource,
      canonicalUrl: directSource,
      sku: "COQ-SYNTH-1",
      name: "Synthetic product fixture",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      categorySourceIds: [],
      optionValues: {},
      mediaSourceIds: [],
      stockState: "in_stock",
      regularPrice: 100,
      salePrice: 80,
      currencyCode: "EUR",
    },
  },
])

assert.equal(ready.disposition, "ready")
assert.equal(ready.normalizedProduct?.sku, "COQ-SYNTH-1")
assert.equal(ready.conflicts.length, 0)
assert.equal(ready.missingRequiredFields.length, 0)

const indexedOnly = buildIndexedRecoveryProductCandidates({
  schemaVersion: 1,
  observedAt: "2026-08-26T15:00:00Z",
  provenance: {
    kind: "public_search_index",
    sourceHost: "coquetteconcept.gr",
    confidence: "derived",
  },
  recentProductSpotChecks: [
    {
      name: "Indexed recovery fixture",
      regularPriceEur: 120,
      salePriceEur: 90,
      status: "sale",
      sourceUrl: "https://coquetteconcept.gr/",
      indexFreshness: "3 days ago",
    },
  ],
})[0]

assert.equal(indexedOnly.disposition, "needs_review")
assert.equal(indexedOnly.normalizedProduct, undefined)
assert.equal(indexedOnly.selected.name, "Indexed recovery fixture")
assert.equal(indexedOnly.selected.regularPrice, 120)
assert.equal(indexedOnly.selected.salePrice, 90)
assert.equal(indexedOnly.selected.currencyCode, "EUR")
assert.equal(indexedOnly.selected.stockState, undefined)
assert.ok(indexedOnly.missingRequiredFields.includes("sku"))
assert.ok(indexedOnly.missingRequiredFields.includes("sourceId"))
assert.ok(indexedOnly.blockers.includes("direct_or_authoritative_evidence_required"))

const unsafeIndexedStock = buildRecoveryProductCandidate("indexed-stock", [
  {
    authority: "direct_storefront",
    sourceUrl: directSource,
    observedAt: "2026-08-26T12:00:00.000Z",
    fields: {
      sourceId: directSource,
      canonicalUrl: directSource,
      sku: "COQ-STOCK-DOMAIN",
      name: "Stock-domain separation fixture",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      categorySourceIds: [],
      optionValues: {},
      mediaSourceIds: [],
    },
  },
  {
    authority: "public_search_index",
    sourceUrl: directSource,
    observedAt: "2026-08-26T13:00:00.000Z",
    freshnessLabel: "today",
    fields: {
      stockState: "in_stock",
    },
  },
])

assert.equal(unsafeIndexedStock.disposition, "ready")
assert.equal(unsafeIndexedStock.normalizedProduct?.sku, "COQ-STOCK-DOMAIN")
assert.equal(unsafeIndexedStock.selected.stockState, undefined)
assert.ok(
  unsafeIndexedStock.conflicts.some(
    (conflict) =>
      conflict.field === "stockState" &&
      conflict.reason === "unsafe_field_authority"
  )
)

const priceConflict = buildRecoveryProductCandidate("price-conflict", [
  {
    authority: "direct_storefront",
    sourceUrl: directSource,
    observedAt: "2026-08-26T12:00:00.000Z",
    fields: {
      sourceId: directSource,
      canonicalUrl: directSource,
      sku: "COQ-PRICE-CONFLICT",
      name: "Price conflict fixture",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      categorySourceIds: [],
      optionValues: {},
      mediaSourceIds: [],
      regularPrice: 100,
      currencyCode: "EUR",
    },
  },
  {
    authority: "direct_storefront",
    sourceUrl: directSource,
    observedAt: "2026-08-26T13:00:00.000Z",
    fields: {
      regularPrice: 110,
    },
  },
])

assert.equal(priceConflict.disposition, "ready")
assert.equal(priceConflict.normalizedProduct?.sku, "COQ-PRICE-CONFLICT")
assert.equal(priceConflict.selected.regularPrice, 110)
assert.ok(
  priceConflict.conflicts.some(
    (entry) =>
      entry.field === "regularPrice" &&
      entry.reason === "same_authority_conflict" &&
      entry.severity === "critical"
  )
)

const missingPriceCurrency = buildRecoveryProductCandidate(
  "missing-price-currency",
  [
    {
      authority: "direct_storefront",
      sourceUrl: directSource,
      observedAt: "2026-08-26T12:00:00.000Z",
      fields: {
        sourceId: directSource,
        canonicalUrl: directSource,
        sku: "COQ-NO-CURRENCY",
        name: "Missing price currency fixture",
        status: "enabled",
        visibility: "catalog_search",
        type: "simple",
        categorySourceIds: [],
        optionValues: {},
        mediaSourceIds: [],
        regularPrice: 100,
      },
    },
  ]
)

assert.equal(missingPriceCurrency.disposition, "ready")
assert.equal(missingPriceCurrency.normalizedProduct?.regularPrice, 100)
assert.equal(missingPriceCurrency.normalizedProduct?.currencyCode, undefined)
assert.ok(!missingPriceCurrency.missingRequiredFields.includes("currencyCode"))

const invalidSale = buildRecoveryProductCandidate("invalid-sale", [
  {
    authority: "direct_storefront",
    sourceUrl: directSource,
    observedAt: "2026-08-26T12:00:00.000Z",
    fields: {
      sourceId: directSource,
      sku: "COQ-BAD-SALE",
      name: "Invalid sale fixture",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      categorySourceIds: [],
      optionValues: {},
      mediaSourceIds: [],
      regularPrice: 100,
      salePrice: 120,
      currencyCode: "EUR",
    },
  },
])

assert.equal(invalidSale.disposition, "ready")
assert.equal(invalidSale.normalizedProduct?.salePrice, 120)
assert.ok(
  invalidSale.conflicts.some(
    (entry) => entry.reason === "invalid_value" && entry.field === "salePrice"
  )
)

console.log("COQUETTE recovery candidate safety contract checks passed")
