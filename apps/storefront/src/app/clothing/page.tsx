import { ProductListingShell } from "../../components/product-listing-shell"
import {
  parseCatalogueSearchParams,
  type CatalogueSearchParams,
} from "../../lib/catalogue-search-params"

export default async function ClothingPage({
  searchParams,
}: {
  searchParams: Promise<CatalogueSearchParams>
}) {
  const parsed = parseCatalogueSearchParams(await searchParams)

  return (
    <ProductListingShell
      categoryHandle="clothing"
      eyebrow="Ρούχα"
      hrefBase="/clothing"
      optionValueIds={parsed.optionValueIds}
      page={parsed.page}
      query={parsed.query}
      sort={parsed.sort}
      title="Γυναικεία Ρούχα"
      description="Νέες παραλαβές, φορέματα, tops, παντελόνια, denim, πλεκτά, μαγιώ και οι υπόλοιπες βασικές κατηγορίες του Coquette Concept."
    />
  )
}
