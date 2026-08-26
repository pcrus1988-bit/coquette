import { getProductsByIds, type CatalogueProduct, type CatalogueState } from "./catalogue"
import { isMedusaStoreConfigured, medusa } from "./medusa"
import { isMedusaSalePrice } from "./pricing"

type SaleCandidatesResponse = {
  product_ids: string[]
  candidate_count: number
  generated_at: string
}

export type SaleProductsResult = {
  state: CatalogueState
  products: CatalogueProduct[]
  count: number
}

const candidateChunkSize = 100

function productHasApplicableSale(product: CatalogueProduct): boolean {
  return (product.variants ?? []).some((variant) =>
    isMedusaSalePrice(variant.calculated_price)
  )
}

export async function getSaleProducts(
  limit = 24,
  offset = 0,
  locale?: string
): Promise<SaleProductsResult> {
  if (!isMedusaStoreConfigured) {
    return {
      state: "unconfigured",
      products: [],
      count: 0,
    }
  }

  try {
    const candidates = await medusa.client.fetch<SaleCandidatesResponse>(
      "/store/sale-candidates"
    )
    const applicableProducts: CatalogueProduct[] = []

    for (
      let index = 0;
      index < candidates.product_ids.length;
      index += candidateChunkSize
    ) {
      const ids = candidates.product_ids.slice(index, index + candidateChunkSize)
      const result = await getProductsByIds(ids, locale)

      if (result.state !== "ready") {
        return {
          state: result.state,
          products: [],
          count: 0,
        }
      }

      applicableProducts.push(
        ...result.products.filter(productHasApplicableSale)
      )
    }

    applicableProducts.sort((left, right) =>
      left.title.localeCompare(right.title, locale || "el-GR")
    )

    return {
      state: "ready",
      products: applicableProducts.slice(offset, offset + limit),
      count: applicableProducts.length,
    }
  } catch (error) {
    console.error("COQUETTE public Sale product query failed", error)

    return {
      state: "unavailable",
      products: [],
      count: 0,
    }
  }
}
