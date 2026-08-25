import { notFound } from "next/navigation"
import { ProductListingShell } from "../../../components/product-listing-shell"

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

export default async function ClothingCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const title = categories[slug]

  if (!title) {
    notFound()
  }

  return <ProductListingShell eyebrow="Ρούχα · Κατηγορία" title={title} />
}
