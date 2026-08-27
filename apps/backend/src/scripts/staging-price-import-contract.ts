import type {
  ExecArgs,
  IPricingModuleService,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildDependencyMappingReconciliationPlan } from "../migration/dependency-mapping-reconciliation"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"
import type { MigrationDependencyMapping } from "../migration/staging-product-execution"
import type { MigrationManifestEntry } from "../migration/types"
import { buildReadyStagingMigrationInputFixture } from "./staging-migration-input-test-fixture"
import stagingPriceImport from "./staging-price-import"
import stagingProductImport from "./staging-product-import"

const sku = "COQ-PRICE-EXEC-CONTRACT-1"
const sourceUrl =
  "https://coquetteconcept.gr/default/ci-staging-price-import-contract.html"
const categorySourceUrl =
  "https://coquetteconcept.gr/default/ci-price-migration-category.html"
const mediaSourceUrl =
  "https://coquetteconcept.gr/media/catalog/product/ci-price-migration-contract.jpg"
const servingMediaUrl =
  "https://coquette-media.example/catalog/ci-price-migration-contract.jpg"
const saleListMarkerKey = "coquette_migration_price_list"
const saleListMarkerValue = "legacy-public-sale-v1"

type VariantPriceSetRecord = {
  id: string
  price_set?: { id?: string } | null
}

type PriceRecord = {
  id: string
  amount?: unknown
  currency_code?: string | null
  min_quantity?: unknown
  max_quantity?: unknown
  price_list?: {
    id?: string
    type?: string | null
    status?: string | null
    starts_at?: string | Date | null
    ends_at?: string | Date | null
    rules_count?: number | null
    metadata?: Record<string, unknown> | null
  } | null
}

type PricingState = {
  priceSetId: string
  prices: PriceRecord[]
}

function candidateObservation(
  regularPrice: number,
  salePrice?: number
): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt: "2026-08-27T07:00:00.000Z",
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku,
      name: "COQUETTE Price Migration Contract Product",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      description: "CI-only guarded pricing migration contract product",
      categorySourceIds: [categorySourceUrl],
      optionValues: { size: "S" },
      mediaSourceIds: [mediaSourceUrl],
      regularPrice,
      salePrice,
      currencyCode: "EUR",
    },
  }
}

function bundleFor(regularPrice: number, salePrice?: number) {
  const candidate = buildRecoveryProductCandidate("ci-staging-price-import", [
    candidateObservation(regularPrice, salePrice),
  ])
  const bundle = buildReadyStagingMigrationInputFixture({
    candidates: [candidate],
    captureId: "ci-staging-price-import",
  })
  assert.equal(bundle.productPlan.isExecutable, true)
  assert.equal(bundle.pricePlan.isReconciled, true)
  return bundle
}

async function writeBundle(
  path: string,
  regularPrice: number,
  salePrice?: number
) {
  const bundle = bundleFor(regularPrice, salePrice)
  await writeFile(path, `${JSON.stringify(bundle, null, 2)}\n`, "utf8")
  process.env.COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM = bundle.bundleChecksum
  return bundle
}

async function pricingState(
  container: ExecArgs["container"],
  variantId: string
): Promise<PricingState> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "variant",
    fields: ["id", "price_set.id"],
    filters: { id: variantId },
  })
  assert.equal(data.length, 1)
  const priceSetId = (data[0] as VariantPriceSetRecord).price_set?.id
  assert.ok(priceSetId)

  const pricingModule = container.resolve<IPricingModuleService>(Modules.PRICING)
  const prices = await pricingModule.listPrices(
    {
      price_set_id: [priceSetId],
      currency_code: "eur",
    },
    {
      relations: ["price_list"],
      take: 100,
    }
  )

  return {
    priceSetId,
    prices: prices as PriceRecord[],
  }
}

function numeric(value: unknown) {
  const amount = Number(value)
  assert.equal(Number.isFinite(amount), true)
  return amount
}

function baseEurPrices(state: PricingState) {
  return state.prices.filter(
    (price) =>
      price.currency_code?.toLowerCase() === "eur" &&
      !price.price_list &&
      price.min_quantity == null &&
      price.max_quantity == null
  )
}

function migrationSalePrices(state: PricingState) {
  return state.prices.filter(
    (price) =>
      price.currency_code?.toLowerCase() === "eur" &&
      price.price_list?.type === "sale" &&
      price.price_list?.status === "active" &&
      price.price_list?.starts_at == null &&
      price.price_list?.ends_at == null &&
      Number(price.price_list?.rules_count ?? 0) === 0 &&
      price.price_list?.metadata?.[saleListMarkerKey] === saleListMarkerValue &&
      price.min_quantity == null &&
      price.max_quantity == null
  )
}

export default async function stagingPriceImportContract({ container }: ExecArgs) {
  const productModuleService = container.resolve(Modules.PRODUCT)
  const root = await mkdtemp(join(tmpdir(), "coquette-staging-price-contract-"))
  const bundlePath = join(root, "migration-input-bundle.json")
  const dependencyPlanPath = join(root, "dependency-plan.json")
  const productManifestPath = join(root, "product-manifest.json")
  const priceManifestPath = join(root, "price-manifest.json")
  const handle = `coquette-price-migration-contract-${Date.now()}`

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
    COQUETTE_STAGING_MIGRATION_INPUT_BUNDLE:
      process.env.COQUETTE_STAGING_MIGRATION_INPUT_BUNDLE,
    COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM:
      process.env.COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM,
    COQUETTE_STAGING_DEPENDENCY_MAPPING_PLAN:
      process.env.COQUETTE_STAGING_DEPENDENCY_MAPPING_PLAN,
    COQUETTE_STAGING_DEPENDENCY_MAPPING_CHECKSUM:
      process.env.COQUETTE_STAGING_DEPENDENCY_MAPPING_CHECKSUM,
    COQUETTE_STAGING_PRODUCT_IMPORT_REPORT:
      process.env.COQUETTE_STAGING_PRODUCT_IMPORT_REPORT,
    COQUETTE_STAGING_PRODUCT_DEPENDENCIES:
      process.env.COQUETTE_STAGING_PRODUCT_DEPENDENCIES,
    COQUETTE_STAGING_PRODUCT_MANIFEST:
      process.env.COQUETTE_STAGING_PRODUCT_MANIFEST,
    COQUETTE_STAGING_PRICE_IMPORT_REPORT:
      process.env.COQUETTE_STAGING_PRICE_IMPORT_REPORT,
    COQUETTE_STAGING_PRICE_MANIFEST:
      process.env.COQUETTE_STAGING_PRICE_MANIFEST,
  }

  try {
    const existingBefore = await productModuleService.listProductVariants({ sku })
    assert.equal(existingBefore.length, 0)

    const category = await productModuleService.createProductCategories({
      name: "COQUETTE Price Migration Contract",
      handle,
    })
    assert.ok(category.id)

    process.env.COQUETTE_STAGING_MIGRATION_INPUT_BUNDLE = bundlePath
    delete process.env.COQUETTE_STAGING_PRODUCT_IMPORT_REPORT
    delete process.env.COQUETTE_STAGING_PRICE_IMPORT_REPORT
    delete process.env.COQUETTE_STAGING_PRODUCT_DEPENDENCIES
    const initialBundle = await writeBundle(bundlePath, 199, 149)
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
    const dependencyPlan = buildDependencyMappingReconciliationPlan({
      bundle: initialBundle,
      mappings: dependencies,
      allowedMediaHosts: ["coquette-media.example"],
    })
    assert.equal(dependencyPlan.isReconciled, true)
    await writeFile(
      dependencyPlanPath,
      `${JSON.stringify(dependencyPlan, null, 2)}\n`,
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
    process.env.COQUETTE_STAGING_DEPENDENCY_MAPPING_PLAN = dependencyPlanPath
    process.env.COQUETTE_STAGING_DEPENDENCY_MAPPING_CHECKSUM =
      dependencyPlan.planChecksum
    process.env.COQUETTE_STAGING_PRODUCT_MANIFEST = productManifestPath

    await stagingProductImport({ container } as ExecArgs)

    const variants = await productModuleService.listProductVariants({ sku })
    assert.equal(variants.length, 1)
    const variantId = variants[0].id
    const productId = variants[0].product_id
    assert.ok(productId)

    const productManifest = JSON.parse(
      await readFile(productManifestPath, "utf8")
    ) as MigrationManifestEntry[]
    assert.equal(productManifest.length, 1)
    assert.equal(productManifest[0].status, "imported")
    assert.equal(productManifest[0].targetId, productId)
    assert.equal(
      productManifest[0].sourceChecksum,
      initialBundle.productPlan.entries[0].sourceChecksum
    )

    process.env.COQUETTE_STAGING_PRICE_MANIFEST = priceManifestPath

    await stagingPriceImport({ container } as ExecArgs)

    let state = await pricingState(container, variantId)
    let basePrices = baseEurPrices(state)
    let salePrices = migrationSalePrices(state)
    assert.equal(basePrices.length, 1)
    assert.equal(numeric(basePrices[0].amount), 199)
    assert.equal(salePrices.length, 1)
    assert.equal(numeric(salePrices[0].amount), 149)
    const migrationSaleListId = salePrices[0].price_list?.id
    assert.ok(migrationSaleListId)

    let priceManifest = JSON.parse(
      await readFile(priceManifestPath, "utf8")
    ) as MigrationManifestEntry[]
    assert.equal(priceManifest.length, 1)
    assert.equal(priceManifest[0].status, "imported")
    assert.equal(priceManifest[0].targetId, variantId)
    assert.equal(priceManifest[0].attempts, 1)
    assert.equal(
      priceManifest[0].sourceChecksum,
      initialBundle.pricePlan.runtimeManifestEntries[0].sourceChecksum
    )

    await stagingPriceImport({ container } as ExecArgs)

    state = await pricingState(container, variantId)
    basePrices = baseEurPrices(state)
    salePrices = migrationSalePrices(state)
    assert.equal(basePrices.length, 1)
    assert.equal(numeric(basePrices[0].amount), 199)
    assert.equal(salePrices.length, 1)
    assert.equal(numeric(salePrices[0].amount), 149)
    assert.equal(salePrices[0].price_list?.id, migrationSaleListId)

    priceManifest = JSON.parse(
      await readFile(priceManifestPath, "utf8")
    ) as MigrationManifestEntry[]
    assert.equal(priceManifest[0].attempts, 1)

    const changedBundle = await writeBundle(bundlePath, 209, 159)
    assert.equal(
      changedBundle.productPlan.entries[0].sourceChecksum,
      initialBundle.productPlan.entries[0].sourceChecksum
    )
    assert.notEqual(
      changedBundle.pricePlan.runtimeManifestEntries[0].sourceChecksum,
      initialBundle.pricePlan.runtimeManifestEntries[0].sourceChecksum
    )

    await stagingPriceImport({ container } as ExecArgs)

    state = await pricingState(container, variantId)
    basePrices = baseEurPrices(state)
    salePrices = migrationSalePrices(state)
    assert.equal(basePrices.length, 1)
    assert.equal(numeric(basePrices[0].amount), 209)
    assert.equal(salePrices.length, 1)
    assert.equal(numeric(salePrices[0].amount), 159)
    assert.equal(salePrices[0].price_list?.id, migrationSaleListId)

    priceManifest = JSON.parse(
      await readFile(priceManifestPath, "utf8")
    ) as MigrationManifestEntry[]
    assert.equal(priceManifest[0].attempts, 2)
    assert.equal(
      priceManifest[0].sourceChecksum,
      changedBundle.pricePlan.runtimeManifestEntries[0].sourceChecksum
    )
    assert.ok(
      priceManifest[0].warnings.some((warning) =>
        warning.includes("checksum changed")
      )
    )

    const regularOnlyBundle = await writeBundle(bundlePath, 209)
    assert.equal(
      regularOnlyBundle.productPlan.entries[0].sourceChecksum,
      initialBundle.productPlan.entries[0].sourceChecksum
    )

    await stagingPriceImport({ container } as ExecArgs)

    state = await pricingState(container, variantId)
    basePrices = baseEurPrices(state)
    salePrices = migrationSalePrices(state)
    assert.equal(basePrices.length, 1)
    assert.equal(numeric(basePrices[0].amount), 209)
    assert.equal(salePrices.length, 0)

    priceManifest = JSON.parse(
      await readFile(priceManifestPath, "utf8")
    ) as MigrationManifestEntry[]
    assert.equal(priceManifest[0].attempts, 3)
    assert.equal(
      priceManifest[0].sourceChecksum,
      regularOnlyBundle.pricePlan.runtimeManifestEntries[0].sourceChecksum
    )

    const variantsAfterAllRuns = await productModuleService.listProductVariants({ sku })
    assert.equal(variantsAfterAllRuns.length, 1)
    assert.equal(variantsAfterAllRuns[0].id, variantId)
    assert.equal(variantsAfterAllRuns[0].product_id, productId)

    console.log(
      "COQUETTE clean-database verified dependency-plan product bootstrap + reconciled-bundle staging price import idempotency/update/sale-removal contract passed"
    )
  } finally {
    for (const [key, value] of Object.entries(priorEnvironment)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(root, { recursive: true, force: true })
  }
}
