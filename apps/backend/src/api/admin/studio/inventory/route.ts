import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  cleanStudioInventoryProductId,
  readStudioInventoryState,
} from "../../../../lib/studio-inventory"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const productId = cleanStudioInventoryProductId(req.query?.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  try {
    const state = await readStudioInventoryState(req.scope, productId)
    return res.status(200).json(state)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("COQUETTE Studio inventory state failed", error)
    return res.status(409).json({
      message,
      code: "inventory_state_blocked",
    })
  }
}
