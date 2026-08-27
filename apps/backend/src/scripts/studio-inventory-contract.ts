import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import assert from "node:assert/strict"
import {
  applyStudioInventoryPlan,
  buildStudioInventoryPlan,
  readStudioInventoryState,
  STUDIO_INVENTORY_LOCATION_NAME,
  type StudioInventoryRequest,
} from "../lib/studio-inventory"

type ProductTimestampRecord = {
  id: string
  updated_at?: string | Date | null
}

async function runtimeDefaults(container: ExecArgs["container"]) {
  const storeModule = container.resolve(Modules.STORE)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const stores = await storeModule.listStores({}, { take: 2 })
  assert.equal(stores.length, 1)
  assert.ok(stores[0].default_sales_channel_id)
  assert.ok(stores[0].default_location_id)

  const locations = await stockLocationModule.listStockLocations(
    { id: stores[0].default_location_id },
    { take: 2 }
  )
  assert.equal(locations.length, 1)
  assert.equal(locations[0].name, STUDIO_INVENTORY_LOCATION_NAME)

  const shippingProfiles = await fulfillmentModule.listShippingProfiles({ type: "default" })
  assert.equal(shippingProfiles.length, 1)

  return {
    salesChannelId: stores[0].default_sales_channel_id!,
    shippingProfileId: shippingProfiles[0].id,
    locationId: stores[0].default_location_id!,
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

function lineByTitle(
  state: Awaited<ReturnType<typeof readStudioInventoryState>>,
  title: string
) {
  const line = state.variants.find((variant) => variant.title === title)
  assert.ok(line, `Missing inventory-contract variant ${title}`)
  return line
}

export default async function studioInventoryContract({ container }: ExecArgs) {
  const defaults = await runtimeDefaults(container)
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: `COQUETTE Studio Inventory Contract ${suffix}`,
          status: "draft",
          shipping_profile_id: defaults.shippingProfileId,
          sales_channels: [{ id: defaults.salesChannelId }],
          options: [{ title: "Size", values: ["S", "M"] }],
          variants: [
            {
              title: "S",
              sku: `COQ-STOCK-S-${suffix}`,
              options: { Size: "S" },
              manage_inventory: false,
              allow_backorder: false,
            },
            {
              title: "M",
              sku: `COQ-STOCK-M-${suffix}`,
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

  let state = await readStudioInventoryState(container, productId)
  assert.equal(state.ready, true)
  assert.equal(state.location.id, defaults.locationId)
  assert.equal(state.location.name, STUDIO_INVENTORY_LOCATION_NAME)
  assert.equal(state.variants.length, 2)
  assert.equal(state.variants.every((line) => !line.manage_inventory), true)
  assert.equal(state.variants.every((line) => !line.inventory_item_id), true)
  assert.equal(state.variants.every((line) => line.stocked_quantity === 0), true)

  const s = lineByTitle(state, "S")
  const m = lineByTitle(state, "M")
  const first: StudioInventoryRequest = {
    variants: [
      { variant_id: s.variant_id, stocked_quantity: 7 },
      { variant_id: m.variant_id, stocked_quantity: 3 },
    ],
  }

  const firstUpdatedAt = await productUpdatedAt(container, productId)
  const firstPlan = await buildStudioInventoryPlan(
    container,
    productId,
    firstUpdatedAt,
    first
  )
  assert.equal(firstPlan.change_count, 2)
  assert.equal(firstPlan.variants.every((line) => line.action === "setup_tracking"), true)
  assert.match(firstPlan.inventory_hash, /^[a-f0-9]{64}$/)

  await applyStudioInventoryPlan(
    container,
    productId,
    firstUpdatedAt,
    first,
    firstPlan.inventory_hash
  )

  state = await readStudioInventoryState(container, productId)
  assert.equal(state.variants.every((line) => line.manage_inventory), true)
  assert.equal(state.variants.every((line) => line.allow_backorder === false), true)
  assert.equal(state.variants.every((line) => Boolean(line.inventory_item_id)), true)
  assert.equal(state.variants.every((line) => Boolean(line.inventory_level_id)), true)
  assert.equal(lineByTitle(state, "S").stocked_quantity, 7)
  assert.equal(lineByTitle(state, "M").stocked_quantity, 3)

  const inventoryModule = container.resolve(Modules.INVENTORY)
  for (const line of state.variants) {
    const levels = await inventoryModule.listInventoryLevels(
      { inventory_item_id: line.inventory_item_id! },
      { take: 10 }
    )
    assert.equal(levels.length, 1)
    assert.equal(levels[0].location_id, defaults.locationId)
  }

  const idempotentUpdatedAt = await productUpdatedAt(container, productId)
  const idempotentPlan = await buildStudioInventoryPlan(
    container,
    productId,
    idempotentUpdatedAt,
    first
  )
  assert.equal(idempotentPlan.change_count, 0)
  assert.equal(idempotentPlan.variants.every((line) => line.action === "unchanged"), true)
  await applyStudioInventoryPlan(
    container,
    productId,
    idempotentUpdatedAt,
    first,
    idempotentPlan.inventory_hash
  )

  state = await readStudioInventoryState(container, productId)
  const second: StudioInventoryRequest = {
    variants: state.variants.map((line) => ({
      variant_id: line.variant_id,
      stocked_quantity: line.title === "S" ? 11 : line.stocked_quantity,
    })),
  }
  const secondUpdatedAt = await productUpdatedAt(container, productId)
  const secondPlan = await buildStudioInventoryPlan(
    container,
    productId,
    secondUpdatedAt,
    second
  )
  assert.equal(secondPlan.change_count, 1)
  assert.equal(
    secondPlan.variants.find((line) => line.title === "S")?.action,
    "update"
  )
  await applyStudioInventoryPlan(
    container,
    productId,
    secondUpdatedAt,
    second,
    secondPlan.inventory_hash
  )

  state = await readStudioInventoryState(container, productId)
  assert.equal(lineByTitle(state, "S").stocked_quantity, 11)
  assert.equal(lineByTitle(state, "M").stocked_quantity, 3)
  assert.equal(state.variants.every((line) => line.reserved_quantity === 0), true)

  const staleHashUpdatedAt = await productUpdatedAt(container, productId)
  const staleHashPlan = await buildStudioInventoryPlan(
    container,
    productId,
    staleHashUpdatedAt,
    second
  )
  await assert.rejects(
    () =>
      applyStudioInventoryPlan(
        container,
        productId,
        staleHashUpdatedAt,
        second,
        "0".repeat(64)
      ),
    /stale_inventory_plan/
  )
  assert.match(staleHashPlan.inventory_hash, /^[a-f0-9]{64}$/)

  const productModule = container.resolve(Modules.PRODUCT)
  const variants = await productModule.listProductVariants({ product_id: productId })
  assert.equal(variants.length, 2)
  assert.equal(variants.every((variant) => variant.manage_inventory === true), true)
  assert.equal(variants.every((variant) => variant.allow_backorder === false), true)
  const products = await productModule.listProducts({ id: productId })
  assert.equal(products.length, 1)
  assert.equal(products[0].status, "draft")

  console.log(
    "COQUETTE Studio guarded single-location inventory setup/update/idempotency/hash contract passed"
  )
}
