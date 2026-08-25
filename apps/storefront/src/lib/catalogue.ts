import { isMedusaStoreConfigured, medusa } from "./medusa"

export type CatalogueState = "ready" | "unconfigured" | "unavailable"

type ProductListResponse = Awaited<ReturnType<typeof medusa.store.product.list>>
export type CatalogueProduct = ProductListResponse["products"][number]

export type CatalogueProductsResult = {
  state: CatalogueState
  products: CatalogueProduct[]
  count: number
}

export type CatalogueProductResult = {
  state: CatalogueState | "not_found"
  product: CatalogueProduct | null
}

const defaultCountryCode = (
  process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || "gr"
).toLowerCase()

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

export async function getProductByHandle(
  handle: string
): Promise<CatalogueProductResult> {
  if (!isMedusaStoreConfigured) {
    return {
      state: "unconfigured",
      product: null,
    }
  }

  try {
    const { products } = await medusa.store.product.list(
      {
        handle,
        limit: 1,
        country_code: defaultCountryCode,
        fields: "*variants.calculated_price,+variants.inventory_quantity,*images",
      },
      {
        next: {
          tags: ["products", `product:${handle}`],
        },
      }
    )

    return {
      state: products[0] ? "ready" : "not_found",
      product: products[0] ?? null,
    }
  } catch (error) {
    console.error(`COQUETTE Store API product query failed for ${handle}`, error)

    return {
      state: "unavailable",
      product: null,
    }
  }
}
