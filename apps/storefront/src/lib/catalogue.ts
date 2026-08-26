import { isMedusaStoreConfigured, medusa } from "./medusa"

export type CatalogueState = "ready" | "unconfigured" | "unavailable"
export type CategoryCatalogueState = CatalogueState | "not_found"
export type CatalogueSort = "" | "-created_at" | "created_at" | "title" | "-title"

export type CatalogueQuery = {
  q?: string
  order?: CatalogueSort
  optionValueIds?: string[]
}

type ProductListResponse = Awaited<ReturnType<typeof medusa.store.product.list>>
type CategoryListResponse = Awaited<ReturnType<typeof medusa.store.category.list>>
type ProductOptionListResponse = Awaited<
  ReturnType<typeof medusa.store.productOption.list>
>

export type CatalogueProduct = ProductListResponse["products"][number]
export type CatalogueCategory = CategoryListResponse["product_categories"][number]
export type CatalogueProductOption = ProductOptionListResponse["product_options"][number]
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

export type ProductFilterOptionsResult = {
  state: CatalogueState
  options: CatalogueProductOption[]
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

function normalizeQuery(query?: CatalogueQuery) {
  const q = query?.q?.trim()
  const optionValueIds = [...new Set(query?.optionValueIds ?? [])].filter(Boolean)

  return {
    ...(q ? { q } : {}),
    ...(query?.order ? { order: query.order } : {}),
    ...(optionValueIds.length > 0
      ? { option_value_id: optionValueIds }
      : {}),
  }
}

function queryTags(query?: CatalogueQuery) {
  const q = query?.q?.trim() || "all"
  const order = query?.order || "default"
  const options = [...new Set(query?.optionValueIds ?? [])].sort().join(",") || "all"

  return [`query:${q}`, `order:${order}`, `options:${options}`]
}

export async function getProductFilterOptions(
  locale?: string
): Promise<ProductFilterOptionsResult> {
  if (!isMedusaStoreConfigured) {
    return {
      state: "unconfigured",
      options: [],
    }
  }

  try {
    const { product_options } = await medusa.store.productOption.list(
      {
        limit: 100,
        offset: 0,
        is_exclusive: false,
        ...localeParams(locale),
      },
      {
        next: {
          tags: ["product-options", localeTag(locale)],
        },
      }
    )

    return {
      state: "ready",
      options: product_options,
    }
  } catch (error) {
    console.error("COQUETTE Store API product-option query failed", error)

    return {
      state: "unavailable",
      options: [],
    }
  }
}

export async function getCatalogueProducts(
  limit = 24,
  offset = 0,
  locale?: string,
  query?: CatalogueQuery
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
        ...normalizeQuery(query),
        ...localeParams(locale),
      },
      {
        next: {
          tags: ["products", localeTag(locale), ...queryTags(query)],
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
  locale?: string,
  query?: CatalogueQuery
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
        ...normalizeQuery(query),
        ...localeParams(locale),
      },
      {
        next: {
          tags: [
            "products",
            localeTag(locale),
            `category-products:${category.id}`,
            ...categoryIds.map((id) => `category-products:${id}`),
            ...queryTags(query),
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
