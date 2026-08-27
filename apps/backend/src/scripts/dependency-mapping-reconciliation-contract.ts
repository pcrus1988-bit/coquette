import assert from "node:assert/strict"
import {
  buildDependencyMappingReconciliationPlan,
  buildDependencyRequirements,
  verifyDependencyMappingReconciliationPlan,
  type DependencyMappingReconciliationPlan,
} from "../migration/dependency-mapping-reconciliation"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"
import type { MigrationDependencyMapping } from "../migration/staging-product-execution"
import { buildReadyStagingMigrationInputFixture } from "./staging-migration-input-test-fixture"

const sourceUrlA =
  "https://coquetteconcept.gr/default/phase-4q-contract-a.html"
const sourceUrlB =
  "https://coquetteconcept.gr/default/phase-4q-contract-b.html"
const categoryA = "https://coquetteconcept.gr/default/dresses.html"
const categoryShared = "https://coquetteconcept.gr/default/new-arrivals.html"
const mediaA =
  "https://coquetteconcept.gr/media/catalog/product/phase-4q-a.jpg"
const mediaB =
  "https://coquetteconcept.gr/media/catalog/product/phase-4q-b.jpg"
const brand = "legacy-designer:phase-4q-designer"
const servingHost = "coquette-media.example"

function observation(input: {
  sourceUrl: string
  sku: string
  name: string
  categories: string[]
  media: string[]
  price?: number
}): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl: input.sourceUrl,
    observedAt: "2026-08-27T08:30:00.000Z",
    fields: {
      sourceId: input.sourceUrl,
      canonicalUrl: input.sourceUrl,
      sku: input.sku,
      name: input.name,
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      brandSourceId: brand,
      categorySourceIds: input.categories,
      optionValues: { size: "S" },
      mediaSourceIds: input.media,
      stockState: "in_stock",
      regularPrice: input.price ?? 199,
      currencyCode: "EUR",
    },
  }
}

function candidate(
  candidateKey: string,
  input: Parameters<typeof observation>[0]
) {
  return buildRecoveryProductCandidate(candidateKey, [observation(input)])
}

const candidates = [
  candidate("phase-4q-a", {
    sourceUrl: sourceUrlA,
    sku: "PHASE-4Q-A",
    name: "Phase 4Q Product A",
    categories: [categoryA, categoryShared],
    media: [mediaA],
  }),
  candidate("phase-4q-b", {
    sourceUrl: sourceUrlB,
    sku: "PHASE-4Q-B",
    name: "Phase 4Q Product B",
    categories: [categoryShared],
    media: [mediaB],
  }),
]

const bundle = buildReadyStagingMigrationInputFixture({
  candidates,
  captureId: "phase-4q-dependency-contract",
})
assert.equal(bundle.isReadyForStagingExecution, true)

const requirements = buildDependencyRequirements(bundle)
assert.equal(requirements.length, 5)
const sharedRequirement = requirements.find(
  (entry) => entry.entityType === "category" && entry.sourceId === categoryShared
)
assert.ok(sharedRequirement)
assert.deepEqual(sharedRequirement.candidateKeys, ["phase-4q-a", "phase-4q-b"])
assert.ok(
  requirements.some(
    (entry) => entry.entityType === "category" && entry.sourceId === categoryA
  )
)
assert.ok(
  requirements.some(
    (entry) => entry.entityType === "brand" && entry.sourceId === brand
  )
)
assert.ok(
  requirements.some(
    (entry) => entry.entityType === "media" && entry.sourceId === mediaA
  )
)
assert.ok(
  requirements.some(
    (entry) => entry.entityType === "media" && entry.sourceId === mediaB
  )
)

const missing = buildDependencyMappingReconciliationPlan({
  bundle,
  mappings: [],
  allowedMediaHosts: [servingHost],
})
assert.equal(missing.isReconciled, false)
assert.equal(missing.totals.missing, 5)
assert.equal(missing.validatedMappings.length, 0)
assert.equal(missing.isExecutable, false)

const validMappings: MigrationDependencyMapping[] = [
  {
    entityType: "category",
    sourceId: categoryA,
    status: "imported",
    targetId: "pcat_phase_4q_dresses",
    note: "CI-only exact category mapping",
  },
  {
    entityType: "category",
    sourceId: categoryShared,
    status: "imported",
    targetId: "pcat_phase_4q_new_arrivals",
  },
  {
    entityType: "brand",
    sourceId: brand,
    status: "imported",
    targetId: "brand_phase_4q_designer",
  },
  {
    entityType: "media",
    sourceId: mediaA,
    status: "imported",
    targetUrl: `https://${servingHost}/catalog/phase-4q-a.jpg`,
  },
  {
    entityType: "media",
    sourceId: mediaB,
    status: "imported",
    targetUrl: `https://${servingHost}/catalog/phase-4q-b.jpg`,
  },
]

const ready = buildDependencyMappingReconciliationPlan({
  bundle,
  mappings: validMappings,
  allowedMediaHosts: [servingHost],
})
assert.equal(ready.isReconciled, true)
assert.equal(ready.totals.resolved, 5)
assert.equal(ready.validatedMappings.length, 5)
assert.deepEqual(ready.globalBlockers, [])
assert.match(ready.planChecksum, /^[a-f0-9]{64}$/)
assert.equal(ready.isExecutable, false)
assert.equal(
  verifyDependencyMappingReconciliationPlan({
    plan: ready,
    bundle,
    allowedMediaHosts: [servingHost],
  }).valid,
  true
)

const duplicate = buildDependencyMappingReconciliationPlan({
  bundle,
  mappings: [...validMappings, validMappings[0]],
  allowedMediaHosts: [servingHost],
})
assert.equal(duplicate.isReconciled, false)
assert.ok(duplicate.globalBlockers.includes("duplicate_dependency_mapping_keys"))
assert.equal(duplicate.duplicateMappingKeys.length, 1)

const orphan = buildDependencyMappingReconciliationPlan({
  bundle,
  mappings: [
    ...validMappings,
    {
      entityType: "category",
      sourceId: "https://coquetteconcept.gr/default/not-required.html",
      status: "imported",
      targetId: "pcat_orphan",
    },
  ],
  allowedMediaHosts: [servingHost],
})
assert.equal(orphan.isReconciled, false)
assert.ok(orphan.globalBlockers.includes("orphan_dependency_mappings_present"))
assert.equal(orphan.orphanMappingKeys.length, 1)

const legacyHotlink = buildDependencyMappingReconciliationPlan({
  bundle,
  mappings: validMappings.map((mapping) =>
    mapping.entityType === "media" && mapping.sourceId === mediaA
      ? {
          ...mapping,
          targetUrl: mediaA,
        }
      : mapping
  ),
  allowedMediaHosts: [servingHost],
})
assert.equal(legacyHotlink.isReconciled, false)
assert.equal(
  legacyHotlink.entries.find(
    (entry) => entry.entityType === "media" && entry.sourceId === mediaA
  )?.state,
  "invalid"
)
assert.ok(
  legacyHotlink.entries
    .find((entry) => entry.entityType === "media" && entry.sourceId === mediaA)
    ?.blockers.includes("media_target_url_missing_or_not_allowed")
)

const legacyHostAllowed = buildDependencyMappingReconciliationPlan({
  bundle,
  mappings: validMappings,
  allowedMediaHosts: [servingHost, "coquetteconcept.gr"],
})
assert.equal(legacyHostAllowed.isReconciled, false)
assert.ok(
  legacyHostAllowed.globalBlockers.includes(
    "legacy_host_cannot_be_serving_media_host"
  )
)

const wrongCategoryShape = buildDependencyMappingReconciliationPlan({
  bundle,
  mappings: validMappings.map((mapping) =>
    mapping.entityType === "category" && mapping.sourceId === categoryA
      ? {
          entityType: "category" as const,
          sourceId: categoryA,
          status: "imported" as const,
          targetUrl: `https://${servingHost}/wrong-category-target`,
        }
      : mapping
  ),
  allowedMediaHosts: [servingHost],
})
const wrongCategory = wrongCategoryShape.entries.find(
  (entry) => entry.entityType === "category" && entry.sourceId === categoryA
)
assert.equal(wrongCategory?.state, "invalid")
assert.ok(wrongCategory?.blockers.includes("category_target_id_required"))
assert.ok(wrongCategory?.blockers.includes("category_mapping_must_not_use_target_url"))

const explicitUnavailable = buildDependencyMappingReconciliationPlan({
  bundle,
  mappings: validMappings.map((mapping) =>
    mapping.entityType === "brand"
      ? {
          entityType: "brand" as const,
          sourceId: brand,
          status: "unavailable" as const,
          note: "Target Brand is deliberately not mapped yet.",
        }
      : mapping
  ),
  allowedMediaHosts: [servingHost],
})
assert.equal(explicitUnavailable.isReconciled, false)
assert.equal(explicitUnavailable.totals.unavailable, 1)

const tampered = JSON.parse(
  JSON.stringify(ready)
) as DependencyMappingReconciliationPlan
tampered.entries[0].candidateKeys = ["tampered-candidate"]
const tamperedVerification = verifyDependencyMappingReconciliationPlan({
  plan: tampered,
  bundle,
  allowedMediaHosts: [servingHost],
})
assert.equal(tamperedVerification.valid, false)
assert.ok(
  tamperedVerification.errors.includes("dependency_mapping_plan_checksum_mismatch")
)
assert.ok(
  tamperedVerification.errors.includes(
    "dependency_mapping_plan_entries_do_not_match_bundle_and_mappings"
  )
)

const changedPriceCandidates = [
  candidate("phase-4q-a", {
    sourceUrl: sourceUrlA,
    sku: "PHASE-4Q-A",
    name: "Phase 4Q Product A",
    categories: [categoryA, categoryShared],
    media: [mediaA],
    price: 219,
  }),
  candidates[1],
]
const changedPriceBundle = buildReadyStagingMigrationInputFixture({
  candidates: changedPriceCandidates,
  captureId: "phase-4q-dependency-contract",
})
const changedPricePlan = buildDependencyMappingReconciliationPlan({
  bundle: changedPriceBundle,
  mappings: validMappings,
  allowedMediaHosts: [servingHost],
})
assert.equal(changedPricePlan.isReconciled, true)
assert.equal(changedPricePlan.requirementsChecksum, ready.requirementsChecksum)
assert.notEqual(
  changedPricePlan.migrationInputBundleChecksum,
  ready.migrationInputBundleChecksum,
  "a new reconciled migration bundle must receive a newly bound dependency plan even when dependency requirements are unchanged"
)
assert.notEqual(changedPricePlan.planChecksum, ready.planChecksum)

console.log(
  "COQUETTE Phase 4Q dependency mapping reconciliation contract passed without inferred dependency targets"
)
