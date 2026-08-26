import { ProductListingShell } from "../../components/product-listing-shell"

export default async function SalePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page } = await searchParams
  const pageNumber = Math.max(1, Number.parseInt(page || "1", 10) || 1)

  return (
    <ProductListingShell
      description="Εμφανίζονται μόνο προϊόντα των οποίων η τρέχουσα υπολογισμένη τιμή για το storefront προέρχεται από ενεργό Medusa price list τύπου Sale. Private/customer-group price lists δεν δημοσιεύονται ως γενική προσφορά."
      eyebrow="Sale"
      hrefBase="/sale"
      page={pageNumber}
      saleOnly
      title="Σε Προσφορά"
    />
  )
}
