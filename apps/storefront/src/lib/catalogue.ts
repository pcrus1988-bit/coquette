import { isMedusaStoreConfigured, medusa } from "./medusa"

export type CatalogueState = "ready" | "unconfigured" | "unavailable"

export type CatalogueProductsResult = {
  state: CatalogueState
  products: Awaited<ReturnType<typeof medusa.store.product.list>>["products"]
  count: number
}

export async function getCatalogueProducts(
  limit = 8
): Promise<CatalogueProductsResult> {
  if (!isMedusaStoreConfigured) {
    return {
      state: "unconfigured",
      products: [],
      count: 0,
    }
  }

  try {
    const { products, count } = await medusa.store.product.list(
      { limit },
      {
        next: {
          revalidate: 60,
          tags: ["products"],
        },
      }
    )

    return {
      state: "ready",
      products,
      count,
    }
  } catch (error) {
    console.error("COQUETTE Store API product query failed", error)

    return {
      state: "unavailable",
      products: [],
      count: 0,
    }
  }
}
