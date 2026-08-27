import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import assert from "node:assert/strict"
import {
  applyStudioLifecyclePlan,
  buildStudioLifecyclePlan,
  readStudioLifecycleState,
} from "../lib/studio-lifecycle"
import {
  applyStudioPricingPlan,
  buildStudioPricingPlan,
  type StudioPricingRequest,
} from "../lib/studio-pricing"

type ProductRecord = {
  id: string
  status?: string | null
  updated_at?: string | Date | null
  sales_channels?: Array<{ id: string }> | null
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

async function productRecord(
  container: ExecArgs["container"],
  productId: string
): Promise<ProductRecord> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "status", "updated_at", "sales_channels.id"],
    filters: { id: productId },
  })
  assert.equal(data.length, 1)
  return data[0] as ProductRecord
}

function timestamp(record: ProductRecord) {
  assert.ok(record.updated_at)
  return record.updated_at instanceof Date
    ? record.updated_at.toISOString()
    : String(record.updated_at)
}

export default async function studioLifecycleContract({ container }: ExecArgs) {
  const defaults = await runtimeDefaults(container)
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: `COQUETTE Studio Lifecycle Contract ${suffix}`,
          status: "draft",
          shipping_profile_id: defaults.shippingProfileId,
          options: [{ title: "Size", values: ["S", "M"] }],
          variants: [
            {
              title: "S",
              sku: `COQ-LIFE-S-${suffix}`,
              options: { Size: "S" },
              manage_inventory: false,
              allow_backorder: false,
            },
            {
              title: "M",
              sku: `COQ-LIFE-M-${suffix}`,
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

  let record = await productRecord(container, productId)
  assert.equal(record.status, "draft")
  assert.deepEqual(record.sales_channels || [], [])

  let state = await readStudioLifecycleState(container, productId)
  assert.equal(state.product.status, "draft")
  assert.equal(state.publish_readiness.ready, false)
  assert.equal(state.publish_readiness.variants, 2)
  assert.equal(state.publish_readiness.priced_variants, 0)
  assert.equal(state.available_actions.length, 0)
  assert.equal(state.canonical_sales_channel.id, defaults.salesChannelId)

  const initialAt = timestamp(record)
  await assert.rejects(
    () => buildStudioLifecyclePlan(container, productId, initialAt, "publish"),
    /publish_not_ready/
  )

  const firstPricing: StudioPricingRequest = {
    mode: "uniform",
    uniform: { regular: "199.00", sale: null },
  }
  const firstPricePlan = await buildStudioPricingPlan(
    container,
    productId,
    initialAt,
    firstPricing
  )
  await applyStudioPricingPlan(
    container,
    productId,
    initialAt,
    firstPricing,
    firstPricePlan.pricing_hash
  )

  record = await productRecord(container, productId)
  state = await readStudioLifecycleState(container, productId)
  assert.equal(state.publish_readiness.ready, true)
  assert.equal(state.publish_readiness.priced_variants, 2)
  assert.deepEqual(state.available_actions, ["publish"])
  assert.deepEqual(state.current_sales_channels, [])

  const reviewedAt = timestamp(record)
  const reviewedPublish = await buildStudioLifecyclePlan(
    container,
    productId,
    reviewedAt,
    "publish"
  )
  assert.equal(reviewedPublish.before.status, "draft")
  assert.equal(reviewedPublish.after.status, "published")
  assert.equal(reviewedPublish.attach_canonical_sales_channel, true)
  assert.deepEqual(reviewedPublish.before.sales_channel_ids, [])
  assert.deepEqual(reviewedPublish.after.sales_channel_ids, [defaults.salesChannelId])
  assert.equal(reviewedPublish.price_fingerprint.length, 2)
  assert.equal(reviewedPublish.change_count, 2)
  assert.match(reviewedPublish.lifecycle_hash, /^[a-f0-9]{64}$/)

  const changedPricing: StudioPricingRequest = {
    mode: "uniform",
    uniform: { regular: "209.00", sale: null },
  }
  const changedPricePlan = await buildStudioPricingPlan(
    container,
    productId,
    reviewedAt,
    changedPricing
  )
  await applyStudioPricingPlan(
    container,
    productId,
    reviewedAt,
    changedPricing,
    changedPricePlan.pricing_hash
  )

  await assert.rejects(
    () =>
      applyStudioLifecyclePlan(
        container,
        productId,
        reviewedAt,
        "publish",
        reviewedPublish.lifecycle_hash
      ),
    /stale_lifecycle_plan/
  )
  record = await productRecord(container, productId)
  assert.equal(record.status, "draft")
  assert.deepEqual(record.sales_channels || [], [])

  const refreshedPublish = await buildStudioLifecyclePlan(
    container,
    productId,
    timestamp(record),
    "publish"
  )
  assert.notEqual(refreshedPublish.lifecycle_hash, reviewedPublish.lifecycle_hash)
  assert.equal(refreshedPublish.price_fingerprint.every((line) => line.base_eur_amount === "209.00"), true)
  await applyStudioLifecyclePlan(
    container,
    productId,
    timestamp(record),
    "publish",
    refreshedPublish.lifecycle_hash
  )

  record = await productRecord(container, productId)
  assert.equal(record.status, "published")
  assert.deepEqual((record.sales_channels || []).map((channel) => channel.id), [defaults.salesChannelId])
  state = await readStudioLifecycleState(container, productId)
  assert.equal(state.product.status, "published")
  assert.deepEqual(state.available_actions, ["unpublish"])

  const publishedAt = timestamp(record)
  const unpublishPlan = await buildStudioLifecyclePlan(
    container,
    productId,
    publishedAt,
    "unpublish"
  )
  assert.equal(unpublishPlan.before.status, "published")
  assert.equal(unpublishPlan.after.status, "draft")
  assert.equal(unpublishPlan.attach_canonical_sales_channel, false)
  assert.deepEqual(unpublishPlan.after.sales_channel_ids, [defaults.salesChannelId])
  assert.equal(unpublishPlan.change_count, 1)
  await applyStudioLifecyclePlan(
    container,
    productId,
    publishedAt,
    "unpublish",
    unpublishPlan.lifecycle_hash
  )

  record = await productRecord(container, productId)
  assert.equal(record.status, "draft")
  assert.deepEqual((record.sales_channels || []).map((channel) => channel.id), [defaults.salesChannelId])
  state = await readStudioLifecycleState(container, productId)
  assert.deepEqual(state.available_actions, ["publish"])

  await assert.rejects(
    () => buildStudioLifecyclePlan(container, productId, publishedAt, "publish"),
    /stale_product/
  )

  const republishPlan = await buildStudioLifecyclePlan(
    container,
    productId,
    timestamp(record),
    "publish"
  )
  assert.equal(republishPlan.attach_canonical_sales_channel, false)
  assert.equal(republishPlan.change_count, 1)
  await applyStudioLifecyclePlan(
    container,
    productId,
    timestamp(record),
    "publish",
    republishPlan.lifecycle_hash
  )

  record = await productRecord(container, productId)
  assert.equal(record.status, "published")
  assert.deepEqual((record.sales_channels || []).map((channel) => channel.id), [defaults.salesChannelId])

  console.log(
    "COQUETTE Studio guarded publish/unpublish, canonical-channel attachment, price-fingerprint staleness and re-publication contract passed"
  )
}
