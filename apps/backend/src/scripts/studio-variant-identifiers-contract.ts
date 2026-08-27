import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import assert from "node:assert/strict"
import {
  applyStudioVariantIdentifierPlan,
  buildStudioVariantIdentifierPlan,
  readStudioVariantIdentifierState,
  type StudioVariantIdentifierRequest,
} from "../lib/studio-variant-identifiers"

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
  const value = (data[0] as ProductTimestampRecord).updated_at
  assert.ok(value)
  return value instanceof Date ? value.toISOString() : String(value)
}

function checkDigit(base: string) {
  const digits = base.split("").map(Number)
  let sum = 0
  for (let index = digits.length - 1, position = 1; index >= 0; index--, position++) {
    sum += digits[index] * (position % 2 === 1 ? 3 : 1)
  }
  return String((10 - (sum % 10)) % 10)
}

function gtin(totalLength: 12 | 13, discriminator: string) {
  const baseLength = totalLength - 1
  const raw = `${Date.now()}${Math.floor(Math.random() * 1_000_000)}${discriminator}`.replace(/\D/g, "")
  const base = raw.padStart(baseLength, "0").slice(-baseLength)
  return `${base}${checkDigit(base)}`
}

function lineByTitle(
  state: Awaited<ReturnType<typeof readStudioVariantIdentifierState>>,
  title: string
) {
  const line = state.variants.find((variant) => variant.title === title)
  assert.ok(line, `Missing identifier-contract variant ${title}`)
  return line
}

export default async function studioVariantIdentifiersContract({ container }: ExecArgs) {
  const defaults = await runtimeDefaults(container)
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "COQUETTE Studio Identifier Contract",
          status: "draft",
          shipping_profile_id: defaults.shippingProfileId,
          sales_channels: [{ id: defaults.salesChannelId }],
          options: [{ title: "Size", values: ["S", "M"] }],
          variants: [
            {
              title: "S",
              options: { Size: "S" },
              manage_inventory: false,
              allow_backorder: false,
            },
            {
              title: "M",
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

  let state = await readStudioVariantIdentifierState(container, productId)
  assert.equal(state.ready, true)
  assert.equal(state.variants.length, 2)
  assert.equal(
    state.variants.every(
      (variant) => !variant.sku && !variant.ean && !variant.upc && !variant.barcode
    ),
    true
  )

  const s = lineByTitle(state, "S")
  const m = lineByTitle(state, "M")
  const first: StudioVariantIdentifierRequest = {
    variants: [
      {
        variant_id: s.variant_id,
        sku: `COQ-ID-S-${suffix}`,
        ean: gtin(13, "11"),
        upc: gtin(12, "12"),
        barcode: `BAR-S-${suffix}`,
      },
      {
        variant_id: m.variant_id,
        sku: `COQ-ID-M-${suffix}`,
        ean: gtin(13, "21"),
        upc: gtin(12, "22"),
        barcode: `BAR-M-${suffix}`,
      },
    ],
  }

  const firstUpdatedAt = await productUpdatedAt(container, productId)
  const firstPlan = await buildStudioVariantIdentifierPlan(
    container,
    productId,
    firstUpdatedAt,
    first
  )
  assert.equal(firstPlan.change_count, 8)
  assert.match(firstPlan.identifier_hash, /^[a-f0-9]{64}$/)
  await applyStudioVariantIdentifierPlan(
    container,
    productId,
    firstUpdatedAt,
    first,
    firstPlan.identifier_hash
  )

  state = await readStudioVariantIdentifierState(container, productId)
  for (const requestLine of first.variants) {
    const actual = state.variants.find((variant) => variant.variant_id === requestLine.variant_id)
    assert.ok(actual)
    assert.equal(actual.sku, requestLine.sku)
    assert.equal(actual.ean, requestLine.ean)
    assert.equal(actual.upc, requestLine.upc)
    assert.equal(actual.barcode, requestLine.barcode)
  }

  const idempotentUpdatedAt = await productUpdatedAt(container, productId)
  const idempotentPlan = await buildStudioVariantIdentifierPlan(
    container,
    productId,
    idempotentUpdatedAt,
    first
  )
  assert.equal(idempotentPlan.change_count, 0)
  await applyStudioVariantIdentifierPlan(
    container,
    productId,
    idempotentUpdatedAt,
    first,
    idempotentPlan.identifier_hash
  )

  const second: StudioVariantIdentifierRequest = {
    variants: [
      {
        ...first.variants[0],
        sku: `COQ-ID-S2-${suffix}`,
        ean: null,
        upc: null,
        barcode: null,
      },
      {
        ...first.variants[1],
        barcode: `BAR-M2-${suffix}`,
      },
    ],
  }
  const secondUpdatedAt = await productUpdatedAt(container, productId)
  const secondPlan = await buildStudioVariantIdentifierPlan(
    container,
    productId,
    secondUpdatedAt,
    second
  )
  assert.equal(secondPlan.change_count, 5)
  await applyStudioVariantIdentifierPlan(
    container,
    productId,
    secondUpdatedAt,
    second,
    secondPlan.identifier_hash
  )

  state = await readStudioVariantIdentifierState(container, productId)
  const finalS = lineByTitle(state, "S")
  const finalM = lineByTitle(state, "M")
  assert.equal(finalS.sku, second.variants[0].sku)
  assert.equal(finalS.ean, null)
  assert.equal(finalS.upc, null)
  assert.equal(finalS.barcode, null)
  assert.equal(finalM.barcode, second.variants[1].barcode)

  const invalidEan: StudioVariantIdentifierRequest = {
    variants: second.variants.map((line, index) =>
      index === 0 ? { ...line, ean: "4006381333932" } : line
    ),
  }
  const invalidEanUpdatedAt = await productUpdatedAt(container, productId)
  await assert.rejects(
    () => buildStudioVariantIdentifierPlan(container, productId, invalidEanUpdatedAt, invalidEan),
    /valid EAN-8 or EAN-13/
  )

  const { result: foreignResult } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "COQUETTE Studio Identifier Collision",
          status: "draft",
          shipping_profile_id: defaults.shippingProfileId,
          sales_channels: [{ id: defaults.salesChannelId }],
          variants: [
            {
              title: "Default",
              sku: `FOREIGN-${suffix}`,
              barcode: `FOREIGN-BAR-${suffix}`,
              manage_inventory: false,
              allow_backorder: false,
            },
          ],
        },
      ],
    },
  })
  assert.ok(foreignResult[0]?.id)

  const collision: StudioVariantIdentifierRequest = {
    variants: second.variants.map((line, index) =>
      index === 0 ? { ...line, sku: `FOREIGN-${suffix}` } : line
    ),
  }
  const collisionUpdatedAt = await productUpdatedAt(container, productId)
  await assert.rejects(
    () => buildStudioVariantIdentifierPlan(container, productId, collisionUpdatedAt, collision),
    /already assigned to another Medusa variant/
  )

  const productModule = container.resolve(Modules.PRODUCT)
  const variants = await productModule.listProductVariants({ product_id: productId })
  assert.equal(variants.length, 2)
  assert.equal(variants.every((variant) => variant.manage_inventory === false), true)
  assert.equal(variants.every((variant) => variant.allow_backorder === false), true)
  const products = await productModule.listProducts({ id: productId })
  assert.equal(products.length, 1)
  assert.equal(products[0].status, "draft")

  console.log(
    "COQUETTE Studio guarded variant identifier create/update/idempotency/validation/collision contract passed"
  )
}
