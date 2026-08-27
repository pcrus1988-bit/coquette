import { createHash } from "crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import applyStudioInventoryWorkflow from "../workflows/apply-studio-inventory"

export const STUDIO_INVENTORY_VERSION = "1"
const MAX_STOCKED_QUANTITY = 1_000_000_000

type InventoryLevelRecord = {
  id: string
  location_id: string
  stocked_quantity?: number | string | null
  reserved_quantity?: number | string | null
  incoming_quantity?: number | string | null
}

type InventoryItemRecord = {
  id: string
  sku?: string | null
  title?: string | null
  location_levels?: InventoryLevelRecord[] | null
}

type InventoryLinkRecord = {
  id?: string
  inventory_item_id?: string
  required_quantity?: number | string | null
  inventory?: InventoryItemRecord | null
}

type VariantRecord = {
  id: string
  title?: string | null
  sku?: string | null
  ean?: string | null
  upc?: string | null
  barcode?: string | null
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  inventory_items?: InventoryLinkRecord[] | null
}

type ProductRecord = {
  id: string
  title?: string | null
  status?: string | null
  updated_at?: string | Date | null
  metadata?: Record<string, unknown> | null
  variants?: VariantRecord[] | null
}

type LocationRecord = {
  id: string
  name?: string | null
}

export type StudioInventoryRequest = {
  variants: Array<{
    variant_id: string
    locations: Array<{
      location_id: string
      stocked_quantity: number
    }>
  }>
}

export type StudioInventoryStateLevel = {
  location_id: string
  location_name: string
  inventory_level_id: string | null
  stocked_quantity: number | null
  reserved_quantity: number
  incoming_quantity: number
}

export type StudioInventoryStateVariant = {
  variant_id: string
  title: string
  sku: string | null
  ean: string | null
  upc: string | null
  barcode: string | null
  manage_inventory: boolean
  allow_backorder: boolean
  inventory_item_id: string | null
  inventory_item_sku: string | null
  required_quantity: number | null
  levels: StudioInventoryStateLevel[]
}

export type StudioInventoryState = {
  ready: boolean
  product_id: string
  product_title: string
  expected_updated_at: string
  code?: string
  message?: string
  locations: Array<{ location_id: string; name: string }>
  variants: StudioInventoryStateVariant[]
}

type InventoryAction = "create" | "update" | "unchanged"

export type StudioInventoryPlanVariant = {
  variant_id: string
  title: string
  sku: string | null
  inventory_item_id: string | null
  inventory_item_action: "create" | "existing"
  manage_inventory_action: "enable" | "unchanged"
  locations: Array<{
    location_id: string
    location_name: string
    inventory_level_id: string | null
    current_stocked_quantity: number | null
    intended_stocked_quantity: number
    action: InventoryAction
  }>
}

export type StudioInventoryPlan = {
  version: string
  product_id: string
  product_title: string
  expected_updated_at: string
  variants: StudioInventoryPlanVariant[]
  change_count: number
  inventory_hash: string
}

type GuardProblem = {
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

function canonicalTimestamp(value: unknown) {
  if (value == null || value === "") return ""
  const date = value instanceof Date ? value : new Date(String(value))
  const time = date.getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : ""
}

function textOrNull(value: unknown) {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

function finiteQuantity(value: unknown, fallback = 0) {
  if (value == null || value === "") return fallback
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function wholeStock(value: unknown, label: string) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_STOCKED_QUANTITY
  ) {
    throw unexpectedState(
      `${label} must be a whole-piece quantity between 0 and ${MAX_STOCKED_QUANTITY}`
    )
  }
  return value
}

export function cleanStudioInventoryProductId(value: unknown) {
  if (typeof value !== "string") return ""
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ""
}

function cleanId(value: unknown, label: string) {
  if (typeof value !== "string") throw unexpectedState(`${label} is required`)
  const id = value.trim()
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(id)) {
    throw unexpectedState(`${label} is invalid`)
  }
  return id
}

async function loadProduct(
  container: MedusaContainer,
  productId: string
): Promise<ProductRecord | undefined> {
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
      "variants.ean",
      "variants.upc",
      "variants.barcode",
      "variants.manage_inventory",
      "variants.allow_backorder",
      "variants.inventory_items.id",
      "variants.inventory_items.inventory_item_id",
      "variants.inventory_items.required_quantity",
      "variants.inventory_items.inventory.id",
      "variants.inventory_items.inventory.sku",
      "variants.inventory_items.inventory.title",
      "variants.inventory_items.inventory.location_levels.id",
      "variants.inventory_items.inventory.location_levels.location_id",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
      "variants.inventory_items.inventory.location_levels.reserved_quantity",
      "variants.inventory_items.inventory.location_levels.incoming_quantity",
    ],
    filters: { id: productId },
  })
  return data?.[0] as ProductRecord | undefined
}

async function loadLocations(container: MedusaContainer) {
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const locations = (await stockLocationModule.listStockLocations(
    {},
    { take: 1000 }
  )) as LocationRecord[]
  return locations
    .map((location) => ({
      location_id: location.id,
      name: textOrNull(location.name) || "Stock location",
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
      a.location_id.localeCompare(b.location_id)
    )
}

function draftProblem(
  product: ProductRecord | undefined,
  locations: Array<{ location_id: string; name: string }>
): GuardProblem | undefined {
  if (!product) return { status: 404, code: "draft_not_found", message: "Draft not found" }
  if (product.status !== "draft") {
    return {
      status: 409,
      code: "not_a_draft",
      message: "Inventory can only be configured here while the product is an unpublished Studio draft.",
    }
  }
  if (product.metadata?.coquette_studio_origin !== "quick_draft") {
    return {
      status: 403,
      code: "not_studio_draft",
      message: "This product was not created through the guarded COQUETTE Studio flow.",
    }
  }
  if (product.metadata?.coquette_studio_variants_generated !== "true" || !product.variants?.length) {
    return {
      status: 409,
      code: "variant_graph_required",
      message: "Build the reviewed product choices before setting stock.",
    }
  }
  if (!locations.length) {
    return {
      status: 409,
      code: "stock_location_required",
      message: "At least one Medusa stock location is required before Studio can manage inventory.",
    }
  }
  return undefined
}

function topologyProblem(variant: VariantRecord): GuardProblem | undefined {
  const links = variant.inventory_items || []
  if (links.length > 1) {
    return {
      status: 409,
      code: "inventory_kit_blocked",
      message: `${variant.title || "Variant"} uses multiple inventory items. Studio will not flatten an inventory kit into one stock number.`,
    }
  }

  if (links.length === 1) {
    const link = links[0]
    if (!link.inventory?.id) {
      return {
        status: 409,
        code: "inventory_topology_incomplete",
        message: `${variant.title || "Variant"} has an incomplete inventory-item link that must be reconciled in Medusa first.`,
      }
    }
    const required = link.required_quantity == null ? 1 : Number(link.required_quantity)
    if (!Number.isFinite(required) || required !== 1) {
      return {
        status: 409,
        code: "inventory_kit_blocked",
        message: `${variant.title || "Variant"} requires ${String(link.required_quantity)} units of its inventory item. Studio inventory currently supports one physical piece per variant only.`,
      }
    }
  }

  if (variant.manage_inventory && links.length !== 1) {
    return {
      status: 409,
      code: "inventory_topology_incomplete",
      message: `${variant.title || "Variant"} is marked as inventory-managed but has no single Medusa inventory item. Reconcile it before using Studio stock controls.`,
    }
  }

  for (const link of links) {
    for (const level of link.inventory?.location_levels || []) {
      if (finiteQuantity(level.reserved_quantity) > 0) {
        return {
          status: 409,
          code: "inventory_reservations_present",
          message: `${variant.title || "Variant"} already has reserved stock. Studio will not rewrite its on-hand baseline while reservations exist.`,
        }
      }
    }
  }

  return undefined
}

function stateVariant(
  variant: VariantRecord,
  locations: Array<{ location_id: string; name: string }>
): StudioInventoryStateVariant {
  const link = (variant.inventory_items || [])[0]
  const inventory = link?.inventory || null
  const levelByLocation = new Map(
    (inventory?.location_levels || []).map((level) => [level.location_id, level])
  )
  return {
    variant_id: variant.id,
    title: textOrNull(variant.title) || "Variant",
    sku: textOrNull(variant.sku),
    ean: textOrNull(variant.ean),
    upc: textOrNull(variant.upc),
    barcode: textOrNull(variant.barcode),
    manage_inventory: variant.manage_inventory === true,
    allow_backorder: variant.allow_backorder === true,
    inventory_item_id: inventory?.id || null,
    inventory_item_sku: textOrNull(inventory?.sku),
    required_quantity:
      link?.required_quantity == null ? (inventory ? 1 : null) : finiteQuantity(link.required_quantity, 1),
    levels: locations.map((location) => {
      const level = levelByLocation.get(location.location_id)
      return {
        location_id: location.location_id,
        location_name: location.name,
        inventory_level_id: level?.id || null,
        stocked_quantity:
          level?.stocked_quantity == null ? null : finiteQuantity(level.stocked_quantity),
        reserved_quantity: finiteQuantity(level?.reserved_quantity),
        incoming_quantity: finiteQuantity(level?.incoming_quantity),
      }
    }),
  }
}

export async function readStudioInventoryState(
  container: MedusaContainer,
  productId: string
): Promise<StudioInventoryState> {
  const [product, locations] = await Promise.all([
    loadProduct(container, productId),
    loadLocations(container),
  ])
  let problem = draftProblem(product, locations)
  if (!problem && product) {
    for (const variant of product.variants || []) {
      problem = topologyProblem(variant)
      if (problem) break
    }
  }

  return {
    ready: !problem,
    product_id: productId,
    product_title: textOrNull(product?.title) || "Product draft",
    expected_updated_at: canonicalTimestamp(product?.updated_at),
    ...(problem ? { code: problem.code, message: problem.message } : {}),
    locations,
    variants: (product?.variants || []).map((variant) => stateVariant(variant, locations)),
  }
}

function normalizeRequest(
  state: StudioInventoryState,
  request: StudioInventoryRequest
) {
  if (!Array.isArray(request.variants) || request.variants.length !== state.variants.length) {
    throw unexpectedState("Every current variant must have exactly one explicit stock row")
  }

  const locationIds = new Set(state.locations.map((location) => location.location_id))
  const variantById = new Map(state.variants.map((variant) => [variant.variant_id, variant]))
  const seenVariants = new Set<string>()

  return request.variants.map((row) => {
    const variantId = cleanId(row.variant_id, "Variant id")
    const variant = variantById.get(variantId)
    if (!variant || seenVariants.has(variantId)) {
      throw unexpectedState("Inventory rows contain an unknown or duplicate variant id")
    }
    seenVariants.add(variantId)

    if (!Array.isArray(row.locations) || row.locations.length !== state.locations.length) {
      throw unexpectedState(`Every stock location must be entered explicitly for ${variant.title}`)
    }

    const seenLocations = new Set<string>()
    const quantities = row.locations.map((locationRow) => {
      const locationId = cleanId(locationRow.location_id, "Stock location id")
      if (!locationIds.has(locationId) || seenLocations.has(locationId)) {
        throw unexpectedState(`${variant.title} contains an unknown or duplicate stock location`)
      }
      seenLocations.add(locationId)
      return {
        location_id: locationId,
        stocked_quantity: wholeStock(
          locationRow.stocked_quantity,
          `${variant.title} stock`
        ),
      }
    })

    return {
      variant,
      quantities,
    }
  })
}

export async function buildStudioInventoryPlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  request: StudioInventoryRequest
): Promise<StudioInventoryPlan> {
  const state = await readStudioInventoryState(container, productId)
  if (!state.ready) {
    throw unexpectedState(`${state.code || "inventory_blocked"}:${state.message || "Inventory is blocked"}`)
  }

  const actualTimestamp = canonicalTimestamp(state.expected_updated_at)
  const expectedTimestamp = canonicalTimestamp(expectedUpdatedAt)
  if (!actualTimestamp || !expectedTimestamp || actualTimestamp !== expectedTimestamp) {
    throw new MedusaError(MedusaError.Types.CONFLICT, "stale_draft")
  }

  const normalized = normalizeRequest(state, request)
  const locationById = new Map(state.locations.map((location) => [location.location_id, location]))

  const variants: StudioInventoryPlanVariant[] = normalized.map(({ variant, quantities }) => {
    const currentLevels = new Map(variant.levels.map((level) => [level.location_id, level]))
    return {
      variant_id: variant.variant_id,
      title: variant.title,
      sku: variant.sku,
      inventory_item_id: variant.inventory_item_id,
      inventory_item_action: variant.inventory_item_id ? "existing" : "create",
      manage_inventory_action: variant.manage_inventory ? "unchanged" : "enable",
      locations: quantities
        .map((quantity) => {
          const current = currentLevels.get(quantity.location_id)
          const action: InventoryAction = !current?.inventory_level_id
            ? "create"
            : current.stocked_quantity === quantity.stocked_quantity
              ? "unchanged"
              : "update"
          return {
            location_id: quantity.location_id,
            location_name: locationById.get(quantity.location_id)?.name || "Stock location",
            inventory_level_id: current?.inventory_level_id || null,
            current_stocked_quantity: current?.stocked_quantity ?? null,
            intended_stocked_quantity: quantity.stocked_quantity,
            action,
          }
        })
        .sort((a, b) => a.location_id.localeCompare(b.location_id)),
    }
  })

  variants.sort((a, b) => a.variant_id.localeCompare(b.variant_id))

  const hashInput = {
    version: STUDIO_INVENTORY_VERSION,
    product_id: state.product_id,
    expected_updated_at: actualTimestamp,
    locations: state.locations.map((location) => ({ ...location })),
    variants: variants.map((variant) => {
      const current = state.variants.find((row) => row.variant_id === variant.variant_id)!
      return {
        variant_id: variant.variant_id,
        current: {
          manage_inventory: current.manage_inventory,
          allow_backorder: current.allow_backorder,
          inventory_item_id: current.inventory_item_id,
          inventory_item_sku: current.inventory_item_sku,
          required_quantity: current.required_quantity,
          levels: current.levels.map((level) => ({
            location_id: level.location_id,
            inventory_level_id: level.inventory_level_id,
            stocked_quantity: level.stocked_quantity,
            reserved_quantity: level.reserved_quantity,
            incoming_quantity: level.incoming_quantity,
          })),
        },
        intended: {
          manage_inventory: true,
          required_quantity: 1,
          locations: variant.locations.map((level) => ({
            location_id: level.location_id,
            stocked_quantity: level.intended_stocked_quantity,
          })),
        },
      }
    }),
  }

  const changeCount = variants.reduce(
    (total, variant) =>
      total +
      (variant.inventory_item_action === "create" ? 1 : 0) +
      (variant.manage_inventory_action === "enable" ? 1 : 0) +
      variant.locations.filter((location) => location.action !== "unchanged").length,
    0
  )

  return {
    version: STUDIO_INVENTORY_VERSION,
    product_id: state.product_id,
    product_title: state.product_title,
    expected_updated_at: actualTimestamp,
    variants,
    change_count: changeCount,
    inventory_hash: stableHash(hashInput),
  }
}

export async function applyStudioInventoryPlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  request: StudioInventoryRequest,
  approvedHash: string
) {
  const plan = await buildStudioInventoryPlan(
    container,
    productId,
    expectedUpdatedAt,
    request
  )
  if (plan.inventory_hash !== approvedHash) {
    throw new MedusaError(MedusaError.Types.CONFLICT, "stale_inventory_plan")
  }

  const createItems = plan.variants
    .filter((variant) => variant.inventory_item_action === "create")
    .map((variant) => ({
      variant_id: variant.variant_id,
      title: `${plan.product_title} · ${variant.title}`,
      sku: variant.sku,
      location_levels: variant.locations.map((location) => ({
        location_id: location.location_id,
        stocked_quantity: location.intended_stocked_quantity,
      })),
    }))

  const createLevels = plan.variants.flatMap((variant) => {
    if (!variant.inventory_item_id) return []
    return variant.locations
      .filter((location) => location.action === "create")
      .map((location) => ({
        inventory_item_id: variant.inventory_item_id!,
        location_id: location.location_id,
        stocked_quantity: location.intended_stocked_quantity,
      }))
  })

  const updateLevels = plan.variants.flatMap((variant) => {
    if (!variant.inventory_item_id) return []
    return variant.locations
      .filter((location) => location.action === "update" && location.inventory_level_id)
      .map((location) => ({
        id: location.inventory_level_id!,
        inventory_item_id: variant.inventory_item_id!,
        location_id: location.location_id,
        stocked_quantity: location.intended_stocked_quantity,
      }))
  })

  const enableVariantIds = plan.variants
    .filter((variant) => variant.manage_inventory_action === "enable")
    .map((variant) => variant.variant_id)

  if (plan.change_count > 0) {
    await applyStudioInventoryWorkflow(container).run({
      input: {
        create_items: createItems,
        create_levels: createLevels,
        update_levels: updateLevels,
        enable_variant_ids: enableVariantIds,
      },
    })
  }

  const verified = await readStudioInventoryState(container, productId)
  if (!verified.ready) {
    throw unexpectedState(verified.message || "Inventory verification is blocked")
  }
  const verifiedByVariant = new Map(
    verified.variants.map((variant) => [variant.variant_id, variant])
  )
  for (const planned of plan.variants) {
    const actual = verifiedByVariant.get(planned.variant_id)
    if (!actual || !actual.manage_inventory || actual.allow_backorder) {
      throw unexpectedState(`Inventory policy verification failed for ${planned.variant_id}`)
    }
    if (!actual.inventory_item_id || actual.required_quantity !== 1) {
      throw unexpectedState(`Inventory item verification failed for ${planned.variant_id}`)
    }
    const actualLevels = new Map(actual.levels.map((level) => [level.location_id, level]))
    for (const intended of planned.locations) {
      const actualLevel = actualLevels.get(intended.location_id)
      if (
        !actualLevel?.inventory_level_id ||
        actualLevel.stocked_quantity !== intended.intended_stocked_quantity ||
        actualLevel.reserved_quantity !== 0
      ) {
        throw unexpectedState(
          `Inventory level verification failed for ${planned.variant_id} at ${intended.location_id}`
        )
      }
    }
  }

  return {
    applied: true,
    change_count: plan.change_count,
    state: verified,
  }
}
