import Link from "next/link"
import type { CatalogueProduct } from "../lib/catalogue"

type ProductVariant = NonNullable<CatalogueProduct["variants"]>[number]

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(amount)
}

export function ProductCard({ product }: { product: CatalogueProduct }) {
  const variants = product.variants ?? []
  const pricedVariants = variants.filter(
    (variant: ProductVariant) =>
      variant.calculated_price?.calculated_amount != null
  )
  const displayVariant = [...pricedVariants].sort(
    (left: ProductVariant, right: ProductVariant) =>
      Number(left.calculated_price?.calculated_amount ?? 0) -
      Number(right.calculated_price?.calculated_amount ?? 0)
  )[0]
  const price = displayVariant?.calculated_price
  const amount = price?.calculated_amount
  const originalAmount = price?.original_amount
  const currencyCode = price?.currency_code || "eur"
  const isSale =
    amount != null &&
    originalAmount != null &&
    Number(originalAmount) > Number(amount)
  const isInStock = variants.some(
    (variant: ProductVariant) =>
      variant.manage_inventory === false ||
      Number(variant.inventory_quantity ?? 0) > 0
  )
  const imageUrl = product.thumbnail || product.images?.[0]?.url

  return (
    <article className="group min-w-0">
      <Link className="block" href={`/products/${product.handle}`}>
        <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100">
          {imageUrl ? (
            <img
              alt={product.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              loading="lazy"
              src={imageUrl}
            />
          ) : (
            <div className="h-full w-full bg-neutral-200" />
          )}

          <div className="absolute left-3 top-3 flex flex-col gap-2">
            {isSale ? (
              <span className="bg-neutral-950 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white">
                Sale
              </span>
            ) : null}
            {!isInStock && variants.length > 0 ? (
              <span className="bg-white/90 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-neutral-700">
                Εξαντλημένο
              </span>
            ) : null}
          </div>
        </div>

        <div className="pt-4">
          <h2 className="line-clamp-2 text-sm leading-5">{product.title}</h2>
          {amount != null ? (
            <div className="mt-2 flex items-baseline gap-2 text-sm">
              <span>{formatPrice(Number(amount), currencyCode)}</span>
              {isSale ? (
                <span className="text-xs text-neutral-400 line-through">
                  {formatPrice(Number(originalAmount), currencyCode)}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-neutral-500">Τιμή μη διαθέσιμη</p>
          )}
        </div>
      </Link>
    </article>
  )
}
