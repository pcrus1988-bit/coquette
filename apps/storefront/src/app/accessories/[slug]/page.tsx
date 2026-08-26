import { notFound } from "next/navigation"
import { ProductListingShell } from "../../../components/product-listing-shell"
import {
  parseCatalogueSearchParams,
  type CatalogueSearchParams,
} from "../../../lib/catalogue-search-params"

const categories: Record<string, string> = {
  bags: "Τσάντες",
  belts: "Ζώνες",
  jewellery: "Κοσμήματα",
  hats: "Καπέλα",
  sunglasses: "Γυαλιά Ηλίου",
  "hair-accessories": "Λαστιχάκια και Κορδέλες",
}

export default async function AccessoriesCategoryPage({
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
      eyebrow="Αξεσουάρ · Κατηγορία"
      hrefBase={`/accessories/${slug}`}
      optionValueIds={parsed.optionValueIds}
      page={parsed.page}
      query={parsed.query}
      sort={parsed.sort}
      title={title}
    />
  )
}
