import type { ExecArgs, LinkDefinition } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createLinksWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import assert from "node:assert/strict"
import {
  applyStudioArchivePlan,
  buildStudioArchivePlan,
  readStudioArchiveState,
} from "../lib/studio-archive"
import { readStudioLifecycleState } from "../lib/studio-lifecycle"

type ProductRecord = {
  id: string
  status?: string | null
  updated_at?: string | Date | null
  metadata?: Record<string, unknown> | null
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
    fields: ["id", "status", "updated_at", "metadata", "sales_channels.id"],
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

export default async function studioArchiveContract({ container }: ExecArgs) {
  const defaults = await runtimeDefaults(container)
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: `COQUETTE Studio Archive Contract ${suffix}`,
          status: "published",
          shipping_profile_id: defaults.shippingProfileId,
          options: [{ title: "Size", values: ["One Size"] }],
          variants: [
            {
              title: "One Size",
              sku: `COQ-ARCH-${suffix}`,
              options: { Size: "One Size" },
              manage_inventory: false,
              allow_backorder: false,
            },
          ],
          metadata: {
            coquette_studio_origin: "quick_draft",
            coquette_studio_variants_generated: "true",
            coquette_studio_variant_count: "1",
            coquette_studio_variant_graph_version: "1",
            coquette_archive_contract_sentinel: "preserve-me",
          },
        },
      ],
    },
  })

  const productId = result[0]?.id
  assert.ok(productId)

  const links: LinkDefinition[] = [
    {
      [Modules.PRODUCT]: { product_id: productId },
      [Modules.SALES_CHANNEL]: { sales_channel_id: defaults.salesChannelId },
    },
  ]
  await createLinksWorkflow(container).run({ input: links })

  let record = await productRecord(container, productId)
  assert.equal(record.status, "published")
  assert.deepEqual(
    (record.sales_channels || []).map((channel) => channel.id),
    [defaults.salesChannelId]
  )

  let state = await readStudioArchiveState(container, productId)
  assert.equal(state.archive.archived, false)
  assert.equal(state.archive.previous_status, null)
  assert.equal(state.archive.visibility_invariant_ok, true)
  assert.deepEqual(state.available_actions, ["archive"])

  const publishedAt = timestamp(record)
  const archivePlan = await buildStudioArchivePlan(
    container,
    productId,
    publishedAt,
    "archive"
  )
  assert.equal(archivePlan.before.status, "published")
  assert.equal(archivePlan.before.archived, false)
  assert.equal(archivePlan.after.status, "draft")
  assert.equal(archivePlan.after.archived, true)
  assert.equal(archivePlan.after.previous_status, "published")
  assert.deepEqual(archivePlan.before.sales_channel_ids, [defaults.salesChannelId])
  assert.deepEqual(archivePlan.after.sales_channel_ids, [defaults.salesChannelId])
  assert.equal(archivePlan.preserves.sales_channels, true)
  assert.equal(archivePlan.preserves.variants, true)
  assert.equal(archivePlan.preserves.pricing, true)
  assert.equal(archivePlan.preserves.inventory, true)
  assert.equal(archivePlan.preserves.media, true)
  assert.equal(archivePlan.preserves.placement, true)
  assert.equal(archivePlan.change_count, 2)
  assert.match(archivePlan.archive_hash, /^[a-f0-9]{64}$/)

  await assert.rejects(
    () =>
      applyStudioArchivePlan(
        container,
        productId,
        publishedAt,
        "archive",
        "0".repeat(64)
      ),
    /stale_archive_plan/
  )
  record = await productRecord(container, productId)
  assert.equal(record.status, "published")

  await applyStudioArchivePlan(
    container,
    productId,
    publishedAt,
    "archive",
    archivePlan.archive_hash
  )

  record = await productRecord(container, productId)
  assert.equal(record.status, "draft")
  assert.equal(record.metadata?.coquette_studio_archived, "true")
  assert.equal(record.metadata?.coquette_studio_archive_previous_status, "published")
  assert.equal(record.metadata?.coquette_archive_contract_sentinel, "preserve-me")
  assert.deepEqual(
    (record.sales_channels || []).map((channel) => channel.id),
    [defaults.salesChannelId]
  )

  state = await readStudioArchiveState(container, productId)
  assert.equal(state.archive.archived, true)
  assert.equal(state.archive.previous_status, "published")
  assert.equal(state.archive.visibility_invariant_ok, true)
  assert.deepEqual(state.available_actions, ["restore"])

  await assert.rejects(
    () => readStudioLifecycleState(container, productId),
    /product_archived/
  )
  await assert.rejects(
    () => buildStudioArchivePlan(container, productId, publishedAt, "archive"),
    /stale_product/
  )

  const archivedAt = timestamp(record)
  await assert.rejects(
    () => buildStudioArchivePlan(container, productId, archivedAt, "archive"),
    /invalid_transition/
  )

  const restorePlan = await buildStudioArchivePlan(
    container,
    productId,
    archivedAt,
    "restore"
  )
  assert.equal(restorePlan.before.status, "draft")
  assert.equal(restorePlan.before.archived, true)
  assert.equal(restorePlan.after.status, "draft")
  assert.equal(restorePlan.after.archived, false)
  assert.equal(restorePlan.after.previous_status, "published")
  assert.deepEqual(restorePlan.after.sales_channel_ids, [defaults.salesChannelId])
  assert.equal(restorePlan.change_count, 1)
  assert.match(restorePlan.archive_hash, /^[a-f0-9]{64}$/)

  await applyStudioArchivePlan(
    container,
    productId,
    archivedAt,
    "restore",
    restorePlan.archive_hash
  )

  record = await productRecord(container, productId)
  assert.equal(record.status, "draft")
  assert.equal(record.metadata?.coquette_studio_archived, "false")
  assert.equal(record.metadata?.coquette_studio_archive_previous_status, "published")
  assert.equal(record.metadata?.coquette_archive_contract_sentinel, "preserve-me")
  assert.deepEqual(
    (record.sales_channels || []).map((channel) => channel.id),
    [defaults.salesChannelId]
  )

  state = await readStudioArchiveState(container, productId)
  assert.equal(state.product.status, "draft")
  assert.equal(state.archive.archived, false)
  assert.equal(state.archive.previous_status, "published")
  assert.equal(state.archive.visibility_invariant_ok, true)
  assert.deepEqual(state.available_actions, ["archive"])

  const lifecycle = await readStudioLifecycleState(container, productId)
  assert.equal(lifecycle.product.status, "draft")

  console.log(
    "COQUETTE Studio guarded archive/restore, reversible draft restoration, stale review, lifecycle exclusion, metadata preservation and sales-channel preservation contract passed"
  )
}
