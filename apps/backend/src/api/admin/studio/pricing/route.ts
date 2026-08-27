import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  cleanStudioPricingProductId,
} from "../../../../lib/studio-pricing"
import { readStudioPricingState } from "../../../../lib/studio-pricing-state"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const productId = cleanStudioPricingProductId(req.query?.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  try {
    const state = await readStudioPricingState(req.scope, productId)
    return res.status(200).json(state)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const forbidden = message.includes("not_studio_draft")
    const missing = message.includes("draft_not_found")
    return res.status(forbidden ? 403 : missing ? 404 : 409).json({
      message,
      code: forbidden
        ? "not_studio_draft"
        : missing
          ? "draft_not_found"
          : "pricing_state_blocked",
    })
  }
}
