import Link from "next/link"
import {
  getCatalogueProducts,
  getCategoryProducts,
  type CatalogueState,
  type CategoryCatalogueState,
} from "../lib/catalogue"
import { getBrandProducts } from "../lib/brands"
import { ProductCard } from "./product-card"

type StorefrontLanguage = "el" | "en"

type ProductListingShellProps = {
  eyebrow: string
  title: string
  description?: string
  categoryHandle?: string
  brandHandle?: string
  loadAll?: boolean
  pendingMessage?: string
  page?: number
  hrefBase: string
  language?: StorefrontLanguage
  locale?: string
  productHrefPrefix?: string
}

const copy = {
  el: {
    filters: ["Τιμή", "Σχεδιαστής", "Χρώμα", "Μέγεθος"],
    products: "προϊόντα",
    connectionPending: "catalogue connection pending",
    filterPending: "Ενεργοποιείται στη φάση search/filter",
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
    filterPending: "Activates in the search/filter phase",
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

export async function ProductListingShell({
  eyebrow,
  title,
  description,
  categoryHandle,
  brandHandle,
  loadAll = false,
  pendingMessage,
  page = 1,
  hrefBase,
  language = "el",
  locale,
  productHrefPrefix,
}: ProductListingShellProps) {
  const labels = copy[language]
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const offset = (safePage - 1) * pageSize
  const result = brandHandle
    ? await getBrandProducts(brandHandle, pageSize, offset, locale)
    : categoryHandle
      ? await getCategoryProducts(categoryHandle, pageSize, offset, locale)
      : loadAll
        ? await getCatalogueProducts(pageSize, offset, locale)
        : null
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
              <Link href={`${hrefBase}?page=${safePage - 1}`}>
                {labels.previous}
              </Link>
            ) : (
              <span className="text-neutral-300">{labels.previous}</span>
            )}
            <span className="text-neutral-500">
              {safePage} / {totalPages}
            </span>
            {hasNext ? (
              <Link href={`${hrefBase}?page=${safePage + 1}`}>
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
