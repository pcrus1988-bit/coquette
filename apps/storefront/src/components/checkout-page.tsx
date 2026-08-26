"use client"

import Link from "next/link"
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { isMedusaStoreConfigured, medusa } from "../lib/medusa"
import { useCart, type CheckoutAddress, type StoreCart } from "../providers/cart"
import { useRegion } from "../providers/region"
import { CheckoutPaymentStep } from "./checkout-payment-step"

type StorefrontLanguage = "el" | "en"
type ShippingOptionsResponse = Awaited<
  ReturnType<typeof medusa.store.fulfillment.listCartOptions>
>
type ShippingOption = ShippingOptionsResponse["shipping_options"][number]

type CheckoutForm = CheckoutAddress & {
  email: string
}

type CalculatedShippingResponse = {
  shipping_option: ShippingOption & { amount?: number | null }
}

const copy = {
  el: {
    eyebrow: "Checkout",
    title: "Στοιχεία Αποστολής",
    intro: "Συμπλήρωσε τα στοιχεία σου. Οι διαθέσιμοι τρόποι αποστολής προέρχονται απευθείας από το COQUETTE commerce backend.",
    empty: "Το καλάθι σου είναι άδειο.",
    back: "Επιστροφή στις αγορές",
    contact: "Επικοινωνία & διεύθυνση",
    email: "Email",
    firstName: "Όνομα",
    lastName: "Επώνυμο",
    phone: "Τηλέφωνο",
    company: "Εταιρεία (προαιρετικό)",
    address1: "Διεύθυνση",
    address2: "Διεύθυνση 2 (προαιρετικό)",
    city: "Πόλη",
    postalCode: "Τ.Κ.",
    province: "Περιφέρεια / Νομός",
    country: "Χώρα",
    save: "Αποθήκευση & τρόποι αποστολής",
    saving: "Αποθήκευση…",
    shipping: "Τρόπος αποστολής",
    shippingPrompt: "Αποθήκευσε πρώτα έγκυρη διεύθυνση για να εμφανιστούν οι πραγματικοί διαθέσιμοι τρόποι αποστολής.",
    shippingLoading: "Έλεγχος διαθέσιμων τρόπων αποστολής…",
    shippingNone: "Δεν βρέθηκε διαθέσιμος τρόπος αποστολής για αυτή τη διεύθυνση.",
    selectShipping: "Επιλογή",
    selected: "Επιλεγμένο",
    unavailableRate: "Η τιμή μεταφορικών δεν είναι διαθέσιμη.",
    summary: "Σύνοψη",
    subtotal: "Υποσύνολο",
    shippingTotal: "Μεταφορικά",
    total: "Σύνολο",
    error: "Δεν ήταν δυνατή η ενημέρωση του checkout. Έλεγξε τα στοιχεία και δοκίμασε ξανά.",
    backendPending: "Το checkout αναμένει τη σύνδεση με το dedicated COQUETTE staging Store API.",
  },
  en: {
    eyebrow: "Checkout",
    title: "Delivery Details",
    intro: "Enter your details. Available delivery methods are retrieved directly from the COQUETTE commerce backend.",
    empty: "Your bag is empty.",
    back: "Continue shopping",
    contact: "Contact & address",
    email: "Email",
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone",
    company: "Company (optional)",
    address1: "Address",
    address2: "Address line 2 (optional)",
    city: "City",
    postalCode: "Postcode",
    province: "Region / Province",
    country: "Country",
    save: "Save & show delivery methods",
    saving: "Saving…",
    shipping: "Delivery method",
    shippingPrompt: "Save a valid address first to retrieve the actual delivery methods available for this cart.",
    shippingLoading: "Checking available delivery methods…",
    shippingNone: "No delivery method is available for this address.",
    selectShipping: "Select",
    selected: "Selected",
    unavailableRate: "The delivery price is unavailable.",
    summary: "Summary",
    subtotal: "Subtotal",
    shippingTotal: "Delivery",
    total: "Total",
    error: "Checkout could not be updated. Review your details and try again.",
    backendPending: "Checkout is waiting for the dedicated COQUETTE staging Store API connection.",
  },
} satisfies Record<StorefrontLanguage, Record<string, string>>

function formatMoney(
  amount: number | null | undefined,
  currencyCode: string,
  language: StorefrontLanguage
) {
  if (amount == null) {
    return null
  }

  return new Intl.NumberFormat(language === "en" ? "en-GB" : "el-GR", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(Number(amount))
}

function initialForm(cart?: StoreCart): CheckoutForm {
  const address = cart?.shipping_address

  return {
    email: cart?.email || "",
    first_name: address?.first_name || "",
    last_name: address?.last_name || "",
    phone: address?.phone || "",
    company: address?.company || "",
    address_1: address?.address_1 || "",
    address_2: address?.address_2 || "",
    city: address?.city || "",
    postal_code: address?.postal_code || "",
    province: address?.province || "",
    country_code: address?.country_code || "",
  }
}

export function CheckoutPage({ language = "el" }: { language?: StorefrontLanguage }) {
  const labels = copy[language]
  const { cart, loading: cartLoading, updateCheckoutContact, addShippingMethod } = useCart()
  const { region } = useRegion()
  const [form, setForm] = useState<CheckoutForm>(() => initialForm(cart))
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [calculatedPrices, setCalculatedPrices] = useState<Record<string, number>>({})
  const [shippingLoading, setShippingLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [addressSaved, setAddressSaved] = useState(
    Boolean(cart?.shipping_address?.address_1)
  )

  useEffect(() => {
    if (!cart) {
      return
    }
    setForm(initialForm(cart))
    setAddressSaved(Boolean(cart.shipping_address?.address_1))
  }, [cart?.id])

  const countries = region?.countries ?? []
  const defaultCountry = countries[0]?.iso_2 || "gr"

  useEffect(() => {
    if (!form.country_code && defaultCountry) {
      setForm((current) => ({ ...current, country_code: defaultCountry }))
    }
  }, [defaultCountry, form.country_code])

  const loadShippingOptions = useCallback(
    async (cartId: string) => {
      setShippingLoading(true)
      setLocalError(null)
      try {
        const { shipping_options } = await medusa.store.fulfillment.listCartOptions({
          cart_id: cartId,
        })
        setShippingOptions(shipping_options)

        const calculated = shipping_options.filter(
          (option) => option.price_type === "calculated"
        )
        const settled = await Promise.allSettled(
          calculated.map((option) =>
            medusa.client.fetch<CalculatedShippingResponse>(
              `/store/shipping-options/${option.id}/calculate`,
              {
                method: "POST",
                body: {
                  cart_id: cartId,
                  data: {},
                },
              }
            )
          )
        )
        const nextPrices: Record<string, number> = {}
        for (const response of settled) {
          if (response.status !== "fulfilled") {
            continue
          }
          const option = response.value.shipping_option
          if (option.amount != null) {
            nextPrices[option.id] = Number(option.amount)
          }
        }
        setCalculatedPrices(nextPrices)
      } catch (reason) {
        console.error("COQUETTE shipping option discovery failed", reason)
        setShippingOptions([])
        setLocalError(labels.error)
      } finally {
        setShippingLoading(false)
      }
    },
    [labels.error]
  )

  useEffect(() => {
    if (cart?.id && cart.shipping_address?.address_1) {
      void loadShippingOptions(cart.id)
    }
  }, [cart?.id, cart?.shipping_address?.address_1, loadShippingOptions])

  const submitAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError(null)

    try {
      const shippingAddress: CheckoutAddress = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        address_1: form.address_1.trim(),
        ...(form.address_2?.trim()
          ? { address_2: form.address_2.trim() }
          : {}),
        ...(form.company?.trim() ? { company: form.company.trim() } : {}),
        postal_code: form.postal_code.trim(),
        city: form.city.trim(),
        country_code: (form.country_code || defaultCountry).toLowerCase(),
        ...(form.province?.trim() ? { province: form.province.trim() } : {}),
        ...(form.phone?.trim() ? { phone: form.phone.trim() } : {}),
      }

      const updated = await updateCheckoutContact({
        email: form.email.trim(),
        shippingAddress,
      })
      setAddressSaved(true)
      await loadShippingOptions(updated.id)
    } catch (reason) {
      console.error("COQUETTE checkout address update failed", reason)
      setLocalError(labels.error)
    }
  }

  const selectedShippingOptionIds = new Set(
    (cart?.shipping_methods ?? [])
      .map((method) => method.shipping_option_id)
      .filter((value): value is string => Boolean(value))
  )

  const currencyCode = cart?.currency_code || region?.currency_code || "eur"
  const summary = useMemo(
    () => ({
      subtotal: formatMoney(cart?.subtotal, currencyCode, language),
      shipping: formatMoney(cart?.shipping_total, currencyCode, language),
      total: formatMoney(cart?.total, currencyCode, language),
    }),
    [
      cart?.subtotal,
      cart?.shipping_total,
      cart?.total,
      currencyCode,
      language,
    ]
  )

  if (!isMedusaStoreConfigured) {
    return (
      <main className="min-h-[55vh] bg-[#f7f5f2] px-5 py-16 lg:px-8">
        <section className="mx-auto max-w-4xl border border-neutral-200 bg-white p-8 text-sm text-neutral-600">
          {labels.backendPending}
        </section>
      </main>
    )
  }

  if (cart && (cart.items?.length ?? 0) === 0) {
    return (
      <main className="min-h-[55vh] bg-[#f7f5f2] px-5 py-16 lg:px-8">
        <section className="mx-auto max-w-4xl">
          <h1 className="font-serif text-5xl">{labels.title}</h1>
          <p className="mt-6 text-sm text-neutral-600">{labels.empty}</p>
          <Link
            className="mt-8 inline-block border-b border-neutral-950 pb-1 text-xs uppercase tracking-[0.14em]"
            href={language === "en" ? "/en/clothing" : "/clothing"}
          >
            {labels.back}
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="bg-[#f7f5f2] px-5 py-12 text-neutral-950 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">
          {labels.eyebrow}
        </p>
        <h1 className="mt-3 font-serif text-5xl sm:text-6xl">{labels.title}</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-neutral-600">
          {labels.intro}
        </p>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <section className="border border-neutral-200 bg-white p-6 sm:p-8">
              <h2 className="font-serif text-2xl">{labels.contact}</h2>
              <form
                className="mt-6 grid gap-4 sm:grid-cols-2"
                onSubmit={submitAddress}
              >
                <Field
                  label={labels.email}
                  required
                  type="email"
                  value={form.email}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, email: value }))
                  }
                />
                <Field
                  label={labels.phone}
                  type="tel"
                  value={form.phone || ""}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, phone: value }))
                  }
                />
                <Field
                  label={labels.firstName}
                  required
                  value={form.first_name}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, first_name: value }))
                  }
                />
                <Field
                  label={labels.lastName}
                  required
                  value={form.last_name}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, last_name: value }))
                  }
                />
                <Field
                  className="sm:col-span-2"
                  label={labels.company}
                  value={form.company || ""}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, company: value }))
                  }
                />
                <Field
                  className="sm:col-span-2"
                  label={labels.address1}
                  required
                  value={form.address_1}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, address_1: value }))
                  }
                />
                <Field
                  className="sm:col-span-2"
                  label={labels.address2}
                  value={form.address_2 || ""}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, address_2: value }))
                  }
                />
                <Field
                  label={labels.city}
                  required
                  value={form.city}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, city: value }))
                  }
                />
                <Field
                  label={labels.postalCode}
                  required
                  value={form.postal_code}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, postal_code: value }))
                  }
                />
                <Field
                  label={labels.province}
                  value={form.province || ""}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, province: value }))
                  }
                />
                <label className="block">
                  <span className="mb-2 block text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                    {labels.country}
                  </span>
                  <select
                    className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
                    required
                    value={form.country_code || defaultCountry}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        country_code: event.target.value,
                      }))
                    }
                  >
                    {countries.map((country) => (
                      <option
                        key={country.iso_2}
                        value={country.iso_2 || ""}
                      >
                        {country.display_name || country.iso_2?.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="sm:col-span-2 mt-2 bg-neutral-950 px-6 py-4 text-xs uppercase tracking-[0.16em] text-white disabled:bg-neutral-400"
                  disabled={cartLoading || !cart}
                  type="submit"
                >
                  {cartLoading ? labels.saving : labels.save}
                </button>
              </form>
              {localError ? (
                <p className="mt-4 text-sm text-red-700">{localError}</p>
              ) : null}
            </section>

            <section className="border border-neutral-200 bg-white p-6 sm:p-8">
              <h2 className="font-serif text-2xl">{labels.shipping}</h2>
              {!addressSaved ? (
                <p className="mt-4 text-sm leading-6 text-neutral-600">
                  {labels.shippingPrompt}
                </p>
              ) : shippingLoading ? (
                <p className="mt-4 text-sm text-neutral-600">
                  {labels.shippingLoading}
                </p>
              ) : shippingOptions.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-600">
                  {labels.shippingNone}
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {shippingOptions.map((option) => {
                    const amount =
                      option.price_type === "calculated"
                        ? calculatedPrices[option.id]
                        : option.amount
                    const formatted = formatMoney(
                      amount,
                      currencyCode,
                      language
                    )
                    const selected = selectedShippingOptionIds.has(option.id)

                    return (
                      <div
                        className="flex items-center justify-between gap-4 border border-neutral-200 p-4"
                        key={option.id}
                      >
                        <div>
                          <p className="text-sm font-medium">{option.name}</p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {formatted || labels.unavailableRate}
                          </p>
                        </div>
                        <button
                          className="border border-neutral-950 px-4 py-2 text-[10px] uppercase tracking-[0.14em] disabled:border-neutral-300 disabled:text-neutral-400"
                          disabled={
                            cartLoading ||
                            (option.price_type === "calculated" && amount == null) ||
                            selected
                          }
                          onClick={() => void addShippingMethod(option.id)}
                          type="button"
                        >
                          {selected ? labels.selected : labels.selectShipping}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <CheckoutPaymentStep language={language} />
          </div>

          <aside className="h-fit border border-neutral-200 bg-white p-6 lg:sticky lg:top-6">
            <h2 className="font-serif text-2xl">{labels.summary}</h2>
            <div className="mt-6 space-y-3 text-sm">
              <SummaryRow label={labels.subtotal} value={summary.subtotal} />
              <SummaryRow label={labels.shippingTotal} value={summary.shipping} />
              <div className="border-t border-neutral-200 pt-4">
                <SummaryRow label={labels.total} strong value={summary.total} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  className = "",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-[10px] uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </span>
      <input
        className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-950"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  )
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string | null
  strong?: boolean
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${
        strong ? "font-medium" : "text-neutral-600"
      }`}
    >
      <span>{label}</span>
      <span>{value || "—"}</span>
    </div>
  )
}
