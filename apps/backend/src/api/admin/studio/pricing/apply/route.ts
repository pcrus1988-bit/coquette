import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  applyStudioPricingPlan,
  cleanStudioPricingProductId,
  STUDIO_PRICING_MODES,
  type StudioPricingRequest,
} from "../../../../../lib/studio-pricing"

const Money = z.string().trim().min(1).max(20)
const OptionalMoney = z.union([Money, z.literal(""), z.null()]).optional()

const ApplyPayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    expected_updated_at: z.string().trim().min(1).max(100),
    pricing_hash: z.string().regex(/^[a-f0-9]{64}$/),
    pricing: z
      .object({
        mode: z.enum(STUDIO_PRICING_MODES),
        uniform: z
          .object({ regular: Money, sale: OptionalMoney })
          .strict()
          .optional(),
        variants: z
          .array(
            z
              .object({
                variant_id: z.string().trim().min(3).max(160),
                regular: Money,
                sale: OptionalMoney,
              })
              .strict()
          )
          .max(120)
          .optional(),
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
      message: "This draft changed in another session. Reload it before applying prices.",
    }
  }
  if (message === "stale_pricing_plan") {
    return {
      status: 409,
      code: "stale_pricing_plan",
      message: "The live pricing state changed after review. Refresh the price plan before applying it.",
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
      message: "Build the product choices before applying prices.",
    }
  }
  return {
    status: 409,
    code: "pricing_apply_blocked",
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
      message: "Invalid guarded pricing apply request.",
      issues: parsed.error.issues,
    })
  }

  const productId = cleanStudioPricingProductId(parsed.data.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)

  try {
    const plan = await locking.execute(
      "coquette-studio-pricing",
      async () =>
        applyStudioPricingPlan(
          req.scope,
          productId,
          parsed.data.expected_updated_at,
          parsed.data.pricing as StudioPricingRequest,
          parsed.data.pricing_hash
        ),
      { timeout: 15 }
    )

    return res.status(200).json({
      applied: true,
      plan,
    })
  } catch (error) {
    console.error("COQUETTE Studio guarded pricing apply failed", error)
    const mapped = domainError(error)
    return res.status(mapped.status).json({
      message: mapped.message,
      code: mapped.code,
    })
  }
}
