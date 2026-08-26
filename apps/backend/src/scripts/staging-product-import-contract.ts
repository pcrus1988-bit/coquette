import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildProductImportPlan } from "../migration/import-plan"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"
import type { MigrationDependencyMapping } from "../migration/staging-product-execution"
import type { MigrationManifestEntry } from "../migration/types"
import stagingProductImport from "./staging-product-import"

const sku = "COQ-MIG-EXEC-CONTRACT-1"
const sourceUrl =
  "https://coquetteconcept.gr/default/ci-staging-import-contract.html"
const categorySourceUrl =
  "https://coquetteconcept.gr/default/ci-migration-category.html"
const mediaSourceUrl =
  "https://coquetteconcept.gr/media/catalog/product/ci-migration-contract.jpg"
const servingMediaUrl =
  "https://coquette-media.example/catalog/ci-migration-contract.jpg"

function candidateObservation(): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt: "2026-08-26T21:00:00.000Z",
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku,
      name: "COQUETTE Migration Contract Product",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      description: "CI-only structural migration contract product",
      categorySourceIds: [categorySourceUrl],
      optionValues: { size: "S" },
      mediaSourceIds: [mediaSourceUrl],
      stockState: "in_stock",
      regularPrice: 199,
      salePrice: 149,
      currencyCode: "EUR",
    },
  }
}

export default async function stagingProductImportContract({ container }: ExecArgs) {
  const productModuleService = container.resolve(Modules.PRODUCT)
  const root = await mkdtemp(join(tmpdir(), "coquette-staging-import-contract-"))
  const reportPath = join(root, "capture-report.json")
  const dependenciesPath = join(root, "dependencies.json")
  const manifestPath = join(root, "product-manifest.json")
  const handle = `coquette-migration-contract-${Date.now()}`

  const priorEnvironment = {
    COQUETTE_MIGRATION_MODE: process.env.COQUETTE_MIGRATION_MODE,
    COQUETTE_MIGRATION_TARGET: process.env.COQUETTE_MIGRATION_TARGET,
    COQUETTE_MIGRATION_ALLOW_WRITE: process.env.COQUETTE_MIGRATION_ALLOW_WRITE,
    COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST:
      process.env.COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST,
    COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME:
      process.env.COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME,
    COQUETTE_MIGRATION_ALLOWED_MEDIA_HOSTS:
      process.env.COQUETTE_MIGRATION_ALLOWED_MEDIA_HOSTS,
    COQUETTE_STAGING_PRODUCT_IMPORT_REPORT:
      process.env.COQUETTE_STAGING_PRODUCT_IMPORT_REPORT,
    COQUETTE_STAGING_PRODUCT_DEPENDENCIES:
      process.env.COQUETTE_STAGING_PRODUCT_DEPENDENCIES,
    COQUETTE_STAGING_PRODUCT_MANIFEST:
      process.env.COQUETTE_STAGING_PRODUCT_MANIFEST,
  }

  try {
    const existingBefore = await productModuleService.listProductVariants({ sku })
    assert.equal(
      existingBefore.length,
      0,
      `CI database unexpectedly already contains migration contract SKU ${sku}`
    )

    const category = await productModuleService.createProductCategories({
      name: "COQUETTE Migration Contract",
      handle,
    })
    assert.ok(category.id)

    const candidate = buildRecoveryProductCandidate("ci-staging-import", [
      candidateObservation(),
    ])
    const importPlan = buildProductImportPlan([candidate])
    assert.equal(importPlan.isExecutable, true)

    const dependencies: MigrationDependencyMapping[] = [
      {
        entityType: "category",
        sourceId: categorySourceUrl,
        status: "imported",
        targetId: category.id,
      },
      {
        entityType: "media",
        sourceId: mediaSourceUrl,
        status: "imported",
        targetUrl: servingMediaUrl,
      },
    ]

    await writeFile(
      reportPath,
      `${JSON.stringify({ schemaVersion: 3, importPlan }, null, 2)}\n`,
      "utf8"
    )
    await writeFile(
      dependenciesPath,
      `${JSON.stringify(dependencies, null, 2)}\n`,
      "utf8"
    )

    const databaseUrl = new URL(process.env.DATABASE_URL!)
    process.env.COQUETTE_MIGRATION_MODE = "write"
    process.env.COQUETTE_MIGRATION_TARGET = "staging"
    process.env.COQUETTE_MIGRATION_ALLOW_WRITE =
      "COQUETTE_STAGING_WRITE_CONFIRMED"
    process.env.COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST = databaseUrl.hostname
    process.env.COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME =
      databaseUrl.pathname.replace(/^\//, "")
    process.env.COQUETTE_MIGRATION_ALLOWED_MEDIA_HOSTS =
      "coquette-media.example"
    process.env.COQUETTE_STAGING_PRODUCT_IMPORT_REPORT = reportPath
    process.env.COQUETTE_STAGING_PRODUCT_DEPENDENCIES = dependenciesPath
    process.env.COQUETTE_STAGING_PRODUCT_MANIFEST = manifestPath

    await stagingProductImport({ container } as ExecArgs)

    const variantsAfterFirst = await productModuleService.listProductVariants({ sku })
    assert.equal(variantsAfterFirst.length, 1)
    assert.equal(variantsAfterFirst[0].manage_inventory, true)

    const productId = variantsAfterFirst[0].product_id
    assert.ok(productId)
    const productsAfterFirst = await productModuleService.listProducts({ id: productId })
    assert.equal(productsAfterFirst.length, 1)
    assert.equal(
      productsAfterFirst[0].metadata?.coquette_migration_source_id,
      sourceUrl
    )
    assert.equal(
      productsAfterFirst[0].metadata?.coquette_migration_source_checksum,
      importPlan.runtimeManifestEntries[0].sourceChecksum
    )

    const firstManifest = JSON.parse(
      await readFile(manifestPath, "utf8")
    ) as MigrationManifestEntry[]
    assert.equal(firstManifest.length, 1)
    assert.equal(firstManifest[0].status, "imported")
    assert.equal(firstManifest[0].targetId, productId)
    assert.equal(firstManifest[0].attempts, 1)

    await stagingProductImport({ container } as ExecArgs)

    const variantsAfterSecond = await productModuleService.listProductVariants({ sku })
    assert.equal(variantsAfterSecond.length, 1)
    assert.equal(variantsAfterSecond[0].product_id, productId)

    const secondManifest = JSON.parse(
      await readFile(manifestPath, "utf8")
    ) as MigrationManifestEntry[]
    assert.equal(secondManifest.length, 1)
    assert.equal(secondManifest[0].status, "imported")
    assert.equal(secondManifest[0].targetId, productId)
    assert.equal(secondManifest[0].attempts, 1)

    console.log(
      "COQUETTE clean-database staging structural product import idempotency contract passed"
    )
  } finally {
    for (const [key, value] of Object.entries(priorEnvironment)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(root, { recursive: true, force: true })
  }
}
