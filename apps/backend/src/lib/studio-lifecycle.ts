import { createHash } from "crypto"
import type {
  IPricingModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import applyStudioLifecycleWorkflow, {
  type ApplyStudioLifecycleWorkflowInput,
} from "../workflows/apply-studio-lifecycle"
import { studioProductIsArchived } from "./studio-archive-policy"

export const STUDIO_LIFECYCLE_VERSION = "1"
export const STUDIO_LIFECYCLE_ACTIONS = ["publish", "unpublish"] as const
export type StudioLifecycleAction = (typeof STUDIO_LIFECYCLE_ACTIONS)[number]

export type StudioLifecycleProduct = {
  id: string
  title?: string | null
  status?: string | null
  updated_at?: string | Date | null
  metadata?: Record<string, unknown> | null
  sales_channels?: Array<{ id: string; name?: string | null }> | null
  variants?: Array<{
    id: string
    title?: string | null
    price_set?: { id?: string | null } | null
  }> | null
}

type PriceRecord = {
  id: string
  amount?: unknown
  currency_code?: string | null
  min_quantity?: unknown
  max_quantity?: unknown
  rules_count?: number | null
  price_set_id?: string | null
  price_list_id?: string | null
  price_list?: { id?: string | null } | null
}

type PriceFingerprint = {
  variant_id: string
  price_set_id: string
  base_eur_price_id: string
  base_eur_amount: string
}

export type StudioLifecycleState = {
  ready: true
  version: string
  product: {
    id: string
    title: string
    status: "draft" | "published"
    updated_at: string
  }
  canonical_sales_channel: {
    id: string
    name: string
  }
  current_sales_channels: Array<{ id: string; name: string }>
  publish_readiness: {
    ready: boolean
    blockers: string[]
    variants: number
    priced_variants: number
  }
  available_actions: StudioLifecycleAction[]
}

export type StudioLifecyclePlan = {
  version: string
  product_id: string
  product_title: string
  expected_updated_at: string
  action: StudioLifecycleAction
  before: {
    status: "draft" | "published"
    sales_channel_ids: string[]
  }
  after: {
    status: "draft" | "published"
    sales_channel_ids: string[]
  }
  canonical_sales_channel_id: string
  attach_canonical_sales_channel: boolean
  price_fingerprint: PriceFingerprint[]
  change_count: number
  lifecycle_hash: string
}

function unexpectedState(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function canonicalTimestamp(value: unknown) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isFinite(date.getTime()) ? date.toISOString() : ""
}

function stableHash(value: object) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function cleanStudioLifecycleProductId(value: unknown) {
  if (typeof value !== "string") return ""
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ""
}

async function loadProduct(container: MedusaContainer, productId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "status",
      "updated_at",
      "metadata",
      "sales_channels.id",
      "sales_channels.name",
      "variants.id",
      "variants.title",
      "variants.price_set.id",
    ],
    filters: { id: productId },
  })
  return data?.[0] as StudioLifecycleProduct | undefined
}

function assertStudioLifecycleProduct(product: StudioLifecycleProduct | undefined) {
  if (!product) throw unexpectedState("product_not_found: Product not found")
  if (product.metadata?.coquette_studio_origin !== "quick_draft") {
    throw unexpectedState(
      "not_studio_product: This product is outside the guarded COQUETTE Studio product flow."
    )
  }
  if (studioProductIsArchived(product.metadata)) {
    throw unexpectedState(
      "product_archived: Restore this product to an editable draft before changing publication visibility."
    )
  }
  if (product.status !== ProductStatus.DRAFT && product.status !== ProductStatus.PUBLISHED) {
    throw unexpectedState(
      `unsupported_status: Studio lifecycle cannot manage Medusa status ${product.status || "unknown"}.`
    )
  }
  if (!canonicalTimestamp(product.updated_at)) {
    throw unexpectedState("Product has no usable update timestamp.")
  }
}

async function canonicalSalesChannel(container: MedusaContainer) {
  const storeModule = container.resolve(Modules.STORE)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const stores = await storeModule.listStores({}, { take: 2 })
  if (stores.length !== 1 || !stores[0].default_sales_channel_id) {
    throw unexpectedState(
      "The store must have exactly one configured default sales channel before Studio can manage publication."
    )
  }
  const channel = await salesChannelModule.retrieveSalesChannel(
    stores[0].default_sales_channel_id
  )
  if (!channel?.id) {
    throw unexpectedState("The configured default sales channel could not be resolved.")
  }
  return { id: channel.id, name: channel.name || "Default Sales Channel" }
}

function unrestrictedBaseEur(price: PriceRecord) {
  return (
    price.currency_code?.toLowerCase() === "eur" &&
    !price.price_list_id &&
    !price.price_list &&
    price.min_quantity == null &&
    price.max_quantity == null &&
    Number(price.rules_count ?? 0) === 0
  )
}

function canonicalPositiveAmount(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return ""
  const cents = Math.round(amount * 100)
  if (Math.abs(amount * 100 - cents) > 0.000001) return ""
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`
}

async function priceFingerprint(
  container: MedusaContainer,
  product: StudioLifecycleProduct
): Promise<{ fingerprint: PriceFingerprint[]; blockers: string[] }> {
  const variants = product.variants || []
  const blockers: string[] = []
  if (product.metadata?.coquette_studio_variants_generated !== "true") {
    blockers.push("Build the reviewed size / colour variant graph before publishing.")
  }
  if (!variants.length) blockers.push("At least one real Medusa variant is required before publishing.")

  const missingPriceSet = variants.filter((variant) => !variant.price_set?.id)
  if (missingPriceSet.length) {
    blockers.push("Every variant must have a valid Medusa price set before publishing.")
    return { fingerprint: [], blockers }
  }
  if (!variants.length) return { fingerprint: [], blockers }

  const pricingModule = container.resolve<IPricingModuleService>(Modules.PRICING)
  const priceSetIds = variants.map((variant) => variant.price_set!.id!)
  const prices = (await pricingModule.listPrices(
    { price_set_id: priceSetIds, currency_code: "eur" },
    { relations: ["price_list"], take: Math.max(500, priceSetIds.length * 20) }
  )) as PriceRecord[]

  const fingerprint: PriceFingerprint[] = []
  for (const variant of variants) {
    const priceSetId = variant.price_set!.id!
    const base = prices.filter(
      (price) => price.price_set_id === priceSetId && unrestrictedBaseEur(price)
    )
    if (base.length !== 1) {
      blockers.push(
        `${variant.title || "Variant"} must have exactly one unrestricted base EUR price before publishing.`
      )
      continue
    }
    const amount = canonicalPositiveAmount(base[0].amount)
    if (!amount) {
      blockers.push(`${variant.title || "Variant"} must have a positive base EUR price before publishing.`)
      continue
    }
    fingerprint.push({
      variant_id: variant.id,
      price_set_id: priceSetId,
      base_eur_price_id: base[0].id,
      base_eur_amount: amount,
    })
  }
  fingerprint.sort((a, b) => a.variant_id.localeCompare(b.variant_id))
  return { fingerprint, blockers }
}

export async function readStudioLifecycleState(
  container: MedusaContainer,
  productId: string
): Promise<StudioLifecycleState> {
  const product = await loadProduct(container, productId)
  assertStudioLifecycleProduct(product)
  const canonical = await canonicalSalesChannel(container)
  const pricing = await priceFingerprint(container, product!)
  const currentChannels = (product!.sales_channels || [])
    .map((channel) => ({ id: channel.id, name: channel.name || channel.id }))
    .sort((a, b) => a.id.localeCompare(b.id))
  const foreignChannels = currentChannels.filter((channel) => channel.id !== canonical.id)
  const blockers = [...pricing.blockers]
  if (foreignChannels.length) {
    blockers.push(
      `Product is linked to non-canonical sales channel(s): ${foreignChannels
        .map((channel) => channel.name)
        .join(", ")}. Remove them in Medusa before publishing through Studio.`
    )
  }

  const status = product!.status as "draft" | "published"
  return {
    ready: true,
    version: STUDIO_LIFECYCLE_VERSION,
    product: {
      id: product!.id,
      title: product!.title || "Untitled product",
      status,
      updated_at: canonicalTimestamp(product!.updated_at),
    },
    canonical_sales_channel: canonical,
    current_sales_channels: currentChannels,
    publish_readiness: {
      ready: blockers.length === 0,
      blockers,
      variants: product!.variants?.length || 0,
      priced_variants: pricing.fingerprint.length,
    },
    available_actions:
      status === "draft"
        ? blockers.length === 0
          ? ["publish"]
          : []
        : ["unpublish"],
  }
}

export async function buildStudioLifecyclePlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  action: StudioLifecycleAction
): Promise<StudioLifecyclePlan> {
  if (!STUDIO_LIFECYCLE_ACTIONS.includes(action)) {
    throw unexpectedState("A valid Studio lifecycle action is required.")
  }
  const product = await loadProduct(container, productId)
  assertStudioLifecycleProduct(product)
  const actualUpdatedAt = canonicalTimestamp(product!.updated_at)
  if (!expectedUpdatedAt || canonicalTimestamp(expectedUpdatedAt) !== actualUpdatedAt) {
    throw unexpectedState("stale_product")
  }

  const canonical = await canonicalSalesChannel(container)
  const pricing = await priceFingerprint(container, product!)
  const beforeChannelIds = [...new Set((product!.sales_channels || []).map((channel) => channel.id))].sort()
  const foreignChannels = beforeChannelIds.filter((id) => id !== canonical.id)
  const beforeStatus = product!.status as "draft" | "published"

  if (action === "publish") {
    if (beforeStatus !== "draft") {
      throw unexpectedState("invalid_transition: Only a draft can be published through Studio.")
    }
    if (pricing.blockers.length) {
      throw unexpectedState(`publish_not_ready: ${pricing.blockers.join(" ")}`)
    }
    if (foreignChannels.length) {
      throw unexpectedState(
        `foreign_sales_channel: Publication is blocked while non-canonical sales channels are attached: ${foreignChannels.join(", ")}.`
      )
    }
  } else if (beforeStatus !== "published") {
    throw unexpectedState("invalid_transition: Only a published product can be unpublished through Studio.")
  }

  const attachCanonical = action === "publish" && !beforeChannelIds.includes(canonical.id)
  const afterChannelIds = attachCanonical
    ? [...beforeChannelIds, canonical.id].sort()
    : beforeChannelIds
  const afterStatus: "draft" | "published" = action === "publish" ? "published" : "draft"

  const hashInput = {
    version: STUDIO_LIFECYCLE_VERSION,
    product_id: product!.id,
    expected_updated_at: actualUpdatedAt,
    action,
    before: { status: beforeStatus, sales_channel_ids: beforeChannelIds },
    after: { status: afterStatus, sales_channel_ids: afterChannelIds },
    canonical_sales_channel_id: canonical.id,
    attach_canonical_sales_channel: attachCanonical,
    price_fingerprint: pricing.fingerprint,
  }

  return {
    ...hashInput,
    product_title: product!.title || "Untitled product",
    change_count: (beforeStatus === afterStatus ? 0 : 1) + (attachCanonical ? 1 : 0),
    lifecycle_hash: stableHash(hashInput),
  }
}

export async function applyStudioLifecyclePlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  action: StudioLifecycleAction,
  lifecycleHash: string
) {
  const plan = await buildStudioLifecyclePlan(
    container,
    productId,
    expectedUpdatedAt,
    action
  )
  if (plan.lifecycle_hash !== lifecycleHash) {
    throw unexpectedState("stale_lifecycle_plan")
  }

  const input: ApplyStudioLifecycleWorkflowInput = {
    product_id: plan.product_id,
    target_status: plan.after.status,
    attach_canonical_sales_channel: plan.attach_canonical_sales_channel,
    canonical_sales_channel_id: plan.canonical_sales_channel_id,
  }
  await applyStudioLifecycleWorkflow(container).run({ input })

  const after = await loadProduct(container, productId)
  assertStudioLifecycleProduct(after)
  const afterStatus = after!.status as "draft" | "published"
  const afterChannels = [...new Set((after!.sales_channels || []).map((channel) => channel.id))].sort()
  if (
    afterStatus !== plan.after.status ||
    JSON.stringify(afterChannels) !== JSON.stringify(plan.after.sales_channel_ids)
  ) {
    throw unexpectedState("Studio lifecycle invariant verification failed")
  }
  if (
    plan.after.status === "published" &&
    !afterChannels.includes(plan.canonical_sales_channel_id)
  ) {
    throw unexpectedState("Published product is not attached to the canonical sales channel")
  }

  return plan
}
