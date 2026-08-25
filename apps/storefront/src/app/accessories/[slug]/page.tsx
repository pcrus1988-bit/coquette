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

export default async function AccessoriesCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const title = categories[slug]

  if (!title) {
    notFound()
  }

  return <ProductListingShell eyebrow="Αξεσουάρ · Κατηγορία" title={title} />
}
