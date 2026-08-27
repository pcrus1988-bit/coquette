import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { FileTypes } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import {
  STUDIO_IMAGE_MIME_TO_EXTENSION,
  STUDIO_MAX_IMAGE_BYTES,
  STUDIO_MAX_PRODUCT_IMAGES,
  cleanStudioProductId,
  isStudioManagedMediaKey,
  loadStudioMediaProduct,
  studioDraftGuardProblem,
  studioDraftIsStale,
  studioProductImageUrls,
  studioPublicUrlForKey,
  type StudioImageMimeType,
} from "../../../../../lib/studio-media"

const AttachPayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    file_key: z.string().trim().min(1).max(700),
    expected_updated_at: z.string().trim().max(100).optional(),
    set_cover: z.boolean().optional().default(false),
  })
  .strict()

function normalizeContentType(value: string | null) {
  return value?.split(";", 1)[0]?.trim().toLowerCase() || ""
}

async function removeRejectedUpload(
  fileService: FileTypes.IFileModuleService,
  fileKey: string
) {
  try {
    await fileService.deleteFiles(fileKey)
  } catch (error) {
    console.warn("Could not remove rejected COQUETTE Studio upload", error)
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = AttachPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid managed image attachment request.",
      issues: parsed.error.issues,
    })
  }

  const productId = cleanStudioProductId(parsed.data.product_id)
  if (!productId) {
    return res.status(400).json({ message: "Invalid product id." })
  }

  if (!isStudioManagedMediaKey(productId, parsed.data.file_key)) {
    return res.status(400).json({
      message: "Only media issued for this Studio draft can be attached.",
      code: "unmanaged_media_key",
    })
  }

  const product = await loadStudioMediaProduct(req, productId)
  const guard = studioDraftGuardProblem(product)
  if (guard) {
    return res.status(guard.status).json({ message: guard.message, code: guard.code })
  }
  if (studioDraftIsStale(product!, parsed.data.expected_updated_at)) {
    return res.status(409).json({
      message: "This draft changed in another session. Reload before attaching media.",
      code: "stale_draft",
      updated_at: product!.updated_at,
    })
  }

  const fileService = req.scope.resolve<FileTypes.IFileModuleService>(Modules.FILE)
  const publicUrl = studioPublicUrlForKey(parsed.data.file_key)

  let head: Response
  try {
    head = await fetch(publicUrl, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
  } catch (error) {
    console.error("COQUETTE Studio media verification failed", error)
    return res.status(502).json({
      message: "The uploaded image could not be verified yet. Try attaching it again.",
      code: "media_verification_unavailable",
    })
  }

  if (!head.ok) {
    await removeRejectedUpload(fileService, parsed.data.file_key)
    return res.status(422).json({
      message: "The uploaded image is not publicly readable from managed storage.",
      code: "media_not_public",
    })
  }

  const contentType = normalizeContentType(head.headers.get("content-type"))
  if (!(contentType in STUDIO_IMAGE_MIME_TO_EXTENSION)) {
    await removeRejectedUpload(fileService, parsed.data.file_key)
    return res.status(422).json({
      message: "The uploaded file is not an allowed COQUETTE product image.",
      code: "invalid_media_type",
    })
  }

  const contentLength = Number(head.headers.get("content-length") || "0")
  if (contentLength && contentLength > STUDIO_MAX_IMAGE_BYTES) {
    await removeRejectedUpload(fileService, parsed.data.file_key)
    return res.status(422).json({
      message: "The uploaded image exceeds the Studio image size limit.",
      code: "media_too_large",
    })
  }

  const currentImages = studioProductImageUrls(product!)
  if (!currentImages.includes(publicUrl) && currentImages.length >= STUDIO_MAX_PRODUCT_IMAGES) {
    await removeRejectedUpload(fileService, parsed.data.file_key)
    return res.status(409).json({
      message: `A product can have at most ${STUDIO_MAX_PRODUCT_IMAGES} Studio images in this workflow.`,
      code: "media_limit_reached",
    })
  }

  const setCover = parsed.data.set_cover || currentImages.length === 0
  const nextImages = currentImages.includes(publicUrl)
    ? currentImages
    : setCover
      ? [publicUrl, ...currentImages]
      : [...currentImages, publicUrl]
  const thumbnail = setCover || !product!.thumbnail ? publicUrl : product!.thumbnail

  await updateProductsWorkflow(req.scope).run({
    input: {
      products: [
        {
          id: productId,
          images: nextImages.map((url) => ({ url })),
          thumbnail,
        },
      ],
    },
  })

  const updated = await loadStudioMediaProduct(req, productId)
  const updatedGuard = studioDraftGuardProblem(updated)
  if (updatedGuard || !updated || !studioProductImageUrls(updated).includes(publicUrl)) {
    console.error("COQUETTE Studio media attachment invariant failed", {
      productId,
      fileKey: parsed.data.file_key,
      guard: updatedGuard,
    })
    return res.status(500).json({
      message: "The image attachment safety invariant failed.",
      code: "media_attachment_invariant_failed",
    })
  }

  return res.status(200).json({
    product: {
      id: updated.id,
      status: updated.status,
      thumbnail: updated.thumbnail || null,
      images: studioProductImageUrls(updated).map((url) => ({ url })),
      updated_at: updated.updated_at || null,
    },
    media: {
      key: parsed.data.file_key,
      url: publicUrl,
      mime_type: contentType as StudioImageMimeType,
      size_bytes: contentLength || null,
    },
  })
}
