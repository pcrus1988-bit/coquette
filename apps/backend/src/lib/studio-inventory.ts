import { createHash } from "crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import applyStudioInventoryWorkflow, {
  type ApplyStudioInventoryWorkflowInput,
} from "../workflows/apply-studio-inventory"

export const STUDIO_INVENTORY_VERSION = "1"
export const STUDIO_INVENTORY_LOCATION_NAME = "COQUETTE Greece"
export const STUDIO_INVENTORY_MAX_QUANTITY = 1_000_000

export type StudioInventoryRequestLine = {
  variant_id: string
  stocked_quantity: number
}

export type StudioInventoryRequest = {
  variants: StudioInventoryRequestLine[]
}

type StudioInventoryProduct = {
  id: string
  title?: string | null
  status?: string | null
  updated_at?: string | Date | null
  metadata?: Record<string, unknown> | null
  variants?: Array<{
    id: string
    title?: string | null
    sku?: string | null
    manage_inventory?: boolean | null
    allow_backorder?: boolean | null
    inventory_items?: Array<{
      inventory_item_id?: string | null
      required_quantity?: number | null
      inventory?: { id?: string | null } | null
    }> | null
  }> | null
}

type InventoryLevelRecord = {
  id: string
  inventory_item_id?: string | null
  location_id?: string | null
  stocked_quantity?: unknown
  reserved_quantity?: unknown
  incoming_quantity?: unknown
}

export type StudioInventoryStateLine = {
  variant_id: string
  title: string
  sku: string | null
  manage_inventory: boolean
  allow_backorder: boolean
  inventory_item_id: string | null
  inventory_level_id: string | null
  stocked_quantity: number
  reserved_quantity: number
  incoming_quantity: number
}

export type StudioInventoryState = {
  ready: true
  version: string
  product: {
    id: string
    title: string
    status: "draft"
    updated_at: string
  }
  location: { id: string; name: string }
  variants: StudioInventoryStateLine[]
}

export type StudioInventoryPlanLine = StudioInventoryStateLine & {
  intended_stocked_quantity: number
  action: "setup_tracking" | "create_level" | "update" | "unchanged"
}

export type StudioInventoryPlan = {
  version: string
  product_id: string
  product_title: string
  expected_updated_at: string
  location: { id: string; name: string }
  variants: StudioInventoryPlanLine[]
  change_count: number
  inventory_hash: string
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
  return Number.isFinite(date.getTime()) ? date.toISOString() : ""
}

function integerQuantity(value: unknown, label: string) {
  const numeric = Number(value ?? 0)
  if (
    !Number.isSafeInteger(numeric) ||
    numeric < 0 ||
    numeric > STUDIO_INVENTORY_MAX_QUANTITY
  ) {
    throw unexpectedState(
      `${label} must be a whole number between 0 and ${STUDIO_INVENTORY_MAX_QUANTITY}`
    )
  }
  return numeric
}

export function cleanStudioInventoryProductId(value: unknown) {
  if (typeof value !== "string") return ""
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ""
}

function cleanVariantId(value: unknown) {
  if (typeof value !== "string") return ""
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ""
}

async function loadProduct(
  container: MedusaContainer,
  productId: string
): Promise<StudioInventoryProduct | undefined> {
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
      "variants.manage_inventory",
      "variants.allow_backorder",
      "variants.inventory_items.inventory_item_id",
      "variants.inventory_items.required_quantity",
      "variants.inventory_items.inventory.id",
    ],
    filters: { id: productId },
  })
  return data?.[0] as StudioInventoryProduct | undefined
}

function assertInventoryDraft(product: StudioInventoryProduct | undefined) {
  if (!product) throw unexpectedState("draft_not_found: Draft not found")
  if (product.status !== "draft") {
    throw unexpectedState(
      "not_a_draft: Inventory can only be managed here while the product is an unpublished Studio draft."
    )
  }
  if (product.metadata?.coquette_studio_origin !== "quick_draft") {
    throw unexpectedState(
      "not_studio_draft: This product is outside the guarded COQUETTE Studio draft flow."
    )
  }
  if (product.metadata?.coquette_studio_variants_generated !== "true") {
    throw unexpectedState(
      "variant_graph_required: Build the saved size / colour choices before setting stock."
    )
  }
  if (!product.variants?.length) {
    throw unexpectedState("variants_required: This draft has no variants to stock.")
  }
}

async function managedLocation(container: MedusaContainer) {
  const storeModule = container.resolve(Modules.STORE)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const stores = await storeModule.listStores({}, { take: 2 })
  if (stores.length !== 1) {
    throw unexpectedState(
      "COQUETTE Studio inventory requires exactly one configured Medusa store."
    )
  }

  const locationId = stores[0].default_location_id
  if (!locationId) {
    throw unexpectedState(
      "The Medusa store has no default stock location. Inventory writes are blocked."
    )
  }

  const locations = await stockLocationModule.listStockLocations(
    { id: locationId },
    { take: 2 }
  )
  if (locations.length !== 1) {
    throw unexpectedState(
      "The configured default stock location could not be resolved uniquely."
    )
  }
  if (locations[0].name !== STUDIO_INVENTORY_LOCATION_NAME) {
    throw unexpectedState(
      `The default stock location must be ${STUDIO_INVENTORY_LOCATION_NAME}; no location will be guessed or created.`
    )
  }

  return { id: locations[0].id, name: locations[0].name }
}

function linkedItemId(
  variant: NonNullable<StudioInventoryProduct["variants"]>[number]
) {
  const links = variant.inventory_items || []
  if (links.length > 1) {
    throw unexpectedState(
      `Variant ${variant.id} is linked to multiple inventory items. Inventory kits require a separate reviewed workflow.`
    )
  }
  if (!links.length) return null

  const link = links[0]
  if (Number(link.required_quantity ?? 1) !== 1) {
    throw unexpectedState(
      `Variant ${variant.id} uses a non-standard inventory required quantity. Studio stock editing is blocked.`
    )
  }
  const id = link.inventory?.id || link.inventory_item_id
  if (!id) {
    throw unexpectedState(
      `Variant ${variant.id} has an unresolved inventory-item link.`
    )
  }
  return String(id)
}

async function allLevels(
  container: MedusaContainer,
  itemIds: string[]
): Promise<InventoryLevelRecord[]> {
  if (!itemIds.length) return []
  const inventoryModule = container.resolve(Modules.INVENTORY)
  return (await inventoryModule.listInventoryLevels(
    { inventory_item_id: itemIds },
    { take: Math.max(500, itemIds.length * 10) }
  )) as InventoryLevelRecord[]
}

async function stateLines(
  container: MedusaContainer,
  product: StudioInventoryProduct,
  locationId: string
): Promise<StudioInventoryStateLine[]> {
  const variants = product.variants || []
  const itemIds = variants.map(linkedItemId).filter(Boolean) as string[]
  const levels = await allLevels(container, itemIds)

  return variants.map((variant) => {
    const itemId = linkedItemId(variant)
    const itemLevels = itemId
      ? levels.filter((level) => level.inventory_item_id === itemId)
      : []
    const foreignLevels = itemLevels.filter(
      (level) => level.location_id !== locationId
    )
    if (foreignLevels.length) {
      throw unexpectedState(
        `Variant ${variant.id} has stock outside ${STUDIO_INVENTORY_LOCATION_NAME}. Multi-location inventory is outside this guarded workflow.`
      )
    }

    const localLevels = itemLevels.filter(
      (level) => level.location_id === locationId
    )
    if (localLevels.length > 1) {
      throw unexpectedState(
        `Variant ${variant.id} has duplicate inventory levels at ${STUDIO_INVENTORY_LOCATION_NAME}.`
      )
    }
    if (variant.manage_inventory && !itemId) {
      throw unexpectedState(
        `Variant ${variant.id} says inventory is managed but has no inventory item.`
      )
    }
    if (!variant.manage_inventory && itemId) {
      throw unexpectedState(
        `Variant ${variant.id} has an inventory item while inventory management is disabled.`
      )
    }
    if (variant.allow_backorder) {
      throw unexpectedState(
        `Variant ${variant.id} currently allows backorders. Backorder policy must be reviewed separately before Studio stock editing.`
      )
    }

    const level = localLevels[0]
    return {
      variant_id: variant.id,
      title: variant.title || "Variant",
      sku: variant.sku || null,
      manage_inventory: Boolean(variant.manage_inventory),
      allow_backorder: false,
      inventory_item_id: itemId,
      inventory_level_id: level?.id || null,
      stocked_quantity: integerQuantity(
        level?.stocked_quantity ?? 0,
        `Stored quantity for ${variant.id}`
      ),
      reserved_quantity: integerQuantity(
        level?.reserved_quantity ?? 0,
        `Reserved quantity for ${variant.id}`
      ),
      incoming_quantity: integerQuantity(
        level?.incoming_quantity ?? 0,
        `Incoming quantity for ${variant.id}`
      ),
    }
  })
}

export async function readStudioInventoryState(
  container: MedusaContainer,
  productId: string
): Promise<StudioInventoryState> {
  const product = await loadProduct(container, productId)
  assertInventoryDraft(product)

  const location = await managedLocation(container)
  const variants = await stateLines(container, product!, location.id)
  const updatedAt = canonicalTimestamp(product!.updated_at)
  if (!updatedAt) {
    throw unexpectedState("The Studio draft has no usable update timestamp.")
  }

  return {
    ready: true,
    version: STUDIO_INVENTORY_VERSION,
    product: {
      id: product!.id,
      title: product!.title || "Untitled draft",
      status: "draft",
      updated_at: updatedAt,
    },
    location,
    variants,
  }
}

function desiredLines(
  state: StudioInventoryState,
  request: StudioInventoryRequest
) {
  const supplied = request.variants || []
  if (supplied.length !== state.variants.length) {
    throw unexpectedState(
      "Every current variant must have exactly one explicit stock row"
    )
  }

  const byId = new Map<string, StudioInventoryRequestLine>()
  for (const line of supplied) {
    const id = cleanVariantId(line.variant_id)
    if (!id || byId.has(id)) {
      throw unexpectedState("Stock rows must contain unique valid variant ids")
    }
    byId.set(id, line)
  }

  return state.variants.map((variant) => {
    const requested = byId.get(variant.variant_id)
    if (!requested) {
      throw unexpectedState(
        "Every current variant must have exactly one explicit stock row"
      )
    }
    const intended = integerQuantity(
      requested.stocked_quantity,
      `Stock for ${variant.title}`
    )
    if (intended < variant.reserved_quantity) {
      throw unexpectedState(
        `Stock for ${variant.title} cannot be lower than its ${variant.reserved_quantity} reserved unit(s). Reservations are never rewritten by Studio.`
      )
    }
    return { variant, intended }
  })
}

export async function buildStudioInventoryPlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  request: StudioInventoryRequest
): Promise<StudioInventoryPlan> {
  const state = await readStudioInventoryState(container, productId)
  const expected = canonicalTimestamp(expectedUpdatedAt)
  if (!expected || state.product.updated_at !== expected) {
    throw unexpectedState("stale_draft")
  }

  const variants: StudioInventoryPlanLine[] = desiredLines(state, request).map(
    ({ variant, intended }) => {
      let action: StudioInventoryPlanLine["action"] = "unchanged"
      if (!variant.manage_inventory && !variant.inventory_item_id) {
        action = "setup_tracking"
      } else if (variant.inventory_item_id && !variant.inventory_level_id) {
        action = "create_level"
      } else if (variant.stocked_quantity !== intended) {
        action = "update"
      }
      return {
        ...variant,
        intended_stocked_quantity: intended,
        action,
      }
    }
  )

  const hashInput = {
    version: STUDIO_INVENTORY_VERSION,
    product_id: state.product.id,
    expected_updated_at: state.product.updated_at,
    location: state.location,
    variants: variants.map((line) => ({
      variant_id: line.variant_id,
      inventory_item_id: line.inventory_item_id,
      inventory_level_id: line.inventory_level_id,
      stocked_quantity: line.stocked_quantity,
      reserved_quantity: line.reserved_quantity,
      incoming_quantity: line.incoming_quantity,
      intended_stocked_quantity: line.intended_stocked_quantity,
      action: line.action,
    })),
  }

  return {
    version: STUDIO_INVENTORY_VERSION,
    product_id: state.product.id,
    product_title: state.product.title,
    expected_updated_at: state.product.updated_at,
    location: state.location,
    variants,
    change_count: variants.filter((line) => line.action !== "unchanged").length,
    inventory_hash: stableHash(hashInput),
  }
}

export async function applyStudioInventoryPlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  request: StudioInventoryRequest,
  inventoryHash: string
) {
  const plan = await buildStudioInventoryPlan(
    container,
    productId,
    expectedUpdatedAt,
    request
  )
  if (plan.inventory_hash !== inventoryHash) {
    throw unexpectedState("stale_inventory_plan")
  }

  if (plan.change_count > 0) {
    const input: ApplyStudioInventoryWorkflowInput = {
      product_id: plan.product_id,
      location_id: plan.location.id,
      variants: plan.variants.map((line) => ({
        variant_id: line.variant_id,
        title: line.title,
        sku: line.sku,
        inventory_item_id: line.inventory_item_id,
        inventory_level_id: line.inventory_level_id,
        stocked_quantity: line.intended_stocked_quantity,
      })),
    }
    await applyStudioInventoryWorkflow(container).run({ input })
  }

  const after = await readStudioInventoryState(container, productId)
  for (const line of plan.variants) {
    const actual = after.variants.find(
      (candidate) => candidate.variant_id === line.variant_id
    )
    if (
      !actual ||
      !actual.manage_inventory ||
      actual.allow_backorder ||
      !actual.inventory_item_id ||
      !actual.inventory_level_id ||
      actual.stocked_quantity !== line.intended_stocked_quantity
    ) {
      throw unexpectedState(
        `Inventory invariant failed for variant ${line.variant_id}`
      )
    }
  }
  return plan
}
