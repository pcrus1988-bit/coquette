import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import {
  STUDIO_MAX_PRODUCT_IMAGES,
  cleanStudioProductId,
  loadStudioMediaProduct,
  studioDraftGuardProblem,
  studioDraftIsStale,
  studioProductImageUrls,
} from "../../../../../lib/studio-media"

const OrderPayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    ordered_urls: z.array(z.string().url().max(1600)).min(1).max(STUDIO_MAX_PRODUCT_IMAGES),
    cover_url: z.string().url().max(1600),
    expected_updated_at: z.string().trim().max(100).optional(),
  })
  .strict()

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = OrderPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid product media order request.",
      issues: parsed.error.issues,
    })
  }

  const productId = cleanStudioProductId(parsed.data.product_id)
  if (!productId) {
    return res.status(400).json({ message: "Invalid product id." })
  }

  const product = await loadStudioMediaProduct(req, productId)
  const guard = studioDraftGuardProblem(product)
  if (guard) {
    return res.status(guard.status).json({ message: guard.message, code: guard.code })
  }
  if (studioDraftIsStale(product!, parsed.data.expected_updated_at)) {
    return res.status(409).json({
      message: "This draft changed in another session. Reload before changing image order.",
      code: "stale_draft",
      updated_at: product!.updated_at,
    })
  }

  const currentImages = studioProductImageUrls(product!)
  const currentSet = new Set(currentImages)
  const orderedUrls = [...new Set(parsed.data.ordered_urls)]

  if (orderedUrls.length !== parsed.data.ordered_urls.length) {
    return res.status(400).json({
      message: "Image order cannot contain duplicates.",
      code: "duplicate_media",
    })
  }
  if (!orderedUrls.every((url) => currentSet.has(url))) {
    return res.status(400).json({
      message: "Image order may only contain media already attached to this product.",
      code: "unattached_media",
    })
  }
  if (!orderedUrls.includes(parsed.data.cover_url)) {
    return res.status(400).json({
      message: "The cover image must remain attached to the product.",
      code: "invalid_cover",
    })
  }

  const removedCount = currentImages.length - orderedUrls.length
  if (removedCount < 0) {
    return res.status(400).json({
      message: "New image URLs cannot be introduced through the ordering route.",
      code: "media_injection_blocked",
    })
  }

  const normalizedOrder = [
    parsed.data.cover_url,
    ...orderedUrls.filter((url) => url !== parsed.data.cover_url),
  ]

  await updateProductsWorkflow(req.scope).run({
    input: {
      products: [
        {
          id: productId,
          images: normalizedOrder.map((url) => ({ url })),
          thumbnail: parsed.data.cover_url,
        },
      ],
    },
  })

  const updated = await loadStudioMediaProduct(req, productId)
  const updatedGuard = studioDraftGuardProblem(updated)
  const updatedImages = updated ? studioProductImageUrls(updated) : []
  if (
    updatedGuard ||
    !updated ||
    updated.thumbnail !== parsed.data.cover_url ||
    normalizedOrder.some((url) => !updatedImages.includes(url))
  ) {
    console.error("COQUETTE Studio media order invariant failed", {
      productId,
      guard: updatedGuard,
    })
    return res.status(500).json({
      message: "The image ordering safety invariant failed.",
      code: "media_order_invariant_failed",
    })
  }

  return res.status(200).json({
    product: {
      id: updated.id,
      status: updated.status,
      thumbnail: updated.thumbnail || null,
      images: updatedImages.map((url) => ({ url })),
      updated_at: updated.updated_at || null,
    },
    detached_count: removedCount,
  })
}
