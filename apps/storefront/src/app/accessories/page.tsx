import { ProductListingShell } from "../../components/product-listing-shell"

export default async function AccessoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page } = await searchParams
  const pageNumber = Math.max(1, Number.parseInt(page || "1", 10) || 1)

  return (
    <ProductListingShell
      categoryHandle="accessories"
      eyebrow="Αξεσουάρ"
      hrefBase="/accessories"
      page={pageNumber}
      title="Αξεσουάρ"
      description="Τσάντες, ζώνες, κοσμήματα, καπέλα, γυαλιά ηλίου και hair accessories από το επιλεγμένο designer portfolio του Coquette Concept."
    />
  )
}
