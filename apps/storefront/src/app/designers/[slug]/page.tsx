import { ProductListingShell } from "../../../components/product-listing-shell"

const humanizeHandle = (handle: string) =>
  handle
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")

export default async function DesignerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const [{ slug }, { page }] = await Promise.all([params, searchParams])
  const pageNumber = Math.max(1, Number.parseInt(page || "1", 10) || 1)

  return (
    <ProductListingShell
      brandHandle={slug}
      eyebrow="Σχεδιαστής"
      hrefBase={`/designers/${slug}`}
      page={pageNumber}
      title={humanizeHandle(slug)}
    />
  )
}
