import { ProductListingShell } from "../../components/product-listing-shell"
import {
  parseCatalogueSearchParams,
  type CatalogueSearchParams,
} from "../../lib/catalogue-search-params"

export default async function AccessoriesPage({
  searchParams,
}: {
  searchParams: Promise<CatalogueSearchParams>
}) {
  const parsed = parseCatalogueSearchParams(await searchParams)

  return (
    <ProductListingShell
      categoryHandle="accessories"
      eyebrow="Αξεσουάρ"
      hrefBase="/accessories"
      optionValueIds={parsed.optionValueIds}
      page={parsed.page}
      query={parsed.query}
      sort={parsed.sort}
      title="Αξεσουάρ"
      description="Τσάντες, ζώνες, κοσμήματα, καπέλα, γυαλιά ηλίου και hair accessories από το επιλεγμένο designer portfolio του Coquette Concept."
    />
  )
}
