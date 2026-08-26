import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getPublicSaleCandidateProductIds } from "../sale/public-sale-candidates"

export default async function saleQueryContract({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productIds = await getPublicSaleCandidateProductIds(query)

  if (!Array.isArray(productIds)) {
    throw new Error("Sale pricing graph contract did not return an array")
  }

  console.log(
    `COQUETTE Sale pricing graph contract passed (${productIds.length} candidate products)`
  )
}
