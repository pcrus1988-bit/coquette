import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  cleanStudioPlacementProductId,
  readStudioPlacementTaxonomyState,
} from "../../../../lib/studio-placement-taxonomy"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const productId = cleanStudioPlacementProductId(req.query?.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  try {
    const state = await readStudioPlacementTaxonomyState(req.scope, productId)
    return res.status(200).json(state)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("COQUETTE Studio placement taxonomy state failed", error)
    return res.status(409).json({
      message,
      code: "placement_taxonomy_state_blocked",
    })
  }
}
