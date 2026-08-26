import { notFound } from "next/navigation"
import { getProductByHandle } from "../lib/catalogue"
import { ProductPurchasePanel } from "./product-purchase-panel"

type StorefrontLanguage = "el" | "en"

const copy = {
  el: {
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
  type ProductImage = NonNullable<typeof product.images>[number]
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
          <ProductPurchasePanel language={language} product={product} />

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
