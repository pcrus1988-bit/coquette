import assert from "node:assert/strict"
import { buildProductImportPlan } from "../migration/import-plan"
import {
  buildPricePlan,
  semanticPriceChecksum,
} from "../migration/price-plan"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"

const observedAt = "2026-08-27T05:00:00.000Z"

function observation(
  sourceUrl: string,
  sku: string,
  priceFields: {
    regularPrice?: number
    salePrice?: number
    currencyCode?: "EUR"
  } = { regularPrice: 100, currencyCode: "EUR" }
): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt,
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku,
      name: `Product ${sku}`,
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      categorySourceIds: ["https://coquetteconcept.gr/default/clothing.html"],
      optionValues: { size: "S" },
      mediaSourceIds: [
        `https://coquetteconcept.gr/media/catalog/product/${sku.toLowerCase()}.jpg`,
      ],
      ...priceFields,
    },
  }
}

function planFor(candidateKey: string, item: RecoveryProductObservation) {
  return buildPricePlan(
    buildProductImportPlan([
      buildRecoveryProductCandidate(candidateKey, [item]),
    ])
  )
}

const regularPlan = planFor(
  "regular",
  observation(
    "https://coquetteconcept.gr/default/regular.html",
    "REGULAR-1"
  )
)
assert.equal(regularPlan.totals.ready, 1)
assert.equal(regularPlan.totals.unavailable, 0)
assert.equal(regularPlan.totals.blocked, 0)
assert.equal(regularPlan.isExecutable, true)
assert.equal(regularPlan.isReconciled, true)
assert.equal(regularPlan.runtimeManifestEntries.length, 1)
assert.equal(regularPlan.runtimeManifestEntries[0].entityType, "price")
assert.equal(regularPlan.runtimeManifestEntries[0].locale, "el")
assert.equal(regularPlan.entries[0].reconstructedPrice?.regularPrice, 100)
assert.equal(regularPlan.entries[0].reconstructedPrice?.currencyCode, "EUR")
assert.equal(regularPlan.entries[0].reconstructedPrice?.salePrice, undefined)
assert.equal(
  regularPlan.entries[0].sourceChecksum,
  semanticPriceChecksum({
    sku: "REGULAR-1",
    currencyCode: "EUR",
    regularPrice: 100,
  })
)

const salePlan = planFor(
  "sale",
  observation("https://coquetteconcept.gr/default/sale.html", "SALE-1", {
    regularPrice: 120,
    salePrice: 84,
    currencyCode: "EUR",
  })
)
assert.equal(salePlan.isExecutable, true)
assert.deepEqual(salePlan.entries[0].reconstructedPrice, {
  sku: "SALE-1",
  currencyCode: "EUR",
  regularPrice: 120,
  salePrice: 84,
})

const structuralChangePlan = buildPricePlan(
  buildProductImportPlan([
    buildRecoveryProductCandidate("regular-structural-change", [
      {
        ...observation(
          "https://coquetteconcept.gr/default/regular.html",
          "REGULAR-1"
        ),
        fields: {
          ...observation(
            "https://coquetteconcept.gr/default/regular.html",
            "REGULAR-1"
          ).fields,
          description: "Changed structural description with the same public price",
        },
      },
    ]),
  ])
)
assert.equal(structuralChangePlan.totals.ready, 1)
assert.equal(
  structuralChangePlan.entries[0].sourceChecksum,
  regularPlan.entries[0].sourceChecksum
)

const changedPricePlan = planFor(
  "regular-price-change",
  observation(
    "https://coquetteconcept.gr/default/regular.html",
    "REGULAR-1",
    { regularPrice: 105, currencyCode: "EUR" }
  )
)
assert.equal(changedPricePlan.totals.ready, 1)
assert.notEqual(
  changedPricePlan.entries[0].sourceChecksum,
  regularPlan.entries[0].sourceChecksum
)

const unavailablePlan = planFor(
  "unavailable",
  observation(
    "https://coquetteconcept.gr/default/unavailable.html",
    "UNAVAILABLE-1",
    {}
  )
)
assert.equal(unavailablePlan.totals.ready, 0)
assert.equal(unavailablePlan.totals.unavailable, 1)
assert.equal(unavailablePlan.totals.blocked, 0)
assert.equal(unavailablePlan.isExecutable, false)
assert.equal(unavailablePlan.isReconciled, true)
assert.equal(unavailablePlan.runtimeManifestEntries.length, 0)
assert.deepEqual(unavailablePlan.entries[0].warnings, [
  "public_price_not_recovered",
])

const saleWithoutRegularPlan = planFor(
  "sale-without-regular",
  observation(
    "https://coquetteconcept.gr/default/sale-without-regular.html",
    "SALE-NO-REGULAR",
    { salePrice: 80, currencyCode: "EUR" }
  )
)
assert.equal(saleWithoutRegularPlan.totals.blocked, 1)
assert.ok(
  saleWithoutRegularPlan.entries[0].blockers.includes(
    "sale_price_without_regular_price"
  )
)
assert.equal(saleWithoutRegularPlan.runtimeManifestEntries.length, 0)
assert.equal(saleWithoutRegularPlan.isReconciled, false)

const missingCurrencyPlan = planFor(
  "missing-currency",
  observation(
    "https://coquetteconcept.gr/default/missing-currency.html",
    "NO-CURRENCY",
    { regularPrice: 90 }
  )
)
assert.equal(missingCurrencyPlan.totals.blocked, 1)
assert.ok(
  missingCurrencyPlan.entries[0].blockers.includes(
    "missing_or_unsupported_price_currency"
  )
)

const equalSalePlan = planFor(
  "equal-sale",
  observation(
    "https://coquetteconcept.gr/default/equal-sale.html",
    "EQUAL-SALE",
    { regularPrice: 100, salePrice: 100, currencyCode: "EUR" }
  )
)
assert.equal(equalSalePlan.totals.blocked, 1)
assert.ok(
  equalSalePlan.entries[0].blockers.includes("non_discounting_sale_price")
)

const zeroPricePlan = planFor(
  "zero-price",
  observation(
    "https://coquetteconcept.gr/default/zero-price.html",
    "ZERO-PRICE",
    { regularPrice: 0, currencyCode: "EUR" }
  )
)
assert.equal(zeroPricePlan.totals.blocked, 1)
assert.ok(zeroPricePlan.entries[0].blockers.includes("invalid_regular_price"))

const structurallyBlockedProduct = buildRecoveryProductCandidate(
  "structurally-blocked",
  [
    {
      ...observation(
        "https://coquetteconcept.gr/default/structurally-blocked.html",
        "STRUCT-BLOCK"
      ),
      fields: {
        ...observation(
          "https://coquetteconcept.gr/default/structurally-blocked.html",
          "STRUCT-BLOCK"
        ).fields,
        mediaSourceIds: [],
      },
    },
  ]
)
const structurallyBlockedPricePlan = buildPricePlan(
  buildProductImportPlan([structurallyBlockedProduct])
)
assert.equal(structurallyBlockedPricePlan.totals.blocked, 1)
assert.ok(
  structurallyBlockedPricePlan.entries[0].blockers.includes(
    "structural_product_not_ready"
  )
)
assert.equal(structurallyBlockedPricePlan.runtimeManifestEntries.length, 0)

console.log("COQUETTE deterministic price reconstruction plan contract checks passed")
