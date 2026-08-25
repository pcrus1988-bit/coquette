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

export default async function ClothingCategoryPage({
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
      eyebrow="Ρούχα · Κατηγορία"
      hrefBase={`/clothing/${slug}`}
      page={pageNumber}
      title={title}
    />
  )
}
