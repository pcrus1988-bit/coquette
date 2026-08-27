import { randomUUID } from "node:crypto"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { FileTypes } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  STUDIO_IMAGE_MIME_TO_EXTENSION,
  STUDIO_MAX_IMAGE_BYTES,
  STUDIO_MAX_PRODUCT_IMAGES,
  cleanStudioProductId,
  loadStudioMediaProduct,
  studioDraftGuardProblem,
  studioMediaPrefix,
  studioProductImageUrls,
  studioPublicUrlForKey,
  type StudioImageMimeType,
} from "../../../../../lib/studio-media"

const PresignPayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    filename: z.string().trim().min(1).max(180),
    mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
    size_bytes: z.number().int().positive().max(STUDIO_MAX_IMAGE_BYTES),
  })
  .strict()

function safeStem(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "")
  const normalized = withoutExtension
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return normalized || "image"
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = PresignPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid managed image upload request.",
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
    return res.status(guard.status).json({
      message: guard.message,
      code: guard.code,
    })
  }

  if (studioProductImageUrls(product!).length >= STUDIO_MAX_PRODUCT_IMAGES) {
    return res.status(409).json({
      message: `A product can have at most ${STUDIO_MAX_PRODUCT_IMAGES} Studio images in this workflow.`,
      code: "media_limit_reached",
    })
  }

  const mimeType = parsed.data.mime_type as StudioImageMimeType
  const extension = STUDIO_IMAGE_MIME_TO_EXTENSION[mimeType]
  const objectName = `${Date.now()}-${randomUUID()}-${safeStem(parsed.data.filename)}.${extension}`
  const filename = `${studioMediaPrefix(productId)}${objectName}`

  const fileService = req.scope.resolve<FileTypes.IFileModuleService>(Modules.FILE)
  const provider = fileService.getProvider()
  if (!provider.getPresignedUploadUrl) {
    return res.status(503).json({
      message: "The configured media provider does not support direct managed uploads.",
      code: "presigned_upload_unavailable",
    })
  }

  const upload = await provider.getPresignedUploadUrl({
    filename,
    mimeType,
    access: "public",
    expiresIn: 300,
  })

  if (!upload?.url || !upload?.key) {
    return res.status(502).json({
      message: "The managed media provider did not return a usable upload target.",
      code: "invalid_presign_response",
    })
  }

  const publicUrl = studioPublicUrlForKey(upload.key)

  return res.status(200).json({
    upload_url: upload.url,
    file_key: upload.key,
    public_url: publicUrl,
    method: "PUT",
    expires_in: 300,
    max_size_bytes: STUDIO_MAX_IMAGE_BYTES,
    headers: {
      "content-type": mimeType,
      "x-amz-acl": "public-read",
    },
  })
}
