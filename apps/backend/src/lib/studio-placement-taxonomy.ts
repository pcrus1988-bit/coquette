import { createHash } from "crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { BRAND_MODULE } from "../modules/brand"
import type BrandModuleService from "../modules/brand/service"
import applyStudioPlacementTaxonomyWorkflow, {
  type ApplyStudioPlacementTaxonomyWorkflowInput,
} from "../workflows/apply-studio-placement-taxonomy"

export const STUDIO_PLACEMENT_TAXONOMY_VERSION = "1"

export type StudioPlacementTaxonomyRequest = {
  category_ids: string[]
  designer_id: string | null
}

type ProductGraphRecord = {
  id: string
  title?: string | null
  status?: string | null
  updated_at?: string | Date | null
  metadata?: Record<string, unknown> | null
  categories?: Array<{
    id: string
    name?: string | null
    handle?: string | null
    is_active?: boolean | null
    is_internal?: boolean | null
    parent_category_id?: string | null
  }> | null
  brand?: {
    id?: string | null
    name?: string | null
    handle?: string | null
  } | null
}

export type StudioPlacementTaxonomyState = {
  ready: true
  version: string
  product: {
    id: string
    title: string
    status: "draft"
    updated_at: string
  }
  current: {
    category_ids: string[]
    designer_id: string | null
  }
  categories: Array<{
    id: string
    name: string
    handle: string
    parent_category_id: string | null
    parent_name: string | null
    rank: number
  }>
  designers: Array<{
    id: string
    name: string
    handle: string
  }>
}

export type StudioPlacementTaxonomyPlan = {
  version: string
  product_id: string
  product_title: string
  expected_updated_at: string
  before: {
    category_ids: string[]
    designer_id: string | null
  }
  after: {
    category_ids: string[]
    designer_id: string | null
  }
  category_changes: number
  designer_changed: boolean
  change_count: number
  placement_hash: string
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

function cleanId(value: unknown) {
  if (typeof value !== "string") return ""
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ""
}

export function cleanStudioPlacementProductId(value: unknown) {
  return cleanId(value)
}

function normalizedIds(values: unknown[]) {
  const ids = values.map(cleanId)
  if (ids.some((id) => !id)) {
    throw unexpectedState("Category selections contain an invalid id")
  }
  const unique = [...new Set(ids)].sort()
  if (unique.length !== ids.length) {
    throw unexpectedState("Category selections must not contain duplicate ids")
  }
  return unique
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
      "categories.id",
      "categories.name",
      "categories.handle",
      "categories.is_active",
      "categories.is_internal",
      "categories.parent_category_id",
      "brand.id",
      "brand.name",
      "brand.handle",
    ],
    filters: { id: productId },
  })
  return data?.[0] as ProductGraphRecord | undefined
}

function assertStudioDraft(product: ProductGraphRecord | undefined) {
  if (!product) throw unexpectedState("draft_not_found: Draft not found")
  if (product.status !== "draft") {
    throw unexpectedState(
      "not_a_draft: Placement can only be edited while the product is an unpublished Studio draft."
    )
  }
  if (product.metadata?.coquette_studio_origin !== "quick_draft") {
    throw unexpectedState(
      "not_studio_draft: This product is outside the guarded COQUETTE Studio draft flow."
    )
  }
}

async function selectableCategories(container: MedusaContainer) {
  const productModule = container.resolve(Modules.PRODUCT)
  const categories = await productModule.listProductCategories(
    { is_active: true, is_internal: false },
    { take: 500, order: { rank: "ASC", name: "ASC" } }
  )
  const nameById = new Map(categories.map((category) => [category.id, category.name]))
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    handle: category.handle,
    parent_category_id: category.parent_category_id || null,
    parent_name: category.parent_category_id
      ? nameById.get(category.parent_category_id) || null
      : null,
    rank: category.rank,
  }))
}

async function selectableDesigners(container: MedusaContainer) {
  const brandService = container.resolve<BrandModuleService>(BRAND_MODULE)
  const designers = await brandService.listBrands(
    {},
    { take: 500, order: { name: "ASC" } }
  )
  return designers.map((designer) => ({
    id: designer.id,
    name: designer.name,
    handle: designer.handle,
  }))
}

export async function readStudioPlacementTaxonomyState(
  container: MedusaContainer,
  productId: string
): Promise<StudioPlacementTaxonomyState> {
  const product = await loadProduct(container, productId)
  assertStudioDraft(product)

  const [categories, designers] = await Promise.all([
    selectableCategories(container),
    selectableDesigners(container),
  ])
  const selectableCategoryIds = new Set(categories.map((category) => category.id))
  const currentCategoryIds = normalizedIds(
    (product!.categories || []).map((category) => category.id)
  )

  const blockedCategory = (product!.categories || []).find(
    (category) =>
      !category.is_active || category.is_internal || !selectableCategoryIds.has(category.id)
  )
  if (blockedCategory) {
    throw unexpectedState(
      `Product is linked to category ${blockedCategory.id}, which is inactive, internal, or unavailable to Studio. Review it in Medusa before changing placement.`
    )
  }

  const designerId = product!.brand?.id ? String(product!.brand.id) : null
  if (designerId && !designers.some((designer) => designer.id === designerId)) {
    throw unexpectedState(
      `Product designer ${designerId} does not resolve to a selectable COQUETTE designer.`
    )
  }

  const updatedAt = canonicalTimestamp(product!.updated_at)
  if (!updatedAt) {
    throw unexpectedState("The Studio draft has no usable update timestamp.")
  }

  return {
    ready: true,
    version: STUDIO_PLACEMENT_TAXONOMY_VERSION,
    product: {
      id: product!.id,
      title: product!.title || "Untitled draft",
      status: "draft",
      updated_at: updatedAt,
    },
    current: {
      category_ids: currentCategoryIds,
      designer_id: designerId,
    },
    categories,
    designers,
  }
}

function validateRequest(
  state: StudioPlacementTaxonomyState,
  request: StudioPlacementTaxonomyRequest
) {
  const categoryIds = normalizedIds(request.category_ids || [])
  const allowedCategories = new Set(state.categories.map((category) => category.id))
  const unknownCategory = categoryIds.find((id) => !allowedCategories.has(id))
  if (unknownCategory) {
    throw unexpectedState(
      `Category ${unknownCategory} is not an active merchant-facing COQUETTE category.`
    )
  }

  const designerId = request.designer_id == null ? null : cleanId(request.designer_id)
  if (request.designer_id != null && !designerId) {
    throw unexpectedState("Designer selection contains an invalid id")
  }
  if (
    designerId &&
    !state.designers.some((designer) => designer.id === designerId)
  ) {
    throw unexpectedState(
      `Designer ${designerId} does not resolve to an existing COQUETTE designer.`
    )
  }

  return { categoryIds, designerId }
}

export async function buildStudioPlacementTaxonomyPlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  request: StudioPlacementTaxonomyRequest
): Promise<StudioPlacementTaxonomyPlan> {
  const state = await readStudioPlacementTaxonomyState(container, productId)
  const expected = canonicalTimestamp(expectedUpdatedAt)
  if (!expected || expected !== state.product.updated_at) {
    throw unexpectedState("stale_draft")
  }

  const desired = validateRequest(state, request)
  const beforeCategoryIds = [...state.current.category_ids].sort()
  const afterCategoryIds = desired.categoryIds
  const removed = beforeCategoryIds.filter((id) => !afterCategoryIds.includes(id))
  const added = afterCategoryIds.filter((id) => !beforeCategoryIds.includes(id))
  const designerChanged = state.current.designer_id !== desired.designerId

  const hashInput = {
    version: STUDIO_PLACEMENT_TAXONOMY_VERSION,
    product_id: state.product.id,
    expected_updated_at: state.product.updated_at,
    before: state.current,
    after: {
      category_ids: afterCategoryIds,
      designer_id: desired.designerId,
    },
  }

  return {
    version: STUDIO_PLACEMENT_TAXONOMY_VERSION,
    product_id: state.product.id,
    product_title: state.product.title,
    expected_updated_at: state.product.updated_at,
    before: state.current,
    after: {
      category_ids: afterCategoryIds,
      designer_id: desired.designerId,
    },
    category_changes: added.length + removed.length,
    designer_changed: designerChanged,
    change_count: added.length + removed.length + (designerChanged ? 1 : 0),
    placement_hash: stableHash(hashInput),
  }
}

export async function applyStudioPlacementTaxonomyPlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  request: StudioPlacementTaxonomyRequest,
  placementHash: string
) {
  const plan = await buildStudioPlacementTaxonomyPlan(
    container,
    productId,
    expectedUpdatedAt,
    request
  )
  if (plan.placement_hash !== placementHash) {
    throw unexpectedState("stale_placement_plan")
  }

  if (plan.change_count > 0) {
    const input: ApplyStudioPlacementTaxonomyWorkflowInput = {
      product_id: plan.product_id,
      category_ids: plan.after.category_ids,
      current_designer_id: plan.before.designer_id,
      desired_designer_id: plan.after.designer_id,
    }
    await applyStudioPlacementTaxonomyWorkflow(container).run({ input })
  }

  const after = await readStudioPlacementTaxonomyState(container, productId)
  const expectedCategories = JSON.stringify(plan.after.category_ids)
  const actualCategories = JSON.stringify(after.current.category_ids)
  if (
    expectedCategories !== actualCategories ||
    after.current.designer_id !== plan.after.designer_id ||
    after.product.status !== "draft"
  ) {
    throw unexpectedState("Studio placement taxonomy invariant verification failed")
  }

  return plan
}
