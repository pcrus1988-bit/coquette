import assert from "node:assert/strict"
import { buildRecoveryProductCandidate, type RecoveryProductObservation } from "../migration/recovery-candidates"
import {
  buildStagingTargetPolicyApplication,
  stagingTargetPublicationPolicy,
} from "../migration/staging-target-policy"

const observedAt = "2026-08-29T11:30:00.000Z"
const categoryUrl = "https://coquetteconcept.gr/default/clothing.html"

function observation(input: {
  slug: string
  sku: string
  type?: "simple" | "configurable"
  media?: boolean
  status?: "enabled" | "disabled"
  visibility?: "catalog_search" | "not_visible"
}): RecoveryProductObservation {
  const sourceUrl = `https://coquetteconcept.gr/default/${input.slug}.html`
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt,
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku: input.sku,
      name: input.slug,
      ...(input.status ? { status: input.status } : {}),
      ...(input.visibility ? { visibility: input.visibility } : {}),
      type: input.type ?? "simple",
      categorySourceIds: [categoryUrl],
      optionValues: input.type === "configurable" ? {} : { size: "S" },
      mediaSourceIds:
        input.media === false
          ? []
          : [`https://coquetteconcept.gr/media/catalog/product/${input.slug}.jpg`],
      regularPrice: 100,
      currencyCode: "EUR",
    },
  }
}

function candidate(input: Parameters<typeof observation>[0]) {
  return buildRecoveryProductCandidate(
    `direct:${input.slug}`,
    [observation(input)]
  )
}

const missingPublication = candidate({
  slug: "missing-publication",
  sku: "SAFE-1",
})
assert.equal(missingPublication.disposition, "needs_review")
assert.ok(missingPublication.missingRequiredFields.includes("status"))
assert.ok(missingPublication.missingRequiredFields.includes("visibility"))
assert.equal(missingPublication.selected.status, undefined)
assert.equal(missingPublication.selected.visibility, undefined)

const alreadyPublishedLegacy = candidate({
  slug: "legacy-published",
  sku: "SAFE-2",
  status: "enabled",
  visibility: "catalog_search",
})
assert.equal(alreadyPublishedLegacy.disposition, "ready")

const configurable = candidate({
  slug: "configurable-parent",
  sku: "CONFIG-1",
  type: "configurable",
})
const missingMedia = candidate({
  slug: "missing-media",
  sku: "NO-MEDIA-1",
  media: false,
})
const duplicateA = candidate({ slug: "duplicate-a", sku: "DUP-1" })
const duplicateB = candidate({ slug: "duplicate-b", sku: "DUP-1" })

const application = buildStagingTargetPolicyApplication([
  missingPublication,
  alreadyPublishedLegacy,
  configurable,
  missingMedia,
  duplicateA,
  duplicateB,
])

assert.deepEqual(stagingTargetPublicationPolicy, {
  schemaVersion: 1,
  provenance: "migration_target_policy",
  target: "staging",
  status: "disabled",
  visibility: "not_visible",
  medusaStatus: "draft",
  rationale:
    "Phase 4 real-data imports are quarantined as draft/not-visible until catalogue acceptance and UAT explicitly promote them.",
})
assert.equal(application.sourceCandidateCount, 6)
assert.equal(application.eligibleCandidateCount, 2)
assert.equal(application.quarantinedCandidateCount, 4)
assert.equal(application.isExecutable, true)
assert.equal(application.productPlan.isExecutable, true)
assert.equal(application.productPlan.totals.ready, 2)
assert.equal(application.productPlan.totals.blocked, 0)

const stagedMissing = application.productPlan.entries.find(
  (entry) => entry.sku === "SAFE-1"
)
assert.ok(stagedMissing?.normalizedProduct)
assert.equal(stagedMissing.normalizedProduct.status, "disabled")
assert.equal(stagedMissing.normalizedProduct.visibility, "not_visible")
assert.equal(
  stagedMissing.normalizedProduct.targetPublicationPolicy?.provenance,
  "migration_target_policy"
)
assert.equal(
  stagedMissing.normalizedProduct.targetPublicationPolicy?.medusaStatus,
  "draft"
)

const stagedPublished = application.productPlan.entries.find(
  (entry) => entry.sku === "SAFE-2"
)
assert.ok(stagedPublished?.normalizedProduct)
assert.equal(stagedPublished.normalizedProduct.status, "disabled")
assert.equal(stagedPublished.normalizedProduct.visibility, "not_visible")
assert.equal(
  stagedPublished.normalizedProduct.targetPublicationPolicy?.provenance,
  "migration_target_policy"
)

// The authoritative candidates are not rewritten by the target overlay.
assert.equal(missingPublication.selected.status, undefined)
assert.equal(missingPublication.selected.visibility, undefined)
assert.equal(alreadyPublishedLegacy.selected.status, "enabled")
assert.equal(alreadyPublishedLegacy.selected.visibility, "catalog_search")

const configQuarantine = application.quarantined.find(
  (entry) => entry.sku === "CONFIG-1"
)
assert.ok(configQuarantine?.reasons.includes("non_simple_product:configurable"))
const mediaQuarantine = application.quarantined.find(
  (entry) => entry.sku === "NO-MEDIA-1"
)
assert.ok(
  mediaQuarantine?.reasons.includes("missing_structural_field:mediaSourceIds")
)
const duplicateQuarantine = application.quarantined.filter(
  (entry) => entry.sku === "DUP-1"
)
assert.equal(duplicateQuarantine.length, 2)
assert.ok(
  duplicateQuarantine.every((entry) =>
    entry.reasons.includes(
      "plan_blocker:duplicate_sku_requires_product_identity_resolution"
    )
  )
)

console.log(
  "COQUETTE staging target policy contract passed: safe simple products are draft/not-visible while blocked identities remain quarantined"
)
