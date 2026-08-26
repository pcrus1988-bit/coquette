"use client"

import { useEffect, useMemo, useState } from "react"
import {
  buildKlarnaPaymentSessionData,
  KlarnaCartPayloadError,
} from "../lib/klarna"
import { medusa } from "../lib/medusa"
import { useCart } from "../providers/cart"
import { KlarnaAuthorization } from "./klarna-authorization"
import { PayPalApprovalButton } from "./paypal-approval-button"

type StorefrontLanguage = "el" | "en"
type PaymentProvidersResponse = Awaited<
  ReturnType<typeof medusa.store.payment.listPaymentProviders>
>
type PaymentProvider = PaymentProvidersResponse["payment_providers"][number]

const allowManualPayment =
  process.env.NEXT_PUBLIC_ALLOW_MANUAL_PAYMENT === "true"

const copy = {
  el: {
    title: "Πληρωμή",
    beforeShipping:
      "Επίλεξε πρώτα έγκυρη διεύθυνση και τρόπο αποστολής για να εμφανιστούν οι διαθέσιμοι τρόποι πληρωμής.",
    loading: "Έλεγχος διαθέσιμων τρόπων πληρωμής…",
    none: "Δεν υπάρχει ενεργός online τρόπος πληρωμής για αυτή την περιοχή ακόμη.",
    choose: "Επίλεξε τρόπο πληρωμής",
    initialize: "Συνέχεια με αυτόν τον τρόπο πληρωμής",
    initializing: "Προετοιμασία πληρωμής…",
    ready:
      "Η συνεδρία πληρωμής δημιουργήθηκε στο Medusa και είναι έτοιμη για το provider-specific βήμα.",
    paypalReady:
      "Η PayPal παραγγελία δημιουργήθηκε από το COQUETTE backend. Συνέχισε με το ασφαλές PayPal παράθυρο για έγκριση και η Medusa θα δημιουργήσει την παραγγελία μόνο μετά από επιτυχημένη έγκριση.",
    paypalOrderMissing:
      "Η PayPal συνεδρία δεν περιέχει έγκυρο PayPal order ID. Επανεκκίνησε τον τρόπο πληρωμής πριν συνεχίσεις.",
    klarnaReady:
      "Η Klarna συνεδρία δημιουργήθηκε από το COQUETTE backend. Η τελική έγκριση γίνεται μέσω του ασφαλούς Klarna widget και η παραγγελία δημιουργείται μόνο αφού επιβεβαιωθεί και το server callback.",
    klarnaTokenMissing:
      "Η Klarna συνεδρία δεν περιέχει έγκυρο client token. Επανεκκίνησε τον τρόπο πληρωμής πριν συνεχίσεις.",
    klarnaPayloadError:
      "Το checkout περιέχει σύνολο, φόρο ή έκπτωση που δεν μπορεί ακόμη να χαρτογραφηθεί με ασφάλεια στη Klarna. Δεν έγινε καμία πληρωμή.",
    providerUiPending:
      "Το provider-specific βήμα για αυτόν τον τρόπο πληρωμής δεν είναι ενεργό ακόμη. Δεν θα ολοκληρωθεί παραγγελία ούτε θα χρεωθεί ποσό από αυτή την οθόνη.",
    zeroTotal:
      "Δεν δημιουργείται online payment session για checkout με μηδενικό σύνολο.",
    error:
      "Δεν ήταν δυνατή η προετοιμασία του τρόπου πληρωμής. Δοκίμασε ξανά ή επίλεξε άλλον provider.",
    selected: "Επιλεγμένο",
  },
  en: {
    title: "Payment",
    beforeShipping:
      "Save a valid address and select a delivery method first to see the available payment methods.",
    loading: "Checking available payment methods…",
    none: "No live online payment method is enabled for this region yet.",
    choose: "Choose a payment method",
    initialize: "Continue with this payment method",
    initializing: "Preparing payment…",
    ready:
      "The Medusa payment session is initialized and ready for the provider-specific step.",
    paypalReady:
      "The PayPal order was created by the COQUETTE backend. Continue in the secure PayPal flow for approval; Medusa creates the order only after successful approval.",
    paypalOrderMissing:
      "The PayPal session does not contain a valid PayPal order ID. Re-initialize the payment method before continuing.",
    klarnaReady:
      "The Klarna session was created by the COQUETTE backend. Final approval runs through the secure Klarna widget and the order is created only after the server callback is confirmed as well.",
    klarnaTokenMissing:
      "The Klarna session does not contain a valid client token. Re-initialize the payment method before continuing.",
    klarnaPayloadError:
      "This checkout contains a total, tax, or discount component that cannot yet be mapped safely to Klarna. No payment was attempted.",
    providerUiPending:
      "The provider-specific authorization/redirect step for this method is not active yet. This screen cannot complete an order or charge the customer.",
    zeroTotal:
      "An online payment session is not initialized for a zero-total checkout.",
    error:
      "The payment method could not be prepared. Try again or select another provider.",
    selected: "Selected",
  },
} satisfies Record<StorefrontLanguage, Record<string, string>>

function isManualProvider(providerId: string) {
  return providerId.startsWith("pp_system_default")
}

function isPayPalProvider(providerId: string) {
  return providerId.toLowerCase().includes("paypal")
}

function isKlarnaProvider(providerId: string) {
  return providerId.toLowerCase().includes("klarna")
}

function paymentProviderTitle(providerId: string) {
  const normalized = providerId.toLowerCase()

  if (normalized.includes("paypal")) {
    return "PayPal"
  }

  if (normalized.includes("klarna")) {
    return "Klarna"
  }

  if (
    normalized.includes("card") ||
    normalized.includes("stripe") ||
    normalized.includes("viva")
  ) {
    return "Card"
  }

  if (isManualProvider(providerId)) {
    return "Manual payment"
  }

  return providerId
    .replace(/^pp_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function paymentDataString(data: unknown, key: string) {
  if (!data || typeof data !== "object") {
    return null
  }

  const value = (data as Record<string, unknown>)[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function payPalOrderId(data: unknown) {
  if (!data || typeof data !== "object") {
    return null
  }

  const paymentData = data as Record<string, unknown>
  const value = paymentData.order_id || paymentData.orderId || paymentData.id
  return typeof value === "string" && value.length > 0 ? value : null
}

export function CheckoutPaymentStep({
  language = "el",
}: {
  language?: StorefrontLanguage
}) {
  const labels = copy[language]
  const { cart, loading: cartLoading, initiatePaymentSession } = useCart()
  const [paymentProviders, setPaymentProviders] = useState<PaymentProvider[]>([])
  const [providersLoading, setProvidersLoading] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  const hasAddress = Boolean(cart?.shipping_address?.address_1)
  const hasShippingMethod = (cart?.shipping_methods?.length ?? 0) > 0
  const total = Number(cart?.total ?? 0)
  const paymentEligible = hasAddress && hasShippingMethod && total > 0

  const activeSession = useMemo(
    () => cart?.payment_collection?.payment_sessions?.[0],
    [cart?.payment_collection?.payment_sessions]
  )

  useEffect(() => {
    if (activeSession?.provider_id) {
      setSelectedProviderId(activeSession.provider_id)
    }
  }, [activeSession?.provider_id])

  useEffect(() => {
    if (!cart?.region_id || !hasAddress || !hasShippingMethod) {
      setPaymentProviders([])
      return
    }

    let active = true
    setProvidersLoading(true)
    setLocalError(null)

    medusa.store.payment
      .listPaymentProviders({ region_id: cart.region_id })
      .then(({ payment_providers }) => {
        if (!active) {
          return
        }

        const customerFacing = payment_providers.filter(
          (provider) => allowManualPayment || !isManualProvider(provider.id)
        )
        setPaymentProviders(customerFacing)

        if (
          activeSession?.provider_id &&
          customerFacing.some(
            (provider) => provider.id === activeSession.provider_id
          )
        ) {
          setSelectedProviderId(activeSession.provider_id)
        } else if (customerFacing.length === 1) {
          setSelectedProviderId(customerFacing[0].id)
        }
      })
      .catch((reason) => {
        if (!active) {
          return
        }
        console.error("COQUETTE payment-provider discovery failed", reason)
        setPaymentProviders([])
        setLocalError(labels.error)
      })
      .finally(() => {
        if (active) {
          setProvidersLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [
    cart?.region_id,
    hasAddress,
    hasShippingMethod,
    activeSession?.provider_id,
    labels.error,
  ])

  const initialize = async () => {
    if (!selectedProviderId || !paymentEligible || !cart) {
      return
    }

    setLocalError(null)
    try {
      const data = isKlarnaProvider(selectedProviderId)
        ? buildKlarnaPaymentSessionData(cart, language)
        : undefined

      await initiatePaymentSession({
        provider_id: selectedProviderId,
        ...(data ? { data } : {}),
      })
    } catch (reason) {
      console.error("COQUETTE payment-session step failed", reason)
      setLocalError(
        reason instanceof KlarnaCartPayloadError
          ? labels.klarnaPayloadError
          : labels.error
      )
    }
  }

  const activePayPalOrderId = activeSession && isPayPalProvider(activeSession.provider_id)
    ? payPalOrderId(activeSession.data)
    : null
  const activeKlarnaClientToken = activeSession && isKlarnaProvider(activeSession.provider_id)
    ? paymentDataString(activeSession.data, "client_token")
    : null

  return (
    <section className="border border-neutral-200 bg-white p-6 sm:p-8">
      <h2 className="font-serif text-2xl">{labels.title}</h2>

      {!hasAddress || !hasShippingMethod ? (
        <p className="mt-4 text-sm leading-6 text-neutral-600">
          {labels.beforeShipping}
        </p>
      ) : total <= 0 ? (
        <p className="mt-4 text-sm leading-6 text-neutral-600">
          {labels.zeroTotal}
        </p>
      ) : providersLoading ? (
        <p className="mt-4 text-sm text-neutral-600">{labels.loading}</p>
      ) : paymentProviders.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-neutral-600">{labels.none}</p>
      ) : (
        <div className="mt-5 space-y-4">
          <fieldset>
            <legend className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
              {labels.choose}
            </legend>
            <div className="mt-3 space-y-2">
              {paymentProviders.map((provider) => {
                const selected = selectedProviderId === provider.id
                const activeProvider = activeSession?.provider_id === provider.id

                return (
                  <label
                    className={`flex cursor-pointer items-center justify-between gap-4 border p-4 ${
                      selected ? "border-neutral-950" : "border-neutral-200"
                    }`}
                    key={provider.id}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        checked={selected}
                        disabled={cartLoading}
                        name="payment-provider"
                        onChange={() => setSelectedProviderId(provider.id)}
                        type="radio"
                        value={provider.id}
                      />
                      <span className="text-sm">
                        {paymentProviderTitle(provider.id)}
                      </span>
                    </span>
                    {activeProvider ? (
                      <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                        {labels.selected}
                      </span>
                    ) : null}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <button
            className="w-full bg-neutral-950 px-6 py-4 text-xs uppercase tracking-[0.16em] text-white disabled:bg-neutral-400"
            disabled={cartLoading || !selectedProviderId || !paymentEligible}
            onClick={() => void initialize()}
            type="button"
          >
            {cartLoading ? labels.initializing : labels.initialize}
          </button>

          {activeSession ? (
            <div className="border border-neutral-200 bg-[#f7f5f2] p-4">
              <p className="text-sm leading-6 text-neutral-700">
                {isPayPalProvider(activeSession.provider_id)
                  ? labels.paypalReady
                  : isKlarnaProvider(activeSession.provider_id)
                    ? labels.klarnaReady
                    : labels.ready}
              </p>

              {isPayPalProvider(activeSession.provider_id) ? (
                activePayPalOrderId ? (
                  <PayPalApprovalButton
                    language={language}
                    orderId={activePayPalOrderId}
                  />
                ) : (
                  <p className="mt-3 text-sm leading-6 text-red-700">
                    {labels.paypalOrderMissing}
                  </p>
                )
              ) : isKlarnaProvider(activeSession.provider_id) ? (
                activeKlarnaClientToken ? (
                  <KlarnaAuthorization
                    clientToken={activeKlarnaClientToken}
                    language={language}
                    paymentSessionId={activeSession.id}
                  />
                ) : (
                  <p className="mt-3 text-sm leading-6 text-red-700">
                    {labels.klarnaTokenMissing}
                  </p>
                )
              ) : (
                <p className="mt-2 text-xs leading-5 text-neutral-500">
                  {paymentProviderTitle(activeSession.provider_id)} · {labels.providerUiPending}
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {localError ? (
        <p className="mt-4 text-sm text-red-700">{localError}</p>
      ) : null}
    </section>
  )
}
