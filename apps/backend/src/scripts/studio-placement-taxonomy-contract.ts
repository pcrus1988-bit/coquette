import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import assert from "node:assert/strict"
import {
  applyStudioPlacementTaxonomyPlan,
  buildStudioPlacementTaxonomyPlan,
  readStudioPlacementTaxonomyState,
  type StudioPlacementTaxonomyRequest,
} from "../lib/studio-placement-taxonomy"
import createDesignerWorkflow from "../workflows/create-designer"

type ProductTimestampRecord = {
  id: string
  updated_at?: string | Date | null
}

async function runtimeDefaults(container: ExecArgs["container"]) {
  const storeModule = container.resolve(Modules.STORE)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const stores = await storeModule.listStores({}, { take: 2 })
  assert.equal(stores.length, 1)
  assert.ok(stores[0].default_sales_channel_id)

  const shippingProfiles = await fulfillmentModule.listShippingProfiles({
    type: "default",
  })
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
  const value = (data[0] as ProductTimestampRecord).updated_at
  assert.ok(value)
  return value instanceof Date ? value.toISOString() : String(value)
}

export default async function studioPlacementTaxonomyContract({
  container,
}: ExecArgs) {
  const defaults = await runtimeDefaults(container)
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const { result: categories } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: `Studio Dresses ${suffix}`,
          handle: `studio-dresses-${suffix}`,
          is_active: true,
          is_internal: false,
          rank: 10,
        },
        {
          name: `Studio Occasion ${suffix}`,
          handle: `studio-occasion-${suffix}`,
          is_active: true,
          is_internal: false,
          rank: 20,
        },
        {
          name: `Studio Internal ${suffix}`,
          handle: `studio-internal-${suffix}`,
          is_active: true,
          is_internal: true,
          rank: 30,
        },
      ],
    },
  })
  assert.equal(categories.length, 3)
  const categoryA = categories[0]
  const categoryB = categories[1]
  const internalCategory = categories[2]

  const { result: designerA } = await createDesignerWorkflow(container).run({
    input: {
      name: `Studio Designer A ${suffix}`,
      handle: `studio-designer-a-${suffix}`,
      description: null,
      logo_url: null,
    },
  })
  const { result: designerB } = await createDesignerWorkflow(container).run({
    input: {
      name: `Studio Designer B ${suffix}`,
      handle: `studio-designer-b-${suffix}`,
      description: null,
      logo_url: null,
    },
  })
  assert.ok(designerA.id)
  assert.ok(designerB.id)

  const { result: products } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: `COQUETTE Studio Placement Contract ${suffix}`,
          status: "draft",
          shipping_profile_id: defaults.shippingProfileId,
          sales_channels: [{ id: defaults.salesChannelId }],
          metadata: {
            coquette_studio_origin: "quick_draft",
            coquette_studio_wizard_step: "6",
          },
        },
      ],
    },
  })
  const productId = products[0]?.id
  assert.ok(productId)

  let state = await readStudioPlacementTaxonomyState(container, productId)
  assert.equal(state.ready, true)
  assert.deepEqual(state.current.category_ids, [])
  assert.equal(state.current.designer_id, null)
  assert.equal(
    state.categories.some((category) => category.id === categoryA.id),
    true
  )
  assert.equal(
    state.categories.some((category) => category.id === categoryB.id),
    true
  )
  assert.equal(
    state.categories.some((category) => category.id === internalCategory.id),
    false
  )
  assert.equal(
    state.designers.some((designer) => designer.id === designerA.id),
    true
  )

  const first: StudioPlacementTaxonomyRequest = {
    category_ids: [categoryA.id, categoryB.id],
    designer_id: designerA.id,
  }
  const firstUpdatedAt = await productUpdatedAt(container, productId)
  const firstPlan = await buildStudioPlacementTaxonomyPlan(
    container,
    productId,
    firstUpdatedAt,
    first
  )
  assert.equal(firstPlan.change_count, 3)
  assert.equal(firstPlan.category_changes, 2)
  assert.equal(firstPlan.designer_changed, true)
  assert.match(firstPlan.placement_hash, /^[a-f0-9]{64}$/)

  await applyStudioPlacementTaxonomyPlan(
    container,
    productId,
    firstUpdatedAt,
    first,
    firstPlan.placement_hash
  )
  state = await readStudioPlacementTaxonomyState(container, productId)
  assert.deepEqual(state.current.category_ids, [categoryA.id, categoryB.id].sort())
  assert.equal(state.current.designer_id, designerA.id)
  assert.equal(state.product.status, "draft")

  const idempotentUpdatedAt = await productUpdatedAt(container, productId)
  const idempotentPlan = await buildStudioPlacementTaxonomyPlan(
    container,
    productId,
    idempotentUpdatedAt,
    first
  )
  assert.equal(idempotentPlan.change_count, 0)
  assert.equal(idempotentPlan.category_changes, 0)
  assert.equal(idempotentPlan.designer_changed, false)
  await applyStudioPlacementTaxonomyPlan(
    container,
    productId,
    idempotentUpdatedAt,
    first,
    idempotentPlan.placement_hash
  )

  const second: StudioPlacementTaxonomyRequest = {
    category_ids: [categoryB.id],
    designer_id: designerB.id,
  }
  const secondUpdatedAt = await productUpdatedAt(container, productId)
  const secondPlan = await buildStudioPlacementTaxonomyPlan(
    container,
    productId,
    secondUpdatedAt,
    second
  )
  assert.equal(secondPlan.category_changes, 1)
  assert.equal(secondPlan.designer_changed, true)
  assert.equal(secondPlan.change_count, 2)
  await applyStudioPlacementTaxonomyPlan(
    container,
    productId,
    secondUpdatedAt,
    second,
    secondPlan.placement_hash
  )

  state = await readStudioPlacementTaxonomyState(container, productId)
  assert.deepEqual(state.current.category_ids, [categoryB.id])
  assert.equal(state.current.designer_id, designerB.id)
  assert.equal(state.product.status, "draft")

  const clear: StudioPlacementTaxonomyRequest = {
    category_ids: [],
    designer_id: null,
  }
  const clearUpdatedAt = await productUpdatedAt(container, productId)
  const clearPlan = await buildStudioPlacementTaxonomyPlan(
    container,
    productId,
    clearUpdatedAt,
    clear
  )
  assert.equal(clearPlan.category_changes, 1)
  assert.equal(clearPlan.designer_changed, true)
  await applyStudioPlacementTaxonomyPlan(
    container,
    productId,
    clearUpdatedAt,
    clear,
    clearPlan.placement_hash
  )

  state = await readStudioPlacementTaxonomyState(container, productId)
  assert.deepEqual(state.current.category_ids, [])
  assert.equal(state.current.designer_id, null)
  assert.equal(state.product.status, "draft")

  const invalidInternal: StudioPlacementTaxonomyRequest = {
    category_ids: [internalCategory.id],
    designer_id: null,
  }
  const invalidUpdatedAt = await productUpdatedAt(container, productId)
  await assert.rejects(
    () =>
      buildStudioPlacementTaxonomyPlan(
        container,
        productId,
        invalidUpdatedAt,
        invalidInternal
      ),
    /not an active merchant-facing COQUETTE category/
  )

  const staleHashPlan = await buildStudioPlacementTaxonomyPlan(
    container,
    productId,
    invalidUpdatedAt,
    first
  )
  await assert.rejects(
    () =>
      applyStudioPlacementTaxonomyPlan(
        container,
        productId,
        invalidUpdatedAt,
        first,
        "0".repeat(64)
      ),
    /stale_placement_plan/
  )
  assert.match(staleHashPlan.placement_hash, /^[a-f0-9]{64}$/)

  console.log(
    "COQUETTE Studio guarded category/designer replacement, clearing, idempotency and stale-plan contract passed"
  )
}
