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
  findStudioSalePriceList,
  STUDIO_PRICING_CURRENCY,
} from "./studio-pricing"

type ProductRecord = {
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

type PriceListRecord = {
  id: string
  type?: string | null
  status?: string | null
  starts_at?: string | Date | null
  ends_at?: string | Date | null
  rules_count?: number | null
}

type PriceRecord = {
  id: string
  amount?: unknown
  currency_code?: string | null
  price_set_id?: string | null
  min_quantity?: unknown
  max_quantity?: unknown
  rules_count?: number | null
  price_list?: PriceListRecord | null
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function canonical(value: unknown, label: string) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) throw unexpected(`${label} is invalid`)
  const cents = Math.round(numeric * 100)
  if (Math.abs(numeric * 100 - cents) > 0.000001) {
    throw unexpected(`${label} has unsupported precision`)
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`
}

function unrestricted(price: PriceRecord) {
  return (
    price.min_quantity == null &&
    price.max_quantity == null &&
    Number(price.rules_count ?? 0) === 0
  )
}

function activeSale(list: PriceListRecord | null | undefined) {
  if (!list || list.type !== "sale" || list.status !== "active") return false
  const now = Date.now()
  const starts = list.starts_at ? new Date(list.starts_at).getTime() : undefined
  const ends = list.ends_at ? new Date(list.ends_at).getTime() : undefined
  return !(
    (starts !== undefined && Number.isFinite(starts) && starts > now) ||
    (ends !== undefined && Number.isFinite(ends) && ends <= now)
  )
}

export async function readStudioPricingState(
  container: MedusaContainer,
  productId: string
) {
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
  const product = data?.[0] as ProductRecord | undefined
  if (!product) throw unexpected("draft_not_found")
  if (product.status !== "draft") throw unexpected("not_a_draft")
  if (product.metadata?.coquette_studio_origin !== "quick_draft") {
    throw unexpected("not_studio_draft")
  }
  if (
    product.metadata?.coquette_studio_variants_generated !== "true" ||
    !product.variants?.length
  ) {
    return {
      ready: false,
      code: "variant_graph_required",
      message: "Build the product choices before setting prices.",
      product_id: product.id,
      expected_updated_at: product.updated_at || "",
      currency_code: STUDIO_PRICING_CURRENCY,
      variants: [],
    }
  }
  if (product.variants.some((variant) => !variant.price_set?.id)) {
    throw unexpected("price_set_missing")
  }

  const studioSaleList = await findStudioSalePriceList(container)
  const priceSetIds = product.variants.map((variant) => variant.price_set!.id!)
  const pricing = container.resolve<IPricingModuleService>(Modules.PRICING)
  const prices = (await pricing.listPrices(
    { price_set_id: priceSetIds, currency_code: STUDIO_PRICING_CURRENCY },
    { relations: ["price_list"], take: Math.max(500, priceSetIds.length * 20) }
  )) as PriceRecord[]

  const variants = product.variants.map((variant) => {
    const priceSetId = variant.price_set!.id!
    const own = prices.filter((price) => price.price_set_id === priceSetId)
    const regular = own.filter(
      (price) =>
        price.currency_code?.toLowerCase() === STUDIO_PRICING_CURRENCY &&
        !price.price_list &&
        unrestricted(price)
    )
    const sale = own.filter(
      (price) =>
        price.currency_code?.toLowerCase() === STUDIO_PRICING_CURRENCY &&
        price.price_list?.id === studioSaleList?.id &&
        unrestricted(price)
    )
    if (regular.length > 1 || sale.length > 1) {
      throw unexpected(`ambiguous_pricing:${variant.id}`)
    }

    const foreignConditional = own.some(
      (price) =>
        price.currency_code?.toLowerCase() === STUDIO_PRICING_CURRENCY &&
        !price.price_list &&
        !unrestricted(price)
    )
    const foreignSale = own.some(
      (price) =>
        price.currency_code?.toLowerCase() === STUDIO_PRICING_CURRENCY &&
        price.price_list &&
        price.price_list.id !== studioSaleList?.id &&
        activeSale(price.price_list) &&
        unrestricted(price)
    )

    return {
      variant_id: variant.id,
      title: variant.title || "Variant",
      sku: variant.sku || null,
      barcode: variant.barcode || null,
      regular: regular[0] ? canonical(regular[0].amount, `regular price ${variant.id}`) : null,
      sale: sale[0] ? canonical(sale[0].amount, `sale price ${variant.id}`) : null,
      blocked: foreignConditional || foreignSale,
      blocker: foreignConditional
        ? "This variant has conditional EUR pricing outside Studio."
        : foreignSale
          ? "This variant has an active sale price outside Studio."
          : null,
    }
  })

  const blocked = variants.find((variant) => variant.blocked)
  const first = variants[0]
  const uniform = Boolean(
    first &&
      variants.every(
        (variant) => variant.regular === first.regular && variant.sale === first.sale
      )
  )

  return {
    ready: !blocked,
    code: blocked ? "foreign_pricing_present" : null,
    message: blocked?.blocker || null,
    product_id: product.id,
    product_title: product.title || "Product draft",
    expected_updated_at: product.updated_at || "",
    currency_code: STUDIO_PRICING_CURRENCY,
    suggested_mode: uniform ? "uniform" : "per_variant",
    studio_sale_price_list_id: studioSaleList?.id || null,
    variants,
  }
}
