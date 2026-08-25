import { ProductListingShell } from "../../components/product-listing-shell"

export default function SalePage() {
  return (
    <ProductListingShell
      eyebrow="Sale"
      hrefBase="/sale"
      title="Σε Προσφορά"
      description="Η dedicated sale συλλογή παραμένει ξεχωριστή εμπορική επιφάνεια, με strike-through pricing και promotional badges όταν συνδεθεί το πραγματικό catalogue."
      pendingMessage="Η σελίδα Sale δεν θα εμφανίσει όλα τα προϊόντα ως υποκατάστατο. Θα ενεργοποιηθεί όταν οριστεί και δοκιμαστεί ο πραγματικός κανόνας προσφοράς/price-list από το migrated catalogue."
    />
  )
}
