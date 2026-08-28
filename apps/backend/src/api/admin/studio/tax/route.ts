import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { readStudioTaxState } from "../../../../lib/studio-tax"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    const state = await readStudioTaxState(req.scope)
    return res.status(200).json(state)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(409).json({
      message,
      code: "tax_state_blocked",
    })
  }
}
