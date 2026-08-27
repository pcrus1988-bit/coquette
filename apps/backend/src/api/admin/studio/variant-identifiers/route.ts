import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  cleanStudioIdentifierProductId,
  readStudioVariantIdentifierState,
} from "../../../../lib/studio-variant-identifiers"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const productId = cleanStudioIdentifierProductId(req.query?.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  try {
    const state = await readStudioVariantIdentifierState(req.scope, productId)
    return res.status(200).json(state)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("COQUETTE Studio variant identifier state failed", error)
    return res.status(409).json({
      message,
      code: "variant_identifier_state_blocked",
    })
  }
}
