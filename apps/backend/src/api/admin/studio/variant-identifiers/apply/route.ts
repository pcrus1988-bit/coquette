import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  applyStudioVariantIdentifierPlan,
  cleanStudioIdentifierProductId,
  type StudioVariantIdentifierRequest,
} from "../../../../../lib/studio-variant-identifiers"

const OptionalIdentifier = z.union([z.string().max(100), z.null()])

const ApplyPayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    expected_updated_at: z.string().trim().min(1).max(100),
    identifier_hash: z.string().regex(/^[a-f0-9]{64}$/),
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
      message: "This draft changed in another session. Reload it before applying variant codes.",
    }
  }
  if (message === "stale_identifier_plan") {
    return {
      status: 409,
      code: "stale_identifier_plan",
      message: "The live variant-code state changed after review. Refresh the identifier plan before applying it.",
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
      message: "Build the product choices before applying variant codes.",
    }
  }
  return {
    status: 409,
    code: "variant_identifier_apply_blocked",
    message,
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = ApplyPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid guarded variant identifier apply request.",
      issues: parsed.error.issues,
    })
  }

  const productId = cleanStudioIdentifierProductId(parsed.data.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)

  try {
    const result = await locking.execute(
      "coquette-studio-variant-identifiers",
      async () =>
        applyStudioVariantIdentifierPlan(
          req.scope,
          productId,
          parsed.data.expected_updated_at,
          parsed.data.identifiers as StudioVariantIdentifierRequest,
          parsed.data.identifier_hash
        ),
      { timeout: 15 }
    )

    return res.status(200).json(result)
  } catch (error) {
    console.error("COQUETTE Studio guarded variant identifier apply failed", error)
    const mapped = domainError(error)
    return res.status(mapped.status).json({
      message: mapped.message,
      code: mapped.code,
    })
  }
}
