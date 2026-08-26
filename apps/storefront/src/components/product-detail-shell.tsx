import { notFound } from "next/navigation"
import { getProductByHandle } from "../lib/catalogue"
import { isMedusaSalePrice } from "../lib/pricing"

type StorefrontLanguage = "el" | "en"

const copy = {
  el: {
    inStock: "Σε απόθεμα",
    outOfStock: "Εξαντλημένο",
    priceUnavailable: "Η τιμή δεν είναι ακόμη διαθέσιμη.",
    addToCart: "Προσθήκη στο Καλάθι · checkout phase pending",
    wishlist: "Προσθήκη στη Λίστα Επιθυμιών",
    description: "Περιγραφή",
    noDescription: "Δεν υπάρχει ακόμη περιγραφή για αυτό το προϊόν.",
    shippingReturns: "Αποστολές & Επιστροφές",
    shippingPending:
      "Οι τελικοί κανόνες αποστολής και επιστροφών θα προέρχονται από την εγκεκριμένη ρύθμιση COQUETTE και όχι από προσωρινές τιμές του audit.",
    unconfiguredTitle: "Store API awaiting staging configuration",
    unavailableTitle: "Store API temporarily unavailable",
    unconfiguredBody:
      "This route is ready for the dedicated COQUETTE Medusa publishable key. No database credential is required by the storefront.",
    unavailableBody:
      "The commerce backend could not be reached. The page is staying available without inventing catalogue data.",
  },
  en: {
    inStock: "In stock",
    outOfStock: "Out of stock",
    priceUnavailable: "The price is not available yet.",
    addToCart: "Add to bag · checkout phase pending",
    wishlist: "Add to wishlist",
    description: "Description",
    noDescription: "There is no product description yet.",
    shippingReturns: "Shipping & Returns",
    shippingPending:
      "Final shipping and returns rules will come from approved COQUETTE configuration, not provisional audit values.",
    unconfiguredTitle: "Store API awaiting staging configuration",
    unavailableTitle: "Store API temporarily unavailable",
    unconfiguredBody:
      "This route is ready for the dedicated COQUETTE Medusa publishable key. No database credential is required by the storefront.",
    unavailableBody:
      "The commerce backend could not be reached. The page remains available without inventing catalogue data.",
  },
} satisfies Record<StorefrontLanguage, Record<string, string>>

function formatPrice(
  amount: number,
  currencyCode: string,
  language: StorefrontLanguage
): string {
  return new Intl.NumberFormat(language === "en" ? "en-GB" : "el-GR", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(amount)
}

function ProductConnectionState({
  handle,
  state,
  language,
}: {
  handle: string
  state: "unconfigured" | "unavailable"
  language: StorefrontLanguage
}) {
  const labels = copy[language]
  const title = handle.replace(/-/g, " ").toUpperCase()

  return (
    <main className="bg-[#f7f5f2] text-neutral-950">
      <section className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 lg:grid-cols-[1.15fr_.85fr] lg:px-8">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="aspect-[3/4] bg-neutral-200" key={index} />
          ))}
        </div>
        <div className="lg:sticky lg:top-8 lg:self-start">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            {state === "unconfigured"
              ? labels.unconfiguredTitle
              : labels.unavailableTitle}
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-7 text-neutral-600">
            {state === "unconfigured"
              ? labels.unconfiguredBody
              : labels.unavailableBody}
          </p>
        </div>
      </section>
    </main>
  )
}

export async function ProductDetailShell({
  handle,
  language = "el",
  locale,
}: {
  handle: string
  language?: StorefrontLanguage
  locale?: string
}) {
  const labels = copy[language]
  const result = await getProductByHandle(handle, locale)

  if (result.state === "not_found") {
    notFound()
  }

  if (!result.product) {
    return (
      <ProductConnectionState
        handle={handle}
        language={language}
        state={result.state as "unconfigured" | "unavailable"}
      />
    )
  }

  const product = result.product
  type ProductVariant = NonNullable<typeof product.variants>[number]
  type ProductImage = NonNullable<typeof product.images>[number]
  type ProductOption = NonNullable<typeof product.options>[number]
  type ProductOptionValue = NonNullable<ProductOption["values"]>[number]

  const pricedVariants = (product.variants ?? []).filter(
    (variant: ProductVariant) =>
      variant.calculated_price?.calculated_amount != null
  )
  const displayVariant = [...pricedVariants].sort(
    (left: ProductVariant, right: ProductVariant) =>
      Number(left.calculated_price?.calculated_amount ?? 0) -
      Number(right.calculated_price?.calculated_amount ?? 0)
  )[0]
  const calculatedPrice = displayVariant?.calculated_price
  const amount = calculatedPrice?.calculated_amount
  const originalAmount = calculatedPrice?.original_amount
  const currencyCode = calculatedPrice?.currency_code || "eur"
  const isSale = isMedusaSalePrice(calculatedPrice)
  const variants = product.variants ?? []
  const isInStock = variants.some(
    (variant: ProductVariant) =>
      variant.manage_inventory === false ||
      Number(variant.inventory_quantity ?? 0) > 0
  )
  const images = product.images ?? []

  return (
    <main className="bg-[#f7f5f2] text-neutral-950">
      <section className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 lg:grid-cols-[1.15fr_.85fr] lg:px-8">
        <div className="grid grid-cols-2 gap-3">
          {images.length > 0 ? (
            images.map((image: ProductImage) => (
              <div
                className="aspect-[3/4] overflow-hidden bg-neutral-100"
                key={image.id}
              >
                <img
                  alt={product.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  src={image.url}
                />
              </div>
            ))
          ) : (
            <div className="col-span-2 aspect-[3/4] bg-neutral-200" />
          )}
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            {isInStock ? labels.inStock : labels.outOfStock}
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
            {product.title}
          </h1>

          {amount != null ? (
            <div className="mt-5 flex items-baseline gap-3 text-xl">
              <span>{formatPrice(Number(amount), currencyCode, language)}</span>
              {isSale && originalAmount != null ? (
                <span className="text-base text-neutral-400 line-through">
                  {formatPrice(Number(originalAmount), currencyCode, language)}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm text-neutral-500">
              {labels.priceUnavailable}
            </p>
          )}

          {(product.options ?? []).map((option: ProductOption) => (
            <div
              className="mt-9 border-y border-neutral-300 py-6"
              key={option.id}
            >
              <p className="text-xs uppercase tracking-[0.14em]">{option.title}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(option.values ?? []).map((value: ProductOptionValue) => (
                  <button
                    className="min-w-12 border border-neutral-300 px-3 py-2 text-xs"
                    disabled
                    key={value.id}
                    type="button"
                  >
                    {value.value}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            className="mt-6 w-full bg-neutral-950 px-6 py-4 text-xs uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
            disabled
            type="button"
          >
            {labels.addToCart}
          </button>
          <button
            className="mt-3 w-full border border-neutral-300 px-6 py-4 text-xs uppercase tracking-[0.14em] disabled:text-neutral-400"
            disabled
            type="button"
          >
            {labels.wishlist}
          </button>

          <div className="mt-8 space-y-4 text-sm leading-6 text-neutral-600">
            <details className="border-t border-neutral-300 py-4" open>
              <summary className="cursor-pointer text-xs uppercase tracking-[0.14em] text-neutral-950">
                {labels.description}
              </summary>
              <p className="whitespace-pre-line pt-4">
                {product.description || labels.noDescription}
              </p>
            </details>
            <details className="border-t border-neutral-300 py-4">
              <summary className="cursor-pointer text-xs uppercase tracking-[0.14em] text-neutral-950">
                {labels.shippingReturns}
              </summary>
              <p className="pt-4">{labels.shippingPending}</p>
            </details>
          </div>
        </div>
      </section>
    </main>
  )
}
