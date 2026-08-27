import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  cleanStudioLifecycleProductId,
  readStudioLifecycleState,
} from "../../../../lib/studio-lifecycle"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const productId = cleanStudioLifecycleProductId(req.query?.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  try {
    const state = await readStudioLifecycleState(req.scope, productId)
    return res.status(200).json(state)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("COQUETTE Studio lifecycle state failed", error)
    return res.status(409).json({
      message,
      code: "lifecycle_state_blocked",
    })
  }
}
