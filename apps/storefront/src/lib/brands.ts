import { FetchError } from "@medusajs/js-sdk"
import {
  getProductsByIds,
  type CatalogueProduct,
  type CatalogueState,
} from "./catalogue"
import { isMedusaStoreConfigured, medusa } from "./medusa"

export type StoreBrand = {
  id: string
  name: string
  handle: string
  description: string | null
  logo_url: string | null
}

type BrandDirectoryResponse = {
  brands: StoreBrand[]
  count: number
  limit: number
  offset: number
}

type BrandProductIdsResponse = {
  brand: StoreBrand
  product_ids: string[]
  count: number
  limit: number
  offset: number
}

export type BrandDirectoryResult = {
  state: CatalogueState
  brands: StoreBrand[]
  count: number
}

export type BrandProductsResult = {
  state: CatalogueState | "not_found"
  brand: StoreBrand | null
  products: CatalogueProduct[]
  count: number
}

export async function getBrands(
  limit = 200,
  offset = 0
): Promise<BrandDirectoryResult> {
  if (!isMedusaStoreConfigured) {
    return {
      state: "unconfigured",
      brands: [],
      count: 0,
    }
  }

  try {
    const response = await medusa.client.fetch<BrandDirectoryResponse>(
      "/store/brands",
      {
        query: {
          limit,
          offset,
        },
      }
    )

    return {
      state: "ready",
      brands: response.brands,
      count: response.count,
    }
  } catch (error) {
    console.error("COQUETTE Brand directory query failed", error)

    return {
      state: "unavailable",
      brands: [],
      count: 0,
    }
  }
}

export async function getBrandProducts(
  handle: string,
  limit = 24,
  offset = 0,
  locale?: string
): Promise<BrandProductsResult> {
  if (!isMedusaStoreConfigured) {
    return {
      state: "unconfigured",
      brand: null,
      products: [],
      count: 0,
    }
  }

  try {
    const response = await medusa.client.fetch<BrandProductIdsResponse>(
      `/store/brands/${encodeURIComponent(handle)}`,
      {
        query: {
          limit,
          offset,
        },
      }
    )
    const productResult = await getProductsByIds(response.product_ids, locale)

    if (productResult.state !== "ready") {
      return {
        state: productResult.state,
        brand: response.brand,
        products: [],
        count: response.count,
      }
    }

    return {
      state: "ready",
      brand: response.brand,
      products: productResult.products,
      count: response.count,
    }
  } catch (error) {
    if (error instanceof FetchError && error.status === 404) {
      return {
        state: "not_found",
        brand: null,
        products: [],
        count: 0,
      }
    }

    console.error(`COQUETTE Brand product query failed for ${handle}`, error)

    return {
      state: "unavailable",
      brand: null,
      products: [],
      count: 0,
    }
  }
}
