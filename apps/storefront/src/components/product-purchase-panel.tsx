"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import type { CatalogueProduct } from "../lib/catalogue"
import { isMedusaSalePrice } from "../lib/pricing"
import { useCart } from "../providers/cart"

type StorefrontLanguage = "el" | "en"
type ProductVariant = NonNullable<CatalogueProduct["variants"]>[number]
type ProductOption = NonNullable<CatalogueProduct["options"]>[number]
type ProductOptionValue = NonNullable<ProductOption["values"]>[number]

const copy = {
  el: {
    inStock: "Σε απόθεμα",
    outOfStock: "Εξαντλημένο",
    priceUnavailable: "Η τιμή δεν είναι ακόμη διαθέσιμη.",
    addToCart: "Προσθήκη στο Καλάθι",
    adding: "Προσθήκη…",
    added: "Προστέθηκε στο καλάθι.",
    viewCart: "Προβολή καλαθιού",
    chooseOptions: "Επίλεξε τις διαθέσιμες επιλογές.",
    quantity: "Ποσότητα",
    wishlist: "Προσθήκη στη Λίστα Επιθυμιών · σύντομα",
    addError: "Δεν ήταν δυνατή η προσθήκη στο καλάθι.",
  },
  en: {
    inStock: "In stock",
    outOfStock: "Out of stock",
    priceUnavailable: "The price is not available yet.",
    addToCart: "Add to bag",
    adding: "Adding…",
    added: "Added to your bag.",
    viewCart: "View bag",
    chooseOptions: "Choose the available options.",
    quantity: "Quantity",
    wishlist: "Add to wishlist · coming soon",
    addError: "The product could not be added to your bag.",
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

function initialOptionSelection(product: CatalogueProduct) {
  const firstVariant = product.variants?.[0]
  const selected: Record<string, string> = {}

  for (const optionValue of firstVariant?.options ?? []) {
    if (optionValue.option_id && optionValue.id) {
      selected[optionValue.option_id] = optionValue.id
    }
  }

  return selected
}

export function ProductPurchasePanel({
  product,
  language = "el",
}: {
  product: CatalogueProduct
  language?: StorefrontLanguage
}) {
  const labels = copy[language]
  const { addToCart, loading: cartLoading } = useCart()
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    () => initialOptionSelection(product)
  )
  const [quantity, setQuantity] = useState(1)
  const [status, setStatus] = useState<"idle" | "added" | "error">("idle")

  const selectedVariant = useMemo(() => {
    const options = product.options ?? []
    const variants = product.variants ?? []

    if (options.length === 0) {
      return variants[0]
    }

    if (Object.keys(selectedOptions).length !== options.length) {
      return undefined
    }

    return variants.find((variant: ProductVariant) =>
      (variant.options ?? []).every(
        (optionValue) =>
          Boolean(optionValue.option_id) &&
          selectedOptions[optionValue.option_id!] === optionValue.id
      )
    )
  }, [product, selectedOptions])

  const price = selectedVariant?.calculated_price
  const amount = price?.calculated_amount
  const originalAmount = price?.original_amount
  const currencyCode = price?.currency_code || "eur"
  const isSale = isMedusaSalePrice(price)
  const inventoryQuantity = Number(selectedVariant?.inventory_quantity ?? 0)
  const managesInventory = selectedVariant?.manage_inventory !== false
  const allowsBackorder = selectedVariant?.allow_backorder === true
  const isInStock = Boolean(
    selectedVariant &&
      (!managesInventory || allowsBackorder || inventoryQuantity > 0)
  )
  const maxQuantity =
    selectedVariant && managesInventory && !allowsBackorder
      ? Math.max(1, inventoryQuantity)
      : 99

  const handleAddToCart = async () => {
    if (!selectedVariant || !isInStock || quantity < 1) {
      return
    }

    setStatus("idle")
    try {
      await addToCart(selectedVariant.id, quantity)
      setStatus("added")
    } catch {
      setStatus("error")
    }
  }

  return (
    <>
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
        <p className="mt-5 text-sm text-neutral-500">{labels.priceUnavailable}</p>
      )}

      {(product.options ?? []).map((option: ProductOption) => (
        <div className="mt-9 border-y border-neutral-300 py-6" key={option.id}>
          <p className="text-xs uppercase tracking-[0.14em]">{option.title}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(option.values ?? []).map((value: ProductOptionValue) => {
              const isSelected = selectedOptions[option.id] === value.id
              return (
                <button
                  aria-pressed={isSelected}
                  className={`min-w-12 border px-3 py-2 text-xs transition-colors ${
                    isSelected
                      ? "border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-300 bg-white text-neutral-950"
                  }`}
                  key={value.id}
                  onClick={() => {
                    setSelectedOptions((previous) => ({
                      ...previous,
                      [option.id]: value.id,
                    }))
                    setStatus("idle")
                  }}
                  type="button"
                >
                  {value.value}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {!selectedVariant ? (
        <p className="mt-4 text-xs text-neutral-500">{labels.chooseOptions}</p>
      ) : null}

      <label className="mt-6 flex items-center justify-between border-y border-neutral-300 py-4 text-xs uppercase tracking-[0.14em]">
        <span>{labels.quantity}</span>
        <input
          className="w-20 border border-neutral-300 px-3 py-2 text-center text-sm"
          max={maxQuantity}
          min={1}
          onChange={(event) => {
            const next = Math.max(1, Math.min(maxQuantity, Number(event.target.value) || 1))
            setQuantity(next)
            setStatus("idle")
          }}
          type="number"
          value={quantity}
        />
      </label>

      <button
        className="mt-6 w-full bg-neutral-950 px-6 py-4 text-xs uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
        disabled={!selectedVariant || !isInStock || cartLoading}
        onClick={() => void handleAddToCart()}
        type="button"
      >
        {cartLoading ? labels.adding : labels.addToCart}
      </button>

      {status === "added" ? (
        <div className="mt-4 flex items-center justify-between gap-4 text-xs">
          <span>{labels.added}</span>
          <Link className="border-b border-neutral-950 pb-1 uppercase tracking-[0.12em]" href={language === "en" ? "/en/cart" : "/cart"}>
            {labels.viewCart}
          </Link>
        </div>
      ) : null}
      {status === "error" ? (
        <p className="mt-4 text-xs text-red-700">{labels.addError}</p>
      ) : null}

      <button
        className="mt-3 w-full border border-neutral-300 px-6 py-4 text-xs uppercase tracking-[0.14em] text-neutral-400"
        disabled
        type="button"
      >
        {labels.wishlist}
      </button>
    </>
  )
}
