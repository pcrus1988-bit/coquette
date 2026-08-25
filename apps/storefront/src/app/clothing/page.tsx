import { ProductListingShell } from "../../components/product-listing-shell"

export default async function ClothingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page } = await searchParams
  const pageNumber = Math.max(1, Number.parseInt(page || "1", 10) || 1)

  return (
    <ProductListingShell
      categoryHandle="clothing"
      eyebrow="Ρούχα"
      hrefBase="/clothing"
      page={pageNumber}
      title="Γυναικεία Ρούχα"
      description="Νέες παραλαβές, φορέματα, tops, παντελόνια, denim, πλεκτά, μαγιώ και οι υπόλοιπες βασικές κατηγορίες του Coquette Concept."
    />
  )
}
