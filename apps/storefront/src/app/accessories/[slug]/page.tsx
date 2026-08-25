import { notFound } from "next/navigation"
import { ProductListingShell } from "../../../components/product-listing-shell"

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
  searchParams: Promise<{ page?: string }>
}) {
  const [{ slug }, { page }] = await Promise.all([params, searchParams])
  const title = categories[slug]

  if (!title) {
    notFound()
  }

  const pageNumber = Math.max(1, Number.parseInt(page || "1", 10) || 1)

  return (
    <ProductListingShell
      categoryHandle={slug}
      eyebrow="Αξεσουάρ · Κατηγορία"
      hrefBase={`/accessories/${slug}`}
      page={pageNumber}
      title={title}
    />
  )
}
