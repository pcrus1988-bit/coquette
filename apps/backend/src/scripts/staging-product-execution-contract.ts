import assert from "node:assert/strict"
import { buildProductImportPlan } from "../migration/import-plan"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"
import {
  assertStagingMigrationWriteGuard,
  buildStagingProductExecutionPlan,
  prepareMedusaSimpleProductInput,
  type MigrationDependencyMapping,
} from "../migration/staging-product-execution"
import type { MigrationManifestEntry } from "../migration/types"

const sourceUrl = "https://coquetteconcept.gr/default/execution-fixture.html"
const categorySourceUrl = "https://coquetteconcept.gr/default/clothing/dresses.html"
const mediaSourceUrl =
  "https://coquetteconcept.gr/media/catalog/product/execution-fixture.jpg"
const servingMediaUrl =
  "https://coquette-media.example/catalog/execution-fixture.jpg"
const observedAt = "2026-08-26T20:30:00.000Z"

function observation(overrides: Partial<RecoveryProductObservation["fields"]> = {}): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt,
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku: "EXEC-1",
      name: "Execution Fixture",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      description: "Recovered public description",
      categorySourceIds: [categorySourceUrl],
      optionValues: { size: "S" },
      mediaSourceIds: [mediaSourceUrl],
      stockState: "in_stock",
      regularPrice: 149,
      salePrice: 119,
      currencyCode: "EUR",
      ...overrides,
    },
  }
}

const candidate = buildRecoveryProductCandidate("execution-fixture", [observation()])
assert.equal(candidate.disposition, "ready")
const importPlan = buildProductImportPlan([candidate])
assert.equal(importPlan.isExecutable, true)
assert.equal(importPlan.runtimeManifestEntries.length, 1)

const dependencies: MigrationDependencyMapping[] = [
  {
    entityType: "category",
    sourceId: categorySourceUrl,
    status: "imported",
    targetId: "pcat_fixture",
  },
  {
    entityType: "media",
    sourceId: mediaSourceUrl,
    status: "imported",
    targetUrl: servingMediaUrl,
  },
]

const executionPlan = buildStagingProductExecutionPlan({
  importPlan,
  dependencyMappings: dependencies,
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(executionPlan.isExecutable, true)
assert.equal(executionPlan.totals.create, 1)
assert.equal(executionPlan.totals.skip, 0)
assert.equal(executionPlan.totals.blocked, 0)

const createEntry = executionPlan.entries[0]
assert.equal(createEntry.action, "create")
assert.deepEqual(createEntry.categoryTargetIds, ["pcat_fixture"])
assert.deepEqual(createEntry.mediaTargetUrls, [servingMediaUrl])

const medusaInput = prepareMedusaSimpleProductInput(createEntry, {
  defaultSalesChannelId: "sc_fixture",
  defaultShippingProfileId: "sp_fixture",
})
assert.equal(medusaInput.title, "Execution Fixture")
assert.equal(medusaInput.status, "published")
assert.deepEqual(medusaInput.categories, [{ id: "pcat_fixture" }])
assert.deepEqual(medusaInput.images, [{ url: servingMediaUrl }])
assert.deepEqual(medusaInput.options, [{ title: "size", values: ["S"] }])
assert.equal(medusaInput.variants.length, 1)
assert.equal(medusaInput.variants[0].sku, "EXEC-1")
assert.equal(medusaInput.variants[0].manage_inventory, true)
assert.equal(medusaInput.variants[0].allow_backorder, false)
assert.equal("prices" in medusaInput.variants[0], false)
assert.equal(
  medusaInput.metadata.coquette_migration_source_id,
  sourceUrl
)

const missingMediaPlan = buildStagingProductExecutionPlan({
  importPlan,
  dependencyMappings: dependencies.filter(
    (mapping) => mapping.entityType !== "media"
  ),
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(missingMediaPlan.isExecutable, false)
assert.equal(missingMediaPlan.totals.blocked, 1)
assert.ok(
  missingMediaPlan.entries[0].blockers.includes(
    `media_mapping_missing:${mediaSourceUrl}`
  )
)

const legacyHotlinkPlan = buildStagingProductExecutionPlan({
  importPlan,
  dependencyMappings: [
    dependencies[0],
    {
      entityType: "media",
      sourceId: mediaSourceUrl,
      status: "imported",
      targetUrl: mediaSourceUrl,
    },
  ],
  allowedMediaHosts: ["coquetteconcept.gr"],
})
assert.equal(legacyHotlinkPlan.isExecutable, false)
assert.ok(
  legacyHotlinkPlan.globalBlockers.includes(
    "legacy_host_cannot_be_serving_media_host"
  )
)

const duplicateDependencyPlan = buildStagingProductExecutionPlan({
  importPlan,
  dependencyMappings: [
    ...dependencies,
    {
      entityType: "media",
      sourceId: mediaSourceUrl,
      status: "imported",
      targetUrl: "https://coquette-media.example/catalog/duplicate.jpg",
    },
  ],
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(duplicateDependencyPlan.isExecutable, false)
assert.deepEqual(duplicateDependencyPlan.duplicateDependencyKeys, [
  `media:${encodeURIComponent(mediaSourceUrl)}`,
])

const runtimeManifestEntry = importPlan.runtimeManifestEntries[0]
const previousImported: MigrationManifestEntry = {
  ...runtimeManifestEntry,
  status: "imported",
  targetId: "prod_fixture",
  attempts: 1,
  firstImportedAt: "2026-08-26T21:00:00.000Z",
  lastAttemptAt: "2026-08-26T21:00:00.000Z",
}
const skipPlan = buildStagingProductExecutionPlan({
  importPlan,
  dependencyMappings: dependencies,
  previousProductManifestEntries: [previousImported],
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(skipPlan.isExecutable, true)
assert.equal(skipPlan.entries[0].action, "skip")
assert.equal(skipPlan.entries[0].existingTargetId, "prod_fixture")

const changedPreviousPlan = buildStagingProductExecutionPlan({
  importPlan,
  dependencyMappings: dependencies,
  previousProductManifestEntries: [
    {
      ...previousImported,
      sourceChecksum: "different-semantic-checksum",
    },
  ],
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(changedPreviousPlan.isExecutable, false)
assert.equal(changedPreviousPlan.entries[0].action, "blocked")
assert.ok(
  changedPreviousPlan.entries[0].blockers.includes(
    "existing_product_checksum_changed_requires_update_path"
  )
)

const brandSourceId = "legacy-designer:fixture"
const brandedCandidate = buildRecoveryProductCandidate("branded", [
  observation({ brandSourceId }),
])
const brandedImportPlan = buildProductImportPlan([brandedCandidate])
assert.equal(brandedImportPlan.isExecutable, true)
const missingBrandPlan = buildStagingProductExecutionPlan({
  importPlan: brandedImportPlan,
  dependencyMappings: dependencies,
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(missingBrandPlan.isExecutable, false)
assert.ok(
  missingBrandPlan.entries[0].blockers.includes(
    `brand_mapping_missing:${brandSourceId}`
  )
)

assert.throws(
  () =>
    assertStagingMigrationWriteGuard({
      COQUETTE_MIGRATION_TARGET: "production",
      COQUETTE_MIGRATION_ALLOW_WRITE: "COQUETTE_STAGING_WRITE_CONFIRMED",
      DATABASE_URL: "postgres://user:pass@db.example/staging",
      COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST: "db.example",
      COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME: "staging",
    }),
  /must be exactly 'staging'/
)
assert.throws(
  () =>
    assertStagingMigrationWriteGuard({
      COQUETTE_MIGRATION_TARGET: "staging",
      DATABASE_URL: "postgres://user:pass@db.example/staging",
      COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST: "db.example",
      COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME: "staging",
    }),
  /COQUETTE_STAGING_WRITE_CONFIRMED/
)
assert.throws(
  () =>
    assertStagingMigrationWriteGuard({
      COQUETTE_MIGRATION_TARGET: "staging",
      COQUETTE_MIGRATION_ALLOW_WRITE: "COQUETTE_STAGING_WRITE_CONFIRMED",
      DATABASE_URL: "postgres://user:pass@other.example/staging",
      COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST: "db.example",
      COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME: "staging",
    }),
  /Database host mismatch/
)
assert.deepEqual(
  assertStagingMigrationWriteGuard({
    COQUETTE_MIGRATION_TARGET: "staging",
    COQUETTE_MIGRATION_ALLOW_WRITE: "COQUETTE_STAGING_WRITE_CONFIRMED",
    DATABASE_URL: "postgres://user:pass@db.example/staging",
    COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST: "db.example",
    COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME: "staging",
  }),
  {
    target: "staging",
    databaseHost: "db.example",
    databaseName: "staging",
  }
)

console.log("COQUETTE staging product execution preflight contract checks passed")
