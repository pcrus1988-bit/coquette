import { createHash } from "crypto"
import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const STUDIO_CHOICE_MODES = [
  "one-size",
  "size",
  "color",
  "size-color",
] as const

export type StudioChoiceMode = (typeof STUDIO_CHOICE_MODES)[number]

export const STUDIO_MAX_CHOICE_VALUES = 30
export const STUDIO_MAX_VARIANTS = 120
export const STUDIO_VARIANT_GRAPH_VERSION = "1"

export type StudioVariantProduct = {
  id: string
  title?: string | null
  status?: string | null
  metadata?: Record<string, unknown> | null
  updated_at?: string | null
  options?: Array<{
    id?: string
    title?: string | null
    values?: Array<{ id?: string; value?: string | null }> | null
  }> | null
  variants?: Array<{
    id?: string
    title?: string | null
    manage_inventory?: boolean | null
    allow_backorder?: boolean | null
  }> | null
}

export type StudioVariantOptionPlan = {
  title: "Size" | "Colour"
  values: string[]
}

export type StudioVariantPlanItem = {
  title: string
  options: Record<string, string>
}

export type StudioVariantPlan = {
  version: string
  mode: StudioChoiceMode
  sizes: string[]
  colors: string[]
  options: StudioVariantOptionPlan[]
  variants: StudioVariantPlanItem[]
  variant_count: number
  blueprint_hash: string
}

export type StudioVariantPlanProblem = {
  code: string
  message: string
}

function cleanChoiceValue(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, 40)
}

function normalizedList(value: unknown) {
  if (!Array.isArray(value)) return undefined
  if (value.length > STUDIO_MAX_CHOICE_VALUES) return undefined

  const values: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const cleaned = cleanChoiceValue(item)
    if (!cleaned) continue
    const key = cleaned.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    values.push(cleaned)
  }
  return values
}

function metadataList(metadata: Record<string, unknown>, key: string) {
  const raw = metadata[key]
  if (typeof raw !== "string") return undefined
  try {
    return normalizedList(JSON.parse(raw))
  } catch {
    return undefined
  }
}

function stableHash(input: object) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex")
}

export function cleanStudioVariantProductId(value: unknown) {
  if (typeof value !== "string") return ""
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ""
}

export async function loadStudioVariantProduct(
  req: MedusaRequest,
  productId: string
): Promise<StudioVariantProduct | undefined> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "status",
      "metadata",
      "updated_at",
      "options.id",
      "options.title",
      "options.values.id",
      "options.values.value",
      "variants.id",
      "variants.title",
      "variants.manage_inventory",
      "variants.allow_backorder",
    ],
    filters: { id: productId },
  })
  return data?.[0] as StudioVariantProduct | undefined
}

export function studioVariantDraftProblem(
  product: StudioVariantProduct | undefined
): StudioVariantPlanProblem & { status: number } | undefined {
  if (!product) {
    return { status: 404, code: "draft_not_found", message: "Draft not found" }
  }
  if (product.status !== "draft") {
    return {
      status: 409,
      code: "not_a_draft",
      message: "Choices can only be built on an unpublished product draft",
    }
  }
  if (product.metadata?.coquette_studio_origin !== "quick_draft") {
    return {
      status: 403,
      code: "not_studio_draft",
      message: "This product was not created through the guarded COQUETTE Studio flow",
    }
  }
  return undefined
}

export function studioVariantGraphExists(product: StudioVariantProduct) {
  return Boolean(
    product.metadata?.coquette_studio_variants_generated === "true" ||
      (product.options?.length ?? 0) > 0 ||
      (product.variants?.length ?? 0) > 0
  )
}

export function studioVariantDraftIsStale(
  product: StudioVariantProduct,
  expectedUpdatedAt: string | undefined
) {
  return Boolean(
    expectedUpdatedAt &&
      product.updated_at &&
      expectedUpdatedAt !== product.updated_at
  )
}

export function buildStudioVariantPlan(
  product: StudioVariantProduct
): { plan?: StudioVariantPlan; problem?: StudioVariantPlanProblem } {
  const metadata =
    product.metadata && typeof product.metadata === "object" ? product.metadata : {}
  const modeValue = metadata.coquette_studio_choice_mode

  if (
    typeof modeValue !== "string" ||
    !STUDIO_CHOICE_MODES.includes(modeValue as StudioChoiceMode)
  ) {
    return {
      problem: {
        code: "choice_mode_required",
        message: "Save a choice mode before building the variant graph.",
      },
    }
  }

  const mode = modeValue as StudioChoiceMode
  const savedSizes = metadataList(metadata, "coquette_studio_sizes")
  const savedColors = metadataList(metadata, "coquette_studio_colors")

  if (mode !== "one-size" && mode !== "color" && !savedSizes) {
    return {
      problem: {
        code: "invalid_sizes",
        message: "The saved size list is invalid. Re-save the blueprint before continuing.",
      },
    }
  }
  if (mode !== "one-size" && mode !== "size" && !savedColors) {
    return {
      problem: {
        code: "invalid_colors",
        message: "The saved colour list is invalid. Re-save the blueprint before continuing.",
      },
    }
  }

  const sizes = mode === "one-size" ? ["One Size"] : savedSizes ?? []
  const colors = savedColors ?? []

  if (mode === "size" && sizes.length === 0) {
    return {
      problem: { code: "sizes_required", message: "Add at least one size before building choices." },
    }
  }
  if (mode === "color" && colors.length === 0) {
    return {
      problem: { code: "colors_required", message: "Add at least one colour before building choices." },
    }
  }
  if (mode === "size-color" && (sizes.length === 0 || colors.length === 0)) {
    return {
      problem: {
        code: "size_color_required",
        message: "Add at least one size and one colour before building choices.",
      },
    }
  }

  const options: StudioVariantOptionPlan[] = []
  const variants: StudioVariantPlanItem[] = []

  if (mode === "one-size" || mode === "size") {
    options.push({ title: "Size", values: sizes })
    for (const size of sizes) {
      variants.push({ title: size, options: { Size: size } })
    }
  } else if (mode === "color") {
    options.push({ title: "Colour", values: colors })
    for (const color of colors) {
      variants.push({ title: color, options: { Colour: color } })
    }
  } else {
    options.push({ title: "Size", values: sizes })
    options.push({ title: "Colour", values: colors })
    for (const size of sizes) {
      for (const color of colors) {
        variants.push({
          title: `${size} / ${color}`,
          options: { Size: size, Colour: color },
        })
      }
    }
  }

  if (variants.length === 0 || variants.length > STUDIO_MAX_VARIANTS) {
    return {
      problem: {
        code: "variant_limit",
        message: `This blueprint would create ${variants.length} variants. COQUETTE Studio allows 1–${STUDIO_MAX_VARIANTS} variants in this guarded workflow.`,
      },
    }
  }

  const hashInput = {
    version: STUDIO_VARIANT_GRAPH_VERSION,
    mode,
    sizes: mode === "color" ? [] : sizes,
    colors: mode === "one-size" || mode === "size" ? [] : colors,
  }

  return {
    plan: {
      ...hashInput,
      options,
      variants,
      variant_count: variants.length,
      blueprint_hash: stableHash(hashInput),
    },
  }
}
