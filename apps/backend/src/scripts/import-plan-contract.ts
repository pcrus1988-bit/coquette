import assert from "node:assert/strict"
import { buildProductImportPlan, semanticProductChecksum } from "../migration/import-plan"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"

const observedAt = "2026-08-26T20:00:00.000Z"

function readyObservation(sourceUrl: string, sku: string): RecoveryProductObservation {
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
      stockState: "in_stock",
      regularPrice: 100,
      currencyCode: "EUR",
    },
  }
}

const readyCandidate = buildRecoveryProductCandidate("ready-el", [
  readyObservation(
    "https://coquetteconcept.gr/default/product-ready.html",
    "READY-1"
  ),
])
assert.equal(readyCandidate.disposition, "ready")

const blockedCandidate = buildRecoveryProductCandidate("blocked", [
  {
    authority: "direct_storefront",
    sourceUrl: "https://coquetteconcept.gr/default/product-blocked.html",
    observedAt,
    fields: {
      sourceId: "https://coquetteconcept.gr/default/product-blocked.html",
      sku: "BLOCK-1",
      name: "Blocked product",
      type: "simple",
      categorySourceIds: ["https://coquetteconcept.gr/default/clothing.html"],
      optionValues: {},
      mediaSourceIds: [
        "https://coquetteconcept.gr/media/catalog/product/block-1.jpg",
      ],
    },
  },
])
assert.equal(blockedCandidate.disposition, "needs_review")

const rejectedCandidate = buildRecoveryProductCandidate("", [])
assert.equal(rejectedCandidate.disposition, "rejected")

const plan = buildProductImportPlan([
  blockedCandidate,
  readyCandidate,
  rejectedCandidate,
])
assert.deepEqual(
  plan.entries.map((entry) => entry.candidateKey),
  ["", "blocked", "ready-el"]
)
assert.equal(plan.totals.ready, 1)
assert.equal(plan.totals.blocked, 1)
assert.equal(plan.totals.rejected, 1)
assert.equal(plan.runtimeManifestEntries.length, 1)
assert.equal(plan.runtimeManifestEntries[0].status, "pending")
assert.equal(plan.runtimeManifestEntries[0].locale, "el")
assert.equal(plan.runtimeManifestEntries[0].sourceId, readyCandidate.selected.sourceId)
assert.equal(plan.isExecutable, false)

const readyEntry = plan.entries.find((entry) => entry.candidateKey === "ready-el")
assert.ok(readyEntry?.normalizedProduct)
assert.equal(
  readyEntry?.sourceChecksum,
  semanticProductChecksum(readyEntry!.normalizedProduct!)
)

const changedEvidenceCandidate = buildRecoveryProductCandidate("ready-el-new-evidence", [
  {
    ...readyObservation(
      "https://coquetteconcept.gr/default/product-ready.html",
      "READY-1"
    ),
    observedAt: "2026-08-26T21:00:00.000Z",
    note: "same importable data, newer capture evidence",
  },
])
const evidencePlan = buildProductImportPlan([changedEvidenceCandidate])
assert.equal(evidencePlan.totals.ready, 1)
assert.equal(
  evidencePlan.entries[0].sourceChecksum,
  readyEntry?.sourceChecksum
)
assert.notEqual(
  evidencePlan.entries[0].planningChecksum,
  readyEntry?.planningChecksum
)

const duplicateSkuPlan = buildProductImportPlan([
  buildRecoveryProductCandidate("dup-el", [
    readyObservation(
      "https://coquetteconcept.gr/default/shared-product.html",
      "SHARED-1"
    ),
  ]),
  buildRecoveryProductCandidate("dup-en", [
    readyObservation(
      "https://coquetteconcept.gr/en/shared-product.html",
      "SHARED-1"
    ),
  ]),
])
assert.deepEqual(duplicateSkuPlan.duplicateSkus, ["SHARED-1"])
assert.equal(duplicateSkuPlan.totals.ready, 0)
assert.equal(duplicateSkuPlan.totals.blocked, 2)
assert.equal(duplicateSkuPlan.runtimeManifestEntries.length, 0)
assert.ok(
  duplicateSkuPlan.entries.every((entry) =>
    entry.blockers.includes("duplicate_sku_requires_product_identity_resolution")
  )
)

const incompleteMediaCandidate = buildRecoveryProductCandidate("no-media", [
  {
    ...readyObservation(
      "https://coquetteconcept.gr/default/no-media.html",
      "NO-MEDIA-1"
    ),
    fields: {
      ...readyObservation(
        "https://coquetteconcept.gr/default/no-media.html",
        "NO-MEDIA-1"
      ).fields,
      mediaSourceIds: [],
    },
  },
])
assert.equal(incompleteMediaCandidate.disposition, "ready")
const incompleteMediaPlan = buildProductImportPlan([incompleteMediaCandidate])
assert.equal(incompleteMediaPlan.totals.ready, 0)
assert.equal(incompleteMediaPlan.totals.blocked, 1)
assert.ok(
  incompleteMediaPlan.entries[0].validationIssues.some(
    (issue) => issue.field === "mediaSourceIds"
  )
)
assert.equal(incompleteMediaPlan.runtimeManifestEntries.length, 0)

const executablePlan = buildProductImportPlan([readyCandidate])
assert.equal(executablePlan.isExecutable, true)
assert.equal(executablePlan.runtimeManifestEntries.length, 1)

console.log("COQUETTE deterministic product import plan contract checks passed")
