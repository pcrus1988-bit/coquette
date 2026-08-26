import { isMedusaStoreConfigured, medusa } from "./medusa"

export type CatalogueState = "ready" | "unconfigured" | "unavailable"
export type CategoryCatalogueState = CatalogueState | "not_found"

type ProductListResponse = Awaited<ReturnType<typeof medusa.store.product.list>>
type CategoryListResponse = Awaited<ReturnType<typeof medusa.store.category.list>>

export type CatalogueProduct = ProductListResponse["products"][number]
export type CatalogueCategory = CategoryListResponse["product_categories"][number]
type CatalogueCategoryTree = CatalogueCategory & {
  category_children?: CatalogueCategoryTree[]
}

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

function collectCategoryIds(category: CatalogueCategoryTree): string[] {
  return [
    category.id,
    ...(category.category_children ?? []).flatMap(collectCategoryIds),
  ]
}

function localeParams(locale?: string) {
  return locale ? { locale } : {}
}

function localeTag(locale?: string) {
  return locale ? `locale:${locale}` : "locale:default"
}

export async function getCatalogueProducts(
  limit = 24,
  offset = 0,
  locale?: string
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
        ...localeParams(locale),
      },
      {
        next: {
          tags: ["products", localeTag(locale)],
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

export async function getProductsByIds(
  productIds: string[],
  locale?: string
): Promise<CatalogueProductsResult> {
  if (!isMedusaStoreConfigured) {
    return {
      state: "unconfigured",
      products: [],
      count: 0,
    }
  }

  if (productIds.length === 0) {
    return {
      state: "ready",
      products: [],
      count: 0,
    }
  }

  try {
    const { products } = await medusa.store.product.list(
      {
        id: productIds,
        limit: productIds.length,
        country_code: defaultCountryCode,
        fields: productCardFields,
        ...localeParams(locale),
      },
      {
        next: {
          tags: [
            "products",
            localeTag(locale),
            ...productIds.map((id) => `product-id:${id}`),
          ],
        },
      }
    )

    const productOrder = new Map(productIds.map((id, index) => [id, index]))
    const orderedProducts = [...products].sort(
      (left, right) =>
        (productOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (productOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    )

    return {
      state: "ready",
      products: orderedProducts,
      count: orderedProducts.length,
    }
  } catch (error) {
    console.error("COQUETTE Store API product ID query failed", error)

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
  offset = 0,
  locale?: string
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
        include_descendants_tree: true,
        fields: "*category_children",
        ...localeParams(locale),
      },
      {
        next: {
          tags: ["categories", `category:${categoryHandle}`, localeTag(locale)],
        },
      }
    )

    const category = product_categories[0] as CatalogueCategoryTree | undefined

    if (!category) {
      return {
        state: "not_found",
        category: null,
        products: [],
        count: 0,
      }
    }

    const categoryIds = collectCategoryIds(category)
    const { products, count } = await medusa.store.product.list(
      {
        category_id: categoryIds,
        limit,
        offset,
        country_code: defaultCountryCode,
        fields: productCardFields,
        ...localeParams(locale),
      },
      {
        next: {
          tags: [
            "products",
            localeTag(locale),
            `category-products:${category.id}`,
            ...categoryIds.map((id) => `category-products:${id}`),
          ],
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
  handle: string,
  locale?: string
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
        ...localeParams(locale),
      },
      {
        next: {
          tags: ["products", `product:${handle}`, localeTag(locale)],
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
