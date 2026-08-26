import { notFound } from "next/navigation"
import { ProductListingShell } from "../../../components/product-listing-shell"
import {
  parseCatalogueSearchParams,
  type CatalogueSearchParams,
} from "../../../lib/catalogue-search-params"

const categories: Record<string, string> = {
  "new-arrivals": "Νέες Παραλαβές",
  dresses: "Φορέματα",
  tops: "Μπλούζες",
  trousers: "Παντελόνια",
  outerwear: "Πανωφόρια",
  jeans: "Τζιν",
  leggings: "Κολάν",
  skirts: "Φούστες",
  activewear: "Αθλητική Ένδυση",
  jumpsuits: "Ολόσωμες Φόρμες",
  knitwear: "Πλεκτά",
  swimwear: "Μαγιώ",
}

export default async function ClothingCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<CatalogueSearchParams>
}) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams])
  const title = categories[slug]

  if (!title) {
    notFound()
  }

  const parsed = parseCatalogueSearchParams(rawSearchParams)

  return (
    <ProductListingShell
      categoryHandle={slug}
      designer={parsed.designer}
      eyebrow="Ρούχα · Κατηγορία"
      hrefBase={`/clothing/${slug}`}
      optionValueIds={parsed.optionValueIds}
      page={parsed.page}
      query={parsed.query}
      sort={parsed.sort}
      title={title}
    />
  )
}
