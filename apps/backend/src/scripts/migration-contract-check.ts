import assert from "node:assert/strict"
import { sourceChecksum } from "../migration/checksum"
import {
  createPendingManifestEntry,
  findDuplicateManifestKeys,
  shouldReimport,
} from "../migration/manifest"
import { reconcileMigration } from "../migration/reconciliation"
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
  { entityType: "product", sourceId: "42", locale: "el" },
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
  sourceId: "42",
  sku: "COQ-42",
  name: "Synthetic migration fixture",
  status: "enabled",
  visibility: "catalog_search",
  type: "simple",
  categorySourceIds: ["7"],
  optionValues: { size: "M" },
  mediaSourceIds: ["media-42"],
}

assert.deepEqual(validateNormalizedProduct(sampleProduct), [])

console.log("COQUETTE Magento migration contract checks passed")
