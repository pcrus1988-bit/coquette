import Link from "next/link"
import {
  getCatalogueProducts,
  getCategoryProducts,
  type CatalogueState,
  type CategoryCatalogueState,
} from "../lib/catalogue"
import { ProductCard } from "./product-card"

type ProductListingShellProps = {
  eyebrow: string
  title: string
  description?: string
  categoryHandle?: string
  page?: number
  hrefBase: string
}

const filterGroups = ["Τιμή", "Σχεδιαστής", "Χρώμα", "Μέγεθος"]
const pageSize = 24

function ConnectionMessage({
  state,
  categoryHandle,
}: {
  state: CatalogueState | CategoryCatalogueState
  categoryHandle?: string
}) {
  if (state === "unconfigured") {
    return (
      <p>
        Το catalogue UI είναι έτοιμο. Αναμένει το dedicated COQUETTE Medusa backend
        URL και publishable key του staging περιβάλλοντος.
      </p>
    )
  }

  if (state === "not_found" && categoryHandle) {
    return (
      <p>
        Η κατηγορία <strong>{categoryHandle}</strong> δεν έχει μεταφερθεί ακόμη στο
        Medusa catalogue. Η σελίδα παραμένει διαθέσιμη για migration/UAT έλεγχο.
      </p>
    )
  }

  return (
    <p>
      Το commerce backend δεν είναι προσωρινά διαθέσιμο. Δεν εμφανίζονται πλασματικά
      προϊόντα ή τιμές.
    </p>
  )
}

export async function ProductListingShell({
  eyebrow,
  title,
  description,
  categoryHandle,
  page = 1,
  hrefBase,
}: ProductListingShellProps) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const offset = (safePage - 1) * pageSize
  const result = categoryHandle
    ? await getCategoryProducts(categoryHandle, pageSize, offset)
    : await getCatalogueProducts(pageSize, offset)
  const totalPages = Math.max(1, Math.ceil(result.count / pageSize))
  const hasPrevious = safePage > 1
  const hasNext = safePage < totalPages

  return (
    <main className="bg-[#f7f5f2] text-neutral-950">
      <header className="mx-auto max-w-[1440px] px-5 pb-12 pt-16 lg:px-8">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
          {eyebrow}
        </p>
        <div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h1 className="font-serif text-5xl sm:text-6xl">{title}</h1>
            {description ? (
              <p className="mt-5 max-w-2xl text-sm leading-7 text-neutral-600">
                {description}
              </p>
            ) : null}
          </div>
          <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">
            {result.state === "ready"
              ? `${result.count} προϊόντα`
              : "catalogue connection pending"}
          </p>
        </div>
      </header>

      <section className="border-y border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 overflow-x-auto px-5 py-4 lg:px-8">
          <div className="flex gap-2">
            {filterGroups.map((filter) => (
              <button
                className="cursor-not-allowed whitespace-nowrap border border-neutral-200 px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-neutral-400"
                disabled
                key={filter}
                title="Ενεργοποιείται στη φάση search/filter"
                type="button"
              >
                {filter} +
              </button>
            ))}
          </div>
          <button
            className="cursor-not-allowed whitespace-nowrap text-[11px] uppercase tracking-[0.12em] text-neutral-400"
            disabled
            title="Ενεργοποιείται στη φάση search/filter"
            type="button"
          >
            Ταξινόμηση ▾
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-14 lg:px-8">
        {result.state !== "ready" ? (
          <div className="border border-neutral-200 bg-white p-8 text-sm leading-7 text-neutral-600">
            <ConnectionMessage
              categoryHandle={categoryHandle}
              state={result.state}
            />
          </div>
        ) : result.products.length === 0 ? (
          <div className="border border-neutral-200 bg-white p-8 text-sm text-neutral-600">
            Δεν υπάρχουν δημοσιευμένα προϊόντα σε αυτή την κατηγορία ακόμη.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {result.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {result.state === "ready" && result.count > 0 ? (
          <nav
            aria-label="Σελιδοποίηση προϊόντων"
            className="mt-14 flex items-center justify-between border-t border-neutral-200 pt-8 text-xs uppercase tracking-[0.14em]"
          >
            {hasPrevious ? (
              <Link href={`${hrefBase}?page=${safePage - 1}`}>← Προηγούμενα</Link>
            ) : (
              <span className="text-neutral-300">← Προηγούμενα</span>
            )}
            <span className="text-neutral-500">
              {safePage} / {totalPages}
            </span>
            {hasNext ? (
              <Link href={`${hrefBase}?page=${safePage + 1}`}>Επόμενα →</Link>
            ) : (
              <span className="text-neutral-300">Επόμενα →</span>
            )}
          </nav>
        ) : null}
      </section>
    </main>
  )
}
