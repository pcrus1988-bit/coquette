import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const STUDIO_IMAGE_MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const

export type StudioImageMimeType = keyof typeof STUDIO_IMAGE_MIME_TO_EXTENSION

export const STUDIO_MAX_IMAGE_BYTES = 12 * 1024 * 1024
export const STUDIO_MAX_PRODUCT_IMAGES = 20

export type StudioMediaProduct = {
  id: string
  status?: string | null
  metadata?: Record<string, unknown> | null
  updated_at?: string | null
  thumbnail?: string | null
  images?: Array<{ id?: string; url?: string | null }> | null
}

export type StudioDraftGuardProblem = {
  status: number
  code: string
  message: string
}

export function cleanStudioProductId(value: unknown) {
  if (typeof value !== "string") return ""
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ""
}

export function studioMediaPrefix(productId: string) {
  return `studio/products/${productId}/`
}

export function isStudioManagedMediaKey(productId: string, key: string) {
  return key.startsWith(studioMediaPrefix(productId)) && !key.includes("..")
}

export function studioFileBaseUrl() {
  const value = process.env.S3_FILE_URL?.trim()
  if (!value) {
    throw new Error("S3_FILE_URL is required for COQUETTE Studio managed media")
  }
  return value.replace(/\/$/, "")
}

export function studioPublicUrlForKey(key: string) {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  return `${studioFileBaseUrl()}/${encodedKey}`
}

export function studioManagedKeyFromPublicUrl(value: string) {
  try {
    const base = new URL(`${studioFileBaseUrl()}/`)
    const target = new URL(value)
    if (target.origin !== base.origin) return undefined
    if (!target.pathname.startsWith(base.pathname)) return undefined
    const encodedKey = target.pathname.slice(base.pathname.length)
    if (!encodedKey) return undefined
    return encodedKey
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/")
  } catch {
    return undefined
  }
}

export function studioProductImageUrls(product: StudioMediaProduct) {
  const values = (product.images ?? [])
    .map((image) => image?.url)
    .filter((url): url is string => typeof url === "string" && Boolean(url.trim()))
  return [...new Set(values)]
}

export async function loadStudioMediaProduct(
  req: MedusaRequest,
  productId: string
): Promise<StudioMediaProduct | undefined> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "status", "metadata", "updated_at", "thumbnail", "images.*"],
    filters: { id: productId },
  })
  return data?.[0] as StudioMediaProduct | undefined
}

export function studioDraftGuardProblem(
  product: StudioMediaProduct | undefined
): StudioDraftGuardProblem | undefined {
  if (!product) {
    return { status: 404, code: "draft_not_found", message: "Draft not found" }
  }
  if (product.status !== "draft") {
    return {
      status: 409,
      code: "not_a_draft",
      message: "Managed media can only be changed on an unpublished product draft",
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

export function studioDraftIsStale(
  product: StudioMediaProduct,
  expectedUpdatedAt: string | undefined
) {
  return Boolean(
    expectedUpdatedAt &&
      product.updated_at &&
      expectedUpdatedAt !== product.updated_at
  )
}
