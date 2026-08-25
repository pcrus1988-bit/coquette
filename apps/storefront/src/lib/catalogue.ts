import { isMedusaStoreConfigured, medusa } from "./medusa"

export type CatalogueState = "ready" | "unconfigured" | "unavailable"
export type CategoryCatalogueState = CatalogueState | "not_found"

type ProductListResponse = Awaited<ReturnType<typeof medusa.store.product.list>>
type CategoryListResponse = Awaited<ReturnType<typeof medusa.store.category.list>>

export type CatalogueProduct = ProductListResponse["products"][number]
export type CatalogueCategory = CategoryListResponse["product_categories"][number]

export type CatalogueProductsResult = {
  state: CatalogueState
  products: CatalogueProduct[]
  count: number
}

export type CatalogueProductResult = {
  state: CatalogueState | "not_found"
  product: CatalogueProduct | null
}

export type CategoryProductsResult = {
  state: CategoryCatalogueState
  category: CatalogueCategory | null
  products: CatalogueProduct[]
  count: number
}

const defaultCountryCode = (
  process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || "gr"
).toLowerCase()

const productCardFields =
  "id,title,handle,thumbnail,*images,*variants.calculated_price,+variants.inventory_quantity,+variants.manage_inventory"

export async function getCatalogueProducts(
  limit = 24,
  offset = 0
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
      {
        limit,
        offset,
        country_code: defaultCountryCode,
        fields: productCardFields,
      },
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

export async function getCategoryProducts(
  categoryHandle: string,
  limit = 24,
  offset = 0
): Promise<CategoryProductsResult> {
  if (!isMedusaStoreConfigured) {
    return {
      state: "unconfigured",
      category: null,
      products: [],
      count: 0,
    }
  }

  try {
    const { product_categories } = await medusa.store.category.list(
      {
        handle: categoryHandle,
        limit: 1,
      },
      {
        next: {
          tags: ["categories", `category:${categoryHandle}`],
        },
      }
    )

    const category = product_categories[0]

    if (!category) {
      return {
        state: "not_found",
        category: null,
        products: [],
        count: 0,
      }
    }

    const { products, count } = await medusa.store.product.list(
      {
        category_id: category.id,
        limit,
        offset,
        country_code: defaultCountryCode,
        fields: productCardFields,
      },
      {
        next: {
          tags: ["products", `category-products:${category.id}`],
        },
      }
    )

    return {
      state: "ready",
      category,
      products,
      count,
    }
  } catch (error) {
    console.error(
      `COQUETTE Store API category query failed for ${categoryHandle}`,
      error
    )

    return {
      state: "unavailable",
      category: null,
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
