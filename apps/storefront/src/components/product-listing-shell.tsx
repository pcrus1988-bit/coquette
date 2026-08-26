import Link from "next/link"
import {
  getCatalogueProducts,
  getCategoryProducts,
  getProductFilterOptions,
  type CatalogueSort,
  type CatalogueState,
  type CategoryCatalogueState,
} from "../lib/catalogue"
import {
  getBrandProductIds,
  getBrandProducts,
  getBrands,
} from "../lib/brands"
import { getSaleProducts } from "../lib/sale"
import { CatalogueControls } from "./catalogue-controls"
import { ProductCard } from "./product-card"

type StorefrontLanguage = "el" | "en"

type ProductListingShellProps = {
  eyebrow: string
  title: string
  description?: string
  categoryHandle?: string
  brandHandle?: string
  saleOnly?: boolean
  loadAll?: boolean
  pendingMessage?: string
  page?: number
  hrefBase: string
  language?: StorefrontLanguage
  locale?: string
  productHrefPrefix?: string
  query?: string
  sort?: CatalogueSort
  optionValueIds?: string[]
  designer?: string
}

const copy = {
  el: {
    filters: ["Τιμή", "Σχεδιαστής", "Χρώμα", "Μέγεθος"],
    products: "προϊόντα",
    connectionPending: "catalogue connection pending",
    filterPending: "Δεν είναι διαθέσιμο σε αυτή την εμπορική επιφάνεια ακόμη",
    sort: "Ταξινόμηση ▾",
    unconfigured:
      "Το catalogue UI είναι έτοιμο. Αναμένει το dedicated COQUETTE Medusa backend URL και publishable key του staging περιβάλλοντος.",
    categoryMissingPrefix: "Η κατηγορία",
    categoryMissingSuffix:
      "δεν έχει μεταφερθεί ακόμη στο Medusa catalogue. Η σελίδα παραμένει διαθέσιμη για migration/UAT έλεγχο.",
    brandMissingPrefix: "Ο σχεδιαστής",
    brandMissingSuffix:
      "δεν έχει μεταφερθεί ακόμη στο COQUETTE Brand catalogue. Η σελίδα παραμένει διαθέσιμη για migration/UAT έλεγχο.",
    unavailable:
      "Το commerce backend δεν είναι προσωρινά διαθέσιμο. Δεν εμφανίζονται πλασματικά προϊόντα ή τιμές.",
    pending:
      "Η συγκεκριμένη εμπορική επιφάνεια θα συνδεθεί με το κατάλληλο Medusa query όταν ολοκληρωθεί το αντίστοιχο migration/merchandising workstream.",
    empty: "Δεν υπάρχουν δημοσιευμένα προϊόντα σε αυτή την επιλογή ακόμη.",
    pagination: "Σελιδοποίηση προϊόντων",
    previous: "← Προηγούμενα",
    next: "Επόμενα →",
  },
  en: {
    filters: ["Price", "Designer", "Colour", "Size"],
    products: "products",
    connectionPending: "catalogue connection pending",
    filterPending: "Not available on this merchandising surface yet",
    sort: "Sort ▾",
    unconfigured:
      "The catalogue UI is ready and is waiting for the dedicated COQUETTE staging Medusa backend URL and publishable key.",
    categoryMissingPrefix: "Category",
    categoryMissingSuffix:
      "has not been migrated to the Medusa catalogue yet. This route remains available for migration and UAT checks.",
    brandMissingPrefix: "Designer",
    brandMissingSuffix:
      "has not been migrated to the COQUETTE Brand catalogue yet. This route remains available for migration and UAT checks.",
    unavailable:
      "The commerce backend is temporarily unavailable. The storefront will not invent products or prices.",
    pending:
      "This merchandising surface will be connected to its dedicated Medusa query when the related migration/merchandising workstream is complete.",
    empty: "There are no published products in this selection yet.",
    pagination: "Product pagination",
    previous: "← Previous",
    next: "Next →",
  },
} satisfies Record<StorefrontLanguage, Record<string, string | string[]>>

const pageSize = 24

function ConnectionMessage({
  state,
  categoryHandle,
  brandHandle,
  language,
}: {
  state: CatalogueState | CategoryCatalogueState | "not_found"
  categoryHandle?: string
  brandHandle?: string
  language: StorefrontLanguage
}) {
  const labels = copy[language]

  if (state === "unconfigured") {
    return <p>{labels.unconfigured}</p>
  }

  if (state === "not_found" && brandHandle) {
    return (
      <p>
        {labels.brandMissingPrefix} <strong>{brandHandle}</strong>{" "}
        {labels.brandMissingSuffix}
      </p>
    )
  }

  if (state === "not_found" && categoryHandle) {
    return (
      <p>
        {labels.categoryMissingPrefix} <strong>{categoryHandle}</strong>{" "}
        {labels.categoryMissingSuffix}
      </p>
    )
  }

  return <p>{labels.unavailable}</p>
}

function pageHref({
  hrefBase,
  page,
  query,
  sort,
  optionValueIds,
  designer,
}: {
  hrefBase: string
  page: number
  query?: string
  sort?: CatalogueSort
  optionValueIds?: string[]
  designer?: string
}) {
  const params = new URLSearchParams()

  if (query?.trim()) {
    params.set("q", query.trim())
  }
  if (sort) {
    params.set("sort", sort)
  }
  for (const optionId of [...new Set(optionValueIds ?? [])]) {
    if (optionId) {
      params.append("option", optionId)
    }
  }
  if (designer) {
    params.set("designer", designer)
  }
  if (page > 1) {
    params.set("page", String(page))
  }

  const queryString = params.toString()
  return queryString ? `${hrefBase}?${queryString}` : hrefBase
}

export async function ProductListingShell({
  eyebrow,
  title,
  description,
  categoryHandle,
  brandHandle,
  saleOnly = false,
  loadAll = false,
  pendingMessage,
  page = 1,
  hrefBase,
  language = "el",
  locale,
  productHrefPrefix,
  query,
  sort = "",
  optionValueIds = [],
  designer = "",
}: ProductListingShellProps) {
  const labels = copy[language]
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const offset = (safePage - 1) * pageSize
  const supportsNativeCatalogueQuery = !saleOnly && !brandHandle && (Boolean(categoryHandle) || loadAll)
  const designerFilterResult =
    supportsNativeCatalogueQuery && designer
      ? await getBrandProductIds(designer)
      : null
  const nativeQuery = supportsNativeCatalogueQuery
    ? {
        q: query,
        order: sort,
        optionValueIds,
        ...(designer
          ? {
              productIds:
                designerFilterResult?.state === "ready"
                  ? designerFilterResult.productIds
                  : [],
            }
          : {}),
      }
    : undefined

  const designerLookupFailed =
    designerFilterResult &&
    (designerFilterResult.state === "unconfigured" ||
      designerFilterResult.state === "unavailable")

  const result = designerLookupFailed
    ? {
        state: designerFilterResult.state,
        products: [],
        count: 0,
      }
    : saleOnly
      ? await getSaleProducts(pageSize, offset, locale)
      : brandHandle
        ? await getBrandProducts(brandHandle, pageSize, offset, locale)
        : categoryHandle
          ? await getCategoryProducts(categoryHandle, pageSize, offset, locale, nativeQuery)
          : loadAll
            ? await getCatalogueProducts(pageSize, offset, locale, nativeQuery)
            : null

  const [filterOptionsResult, brandDirectoryResult] = supportsNativeCatalogueQuery
    ? await Promise.all([getProductFilterOptions(locale), getBrands()])
    : [null, null]
  const totalPages = result
    ? Math.max(1, Math.ceil(result.count / pageSize))
    : 1
  const hasPrevious = safePage > 1
  const hasNext = result ? safePage < totalPages : false
  const resolvedProductHrefPrefix =
    productHrefPrefix || (language === "en" ? "/en/products" : "/products")
  const brandResult =
    brandHandle && result && "brand" in result ? result : null
  const resolvedTitle = brandResult?.brand?.name || title
  const resolvedDescription = brandResult?.brand?.description || description

  return (
    <main className="bg-[#f7f5f2] text-neutral-950">
      <header className="mx-auto max-w-[1440px] px-5 pb-12 pt-16 lg:px-8">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
          {eyebrow}
        </p>
        <div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h1 className="font-serif text-5xl sm:text-6xl">{resolvedTitle}</h1>
            {resolvedDescription ? (
              <p className="mt-5 max-w-2xl text-sm leading-7 text-neutral-600">
                {resolvedDescription}
              </p>
            ) : null}
          </div>
          <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">
            {result?.state === "ready"
              ? `${result.count} ${labels.products}`
              : labels.connectionPending}
          </p>
        </div>
      </header>

      {supportsNativeCatalogueQuery ? (
        <CatalogueControls
          action={hrefBase}
          designers={brandDirectoryResult?.brands ?? []}
          language={language}
          options={filterOptionsResult?.options ?? []}
          query={query}
          selectedDesigner={designer}
          selectedOptionValueIds={optionValueIds}
          sort={sort}
        />
      ) : (
        <section className="border-y border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 overflow-x-auto px-5 py-4 lg:px-8">
            <div className="flex gap-2">
              {(labels.filters as string[]).map((filter) => (
                <button
                  className="cursor-not-allowed whitespace-nowrap border border-neutral-200 px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-neutral-400"
                  disabled
                  key={filter}
                  title={labels.filterPending as string}
                  type="button"
                >
                  {filter} +
                </button>
              ))}
            </div>
            <button
              className="cursor-not-allowed whitespace-nowrap text-[11px] uppercase tracking-[0.12em] text-neutral-400"
              disabled
              title={labels.filterPending as string}
              type="button"
            >
              {labels.sort}
            </button>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1440px] px-5 py-14 lg:px-8">
        {!result ? (
          <div className="border border-neutral-200 bg-white p-8 text-sm leading-7 text-neutral-600">
            <p>{pendingMessage || labels.pending}</p>
          </div>
        ) : result.state !== "ready" ? (
          <div className="border border-neutral-200 bg-white p-8 text-sm leading-7 text-neutral-600">
            <ConnectionMessage
              brandHandle={brandHandle}
              categoryHandle={categoryHandle}
              language={language}
              state={result.state}
            />
          </div>
        ) : result.products.length === 0 ? (
          <div className="border border-neutral-200 bg-white p-8 text-sm text-neutral-600">
            {labels.empty}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {result.products.map((product) => (
              <ProductCard
                key={product.id}
                language={language}
                preferSalePrice={saleOnly}
                product={product}
                productHrefPrefix={resolvedProductHrefPrefix}
              />
            ))}
          </div>
        )}

        {result?.state === "ready" && result.count > 0 ? (
          <nav
            aria-label={labels.pagination as string}
            className="mt-14 flex items-center justify-between border-t border-neutral-200 pt-8 text-xs uppercase tracking-[0.14em]"
          >
            {hasPrevious ? (
              <Link
                href={pageHref({
                  hrefBase,
                  page: safePage - 1,
                  query,
                  sort,
                  optionValueIds,
                  designer,
                })}
              >
                {labels.previous}
              </Link>
            ) : (
              <span className="text-neutral-300">{labels.previous}</span>
            )}
            <span className="text-neutral-500">
              {safePage} / {totalPages}
            </span>
            {hasNext ? (
              <Link
                href={pageHref({
                  hrefBase,
                  page: safePage + 1,
                  query,
                  sort,
                  optionValueIds,
                  designer,
                })}
              >
                {labels.next}
              </Link>
            ) : (
              <span className="text-neutral-300">{labels.next}</span>
            )}
          </nav>
        ) : null}
      </section>
    </main>
  )
}
