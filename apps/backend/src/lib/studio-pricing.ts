import { createHash } from "crypto"
import type {
  IPricingModuleService,
  MedusaContainer,
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

export const STUDIO_PRICING_VERSION = "1"
export const STUDIO_PRICING_CURRENCY = "eur"
export const STUDIO_PRICING_MODES = ["uniform", "per_variant"] as const
export type StudioPricingMode = (typeof STUDIO_PRICING_MODES)[number]

const STUDIO_SALE_LIST_MARKER_KEY = "coquette_studio_price_list"
const STUDIO_SALE_LIST_MARKER_VALUE = "studio-sale-v1"
const STUDIO_SALE_LIST_TITLE = "COQUETTE Studio Sale"
const STUDIO_SALE_LIST_DESCRIPTION =
  "Explicit COQUETTE Studio sale prices. No dates or eligibility rules are inferred."

export type StudioPricingRequestLine = {
  variant_id: string
  regular: string
  sale?: string | null
}

export type StudioPricingRequest = {
  mode: StudioPricingMode
  uniform?: {
    regular: string
    sale?: string | null
  }
  variants?: StudioPricingRequestLine[]
}

type StudioPricingProduct = {
  id: string
  title?: string | null
  status?: string | null
  updated_at?: string | null
  metadata?: Record<string, unknown> | null
  variants?: Array<{
    id: string
    title?: string | null
    sku?: string | null
    barcode?: string | null
    price_set?: { id?: string | null } | null
  }> | null
}

type SalePriceListRecord = {
  id: string
  title?: string | null
  type?: string | null
  status?: string | null
  starts_at?: string | Date | null
  ends_at?: string | Date | null
  rules_count?: number | null
  metadata?: Record<string, unknown> | null
}

type PricingPriceRecord = {
  id: string
  amount?: unknown
  currency_code?: string | null
  min_quantity?: unknown
  max_quantity?: unknown
  rules_count?: number | null
  price_set_id?: string | null
  price_list?: SalePriceListRecord | null
}

type VariantPricingState = {
  variant_id: string
  price_set_id: string
  regular?: PricingPriceRecord
  studio_sale?: PricingPriceRecord
  all_prices: PricingPriceRecord[]
}

export type StudioPricingDesiredLine = {
  variant_id: string
  title: string
  regular: string
  sale: string | null
}

export type StudioPricingPlanLine = StudioPricingDesiredLine & {
  current_regular: string | null
  current_sale: string | null
  regular_action: "create" | "update" | "unchanged"
  sale_action: "create" | "update" | "remove" | "unchanged"
}

export type StudioPricingPlan = {
  version: string
  product_id: string
  product_title: string
  expected_updated_at: string
  currency_code: "eur"
  mode: StudioPricingMode
  studio_sale_price_list_id: string | null
  variants: StudioPricingPlanLine[]
  change_count: number
  pricing_hash: string
}

export type StudioPricingProblem = {
  status: number
  code: string
  message: string
}

function unexpectedState(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function stableHash(value: object) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function cleanStudioPricingProductId(value: unknown) {
  if (typeof value !== "string") return ""
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ""
}

function cleanVariantId(value: unknown) {
  if (typeof value !== "string") return ""
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ""
}

function canonicalAmount(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw unexpectedState(`${label} must be entered explicitly as a decimal amount`)
  }
  const raw = value.trim()
  const match = raw.match(/^(0|[1-9]\d{0,5})(?:\.(\d{1,2}))?$/)
  if (!match) {
    throw unexpectedState(`${label} must use a valid EUR amount with at most two decimals`)
  }
  const whole = match[1]
  const fraction = (match[2] || "").padEnd(2, "0")
  const cents = Number(whole) * 100 + Number(fraction)
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 99_999_999) {
    throw unexpectedState(`${label} must be between EUR 0.01 and EUR 999999.99`)
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`
}

function canonicalStoredAmount(value: unknown, label: string) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw unexpectedState(`${label} is not a valid positive amount`)
  }
  const cents = Math.round(numeric * 100)
  if (Math.abs(numeric * 100 - cents) > 0.000001) {
    throw unexpectedState(`${label} has unsupported precision beyond two decimals`)
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`
}

function amountNumber(value: string) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) throw unexpectedState(`Invalid canonical amount ${value}`)
  return numeric
}

function saleListMarker(value: Record<string, unknown> | null | undefined) {
  const marker = value?.[STUDIO_SALE_LIST_MARKER_KEY]
  return typeof marker === "string" ? marker : undefined
}

function priceListCurrentlyActive(priceList: SalePriceListRecord | null | undefined) {
  if (!priceList || priceList.type !== "sale" || priceList.status !== "active") return false
  const now = Date.now()
  const starts = priceList.starts_at ? new Date(priceList.starts_at).getTime() : undefined
  const ends = priceList.ends_at ? new Date(priceList.ends_at).getTime() : undefined
  if (starts !== undefined && Number.isFinite(starts) && starts > now) return false
  if (ends !== undefined && Number.isFinite(ends) && ends <= now) return false
  return true
}

function isUnrestricted(price: PricingPriceRecord) {
  return (
    price.min_quantity == null &&
    price.max_quantity == null &&
    Number(price.rules_count ?? 0) === 0
  )
}

function isBaseEurPrice(price: PricingPriceRecord) {
  return (
    price.currency_code?.toLowerCase() === STUDIO_PRICING_CURRENCY &&
    !price.price_list &&
    isUnrestricted(price)
  )
}

function isStudioSalePrice(price: PricingPriceRecord, studioSaleListId?: string | null) {
  return Boolean(
    studioSaleListId &&
      price.currency_code?.toLowerCase() === STUDIO_PRICING_CURRENCY &&
      price.price_list?.id === studioSaleListId &&
      isUnrestricted(price)
  )
}

async function loadStudioPricingProduct(
  container: MedusaContainer,
  productId: string
): Promise<StudioPricingProduct | undefined> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "status",
      "updated_at",
      "metadata",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.barcode",
      "variants.price_set.id",
    ],
    filters: { id: productId },
  })
  return data?.[0] as StudioPricingProduct | undefined
}

export function studioPricingDraftProblem(
  product: StudioPricingProduct | undefined
): StudioPricingProblem | undefined {
  if (!product) return { status: 404, code: "draft_not_found", message: "Draft not found" }
  if (product.status !== "draft") {
    return {
      status: 409,
      code: "not_a_draft",
      message: "Pricing can only be managed here while the product is an unpublished Studio draft.",
    }
  }
  if (product.metadata?.coquette_studio_origin !== "quick_draft") {
    return {
      status: 403,
      code: "not_studio_draft",
      message: "This product was not created through the guarded COQUETTE Studio flow.",
    }
  }
  if (product.metadata?.coquette_studio_variants_generated !== "true") {
    return {
      status: 409,
      code: "variant_graph_required",
      message: "Build the saved size / colour choices before setting prices.",
    }
  }
  if (!product.variants?.length) {
    return {
      status: 409,
      code: "variants_required",
      message: "This draft has no variants to price.",
    }
  }
  if (product.variants.some((variant) => !variant.price_set?.id)) {
    return {
      status: 409,
      code: "price_set_missing",
      message: "At least one variant is missing its Medusa price set. Pricing is blocked until the graph is repaired.",
    }
  }
  return undefined
}

export function studioPricingDraftIsStale(
  product: StudioPricingProduct,
  expectedUpdatedAt: string | undefined
) {
  return Boolean(
    expectedUpdatedAt &&
      product.updated_at &&
      product.updated_at !== expectedUpdatedAt
  )
}

export async function findStudioSalePriceList(
  container: MedusaContainer
): Promise<SalePriceListRecord | undefined> {
  const pricingModule = container.resolve<IPricingModuleService>(Modules.PRICING)
  const priceLists = await pricingModule.listPriceLists({}, { take: 500 })
  const matches = (priceLists as SalePriceListRecord[]).filter(
    (record) =>
      record.type === "sale" &&
      saleListMarker(record.metadata) === STUDIO_SALE_LIST_MARKER_VALUE
  )
  if (matches.length > 1) {
    throw unexpectedState("Multiple COQUETTE Studio sale price lists exist; pricing is blocked.")
  }
  const priceList = matches[0]
  if (!priceList) return undefined
  if (
    priceList.type !== "sale" ||
    priceList.status !== "active" ||
    priceList.starts_at != null ||
    priceList.ends_at != null ||
    Number(priceList.rules_count ?? 0) !== 0
  ) {
    throw unexpectedState(
      `COQUETTE Studio sale price list ${priceList.id} was changed from its unrestricted active configuration.`
    )
  }
  return priceList
}

export async function ensureStudioSalePriceList(container: MedusaContainer) {
  const existing = await findStudioSalePriceList(container)
  if (existing) return existing
  const pricingModule = container.resolve<IPricingModuleService>(Modules.PRICING)
  const created = await pricingModule.createPriceLists([
    {
      title: STUDIO_SALE_LIST_TITLE,
      description: STUDIO_SALE_LIST_DESCRIPTION,
      type: "sale",
      status: "active",
      starts_at: null,
      ends_at: null,
      metadata: {
        [STUDIO_SALE_LIST_MARKER_KEY]: STUDIO_SALE_LIST_MARKER_VALUE,
      },
    },
  ])
  if (created.length !== 1) throw unexpectedState("COQUETTE Studio sale price list creation failed")
  return created[0] as SalePriceListRecord
}

async function pricingStates(
  container: MedusaContainer,
  product: StudioPricingProduct,
  studioSaleListId?: string | null
) {
  const pricingModule = container.resolve<IPricingModuleService>(Modules.PRICING)
  const priceSetIds = (product.variants || []).map((variant) => variant.price_set!.id!)
  const prices = (await pricingModule.listPrices(
    {
      price_set_id: priceSetIds,
      currency_code: STUDIO_PRICING_CURRENCY,
    },
    {
      relations: ["price_list"],
      take: Math.max(500, priceSetIds.length * 20),
    }
  )) as PricingPriceRecord[]

  return (product.variants || []).map((variant): VariantPricingState => {
    const priceSetId = variant.price_set!.id!
    const variantPrices = prices.filter((price) => price.price_set_id === priceSetId)
    const base = variantPrices.filter(isBaseEurPrice)
    const studioSale = variantPrices.filter((price) =>
      isStudioSalePrice(price, studioSaleListId)
    )
    if (base.length > 1) {
      throw unexpectedState(`Variant ${variant.id} has multiple unrestricted base EUR prices.`)
    }
    if (studioSale.length > 1) {
      throw unexpectedState(`Variant ${variant.id} has multiple COQUETTE Studio sale prices.`)
    }

    const unknownConditionalBase = variantPrices.filter(
      (price) =>
        price.currency_code?.toLowerCase() === STUDIO_PRICING_CURRENCY &&
        !price.price_list &&
        !isBaseEurPrice(price)
    )
    if (unknownConditionalBase.length) {
      throw unexpectedState(
        `Variant ${variant.id} has conditional or quantity-based EUR pricing outside the guarded Studio workflow.`
      )
    }

    const foreignActiveSales = variantPrices.filter(
      (price) =>
        price.currency_code?.toLowerCase() === STUDIO_PRICING_CURRENCY &&
        price.price_list &&
        price.price_list.id !== studioSaleListId &&
        priceListCurrentlyActive(price.price_list) &&
        Number(price.price_list.rules_count ?? 0) === 0 &&
        isUnrestricted(price)
    )
    if (foreignActiveSales.length) {
      throw unexpectedState(
        `Variant ${variant.id} already has an active unrestricted EUR sale price outside COQUETTE Studio.`
      )
    }

    return {
      variant_id: variant.id,
      price_set_id: priceSetId,
      regular: base[0],
      studio_sale: studioSale[0],
      all_prices: variantPrices,
    }
  })
}

function desiredLines(product: StudioPricingProduct, request: StudioPricingRequest) {
  const variants = product.variants || []
  if (!STUDIO_PRICING_MODES.includes(request.mode)) {
    throw unexpectedState("A valid Studio pricing mode is required")
  }

  if (request.mode === "uniform") {
    if (!request.uniform) throw unexpectedState("Enter the uniform regular price before review")
    const regular = canonicalAmount(request.uniform.regular, "Regular price")
    const sale =
      request.uniform.sale == null || request.uniform.sale.trim() === ""
        ? null
        : canonicalAmount(request.uniform.sale, "Sale price")
    if (sale && amountNumber(sale) >= amountNumber(regular)) {
      throw unexpectedState("Sale price must be lower than the regular price")
    }
    return variants.map(
      (variant): StudioPricingDesiredLine => ({
        variant_id: variant.id,
        title: variant.title || "Variant",
        regular,
        sale,
      })
    )
  }

  const supplied = request.variants || []
  if (supplied.length !== variants.length) {
    throw unexpectedState("Every variant must have one explicit pricing row")
  }
  const byId = new Map<string, StudioPricingRequestLine>()
  for (const line of supplied) {
    const variantId = cleanVariantId(line.variant_id)
    if (!variantId || byId.has(variantId)) {
      throw unexpectedState("Variant pricing rows contain an invalid or duplicate variant id")
    }
    byId.set(variantId, line)
  }

  return variants.map((variant): StudioPricingDesiredLine => {
    const line = byId.get(variant.id)
    if (!line) throw unexpectedState(`Pricing row is missing for variant ${variant.id}`)
    const regular = canonicalAmount(line.regular, `${variant.title || "Variant"} regular price`)
    const sale =
      line.sale == null || line.sale.trim() === ""
        ? null
        : canonicalAmount(line.sale, `${variant.title || "Variant"} sale price`)
    if (sale && amountNumber(sale) >= amountNumber(regular)) {
      throw unexpectedState(`${variant.title || "Variant"} sale price must be lower than its regular price`)
    }
    return {
      variant_id: variant.id,
      title: variant.title || "Variant",
      regular,
      sale,
    }
  })
}

export async function buildStudioPricingPlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  request: StudioPricingRequest
): Promise<StudioPricingPlan> {
  const product = await loadStudioPricingProduct(container, productId)
  const problem = studioPricingDraftProblem(product)
  if (problem) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `${problem.code}:${problem.message}`)
  if (studioPricingDraftIsStale(product!, expectedUpdatedAt)) {
    throw new MedusaError(MedusaError.Types.CONFLICT, "stale_draft")
  }

  const studioSaleList = await findStudioSalePriceList(container)
  const states = await pricingStates(container, product!, studioSaleList?.id)
  const desired = desiredLines(product!, request)
  const stateByVariant = new Map(states.map((state) => [state.variant_id, state]))

  const variants = desired.map((line): StudioPricingPlanLine => {
    const state = stateByVariant.get(line.variant_id)
    if (!state) throw unexpectedState(`Pricing state missing for variant ${line.variant_id}`)
    const currentRegular = state.regular
      ? canonicalStoredAmount(state.regular.amount, `Regular price ${line.variant_id}`)
      : null
    const currentSale = state.studio_sale
      ? canonicalStoredAmount(state.studio_sale.amount, `Sale price ${line.variant_id}`)
      : null
    return {
      ...line,
      current_regular: currentRegular,
      current_sale: currentSale,
      regular_action: currentRegular == null ? "create" : currentRegular === line.regular ? "unchanged" : "update",
      sale_action:
        line.sale == null
          ? currentSale == null
            ? "unchanged"
            : "remove"
          : currentSale == null
            ? "create"
            : currentSale === line.sale
              ? "unchanged"
              : "update",
    }
  })

  const hashInput = {
    version: STUDIO_PRICING_VERSION,
    product_id: product!.id,
    expected_updated_at: product!.updated_at || "",
    currency_code: "eur" as const,
    mode: request.mode,
    studio_sale_price_list_id: studioSaleList?.id || null,
    variants: variants.map((line) => ({
      variant_id: line.variant_id,
      regular: line.regular,
      sale: line.sale,
      current_regular: line.current_regular,
      current_sale: line.current_sale,
    })),
  }

  return {
    ...hashInput,
    product_title: product!.title || "Product draft",
    variants,
    change_count: variants.reduce(
      (count, line) =>
        count + (line.regular_action === "unchanged" ? 0 : 1) + (line.sale_action === "unchanged" ? 0 : 1),
      0
    ),
    pricing_hash: stableHash(hashInput),
  }
}

async function applyRegularPrices(
  container: MedusaContainer,
  plan: StudioPricingPlan
) {
  const changed = plan.variants.filter((line) => line.regular_action !== "unchanged")
  if (!changed.length) return
  await updateProductVariantsWorkflow(container).run({
    input: {
      product_variants: changed.map((line) => ({
        id: line.variant_id,
        prices: [
          {
            amount: amountNumber(line.regular),
            currency_code: STUDIO_PRICING_CURRENCY,
          },
        ],
      })),
    },
  })
}

async function applySalePrices(
  container: MedusaContainer,
  plan: StudioPricingPlan,
  saleList: SalePriceListRecord | undefined
) {
  const needsSaleList = plan.variants.some((line) => line.sale != null)
  if (needsSaleList && !saleList) throw unexpectedState("Studio sale price list is required")
  if (!saleList) return

  const product = await loadStudioPricingProduct(container, plan.product_id)
  if (!product) throw unexpectedState("Draft disappeared while applying Studio prices")
  const states = await pricingStates(container, product, saleList.id)
  const stateByVariant = new Map(states.map((state) => [state.variant_id, state]))
  const create: Array<{ amount: number; currency_code: string; variant_id: string }> = []
  const update: Array<{ id: string; amount: number; currency_code: string; variant_id: string }> = []
  const remove: string[] = []

  for (const line of plan.variants) {
    const existing = stateByVariant.get(line.variant_id)?.studio_sale
    if (line.sale == null) {
      if (existing) remove.push(existing.id)
    } else if (!existing) {
      create.push({
        amount: amountNumber(line.sale),
        currency_code: STUDIO_PRICING_CURRENCY,
        variant_id: line.variant_id,
      })
    } else if (canonicalStoredAmount(existing.amount, `Studio sale ${existing.id}`) !== line.sale) {
      update.push({
        id: existing.id,
        amount: amountNumber(line.sale),
        currency_code: STUDIO_PRICING_CURRENCY,
        variant_id: line.variant_id,
      })
    }
  }

  if (!create.length && !update.length && !remove.length) return
  await batchPriceListPricesWorkflow(container).run({
    input: {
      data: {
        id: saleList.id,
        create,
        update,
        delete: remove,
      },
    },
  })
}

export async function applyStudioPricingPlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  request: StudioPricingRequest,
  approvedHash: string
) {
  const before = await buildStudioPricingPlan(
    container,
    productId,
    expectedUpdatedAt,
    request
  )
  if (before.pricing_hash !== approvedHash) {
    throw new MedusaError(MedusaError.Types.CONFLICT, "stale_pricing_plan")
  }

  const needsSaleList = before.variants.some((line) => line.sale != null)
  const saleList = needsSaleList
    ? await ensureStudioSalePriceList(container)
    : await findStudioSalePriceList(container)

  if ((before.studio_sale_price_list_id || null) !== (saleList?.id || null)) {
    if (needsSaleList && before.studio_sale_price_list_id == null) {
      // The first Studio sale creates the dedicated list as part of the approved action.
    } else {
      throw new MedusaError(MedusaError.Types.CONFLICT, "stale_pricing_plan")
    }
  }

  await applyRegularPrices(container, before)
  await applySalePrices(container, before, saleList)

  const verified = await buildStudioPricingPlan(
    container,
    productId,
    expectedUpdatedAt,
    request
  )
  const mismatches = verified.variants.filter(
    (line) =>
      line.current_regular !== line.regular ||
      line.current_sale !== line.sale
  )
  if (mismatches.length) {
    throw unexpectedState(
      `Studio pricing verification failed for ${mismatches.map((line) => line.variant_id).join(", ")}`
    )
  }

  return verified
}