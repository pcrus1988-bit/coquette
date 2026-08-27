import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { manifestKey } from "../migration/manifest"
import { readVerifiedStagingMigrationInputBundle } from "../migration/staging-migration-input"
import {
  assertStagingMigrationWriteGuard,
  buildStagingProductExecutionPlan,
  prepareMedusaSimpleProductInput,
  type MigrationDependencyMapping,
} from "../migration/staging-product-execution"
import type {
  MigrationManifestEntry,
  MigrationSourceKey,
} from "../migration/types"
import { BRAND_MODULE } from "../modules/brand"

type ProductBrandGraphRecord = {
  id: string
  brand?: { id?: string } | null
}

type LinkService = {
  create: (
    links: Array<Record<string, Record<string, string>>>
  ) => Promise<unknown>
}

function unexpectedState(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T
}

async function readManifest(path?: string): Promise<MigrationManifestEntry[]> {
  if (!path) return []
  try {
    const value = await readJson<unknown>(path)
    if (!Array.isArray(value)) {
      throw unexpectedState("Product migration manifest must be a JSON array")
    }
    return value as MigrationManifestEntry[]
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENOENT") return []
    throw error
  }
}

async function atomicWriteJson(path: string, value: unknown) {
  const target = resolve(path)
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  await rename(temporary, target)
}

function upsertManifestEntry(
  entries: MigrationManifestEntry[],
  next: MigrationManifestEntry
) {
  const key = manifestKey(next)
  const matches = entries.filter((entry) => manifestKey(entry) === key)
  if (matches.length > 1) {
    throw unexpectedState(`Duplicate product manifest entries for ${key}`)
  }
  const filtered = entries.filter((entry) => manifestKey(entry) !== key)
  return [...filtered, next].sort((left, right) =>
    manifestKey(left).localeCompare(manifestKey(right))
  )
}

function matchingRuntimeManifestEntry(
  importPlan: Parameters<typeof buildStagingProductExecutionPlan>[0]["importPlan"],
  sourceKey: MigrationSourceKey,
  sourceChecksum: string
) {
  return importPlan.runtimeManifestEntries.find(
    (entry) =>
      manifestKey(entry) === manifestKey(sourceKey) &&
      entry.sourceChecksum === sourceChecksum
  )
}

function nextImportedManifestEntry(
  base: MigrationManifestEntry,
  previous: MigrationManifestEntry | undefined,
  targetId: string,
  now: string,
  warning?: string
): MigrationManifestEntry {
  return {
    ...base,
    status: "imported",
    targetId,
    attempts: (previous?.attempts ?? 0) + 1,
    warnings: warning
      ? [...new Set([...(previous?.warnings ?? base.warnings), warning])]
      : [...(previous?.warnings ?? base.warnings)],
    errors: [],
    firstImportedAt: previous?.firstImportedAt ?? now,
    lastAttemptAt: now,
  }
}

function nextErrorManifestEntry(
  base: MigrationManifestEntry,
  previous: MigrationManifestEntry | undefined,
  error: unknown,
  now: string
): MigrationManifestEntry {
  const message = error instanceof Error ? error.message : String(error)
  return {
    ...base,
    status: "error",
    attempts: (previous?.attempts ?? 0) + 1,
    warnings: [...(previous?.warnings ?? base.warnings)],
    errors: [message],
    firstImportedAt: previous?.firstImportedAt,
    lastAttemptAt: now,
  }
}

function allowedMediaHosts() {
  return (process.env.COQUETTE_MIGRATION_ALLOWED_MEDIA_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

function migrationMode() {
  const value = process.env.COQUETTE_MIGRATION_MODE?.trim() || "dry-run"
  if (value !== "dry-run" && value !== "write") {
    throw unexpectedState(
      "COQUETTE_MIGRATION_MODE must be either 'dry-run' or 'write'"
    )
  }
  return value
}

async function runtimeDefaults(container: ExecArgs["container"]) {
  const storeModuleService = container.resolve(Modules.STORE)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  const stores = await storeModuleService.listStores({}, { take: 2 })
  if (stores.length !== 1) {
    throw unexpectedState(
      `Expected exactly one COQUETTE store for staging import, found ${stores.length}`
    )
  }
  const salesChannelId = stores[0].default_sales_channel_id
  if (!salesChannelId) {
    throw unexpectedState("COQUETTE store has no default sales channel")
  }

  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (shippingProfiles.length !== 1) {
    throw unexpectedState(
      `Expected exactly one default shipping profile, found ${shippingProfiles.length}`
    )
  }

  return {
    defaultSalesChannelId: salesChannelId,
    defaultShippingProfileId: shippingProfiles[0].id,
  }
}

async function existingProductBySku(
  container: ExecArgs["container"],
  sku: string
) {
  const productModuleService = container.resolve(Modules.PRODUCT)
  const variants = await productModuleService.listProductVariants({ sku })
  if (variants.length > 1) {
    throw unexpectedState(
      `Multiple Medusa variants already use SKU ${sku}; refusing migration recovery`
    )
  }
  if (variants.length === 0) return undefined

  const productId = variants[0].product_id
  if (!productId) {
    throw unexpectedState(
      `Existing Medusa variant with SKU ${sku} has no product_id`
    )
  }
  const products = await productModuleService.listProducts({ id: productId })
  if (products.length !== 1) {
    throw unexpectedState(
      `Expected one Medusa product for existing SKU ${sku}, found ${products.length}`
    )
  }
  return products[0]
}

function metadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key]
  return typeof value === "string" ? value : undefined
}

async function linkedBrandId(
  container: ExecArgs["container"],
  productId: string
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "brand.id"],
    filters: { id: productId },
  })
  if (data.length !== 1) {
    throw unexpectedState(
      `Expected exactly one product while checking brand link for ${productId}, found ${data.length}`
    )
  }
  const product = data[0] as ProductBrandGraphRecord
  return product.brand?.id
}

async function assertBrandExists(
  container: ExecArgs["container"],
  brandId: string
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "brand",
    fields: ["id"],
    filters: { id: brandId },
  })
  if (data.length !== 1) {
    throw unexpectedState(
      `Brand dependency ${brandId} does not resolve to exactly one COQUETTE Brand record`
    )
  }
}

async function ensureProductBrandLink(
  container: ExecArgs["container"],
  productId: string,
  brandId: string
) {
  await assertBrandExists(container, brandId)

  const existingBrandId = await linkedBrandId(container, productId)
  if (existingBrandId === brandId) return "existing" as const
  if (existingBrandId) {
    throw unexpectedState(
      `Product ${productId} is already linked to different brand ${existingBrandId}; expected ${brandId}`
    )
  }

  const link = container.resolve(ContainerRegistrationKeys.LINK) as LinkService
  await link.create([
    {
      [Modules.PRODUCT]: { product_id: productId },
      [BRAND_MODULE]: { brand_id: brandId },
    },
  ])

  const linkedBrand = await linkedBrandId(container, productId)
  if (linkedBrand !== brandId) {
    throw unexpectedState(
      `Product-brand link verification failed for product ${productId} and brand ${brandId}`
    )
  }
  return "created" as const
}

export default async function stagingProductImport({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const mode = migrationMode()
  const dependenciesPath =
    process.env.COQUETTE_STAGING_PRODUCT_DEPENDENCIES?.trim()
  const manifestPath = process.env.COQUETTE_STAGING_PRODUCT_MANIFEST?.trim()

  if (!dependenciesPath) {
    throw unexpectedState(
      "COQUETTE_STAGING_PRODUCT_DEPENDENCIES is required"
    )
  }

  const migrationInput = await readVerifiedStagingMigrationInputBundle(process.env)
  const importPlan = migrationInput.productPlan
  const dependencies = await readJson<MigrationDependencyMapping[]>(
    dependenciesPath
  )
  if (!Array.isArray(dependencies)) {
    throw unexpectedState("Staging product dependency mapping must be a JSON array")
  }

  let manifestEntries = await readManifest(manifestPath)
  const executionPlan = buildStagingProductExecutionPlan({
    importPlan,
    dependencyMappings: dependencies,
    previousProductManifestEntries: manifestEntries,
    allowedMediaHosts: allowedMediaHosts(),
  })

  logger.info(
    `COQUETTE staging product import preflight: mode=${mode}, bundle=${migrationInput.bundleChecksum}, create=${executionPlan.totals.create}, skip=${executionPlan.totals.skip}, blocked=${executionPlan.totals.blocked}`
  )

  if (!executionPlan.isExecutable) {
    const blocked = executionPlan.entries
      .filter((entry) => entry.action === "blocked")
      .map((entry) => ({
        candidateKey: entry.candidateKey,
        blockers: entry.blockers,
      }))
    logger.error(
      `COQUETTE staging product import is blocked: ${JSON.stringify({
        globalBlockers: executionPlan.globalBlockers,
        duplicateDependencyKeys: executionPlan.duplicateDependencyKeys,
        blocked,
      })}`
    )
    throw unexpectedState(
      "Staging product import preflight failed; no product writes were attempted"
    )
  }

  if (mode === "dry-run") {
    logger.info(
      `COQUETTE staging product import dry-run passed: ${JSON.stringify(
        executionPlan.entries.map((entry) => ({
          candidateKey: entry.candidateKey,
          action: entry.action,
          sourceId: entry.sourceKey?.sourceId,
          sku: entry.normalizedProduct?.sku,
          categories: entry.categoryTargetIds.length,
          media: entry.mediaTargetUrls.length,
          brandTargetId: entry.brandTargetId,
          existingTargetId: entry.existingTargetId,
          executionChecksum: entry.executionChecksum,
        }))
      )}`
    )
    return
  }

  assertStagingMigrationWriteGuard(process.env)
  if (!manifestPath) {
    throw unexpectedState(
      "COQUETTE_STAGING_PRODUCT_MANIFEST is required in write mode"
    )
  }

  const defaults = await runtimeDefaults(container)

  for (const entry of executionPlan.entries) {
    if (!entry.sourceKey || !entry.sourceChecksum) {
      throw unexpectedState(
        `Executable entry ${entry.candidateKey} lost its source identity`
      )
    }
    const runtimeEntry = matchingRuntimeManifestEntry(
      importPlan,
      entry.sourceKey,
      entry.sourceChecksum
    )
    if (!runtimeEntry) {
      throw unexpectedState(
        `Executable entry ${entry.candidateKey} has no matching runtime manifest entry`
      )
    }

    const now = new Date().toISOString()
    try {
      if (entry.action === "skip") {
        if (!entry.existingTargetId) {
          throw unexpectedState(
            `Skip entry ${entry.candidateKey} is missing its existing target ID`
          )
        }
        if (entry.brandTargetId) {
          await ensureProductBrandLink(
            container,
            entry.existingTargetId,
            entry.brandTargetId
          )
        }
        logger.info(
          `Skipping already imported product ${entry.candidateKey} -> ${entry.existingTargetId}`
        )
        continue
      }
      if (entry.action !== "create" || !entry.normalizedProduct) {
        throw unexpectedState(
          `Unexpected non-create action in executable staging plan: ${entry.action}`
        )
      }

      const existing = await existingProductBySku(
        container,
        entry.normalizedProduct.sku
      )
      if (existing) {
        const sourceId = metadataString(
          existing.metadata as Record<string, unknown> | null | undefined,
          "coquette_migration_source_id"
        )
        const sourceChecksum = metadataString(
          existing.metadata as Record<string, unknown> | null | undefined,
          "coquette_migration_source_checksum"
        )
        if (
          sourceId !== entry.sourceKey.sourceId ||
          sourceChecksum !== entry.sourceChecksum
        ) {
          throw unexpectedState(
            `SKU ${entry.normalizedProduct.sku} already belongs to an unrelated or changed Medusa product ${existing.id}`
          )
        }

        if (entry.brandTargetId) {
          await ensureProductBrandLink(
            container,
            existing.id,
            entry.brandTargetId
          )
        }

        const recovered = nextImportedManifestEntry(
          runtimeEntry,
          entry.previousManifestEntry,
          existing.id,
          now,
          "Recovered existing Medusa product by SKU and migration metadata after a manifest gap."
        )
        manifestEntries = upsertManifestEntry(manifestEntries, recovered)
        await atomicWriteJson(manifestPath, manifestEntries)
        logger.info(
          `Recovered existing staging product ${entry.candidateKey} -> ${existing.id}`
        )
        continue
      }

      const productInput = prepareMedusaSimpleProductInput(entry, defaults)
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [productInput],
        },
      })
      const created = result[0]
      if (!created?.id) {
        throw unexpectedState(
          `Medusa product workflow returned no product ID for ${entry.candidateKey}`
        )
      }

      if (entry.brandTargetId) {
        await ensureProductBrandLink(container, created.id, entry.brandTargetId)
      }

      const imported = nextImportedManifestEntry(
        runtimeEntry,
        entry.previousManifestEntry,
        created.id,
        now
      )
      manifestEntries = upsertManifestEntry(manifestEntries, imported)
      await atomicWriteJson(manifestPath, manifestEntries)
      logger.info(
        `Imported staging product ${entry.candidateKey} -> ${created.id}`
      )
    } catch (error) {
      const failed = nextErrorManifestEntry(
        runtimeEntry,
        entry.previousManifestEntry,
        error,
        now
      )
      manifestEntries = upsertManifestEntry(manifestEntries, failed)
      await atomicWriteJson(manifestPath, manifestEntries)
      throw error
    }
  }

  logger.info(
    `COQUETTE staging structural product import complete: bundle=${migrationInput.bundleChecksum}, manifest=${resolve(
      manifestPath
    )}`
  )
}
