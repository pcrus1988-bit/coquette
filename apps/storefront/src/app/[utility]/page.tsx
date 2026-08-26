import { notFound } from "next/navigation"
import { CartPage } from "../../components/cart-page"
import { ProductListingShell } from "../../components/product-listing-shell"
import {
  parseCatalogueSearchParams,
  type CatalogueSearchParams,
} from "../../lib/catalogue-search-params"

const pages: Record<string, { title: string; body: string }> = {
  account: { title: "Λογαριασμός", body: "Σύνδεση, εγγραφή, ανάκτηση κωδικού, διευθύνσεις, παραγγελίες και wishlist θα υλοποιηθούν χωρίς τα Magento account overlays." },
  contact: { title: "Επικοινωνία", body: "Coquette Concept · Βρασίδου 119, ΤΚ 23100 · Αρχαία Σπάρτη · 2731 0 20404." },
  shipping: { title: "Αποστολές", body: "Οι τελικοί courier κανόνες, χρεώσεις και δωρεάν μεταφορικά άνω των €100 θα μεταφερθούν μετά την επιβεβαίωση των εμπορικών ρυθμίσεων." },
  payments: { title: "Τρόποι πληρωμής", body: "Η σελίδα θα ενημερώνεται από το merchant back office και θα αντικατοπτρίζει μόνο ενεργούς payment providers." },
  terms: { title: "Όροι & Προϋποθέσεις", body: "Το υφιστάμενο νομικό περιεχόμενο θα μεταφερθεί και θα εκδοθεί ως διαχειρίσιμη Website Content σελίδα." },
  privacy: { title: "Πολιτική Απορρήτου", body: "Το privacy content θα μεταφερθεί στο νέο content model και θα επανελεγχθεί πριν το production cutover." },
}

export default async function UtilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ utility: string }>
  searchParams: Promise<CatalogueSearchParams>
}) {
  const [{ utility }, rawSearchParams] = await Promise.all([params, searchParams])

  if (utility === "cart") {
    return <CartPage />
  }

  if (utility === "search") {
    const parsed = parseCatalogueSearchParams(rawSearchParams)
    const title = parsed.query
      ? `Αποτελέσματα για «${parsed.query}»`
      : "Αναζήτηση προϊόντων"

    return (
      <ProductListingShell
        description="Αναζήτησε στον πραγματικό κατάλογο προϊόντων και περιόρισε τα αποτελέσματα με σχεδιαστή και τις μεταφερμένες global επιλογές χρώματος και μεγέθους."
        designer={parsed.designer}
        eyebrow="Αναζήτηση"
        hrefBase="/search"
        loadAll
        optionValueIds={parsed.optionValueIds}
        page={parsed.page}
        query={parsed.query}
        sort={parsed.sort}
        title={title}
      />
    )
  }

  const page = pages[utility]

  if (!page) {
    notFound()
  }

  return (
    <main className="min-h-[55vh] bg-[#f7f5f2] px-5 py-16 text-neutral-950 lg:px-8">
      <section className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Coquette Concept</p>
        <h1 className="mt-4 font-serif text-5xl sm:text-6xl">{page.title}</h1>
        <p className="mt-7 max-w-2xl text-sm leading-7 text-neutral-600">{page.body}</p>
      </section>
    </main>
  )
}
