import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  buildStudioVariantIdentifierPlan,
  cleanStudioIdentifierProductId,
  type StudioVariantIdentifierRequest,
} from "../../../../../lib/studio-variant-identifiers"

const OptionalIdentifier = z.union([z.string().max(100), z.null()])

const IdentifierPayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    expected_updated_at: z.string().trim().min(1).max(100),
    identifiers: z
      .object({
        variants: z
          .array(
            z
              .object({
                variant_id: z.string().trim().min(3).max(160),
                sku: OptionalIdentifier,
                ean: OptionalIdentifier,
                upc: OptionalIdentifier,
                barcode: OptionalIdentifier,
              })
              .strict()
          )
          .max(120),
      })
      .strict(),
  })
  .strict()

function domainError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "stale_draft") {
    return {
      status: 409,
      code: "stale_draft",
      message: "This draft changed in another session. Reload it before reviewing variant codes.",
    }
  }
  if (message.includes("not_studio_draft")) {
    return {
      status: 403,
      code: "not_studio_draft",
      message: "This product is outside the guarded COQUETTE Studio draft flow.",
    }
  }
  if (message.includes("variant_graph_required") || message.includes("variants_required")) {
    return {
      status: 409,
      code: "variant_graph_required",
      message: "Build the product choices before reviewing variant codes.",
    }
  }
  if (message.includes("not_a_draft")) {
    return {
      status: 409,
      code: "not_a_draft",
      message: "Variant codes in this flow are available only while the product remains unpublished.",
    }
  }
  return {
    status: 409,
    code: "variant_identifier_plan_blocked",
    message,
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = IdentifierPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid guarded variant identifier review request.",
      issues: parsed.error.issues,
    })
  }

  const productId = cleanStudioIdentifierProductId(parsed.data.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  try {
    const plan = await buildStudioVariantIdentifierPlan(
      req.scope,
      productId,
      parsed.data.expected_updated_at,
      parsed.data.identifiers as StudioVariantIdentifierRequest
    )
    return res.status(200).json({ ready: true, plan })
  } catch (error) {
    const mapped = domainError(error)
    return res.status(mapped.status).json({
      message: mapped.message,
      code: mapped.code,
    })
  }
}
