import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getPublicSaleCandidateProductIds } from "../../../sale/public-sale-candidates"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const productIds = await getPublicSaleCandidateProductIds(query)

  res.json({
    product_ids: productIds,
    candidate_count: productIds.length,
    generated_at: new Date().toISOString(),
  })
}
