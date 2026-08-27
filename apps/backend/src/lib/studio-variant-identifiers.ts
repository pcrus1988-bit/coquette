import { createHash } from "crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import applyStudioVariantIdentifiersWorkflow from "../workflows/apply-studio-variant-identifiers"

export const STUDIO_IDENTIFIER_VERSION = "1"
export const STUDIO_IDENTIFIER_FIELDS = ["sku", "ean", "upc", "barcode"] as const
export type StudioIdentifierField = (typeof STUDIO_IDENTIFIER_FIELDS)[number]

export type StudioVariantIdentifierRequestLine = {
  variant_id: string
  sku: string | null
  ean: string | null
  upc: string | null
  barcode: string | null
}

export type StudioVariantIdentifierRequest = {
  variants: StudioVariantIdentifierRequestLine[]
}

type StudioIdentifierVariant = {
  id: string
  title?: string | null
  sku?: string | null
  ean?: string | null
  upc?: string | null
  barcode?: string | null
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
}

type StudioIdentifierProduct = {
  id: string
  title?: string | null
  status?: string | null
  updated_at?: string | Date | null
  metadata?: Record<string, unknown> | null
  variants?: StudioIdentifierVariant[] | null
}

export type StudioVariantIdentifierStateLine = {
  variant_id: string
  title: string
  sku: string | null
  ean: string | null
  upc: string | null
  barcode: string | null
}

export type StudioVariantIdentifierState = {
  ready: boolean
  product_id: string
  product_title: string
  expected_updated_at: string
  code?: string
  message?: string
  variants: StudioVariantIdentifierStateLine[]
}

type IdentifierAction = "set" | "clear" | "unchanged"

export type StudioVariantIdentifierPlanLine = {
  variant_id: string
  title: string
  current: {
    sku: string | null
    ean: string | null
    upc: string | null
    barcode: string | null
  }
  intended: {
    sku: string | null
    ean: string | null
    upc: string | null
    barcode: string | null
  }
  actions: Record<StudioIdentifierField, IdentifierAction>
}

export type StudioVariantIdentifierPlan = {
  version: string
  product_id: string
  product_title: string
  expected_updated_at: string
  variants: StudioVariantIdentifierPlanLine[]
  change_count: number
  identifier_hash: string
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

export function cleanStudioIdentifierProductId(value: unknown) {
  if (typeof value !== "string") return ""
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ""
}

function cleanVariantId(value: unknown) {
  if (typeof value !== "string") return ""
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ""
}

function visibleIdentifier(value: unknown, label: string, max = 100) {
  if (value == null) return null
  if (typeof value !== "string") {
    throw unexpectedState(`${label} must be text or empty`)
  }
  const cleaned = value.trim()
  if (!cleaned) return null
  if (cleaned.length > max || /[\u0000-\u001f\u007f]/.test(cleaned)) {
    throw unexpectedState(`${label} contains unsupported characters or is too long`)
  }
  return cleaned
}

function gtinCheckDigitValid(value: string) {
  if (!/^\d+$/.test(value) || value.length < 2) return false
  const digits = value.split("").map(Number)
  const checkDigit = digits.pop()!
  let sum = 0
  for (let index = digits.length - 1, position = 1; index >= 0; index--, position++) {
    sum += digits[index] * (position % 2 === 1 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10 === checkDigit
}

function normalizeField(field: StudioIdentifierField, value: unknown, title: string) {
  const label = `${title} ${field.toUpperCase()}`
  const cleaned = visibleIdentifier(value, label)
  if (cleaned == null) return null

  if (field === "ean") {
    if (!/^(?:\d{8}|\d{13})$/.test(cleaned) || !gtinCheckDigitValid(cleaned)) {
      throw unexpectedState(`${label} must be a valid EAN-8 or EAN-13 including its check digit`)
    }
  }
  if (field === "upc") {
    if (!/^\d{12}$/.test(cleaned) || !gtinCheckDigitValid(cleaned)) {
      throw unexpectedState(`${label} must be a valid 12-digit UPC-A including its check digit`)
    }
  }
  return cleaned
}

function keyFor(field: StudioIdentifierField, value: string) {
  return field === "ean" || field === "upc" ? value : value.toLocaleLowerCase()
}

async function loadProduct(
  container: MedusaContainer,
  productId: string
): Promise<StudioIdentifierProduct | undefined> {
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
    ],
    filters: { id: productId },
  })
  return data?.[0] as StudioIdentifierProduct | undefined
}

function draftProblem(product: StudioIdentifierProduct | undefined): GuardProblem | undefined {
  if (!product) return { status: 404, code: "draft_not_found", message: "Draft not found" }
  if (product.status !== "draft") {
    return {
      status: 409,
      code: "not_a_draft",
      message: "Variant codes can only be managed here while the product is an unpublished Studio draft.",
    }
  }
  if (product.metadata?.coquette_studio_origin !== "quick_draft") {
    return {
      status: 403,
      code: "not_studio_draft",
      message: "This product was not created through the guarded COQUETTE Studio flow.",
    }
  }
  if (product.metadata?.coquette_studio_variants_generated !== "true") {
    return {
      status: 409,
      code: "variant_graph_required",
      message: "Build the reviewed product choices before assigning variant codes.",
    }
  }
  if (!product.variants?.length) {
    return {
      status: 409,
      code: "variants_required",
      message: "This draft has no variants to identify.",
    }
  }
  return undefined
}

function stateLine(variant: StudioIdentifierVariant): StudioVariantIdentifierStateLine {
  return {
    variant_id: variant.id,
    title: variant.title || "Variant",
    sku: visibleIdentifier(variant.sku, `${variant.title || "Variant"} SKU`),
    ean: visibleIdentifier(variant.ean, `${variant.title || "Variant"} EAN`),
    upc: visibleIdentifier(variant.upc, `${variant.title || "Variant"} UPC`),
    barcode: visibleIdentifier(variant.barcode, `${variant.title || "Variant"} barcode`),
  }
}

export async function readStudioVariantIdentifierState(
  container: MedusaContainer,
  productId: string
): Promise<StudioVariantIdentifierState> {
  const product = await loadProduct(container, productId)
  const problem = draftProblem(product)
  return {
    ready: !problem,
    product_id: productId,
    product_title: product?.title || "Product draft",
    expected_updated_at: canonicalTimestamp(product?.updated_at),
    ...(problem ? { code: problem.code, message: problem.message } : {}),
    variants: (product?.variants || []).map(stateLine),
  }
}

function desiredLines(
  product: StudioIdentifierProduct,
  request: StudioVariantIdentifierRequest
) {
  const currentVariants = product.variants || []
  if (!Array.isArray(request.variants) || request.variants.length !== currentVariants.length) {
    throw unexpectedState("Every current variant must have exactly one explicit identifier row")
  }

  const requestById = new Map<string, StudioVariantIdentifierRequestLine>()
  for (const row of request.variants) {
    const variantId = cleanVariantId(row.variant_id)
    if (!variantId || requestById.has(variantId)) {
      throw unexpectedState("Identifier rows contain an invalid or duplicate variant id")
    }
    requestById.set(variantId, row)
  }

  return currentVariants.map((variant) => {
    const row = requestById.get(variant.id)
    if (!row) throw unexpectedState(`Identifier row is missing for variant ${variant.id}`)
    const title = variant.title || "Variant"
    return {
      variant_id: variant.id,
      title,
      sku: normalizeField("sku", row.sku, title),
      ean: normalizeField("ean", row.ean, title),
      upc: normalizeField("upc", row.upc, title),
      barcode: normalizeField("barcode", row.barcode, title),
    }
  })
}

function assertNoRequestDuplicates(
  desired: Array<{
    variant_id: string
    title: string
    sku: string | null
    ean: string | null
    upc: string | null
    barcode: string | null
  }>
) {
  for (const field of STUDIO_IDENTIFIER_FIELDS) {
    const seen = new Map<string, string>()
    for (const row of desired) {
      const value = row[field]
      if (!value) continue
      const key = keyFor(field, value)
      const previous = seen.get(key)
      if (previous && previous !== row.variant_id) {
        throw unexpectedState(`${field.toUpperCase()} ${value} is assigned to more than one variant in this review`)
      }
      seen.set(key, row.variant_id)
    }
  }
}

async function matchingVariants(
  container: MedusaContainer,
  field: StudioIdentifierField,
  value: string
) {
  const productModule = container.resolve(Modules.PRODUCT)
  if (field === "sku") return productModule.listProductVariants({ sku: value })
  if (field === "ean") return productModule.listProductVariants({ ean: value })
  if (field === "upc") return productModule.listProductVariants({ upc: value })
  return productModule.listProductVariants({ barcode: value })
}

async function assertNoExternalCollisions(
  container: MedusaContainer,
  desired: Array<{
    variant_id: string
    title: string
    sku: string | null
    ean: string | null
    upc: string | null
    barcode: string | null
  }>
) {
  for (const row of desired) {
    for (const field of STUDIO_IDENTIFIER_FIELDS) {
      const value = row[field]
      if (!value) continue
      const matches = await matchingVariants(container, field, value)
      const foreign = matches.filter((variant) => variant.id !== row.variant_id)
      if (foreign.length) {
        throw unexpectedState(
          `${field.toUpperCase()} ${value} is already assigned to another Medusa variant; clear or reconcile that value before reusing it.`
        )
      }
    }
  }
}

function action(current: string | null, intended: string | null): IdentifierAction {
  if (current === intended) return "unchanged"
  return intended == null ? "clear" : "set"
}

export async function buildStudioVariantIdentifierPlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  request: StudioVariantIdentifierRequest
): Promise<StudioVariantIdentifierPlan> {
  const product = await loadProduct(container, productId)
  const problem = draftProblem(product)
  if (problem) throw unexpectedState(`${problem.code}:${problem.message}`)

  const actualTimestamp = canonicalTimestamp(product!.updated_at)
  const expectedTimestamp = canonicalTimestamp(expectedUpdatedAt)
  if (!actualTimestamp || !expectedTimestamp || actualTimestamp !== expectedTimestamp) {
    throw new MedusaError(MedusaError.Types.CONFLICT, "stale_draft")
  }

  const desired = desiredLines(product!, request)
  assertNoRequestDuplicates(desired)
  await assertNoExternalCollisions(container, desired)

  const currentById = new Map((product!.variants || []).map((variant) => [variant.id, stateLine(variant)]))
  const variants = desired.map((row): StudioVariantIdentifierPlanLine => {
    const current = currentById.get(row.variant_id)
    if (!current) throw unexpectedState(`Current identifier state missing for variant ${row.variant_id}`)
    const currentValues = {
      sku: current.sku,
      ean: current.ean,
      upc: current.upc,
      barcode: current.barcode,
    }
    const intended = {
      sku: row.sku,
      ean: row.ean,
      upc: row.upc,
      barcode: row.barcode,
    }
    return {
      variant_id: row.variant_id,
      title: row.title,
      current: currentValues,
      intended,
      actions: {
        sku: action(currentValues.sku, intended.sku),
        ean: action(currentValues.ean, intended.ean),
        upc: action(currentValues.upc, intended.upc),
        barcode: action(currentValues.barcode, intended.barcode),
      },
    }
  })

  const hashInput = {
    version: STUDIO_IDENTIFIER_VERSION,
    product_id: product!.id,
    expected_updated_at: actualTimestamp,
    variants: variants.map((row) => ({
      variant_id: row.variant_id,
      current: row.current,
      intended: row.intended,
    })),
  }

  return {
    ...hashInput,
    product_title: product!.title || "Product draft",
    variants,
    change_count: variants.reduce(
      (total, row) =>
        total + STUDIO_IDENTIFIER_FIELDS.filter((field) => row.actions[field] !== "unchanged").length,
      0
    ),
    identifier_hash: stableHash(hashInput),
  }
}

export async function applyStudioVariantIdentifierPlan(
  container: MedusaContainer,
  productId: string,
  expectedUpdatedAt: string,
  request: StudioVariantIdentifierRequest,
  approvedHash: string
) {
  const plan = await buildStudioVariantIdentifierPlan(
    container,
    productId,
    expectedUpdatedAt,
    request
  )
  if (plan.identifier_hash !== approvedHash) {
    throw new MedusaError(MedusaError.Types.CONFLICT, "stale_identifier_plan")
  }

  const changed = plan.variants.filter((row) =>
    STUDIO_IDENTIFIER_FIELDS.some((field) => row.actions[field] !== "unchanged")
  )
  if (changed.length) {
    await applyStudioVariantIdentifiersWorkflow(container).run({
      input: {
        product_variants: changed.map((row) => ({
          id: row.variant_id,
          sku: row.intended.sku,
          ean: row.intended.ean,
          upc: row.intended.upc,
          barcode: row.intended.barcode,
        })),
      },
    })
  }

  const verified = await readStudioVariantIdentifierState(container, productId)
  if (!verified.ready) throw unexpectedState(verified.message || "Identifier verification is blocked")
  const verifiedById = new Map(verified.variants.map((row) => [row.variant_id, row]))
  for (const row of plan.variants) {
    const actual = verifiedById.get(row.variant_id)
    if (
      !actual ||
      actual.sku !== row.intended.sku ||
      actual.ean !== row.intended.ean ||
      actual.upc !== row.intended.upc ||
      actual.barcode !== row.intended.barcode
    ) {
      throw unexpectedState(`Variant identifier verification failed for ${row.variant_id}`)
    }
  }

  return {
    applied: true,
    change_count: plan.change_count,
    state: verified,
  }
}
