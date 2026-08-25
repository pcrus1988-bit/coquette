import { notFound } from "next/navigation"
import { ProductListingShell } from "../../../components/product-listing-shell"
import { designerNames } from "../../../lib/navigation"

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const designers = Object.fromEntries(designerNames.map((name) => [slugify(name), name]))

export default async function DesignerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const title = designers[slug]

  if (!title) {
    notFound()
  }

  return <ProductListingShell eyebrow="Σχεδιαστής" title={title} />
}
