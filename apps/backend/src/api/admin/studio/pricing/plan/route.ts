import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  buildStudioPricingPlan,
  cleanStudioPricingProductId,
  STUDIO_PRICING_MODES,
  type StudioPricingRequest,
} from "../../../../../lib/studio-pricing"

const Money = z.string().trim().min(1).max(20)
const OptionalMoney = z.union([Money, z.literal(""), z.null()]).optional()

const PricingPayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    expected_updated_at: z.string().trim().min(1).max(100),
    pricing: z
      .object({
        mode: z.enum(STUDIO_PRICING_MODES),
        uniform: z
          .object({
            regular: Money,
            sale: OptionalMoney,
          })
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
      message: "This draft changed in another session. Reload it before reviewing prices.",
    }
  }
  if (message.includes("variant_graph_required") || message.includes("variants_required")) {
    return {
      status: 409,
      code: "variant_graph_required",
      message: "Build the product choices before reviewing prices.",
    }
  }
  if (message.includes("not_studio_draft")) {
    return {
      status: 403,
      code: "not_studio_draft",
      message: "This product is outside the guarded COQUETTE Studio draft flow.",
    }
  }
  if (message.includes("not_a_draft")) {
    return {
      status: 409,
      code: "not_a_draft",
      message: "Pricing in this flow is available only while the product remains unpublished.",
    }
  }
  return {
    status: 409,
    code: "pricing_plan_blocked",
    message,
  }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = PricingPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid guarded pricing review request.",
      issues: parsed.error.issues,
    })
  }

  const productId = cleanStudioPricingProductId(parsed.data.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  try {
    const plan = await buildStudioPricingPlan(
      req.scope,
      productId,
      parsed.data.expected_updated_at,
      parsed.data.pricing as StudioPricingRequest
    )
    return res.status(200).json({
      ready: true,
      plan,
    })
  } catch (error) {
    const mapped = domainError(error)
    return res.status(mapped.status).json({
      message: mapped.message,
      code: mapped.code,
    })
  }
}
