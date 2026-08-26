import assert from "node:assert/strict"
import { sourceChecksum } from "../migration/checksum"
import {
  createPendingManifestEntry,
  findDuplicateManifestKeys,
  shouldReimport,
} from "../migration/manifest"
import {
  buildImportedTargetMap,
  requireImportedTargetId,
  resolveImportedTargetId,
} from "../migration/mapping"
import { reconcileMigration } from "../migration/reconciliation"
import {
  createMigrationRun,
  finalizeMigrationRun,
  privateMigrationArtifactPath,
} from "../migration/run"
import { createNormalizedSourceRecord } from "../migration/source-record"
import { validateNormalizedProduct } from "../migration/validation"
import type {
  MigrationManifestEntry,
  NormalizedMagentoProduct,
} from "../migration/types"

const checksumA = sourceChecksum({ sku: "SKU-1", nested: { b: 2, a: 1 } })
const checksumB = sourceChecksum({ nested: { a: 1, b: 2 }, sku: "SKU-1" })
const checksumChanged = sourceChecksum({ sku: "SKU-2", nested: { a: 1, b: 2 } })

assert.equal(checksumA, checksumB, "checksum must ignore object key order")
assert.notEqual(checksumA, checksumChanged, "checksum must change with source data")

const pending = createPendingManifestEntry(
  { entityType: "product", sourceId: "https://coquetteconcept.gr/default/example.html", locale: "el" },
  checksumA
)
assert.equal(pending.status, "pending")
assert.equal(pending.attempts, 0)
assert.equal(shouldReimport(undefined, checksumA), true)
assert.equal(shouldReimport({ ...pending, status: "imported" }, checksumA), false)
assert.equal(shouldReimport({ ...pending, status: "imported" }, checksumChanged), true)

const imported: MigrationManifestEntry = {
  ...pending,
  status: "imported",
  targetId: "prod_test",
  attempts: 1,
}

assert.deepEqual(findDuplicateManifestKeys([imported, imported]).length, 1)

const reconciliation = reconcileMigration({
  entityType: "product",
  expectedSourceCount: 1,
  manifestEntries: [imported],
})
assert.equal(reconciliation.isReconciled, true)
assert.equal(reconciliation.unexplainedVariance, 0)

const sampleProduct: NormalizedMagentoProduct = {
  sourceId: "https://coquetteconcept.gr/default/example.html",
  sku: "COQ-42",
  name: "Synthetic storefront reconstruction fixture",
  status: "enabled",
  visibility: "catalog_search",
  type: "simple",
  categorySourceIds: ["https://coquetteconcept.gr/default/clothing.html"],
  optionValues: { size: "M" },
  mediaSourceIds: ["https://coquetteconcept.gr/media/catalog/product/example.jpg"],
}

assert.deepEqual(validateNormalizedProduct(sampleProduct), [])

const normalizedRecord = createNormalizedSourceRecord(
  { entityType: "product", sourceId: sampleProduct.sourceId, locale: "el" },
  sampleProduct,
  "2026-08-26T12:00:00.000Z"
)
assert.equal(normalizedRecord.sourceChecksum, sourceChecksum(sampleProduct))
assert.equal(normalizedRecord.data.sku, "COQ-42")

const targetMap = buildImportedTargetMap([imported])
assert.equal(targetMap.size, 1)
assert.equal(
  resolveImportedTargetId([imported], {
    entityType: "product",
    sourceId: sampleProduct.sourceId,
    locale: "el",
  }),
  "prod_test"
)
assert.equal(
  requireImportedTargetId([imported], {
    entityType: "product",
    sourceId: sampleProduct.sourceId,
    locale: "el",
  }),
  "prod_test"
)
assert.throws(() =>
  requireImportedTargetId([imported], {
    entityType: "brand",
    sourceId: "missing",
  })
)
assert.throws(() =>
  buildImportedTargetMap([
    imported,
    { ...imported, targetId: "prod_conflict" },
  ])
)

const run = createMigrationRun(
  "capture-001",
  {
    source: "coquetteconcept.gr",
    evidenceMode: "public_storefront",
    captureId: "storefront-2026-08-26",
    baseUrl: "https://coquetteconcept.gr/",
    capturedAt: "2026-08-26T12:00:00.000Z",
    crawlerCommitSha: "0123456789abcdef",
    urlInventorySha256: "a".repeat(64),
    captureManifestSha256: "b".repeat(64),
  },
  "2026-08-26T12:05:00.000Z"
)
assert.equal(run.status, "running")
assert.equal(run.sourceCapture.evidenceMode, "public_storefront")
assert.equal(
  privateMigrationArtifactPath(run.runId, "manifest.json"),
  "migration-runs/capture-001/manifest.json"
)
assert.throws(() => privateMigrationArtifactPath("../escape", "manifest.json"))

const completedRun = finalizeMigrationRun(
  run,
  [reconciliation],
  "2026-08-26T12:10:00.000Z"
)
assert.equal(completedRun.status, "completed")

const reviewRun = finalizeMigrationRun(
  run,
  [{ ...reconciliation, pending: 1, isReconciled: false }],
  "2026-08-26T12:10:00.000Z",
  ["Synthetic pending storefront record"]
)
assert.equal(reviewRun.status, "needs_review")
assert.equal(reviewRun.warnings.length, 1)

console.log("COQUETTE public-storefront reconstruction contract checks passed")
