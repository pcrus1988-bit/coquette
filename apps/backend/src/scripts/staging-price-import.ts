import type {
  ExecArgs,
  IPricingModuleService,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  batchPriceListPricesWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import type { ProductImportPlan } from "../migration/import-plan"
import { manifestKey } from "../migration/manifest"
import { buildPricePlan } from "../migration/price-plan"
import {
  buildStagingPriceExecutionPlan,
  type StagingPriceExecutionEntry,
} from "../migration/staging-price-execution"
import { assertStagingMigrationWriteGuard } from "../migration/staging-product-execution"
import type { MigrationManifestEntry } from "../migration/types"

const MIGRATION_SALE_LIST_MARKER_KEY = "coquette_migration_price_list"
const MIGRATION_SALE_LIST_MARKER_VALUE = "legacy-public-sale-v1"
const MIGRATION_SALE_LIST_TITLE = "COQUETTE Legacy Public Sale"
const MIGRATION_SALE_LIST_DESCRIPTION =
  "Recovered public legacy sale prices. No start/end dates were invented during migration."

type CaptureIngestionReport = {
  schemaVersion?: number
  importPlan?: ProductImportPlan
}

type VariantRecord = {
  id: string
  sku?: string | null
  product_id?: string | null
}

type VariantPriceRecord = {
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

type VariantPricingGraphRecord = {
  id: string
  product_id?: string | null
  sku?: string | null
  prices?: VariantPriceRecord[] | null
}

type SalePriceListRecord = {
  id: string
  title?: string | null
  description?: string | null
  type?: string | null
  status?: string | null
  starts_at?: string | Date | null
  ends_at?: string | Date | null
  rules_count?: number | null
  metadata?: Record<string, unknown> | null
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
      throw unexpectedState("Migration manifest must be a JSON array")
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
    throw unexpectedState(`Duplicate price manifest entries for ${key}`)
  }
  const filtered = entries.filter((entry) => manifestKey(entry) !== key)
  return [...filtered, next].sort((left, right) =>
    manifestKey(left).localeCompare(manifestKey(right))
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

function migrationMode() {
  const value = process.env.COQUETTE_MIGRATION_MODE?.trim() || "dry-run"
  if (value !== "dry-run" && value !== "write") {
    throw unexpectedState(
      "COQUETTE_MIGRATION_MODE must be either 'dry-run' or 'write'"
    )
  }
  return value
}

function numberValue(value: unknown, label: string) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    throw unexpectedState(`${label} is not a finite numeric amount`)
  }
  return numeric
}

function isBaseCurrencyPrice(price: VariantPriceRecord) {
  return (
    price.currency_code?.toLowerCase() === "eur" &&
    !price.price_list &&
    price.min_quantity == null &&
    price.max_quantity == null
  )
}

function isMigrationSalePrice(
  price: VariantPriceRecord,
  migrationSaleListId: string | undefined
) {
  return (
    Boolean(migrationSaleListId) &&
    price.currency_code?.toLowerCase() === "eur" &&
    price.price_list?.id === migrationSaleListId &&
    price.min_quantity == null &&
    price.max_quantity == null
  )
}

function priceListMarker(value: Record<string, unknown> | null | undefined) {
  const marker = value?.[MIGRATION_SALE_LIST_MARKER_KEY]
  return typeof marker === "string" ? marker : undefined
}

function priceListCurrentlyActive(priceList: VariantPriceRecord["price_list"]) {
  if (!priceList || priceList.type !== "sale" || priceList.status !== "active") {
    return false
  }
  const now = Date.now()
  const starts = priceList.starts_at ? new Date(priceList.starts_at).getTime() : undefined
  const ends = priceList.ends_at ? new Date(priceList.ends_at).getTime() : undefined
  if (starts !== undefined && Number.isFinite(starts) && starts > now) return false
  if (ends !== undefined && Number.isFinite(ends) && ends <= now) return false
  return true
}

async function resolveVariantBySku(
  container: ExecArgs["container"],
  sku: string,
  expectedProductId: string
): Promise<VariantRecord> {
  const productModuleService = container.resolve(Modules.PRODUCT)
  const variants = await productModuleService.listProductVariants({ sku })
  if (variants.length !== 1) {
    throw unexpectedState(
      `Expected exactly one Medusa variant for migration SKU ${sku}, found ${variants.length}`
    )
  }
  const variant = variants[0] as VariantRecord
  if (variant.product_id !== expectedProductId) {
    throw unexpectedState(
      `SKU ${sku} resolves to product ${variant.product_id ?? "<missing>"}, expected imported product ${expectedProductId}`
    )
  }
  return variant
}

async function variantPricingGraph(
  container: ExecArgs["container"],
  variantId: string
): Promise<VariantPricingGraphRecord> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "variant",
    fields: [
      "id",
      "sku",
      "product_id",
      "prices.id",
      "prices.amount",
      "prices.currency_code",
      "prices.min_quantity",
      "prices.max_quantity",
      "prices.price_list.id",
      "prices.price_list.type",
      "prices.price_list.status",
      "prices.price_list.starts_at",
      "prices.price_list.ends_at",
      "prices.price_list.rules_count",
      "prices.price_list.metadata",
    ],
    filters: { id: variantId },
  })
  if (data.length !== 1) {
    throw unexpectedState(
      `Expected exactly one pricing graph record for variant ${variantId}, found ${data.length}`
    )
  }
  return data[0] as VariantPricingGraphRecord
}

async function findMigrationSalePriceList(
  container: ExecArgs["container"]
): Promise<SalePriceListRecord | undefined> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "price_list",
    fields: [
      "id",
      "title",
      "description",
      "type",
      "status",
      "starts_at",
      "ends_at",
      "rules_count",
      "metadata",
    ],
    filters: { type: "sale" },
  })
  const matches = (data as SalePriceListRecord[]).filter(
    (record) =>
      priceListMarker(record.metadata) === MIGRATION_SALE_LIST_MARKER_VALUE
  )
  if (matches.length > 1) {
    throw unexpectedState(
      `Multiple COQUETTE migration sale price lists carry marker ${MIGRATION_SALE_LIST_MARKER_VALUE}`
    )
  }
  if (matches.length === 0) return undefined

  const priceList = matches[0]
  if (
    priceList.type !== "sale" ||
    priceList.status !== "active" ||
    priceList.starts_at != null ||
    priceList.ends_at != null ||
    Number(priceList.rules_count ?? 0) !== 0
  ) {
    throw unexpectedState(
      `Migration sale price list ${priceList.id} was altered from its fail-closed active/unrestricted configuration`
    )
  }
  return priceList
}

async function ensureMigrationSalePriceList(
  container: ExecArgs["container"],
  required: boolean
) {
  const existing = await findMigrationSalePriceList(container)
  if (existing || !required) return existing

  const pricingModule = container.resolve<IPricingModuleService>(Modules.PRICING)
  const created = await pricingModule.createPriceLists([
    {
      title: MIGRATION_SALE_LIST_TITLE,
      description: MIGRATION_SALE_LIST_DESCRIPTION,
      type: "sale",
      status: "active",
      starts_at: null,
      ends_at: null,
      metadata: {
        [MIGRATION_SALE_LIST_MARKER_KEY]: MIGRATION_SALE_LIST_MARKER_VALUE,
      },
    },
  ])
  if (created.length !== 1) {
    throw unexpectedState(
      `Expected one migration sale price list to be created, received ${created.length}`
    )
  }
  return created[0] as SalePriceListRecord
}

function assertNoForeignActiveSalePrice(
  graph: VariantPricingGraphRecord,
  migrationSaleListId: string | undefined
) {
  const foreign = (graph.prices ?? []).filter(
    (price) =>
      price.currency_code?.toLowerCase() === "eur" &&
      price.price_list?.id !== migrationSaleListId &&
      priceListCurrentlyActive(price.price_list) &&
      Number(price.price_list?.rules_count ?? 0) === 0
  )
  if (foreign.length > 0) {
    throw unexpectedState(
      `Variant ${graph.id} already has ${foreign.length} active unrestricted EUR sale price(s) outside the COQUETTE migration sale list`
    )
  }
}

async function applyExpectedPriceState(
  container: ExecArgs["container"],
  entry: StagingPriceExecutionEntry,
  migrationSaleList: SalePriceListRecord | undefined
) {
  if (!entry.reconstructedPrice || !entry.sku || !entry.productTargetId) {
    throw unexpectedState(
      `Executable price entry ${entry.candidateKey} lost required price/product identity`
    )
  }

  const variant = await resolveVariantBySku(
    container,
    entry.sku,
    entry.productTargetId
  )
  let graph = await variantPricingGraph(container, variant.id)
  assertNoForeignActiveSalePrice(graph, migrationSaleList?.id)

  const basePrices = (graph.prices ?? []).filter(isBaseCurrencyPrice)
  if (basePrices.length > 1) {
    throw unexpectedState(
      `Variant ${variant.id} has multiple unrestricted base EUR prices`
    )
  }

  let changed = false
  const regularPrice = entry.reconstructedPrice.regularPrice
  if (
    basePrices.length === 0 ||
    numberValue(basePrices[0].amount, `Base EUR price ${basePrices[0]?.id ?? "<missing>"}`) !==
      regularPrice
  ) {
    await updateProductVariantsWorkflow(container).run({
      input: {
        product_variants: [
          {
            id: variant.id,
            prices: [{ amount: regularPrice, currency_code: "eur" }],
          },
        ],
      },
    })
    changed = true
    graph = await variantPricingGraph(container, variant.id)
  }

  const migrationSalePrices = (graph.prices ?? []).filter((price) =>
    isMigrationSalePrice(price, migrationSaleList?.id)
  )
  if (migrationSalePrices.length > 1) {
    throw unexpectedState(
      `Variant ${variant.id} has multiple EUR prices in migration sale list ${migrationSaleList?.id}`
    )
  }

  const expectedSale = entry.reconstructedPrice.salePrice
  if (expectedSale !== undefined) {
    if (!migrationSaleList) {
      throw unexpectedState(
        `Variant ${variant.id} requires a sale price but no migration sale list exists`
      )
    }

    const existingSale = migrationSalePrices[0]
    if (!existingSale) {
      await batchPriceListPricesWorkflow(container).run({
        input: {
          data: {
            id: migrationSaleList.id,
            create: [
              {
                amount: expectedSale,
                currency_code: "eur",
                variant_id: variant.id,
              },
            ],
            update: [],
            delete: [],
          },
        },
      })
      changed = true
    } else if (
      numberValue(existingSale.amount, `Migration sale price ${existingSale.id}`) !==
      expectedSale
    ) {
      await batchPriceListPricesWorkflow(container).run({
        input: {
          data: {
            id: migrationSaleList.id,
            create: [],
            update: [
              {
                id: existingSale.id,
                amount: expectedSale,
                currency_code: "eur",
                variant_id: variant.id,
              },
            ],
            delete: [],
          },
        },
      })
      changed = true
    }
  } else if (migrationSalePrices[0] && migrationSaleList) {
    await batchPriceListPricesWorkflow(container).run({
      input: {
        data: {
          id: migrationSaleList.id,
          create: [],
          update: [],
          delete: [migrationSalePrices[0].id],
        },
      },
    })
    changed = true
  }

  const verified = await variantPricingGraph(container, variant.id)
  assertNoForeignActiveSalePrice(verified, migrationSaleList?.id)
  const verifiedBase = (verified.prices ?? []).filter(isBaseCurrencyPrice)
  if (
    verifiedBase.length !== 1 ||
    numberValue(verifiedBase[0].amount, `Verified base EUR price ${variant.id}`) !==
      regularPrice
  ) {
    throw unexpectedState(
      `Regular EUR price verification failed for variant ${variant.id}`
    )
  }

  const verifiedMigrationSale = (verified.prices ?? []).filter((price) =>
    isMigrationSalePrice(price, migrationSaleList?.id)
  )
  if (expectedSale === undefined) {
    if (verifiedMigrationSale.length !== 0) {
      throw unexpectedState(
        `Sale-price removal verification failed for variant ${variant.id}`
      )
    }
  } else if (
    verifiedMigrationSale.length !== 1 ||
    numberValue(
      verifiedMigrationSale[0].amount,
      `Verified migration sale price ${variant.id}`
    ) !== expectedSale
  ) {
    throw unexpectedState(
      `Sale EUR price verification failed for variant ${variant.id}`
    )
  }

  return { variantId: variant.id, changed }
}

export default async function stagingPriceImport({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const mode = migrationMode()
  const reportPath = process.env.COQUETTE_STAGING_PRICE_IMPORT_REPORT?.trim()
  const productManifestPath =
    process.env.COQUETTE_STAGING_PRODUCT_MANIFEST?.trim()
  const priceManifestPath = process.env.COQUETTE_STAGING_PRICE_MANIFEST?.trim()

  if (!reportPath || !productManifestPath) {
    throw unexpectedState(
      "COQUETTE_STAGING_PRICE_IMPORT_REPORT and COQUETTE_STAGING_PRODUCT_MANIFEST are required"
    )
  }

  const report = await readJson<CaptureIngestionReport>(reportPath)
  if (report.schemaVersion !== 3 || !report.importPlan) {
    throw unexpectedState(
      "Staging price import requires a Phase 4F capture-ingestion report with schemaVersion=3 and importPlan"
    )
  }

  const pricePlan = buildPricePlan(report.importPlan)
  const productManifest = await readManifest(productManifestPath)
  let priceManifest = await readManifest(priceManifestPath)
  const executionPlan = buildStagingPriceExecutionPlan({
    pricePlan,
    productManifestEntries: productManifest,
    previousPriceManifestEntries: priceManifest,
  })

  logger.info(
    `COQUETTE staging price import preflight: mode=${mode}, apply=${executionPlan.totals.apply}, skip=${executionPlan.totals.skip}, unavailable=${executionPlan.totals.unavailable}, blocked=${executionPlan.totals.blocked}`
  )

  if (!executionPlan.isExecutable) {
    logger.error(
      `COQUETTE staging price import is blocked: ${JSON.stringify({
        globalBlockers: executionPlan.globalBlockers,
        duplicateProductManifestKeys: executionPlan.duplicateProductManifestKeys,
        duplicatePriceManifestKeys: executionPlan.duplicatePriceManifestKeys,
        blocked: executionPlan.entries
          .filter((entry) => entry.action === "blocked")
          .map((entry) => ({
            candidateKey: entry.candidateKey,
            blockers: entry.blockers,
          })),
      })}`
    )
    throw unexpectedState(
      "Staging price import preflight failed; no pricing writes were attempted"
    )
  }

  if (mode === "dry-run") {
    logger.info(
      `COQUETTE staging price import dry-run passed: ${JSON.stringify(
        executionPlan.entries.map((entry) => ({
          candidateKey: entry.candidateKey,
          action: entry.action,
          sku: entry.sku,
          productTargetId: entry.productTargetId,
          regularPrice: entry.reconstructedPrice?.regularPrice,
          salePrice: entry.reconstructedPrice?.salePrice,
          previousPriceManifestStatus: entry.previousPriceManifestEntry?.status,
          executionChecksum: entry.executionChecksum,
        }))
      )}`
    )
    return
  }

  assertStagingMigrationWriteGuard(process.env)
  if (!priceManifestPath) {
    throw unexpectedState(
      "COQUETTE_STAGING_PRICE_MANIFEST is required in write mode"
    )
  }

  const needsSaleList = executionPlan.entries.some(
    (entry) =>
      (entry.action === "apply" || entry.action === "skip") &&
      entry.reconstructedPrice?.salePrice !== undefined
  )
  const migrationSaleList = await ensureMigrationSalePriceList(
    container,
    needsSaleList
  )

  for (const entry of executionPlan.entries) {
    if (entry.action === "unavailable") {
      logger.info(
        `No recovered public price for ${entry.candidateKey}; no pricing write attempted`
      )
      continue
    }
    if (entry.action === "blocked") {
      throw unexpectedState(
        `Blocked price entry reached write loop: ${entry.candidateKey}`
      )
    }
    if (!entry.sourceKey || !entry.sourceChecksum) {
      throw unexpectedState(
        `Executable price entry ${entry.candidateKey} lost its source identity`
      )
    }

    const runtimeEntry = pricePlan.runtimeManifestEntries.find(
      (manifestEntry) =>
        manifestKey(manifestEntry) === manifestKey(entry.sourceKey!) &&
        manifestEntry.sourceChecksum === entry.sourceChecksum
    )
    if (!runtimeEntry) {
      throw unexpectedState(
        `Executable price entry ${entry.candidateKey} has no matching runtime price manifest entry`
      )
    }

    const now = new Date().toISOString()
    try {
      const result = await applyExpectedPriceState(
        container,
        entry,
        migrationSaleList
      )

      if (entry.action === "skip" && !result.changed) {
        logger.info(
          `Verified already imported price ${entry.candidateKey} -> ${result.variantId}`
        )
        continue
      }

      const warning =
        entry.action === "skip" && result.changed
          ? "Repaired live pricing drift while source checksum remained unchanged."
          : entry.previousPriceManifestEntry?.status === "imported" &&
              entry.previousPriceManifestEntry.sourceChecksum !== entry.sourceChecksum
            ? "Applied deterministic price update after recovered public price checksum changed."
            : undefined

      const imported = nextImportedManifestEntry(
        runtimeEntry,
        entry.previousPriceManifestEntry,
        result.variantId,
        now,
        warning
      )
      priceManifest = upsertManifestEntry(priceManifest, imported)
      await atomicWriteJson(priceManifestPath, priceManifest)
      logger.info(
        `Imported staging price ${entry.candidateKey} -> ${result.variantId}`
      )
    } catch (error) {
      const failed = nextErrorManifestEntry(
        runtimeEntry,
        entry.previousPriceManifestEntry,
        error,
        now
      )
      priceManifest = upsertManifestEntry(priceManifest, failed)
      await atomicWriteJson(priceManifestPath, priceManifest)
      throw error
    }
  }

  logger.info(
    `COQUETTE staging price import complete: manifest=${resolve(
      priceManifestPath
    )}, salePriceList=${migrationSaleList?.id ?? "not-required"}`
  )
}
