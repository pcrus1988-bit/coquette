import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import assert from "node:assert/strict"
import {
  applyStudioPricingPlan,
  buildStudioPricingPlan,
  findStudioSalePriceList,
  type StudioPricingRequest,
} from "../lib/studio-pricing"
import { readStudioPricingState } from "../lib/studio-pricing-state"

type ProductTimestampRecord = {
  id: string
  updated_at?: string | null
}

async function runtimeDefaults(container: ExecArgs["container"]) {
  const storeModule = container.resolve(Modules.STORE)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const stores = await storeModule.listStores({}, { take: 2 })
  assert.equal(stores.length, 1)
  assert.ok(stores[0].default_sales_channel_id)
  const shippingProfiles = await fulfillmentModule.listShippingProfiles({ type: "default" })
  assert.equal(shippingProfiles.length, 1)
  return {
    salesChannelId: stores[0].default_sales_channel_id!,
    shippingProfileId: shippingProfiles[0].id,
  }
}

async function productUpdatedAt(
  container: ExecArgs["container"],
  productId: string
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "updated_at"],
    filters: { id: productId },
  })
  assert.equal(data.length, 1)
  const updatedAt = (data[0] as ProductTimestampRecord).updated_at
  assert.ok(updatedAt)
  return updatedAt
}

function assertPriceState(
  state: Awaited<ReturnType<typeof readStudioPricingState>>,
  expected: Record<string, { regular: string; sale: string | null }>
) {
  assert.equal(state.ready, true)
  assert.equal(state.currency_code, "eur")
  assert.equal(state.variants.length, Object.keys(expected).length)
  for (const variant of state.variants) {
    const wanted = expected[variant.title]
    assert.ok(wanted, `Unexpected Studio pricing contract variant ${variant.title}`)
    assert.equal(variant.regular, wanted.regular)
    assert.equal(variant.sale, wanted.sale)
    assert.equal(variant.blocked, false)
  }
}

export default async function studioPricingContract({ container }: ExecArgs) {
  const defaults = await runtimeDefaults(container)
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const skuS = `COQ-STUDIO-PRICE-S-${suffix}`
  const skuM = `COQ-STUDIO-PRICE-M-${suffix}`

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "COQUETTE Studio Pricing Contract",
          status: "draft",
          shipping_profile_id: defaults.shippingProfileId,
          sales_channels: [{ id: defaults.salesChannelId }],
          options: [{ title: "Size", values: ["S", "M"] }],
          variants: [
            {
              title: "S",
              sku: skuS,
              options: { Size: "S" },
              manage_inventory: false,
              allow_backorder: false,
            },
            {
              title: "M",
              sku: skuM,
              options: { Size: "M" },
              manage_inventory: false,
              allow_backorder: false,
            },
          ],
          metadata: {
            coquette_studio_origin: "quick_draft",
            coquette_studio_variants_generated: "true",
            coquette_studio_variant_count: "2",
            coquette_studio_variant_graph_version: "1",
          },
        },
      ],
    },
  })

  const productId = result[0]?.id
  assert.ok(productId)

  const initialState = await readStudioPricingState(container, productId)
  assert.equal(initialState.ready, true)
  assert.equal(initialState.suggested_mode, "uniform")
  assert.equal(initialState.variants.length, 2)
  assert.equal(initialState.variants.every((variant) => variant.regular == null), true)
  assert.equal(initialState.variants.every((variant) => variant.sale == null), true)

  const uniform: StudioPricingRequest = {
    mode: "uniform",
    uniform: { regular: "199.00", sale: "149.00" },
  }
  const firstUpdatedAt = await productUpdatedAt(container, productId)
  const firstPlan = await buildStudioPricingPlan(
    container,
    productId,
    firstUpdatedAt,
    uniform
  )
  assert.equal(firstPlan.currency_code, "eur")
  assert.equal(firstPlan.change_count, 4)
  assert.match(firstPlan.pricing_hash, /^[a-f0-9]{64}$/)
  await applyStudioPricingPlan(
    container,
    productId,
    firstUpdatedAt,
    uniform,
    firstPlan.pricing_hash
  )

  let state = await readStudioPricingState(container, productId)
  assertPriceState(state, {
    S: { regular: "199.00", sale: "149.00" },
    M: { regular: "199.00", sale: "149.00" },
  })
  const saleList = await findStudioSalePriceList(container)
  assert.ok(saleList?.id)

  const idempotentUpdatedAt = await productUpdatedAt(container, productId)
  const idempotentPlan = await buildStudioPricingPlan(
    container,
    productId,
    idempotentUpdatedAt,
    uniform
  )
  assert.equal(idempotentPlan.change_count, 0)
  await applyStudioPricingPlan(
    container,
    productId,
    idempotentUpdatedAt,
    uniform,
    idempotentPlan.pricing_hash
  )

  state = await readStudioPricingState(container, productId)
  const byTitle = Object.fromEntries(
    state.variants.map((variant) => [variant.title, variant.variant_id])
  )
  assert.ok(byTitle.S)
  assert.ok(byTitle.M)

  const perVariant: StudioPricingRequest = {
    mode: "per_variant",
    variants: [
      { variant_id: byTitle.S, regular: "210.00", sale: null },
      { variant_id: byTitle.M, regular: "220.00", sale: "180.00" },
    ],
  }
  const perVariantUpdatedAt = await productUpdatedAt(container, productId)
  const perVariantPlan = await buildStudioPricingPlan(
    container,
    productId,
    perVariantUpdatedAt,
    perVariant
  )
  assert.equal(perVariantPlan.change_count, 4)
  await applyStudioPricingPlan(
    container,
    productId,
    perVariantUpdatedAt,
    perVariant,
    perVariantPlan.pricing_hash
  )

  state = await readStudioPricingState(container, productId)
  assert.equal(state.suggested_mode, "per_variant")
  assertPriceState(state, {
    S: { regular: "210.00", sale: null },
    M: { regular: "220.00", sale: "180.00" },
  })

  const removeSale: StudioPricingRequest = {
    mode: "uniform",
    uniform: { regular: "230.00", sale: null },
  }
  const removeSaleUpdatedAt = await productUpdatedAt(container, productId)
  const removeSalePlan = await buildStudioPricingPlan(
    container,
    productId,
    removeSaleUpdatedAt,
    removeSale
  )
  assert.equal(removeSalePlan.change_count, 3)
  await applyStudioPricingPlan(
    container,
    productId,
    removeSaleUpdatedAt,
    removeSale,
    removeSalePlan.pricing_hash
  )

  state = await readStudioPricingState(container, productId)
  assertPriceState(state, {
    S: { regular: "230.00", sale: null },
    M: { regular: "230.00", sale: null },
  })

  const productModule = container.resolve(Modules.PRODUCT)
  const variants = await productModule.listProductVariants({ product_id: productId })
  assert.equal(variants.length, 2)
  assert.equal(variants.every((variant) => variant.manage_inventory === false), true)
  assert.equal(variants.every((variant) => variant.allow_backorder === false), true)

  const products = await productModule.listProducts({ id: productId })
  assert.equal(products.length, 1)
  assert.equal(products[0].status, "draft")

  console.log(
    "COQUETTE Studio guarded pricing create/update/idempotency/sale-removal contract passed"
  )
}
