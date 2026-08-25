import { notFound } from "next/navigation"
import { ProductListingShell } from "../../../components/product-listing-shell"
import { designerNames } from "../../../lib/navigation"

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const designers = Object.fromEntries(
  designerNames.map((name) => [slugify(name), name])
)

export default async function DesignerPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const title = designers[slug]

  if (!title) {
    notFound()
  }

  return (
    <ProductListingShell
      eyebrow="Σχεδιαστής"
      hrefBase={`/designers/${slug}`}
      title={title}
      pendingMessage="Τα προϊόντα του συγκεκριμένου designer θα συνδεθούν μέσω του πρώτης κλάσης COQUETTE Brand/Designer module. Δεν χρησιμοποιούμε προσωρινά μια γενική λίστα προϊόντων, ώστε να μην παρουσιαστεί λανθασμένο catalogue."
    />
  )
}
