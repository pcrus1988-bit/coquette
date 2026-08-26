"use client"

import Link from "next/link"
import type { StoreCart } from "../providers/cart"
import { useCart } from "../providers/cart"

type StorefrontLanguage = "el" | "en"
type CartItem = NonNullable<StoreCart["items"]>[number]

const copy = {
  el: {
    eyebrow: "Καλάθι",
    title: "Το καλάθι μου",
    empty: "Το καλάθι σου είναι άδειο.",
    continueShopping: "Συνέχισε τις αγορές",
    quantity: "Ποσότητα",
    remove: "Αφαίρεση",
    subtotal: "Υποσύνολο",
    total: "Σύνολο",
    checkout: "Συνέχεια στο checkout",
    checkoutNote:
      "Στο επόμενο βήμα αποθηκεύεις email/διεύθυνση και επιλέγεις πραγματικό διαθέσιμο τρόπο αποστολής. Η πληρωμή παραμένει κλειδωμένη μέχρι να συνδεθούν οι production payment providers.",
    loading: "Φόρτωση καλαθιού…",
    error: "Παρουσιάστηκε πρόβλημα με το καλάθι.",
  },
  en: {
    eyebrow: "Bag",
    title: "Your bag",
    empty: "Your bag is empty.",
    continueShopping: "Continue shopping",
    quantity: "Quantity",
    remove: "Remove",
    subtotal: "Subtotal",
    total: "Total",
    checkout: "Continue to checkout",
    checkoutNote:
      "Next you can save your email/address and select an actual available delivery method. Payment remains locked until the production payment providers are connected.",
    loading: "Loading your bag…",
    error: "There is a problem with your bag.",
  },
} satisfies Record<StorefrontLanguage, Record<string, string>>

function formatPrice(
  amount: number,
  currencyCode: string,
  language: StorefrontLanguage
) {
  return new Intl.NumberFormat(language === "en" ? "en-GB" : "el-GR", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(amount)
}

function itemTitle(item: CartItem) {
  return item.product_title || item.title || item.variant?.product?.title || "Product"
}

function itemVariant(item: CartItem) {
  const explicit = item.variant_title || item.variant?.title
  if (explicit && explicit !== "Default") {
    return explicit
  }

  return (item.variant?.options ?? [])
    .map((option) => option.value)
    .filter(Boolean)
    .join(" · ")
}

export function CartPage({ language = "el" }: { language?: StorefrontLanguage }) {
  const labels = copy[language]
  const { cart, loading, error, updateItemQuantity, removeItem } = useCart()
  const items = cart?.items ?? []
  const currencyCode = cart?.currency_code || "eur"
  const shoppingHref = language === "en" ? "/en/clothing" : "/clothing"
  const productPrefix = language === "en" ? "/en/products" : "/products"
  const checkoutHref = language === "en" ? "/en/checkout" : "/checkout"

  return (
    <main className="bg-[#f7f5f2] px-5 py-14 text-neutral-950 lg:px-8">
      <section className="mx-auto max-w-[1200px]">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
          {labels.eyebrow}
        </p>
        <h1 className="mt-3 font-serif text-5xl sm:text-6xl">{labels.title}</h1>

        {loading && !cart ? (
          <div className="mt-12 border border-neutral-200 bg-white p-8 text-sm text-neutral-600">
            {labels.loading}
          </div>
        ) : error && !cart ? (
          <div className="mt-12 border border-neutral-200 bg-white p-8 text-sm text-red-700">
            {labels.error}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-12 border border-neutral-200 bg-white p-8">
            <p className="text-sm text-neutral-600">{labels.empty}</p>
            <Link
              className="mt-6 inline-block border-b border-neutral-950 pb-1 text-xs uppercase tracking-[0.14em]"
              href={shoppingHref}
            >
              {labels.continueShopping}
            </Link>
          </div>
        ) : (
          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_360px]">
            <div className="divide-y divide-neutral-200 border-y border-neutral-200 bg-white">
              {items.map((item) => {
                const title = itemTitle(item)
                const variant = itemVariant(item)
                const handle = item.product_handle || item.variant?.product?.handle
                const thumbnail = item.thumbnail || item.variant?.product?.thumbnail
                const quantity = Number(item.quantity ?? 1)
                const lineTotal = Number(
                  item.subtotal ?? Number(item.unit_price ?? 0) * quantity
                )

                return (
                  <article className="grid grid-cols-[96px_1fr] gap-5 p-5 sm:grid-cols-[120px_1fr]" key={item.id}>
                    <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                      {thumbnail ? (
                        <img alt={title} className="h-full w-full object-cover" src={thumbnail} />
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-col justify-between gap-4">
                      <div>
                        {handle ? (
                          <Link className="text-sm leading-5" href={`${productPrefix}/${handle}`}>
                            {title}
                          </Link>
                        ) : (
                          <p className="text-sm leading-5">{title}</p>
                        )}
                        {variant ? <p className="mt-2 text-xs text-neutral-500">{variant}</p> : null}
                        <p className="mt-3 text-sm">{formatPrice(lineTotal, currencyCode, language)}</p>
                      </div>

                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <label className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                          <span className="mb-2 block">{labels.quantity}</span>
                          <input
                            className="w-20 border border-neutral-300 px-3 py-2 text-center text-sm text-neutral-950"
                            disabled={loading}
                            min={1}
                            onChange={(event) => {
                              const next = Math.max(1, Number(event.target.value) || 1)
                              void updateItemQuantity(item.id, next)
                            }}
                            type="number"
                            value={quantity}
                          />
                        </label>
                        <button
                          className="border-b border-neutral-400 pb-1 text-[10px] uppercase tracking-[0.14em] disabled:text-neutral-300"
                          disabled={loading}
                          onClick={() => void removeItem(item.id)}
                          type="button"
                        >
                          {labels.remove}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <aside className="h-fit border border-neutral-200 bg-white p-6 lg:sticky lg:top-8">
              <div className="flex justify-between gap-4 text-sm">
                <span>{labels.subtotal}</span>
                <span>{formatPrice(Number(cart?.subtotal ?? 0), currencyCode, language)}</span>
              </div>
              <div className="mt-5 flex justify-between gap-4 border-t border-neutral-200 pt-5 text-lg">
                <span>{labels.total}</span>
                <span>{formatPrice(Number(cart?.total ?? cart?.subtotal ?? 0), currencyCode, language)}</span>
              </div>
              <Link
                className="mt-6 block w-full bg-neutral-950 px-6 py-4 text-center text-xs uppercase tracking-[0.16em] text-white"
                href={checkoutHref}
              >
                {labels.checkout}
              </Link>
              <p className="mt-4 text-xs leading-5 text-neutral-500">{labels.checkoutNote}</p>
            </aside>
          </div>
        )}
      </section>
    </main>
  )
}
