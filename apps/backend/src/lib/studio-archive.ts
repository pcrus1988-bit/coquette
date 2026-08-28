import { createHash } from "crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  ProductStatus,
} from "@medusajs/framework/utils"
import applyStudioArchiveWorkflow, {
  type ApplyStudioArchiveWorkflowInput,
} from "../workflows/apply-studio-archive"
import {
  STUDIO_ARCHIVE_MARKER_KEY,
  STUDIO_ARCHIVE_PREVIOUS_STATUS_KEY,
  STUDIO_ARCHIVE_VERSION,
  STUDIO_ARCHIVE_VERSION_KEY,
  studioArchivePreviousStatus,
  studioProductIsArchived,
} from "./studio-archive-policy"

export const STUDIO_ARCHIVE_ACTIONS = ["archive", "restore"] as const
export type StudioArchiveAction = (typeof STUDIO_ARCHIVE_ACTIONS)[number]

type StudioArchiveProduct = {
  id: string
  title?: string | null
  status?: string | null
  updated_at?: string | Date | null
  metadata?: Record<string, unknown> | null
  sales_channels?: Array<{ id: string; name?: string | null }> | null
}

export type StudioArchiveState = {
  ready: true
  version: string
  product: {
    id: string
    title: string
    status: "draft" | "published"
    updated_at: string
  }
  archive: {
    archived: boolean
    previous_status: "draft" | "published" | null
    visibility_invariant_ok: boolean
  }
  current_sales_channels: Array<{ id: string; name: string }>
  available_actions: StudioArchiveAction[]
}

export type StudioArchivePlan = {
  version: string
  product_id: string
  product_title: string
  expected_updated_at: string
  action: StudioArchiveAction
  before: {
    status: "draft" | "published"
    archived: boolean
    previous_status: "draft" | "published" | null
    sales_channel_ids: string[]
  }
  after: {
    status: "draft"
    archived: boolean
    previous_status: "draft" | "published" | null
    sales_channel_ids: string[]
  }
  preserves: {
    sales_channels: true
    variants: true
    pricing: true
    inventory: true
    media: true
    placement: true
  }
  change_count: number
  archive_hash: string
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

export function cleanStudioArchiveProductId(value: unknown) {
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
    ],
    filters: { id: productId },
  })
  return data?.[0] as StudioArchiveProduct | undefined
}

function assertStudioArchiveProduct(product: StudioArchiveProduct | undefined) {
  if (!product) throw unexpectedState("product_not_found: Product not found")
  if (product.metadata?.coquette_studio_origin !== "quick_draft") {
    throw unexpectedState(
      "not_studio_product: This product is outside the guarded COQUETTE Studio product flow."
    )
  }
  if (product.status !== ProductStatus.DRAFT && product.status !== ProductStatus.PUBLISHED) {
    throw unexpectedState(
      `unsupported_status: Studio archive cannot manage Medusa status ${product.status || "unknown"}.`
    )
  }
  if (!canonicalTimestamp(product.updated_at)) {
    throw unexpectedState("Product has no usable update timestamp.")
  }
}

function salesChannels(product: StudioArchiveProduct) {
  return (product.sales_channels || [])
    .map((channel) => ({ id: channel.id, name: channel.name || channel.id }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export async function readStudioArchiveState(
  container: MedusaContainer,
  productId: string
): Promise<StudioArchiveState> {
  const product = await loadProduct(container, productId)
  assertStudioArchiveProduct(product)
  const status = product!.status as "draft" | "published"
  const archived = studioProductIsArchived(product!.metadata)
  const invariantOk = !archived || status === "draft"

  return {
    ready: true,
    version: STUDIO_ARCHIVE_VERSION,
    product: {
      id: product!.id,
      title: product!.title || "Untitled product",
      status,
      updated_at: canonicalTimestamp(product!.updated_at),
    },
    archive: {
      archived,
      previous_status: studioArchivePreviousStatus(product!.metadata),
      visibility_invariant_ok: invariantOk,
    },
    current_sales_channels: salesChannels(product!),
    available_actions: invariantOk ? (archived ? ["restore"] : ["archive"]) : [],
  }
}

export async function buildStudioArchivePlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  action: StudioArchiveAction
): Promise<StudioArchivePlan> {
  if (!STUDIO_ARCHIVE_ACTIONS.includes(action)) {
    throw unexpectedState("A valid Studio archive action is required.")
  }

  const product = await loadProduct(container, productId)
  assertStudioArchiveProduct(product)
  const actualUpdatedAt = canonicalTimestamp(product!.updated_at)
  if (!expectedUpdatedAt || canonicalTimestamp(expectedUpdatedAt) !== actualUpdatedAt) {
    throw unexpectedState("stale_product")
  }

  const beforeStatus = product!.status as "draft" | "published"
  const archived = studioProductIsArchived(product!.metadata)
  const previousStatus = studioArchivePreviousStatus(product!.metadata)
  if (archived && beforeStatus !== "draft") {
    throw unexpectedState(
      "archived_visibility_violation: An archived product must remain a Medusa draft."
    )
  }
  if (action === "archive" && archived) {
    throw unexpectedState("invalid_transition: This product is already archived.")
  }
  if (action === "restore" && !archived) {
    throw unexpectedState("invalid_transition: This product is not archived.")
  }

  const channelIds = salesChannels(product!).map((channel) => channel.id)
  const afterPreviousStatus = action === "archive" ? beforeStatus : previousStatus
  const hashInput = {
    version: STUDIO_ARCHIVE_VERSION,
    product_id: product!.id,
    expected_updated_at: actualUpdatedAt,
    action,
    before: {
      status: beforeStatus,
      archived,
      previous_status: previousStatus,
      sales_channel_ids: channelIds,
    },
    after: {
      status: "draft" as const,
      archived: action === "archive",
      previous_status: afterPreviousStatus,
      sales_channel_ids: channelIds,
    },
    preserves: {
      sales_channels: true as const,
      variants: true as const,
      pricing: true as const,
      inventory: true as const,
      media: true as const,
      placement: true as const,
    },
  }

  return {
    ...hashInput,
    product_title: product!.title || "Untitled product",
    change_count: Number(beforeStatus !== "draft") + 1,
    archive_hash: stableHash(hashInput),
  }
}

export async function applyStudioArchivePlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  action: StudioArchiveAction,
  archiveHash: string
) {
  const plan = await buildStudioArchivePlan(
    container,
    productId,
    expectedUpdatedAt,
    action
  )
  if (plan.archive_hash !== archiveHash) {
    throw unexpectedState("stale_archive_plan")
  }

  const current = await loadProduct(container, productId)
  assertStudioArchiveProduct(current)
  const metadata = {
    ...(current!.metadata || {}),
    [STUDIO_ARCHIVE_MARKER_KEY]: action === "archive" ? "true" : "false",
    [STUDIO_ARCHIVE_VERSION_KEY]: STUDIO_ARCHIVE_VERSION,
    [STUDIO_ARCHIVE_PREVIOUS_STATUS_KEY]:
      plan.after.previous_status || ProductStatus.DRAFT,
  }
  const input: ApplyStudioArchiveWorkflowInput = {
    product_id: productId,
    target_status: "draft",
    metadata,
  }
  await applyStudioArchiveWorkflow(container).run({ input })

  const after = await loadProduct(container, productId)
  assertStudioArchiveProduct(after)
  const afterChannels = salesChannels(after!).map((channel) => channel.id)
  if (
    after!.status !== ProductStatus.DRAFT ||
    studioProductIsArchived(after!.metadata) !== plan.after.archived ||
    JSON.stringify(afterChannels) !== JSON.stringify(plan.after.sales_channel_ids)
  ) {
    throw unexpectedState("Studio archive invariant verification failed")
  }

  return {
    plan,
    state: await readStudioArchiveState(container, productId),
  }
}
