import { notFound } from "next/navigation"
import { getProductByHandle } from "../../../lib/catalogue"

function formatPrice(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(amount)
}

function ProductConnectionState({
  handle,
  state,
}: {
  handle: string
  state: "unconfigured" | "unavailable"
}) {
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
              ? "Store API awaiting staging configuration"
              : "Store API temporarily unavailable"}
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-6 max-w-xl text-sm leading-7 text-neutral-600">
            {state === "unconfigured"
              ? "This route is ready for the dedicated COQUETTE Medusa publishable key. No database credential is required by the storefront."
              : "The commerce backend could not be reached. The page is staying available without inventing catalogue data."}
          </p>
        </div>
      </section>
    </main>
  )
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const result = await getProductByHandle(handle)

  if (result.state === "not_found") {
    notFound()
  }

  if (!result.product) {
    return <ProductConnectionState handle={handle} state={result.state as "unconfigured" | "unavailable"} />
  }

  const product = result.product
  const pricedVariants = (product.variants ?? []).filter(
    (variant) => variant.calculated_price?.calculated_amount != null
  )
  const displayVariant = [...pricedVariants].sort(
    (left, right) =>
      Number(left.calculated_price?.calculated_amount ?? 0) -
      Number(right.calculated_price?.calculated_amount ?? 0)
  )[0]
  const calculatedPrice = displayVariant?.calculated_price
  const amount = calculatedPrice?.calculated_amount
  const originalAmount = calculatedPrice?.original_amount
  const currencyCode = calculatedPrice?.currency_code || "eur"
  const isSale =
    amount != null &&
    originalAmount != null &&
    Number(originalAmount) > Number(amount)
  const variants = product.variants ?? []
  const isInStock = variants.some(
    (variant) =>
      variant.manage_inventory === false || Number(variant.inventory_quantity ?? 0) > 0
  )
  const images = product.images ?? []

  return (
    <main className="bg-[#f7f5f2] text-neutral-950">
      <section className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 lg:grid-cols-[1.15fr_.85fr] lg:px-8">
        <div className="grid grid-cols-2 gap-3">
          {images.length > 0 ? (
            images.map((image) => (
              <div className="aspect-[3/4] overflow-hidden bg-neutral-100" key={image.id}>
                {/* Product media is served from the COQUETTE media bucket after migration. */}
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
            {isInStock ? "Σε απόθεμα" : "Εξαντλημένο"}
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
            {product.title}
          </h1>

          {amount != null ? (
            <div className="mt-5 flex items-baseline gap-3 text-xl">
              <span>{formatPrice(Number(amount), currencyCode)}</span>
              {isSale ? (
                <span className="text-base text-neutral-400 line-through">
                  {formatPrice(Number(originalAmount), currencyCode)}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm text-neutral-500">Η τιμή δεν είναι ακόμη διαθέσιμη.</p>
          )}

          {(product.options ?? []).map((option) => (
            <div className="mt-9 border-y border-neutral-300 py-6" key={option.id}>
              <p className="text-xs uppercase tracking-[0.14em]">{option.title}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(option.values ?? []).map((value) => (
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
            Προσθήκη στο Καλάθι · checkout phase pending
          </button>
          <button
            className="mt-3 w-full border border-neutral-300 px-6 py-4 text-xs uppercase tracking-[0.14em] disabled:text-neutral-400"
            disabled
            type="button"
          >
            Προσθήκη στη Λίστα Επιθυμιών
          </button>

          <div className="mt-8 space-y-4 text-sm leading-6 text-neutral-600">
            <details className="border-t border-neutral-300 py-4" open>
              <summary className="cursor-pointer text-xs uppercase tracking-[0.14em] text-neutral-950">
                Περιγραφή
              </summary>
              <p className="whitespace-pre-line pt-4">
                {product.description || "Δεν υπάρχει ακόμη περιγραφή για αυτό το προϊόν."}
              </p>
            </details>
            <details className="border-t border-neutral-300 py-4">
              <summary className="cursor-pointer text-xs uppercase tracking-[0.14em] text-neutral-950">
                Αποστολές & Επιστροφές
              </summary>
              <p className="pt-4">
                Οι τελικοί κανόνες αποστολής και επιστροφών θα προέρχονται από την
                εγκεκριμένη ρύθμιση COQUETTE και όχι από προσωρινές τιμές του audit.
              </p>
            </details>
          </div>
        </div>
      </section>
    </main>
  )
}
