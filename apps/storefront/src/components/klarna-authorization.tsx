"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useCart, type StoreCart } from "../providers/cart"

type StorefrontLanguage = "el" | "en"

type KlarnaResult = {
  show_form?: boolean
  approved?: boolean
  authorization_token?: string
  finalize_required?: boolean
  error?: {
    invalid_fields?: string[]
    [key: string]: unknown
  }
}

type KlarnaPayments = {
  init: (options: { client_token: string }) => void
  load: (
    options: { container: string; payment_method_category: string },
    data: Record<string, unknown>,
    callback: (result: KlarnaResult) => void
  ) => void
  authorize: (
    options: { payment_method_category: string },
    data: Record<string, unknown>,
    callback: (result: KlarnaResult) => void
  ) => void
}

declare global {
  interface Window {
    Klarna?: { Payments: KlarnaPayments }
    klarnaAsyncCallback?: () => void
  }
}

const KLARNA_SCRIPT_SRC = "https://x.klarnacdn.net/kp/lib/v1/api.js"
let klarnaScriptPromise: Promise<void> | null = null

const copy = {
  el: {
    loading: "Φόρτωση ασφαλούς Klarna checkout…",
    unavailable:
      "Η Klarna δεν είναι διαθέσιμη για αυτό το checkout. Επίλεξε άλλο τρόπο πληρωμής.",
    categoryMissing:
      "Η Klarna συνεδρία δεν επέστρεψε διαθέσιμη κατηγορία πληρωμής. Δεν δημιουργήθηκε παραγγελία.",
    authorize: "Πληρωμή με Klarna",
    authorizing: "Έγκριση μέσω Klarna…",
    synchronizing: "Η Klarna ενέκρινε την πληρωμή. Επιβεβαίωση με το COQUETTE backend…",
    declined:
      "Η Klarna δεν ενέκρινε αυτή την πληρωμή. Δεν δημιουργήθηκε παραγγελία και μπορείς να επιλέξεις άλλο τρόπο πληρωμής.",
    invalid:
      "Η Klarna χρειάζεται διόρθωση σε στοιχεία checkout. Έλεγξε τα στοιχεία σου και δοκίμασε ξανά.",
    callbackPending:
      "Η έγκριση ολοκληρώθηκε στη Klarna, αλλά η ασφαλής επιβεβαίωση του backend δεν έχει φτάσει ακόμη. Δεν δημιουργήθηκε παραγγελία. Μπορείς να δοκιμάσεις ξανά σε λίγο.",
    finalizeRequired:
      "Η Klarna ζήτησε επιπλέον βήμα οριστικοποίησης που δεν ενεργοποιείται αυτόματα. Δεν δημιουργήθηκε παραγγελία.",
    completionFailed:
      "Η Klarna εγκρίθηκε, αλλά η Medusa δεν μπόρεσε να δημιουργήσει την παραγγελία. Το καλάθι παραμένει διαθέσιμο.",
    sdkError:
      "Δεν ήταν δυνατή η φόρτωση ή εκτέλεση της Klarna. Δεν δημιουργήθηκε παραγγελία.",
  },
  en: {
    loading: "Loading secure Klarna checkout…",
    unavailable:
      "Klarna is not available for this checkout. Choose another payment method.",
    categoryMissing:
      "The Klarna session did not return an available payment category. No order was created.",
    authorize: "Pay with Klarna",
    authorizing: "Authorizing with Klarna…",
    synchronizing: "Klarna approved the payment. Confirming with the COQUETTE backend…",
    declined:
      "Klarna did not approve this payment. No order was created and you can choose another payment method.",
    invalid:
      "Klarna needs corrected checkout details. Review your information and try again.",
    callbackPending:
      "Klarna approved the payment, but the secure backend confirmation has not arrived yet. No order was created. You can retry shortly.",
    finalizeRequired:
      "Klarna requested an additional finalization step that is not being auto-run. No order was created.",
    completionFailed:
      "Klarna was approved, but Medusa could not create the order. Your cart remains available.",
    sdkError:
      "Klarna could not be loaded or executed. No order was created.",
  },
} satisfies Record<StorefrontLanguage, Record<string, string>>

export function KlarnaAuthorization({
  language,
  clientToken,
  paymentSessionId,
}: {
  language: StorefrontLanguage
  clientToken: string
  paymentSessionId: string
}) {
  const labels = copy[language]
  const router = useRouter()
  const { cart, completeCart, refreshCart } = useCart()
  const containerId = useMemo(
    () => `klarna-payments-container-${paymentSessionId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [paymentSessionId]
  )
  const paymentMethodCategory = useMemo(
    () => klarnaPaymentMethodCategory(cart, paymentSessionId),
    [cart, paymentSessionId]
  )
  const [ready, setReady] = useState(false)
  const [available, setAvailable] = useState(true)
  const [phase, setPhase] = useState<"idle" | "authorizing" | "synchronizing">("idle")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setReady(false)
    setAvailable(true)
    setLocalError(null)

    if (!paymentMethodCategory) {
      setAvailable(false)
      setLocalError(labels.categoryMissing)
      return () => {
        active = false
      }
    }

    loadKlarnaScript()
      .then(() => {
        if (!active || !window.Klarna?.Payments) {
          return
        }

        window.Klarna.Payments.init({ client_token: clientToken })
        window.Klarna.Payments.load(
          {
            container: `#${containerId}`,
            payment_method_category: paymentMethodCategory,
          },
          {},
          (result) => {
            if (!active) {
              return
            }
            const canShow = result.show_form !== false
            setAvailable(canShow)
            setReady(canShow)
            if (!canShow) {
              setLocalError(labels.unavailable)
            }
          }
        )
      })
      .catch((reason) => {
        console.error("COQUETTE Klarna SDK loading failed", reason)
        if (active) {
          setAvailable(false)
          setLocalError(labels.sdkError)
        }
      })

    return () => {
      active = false
    }
  }, [
    clientToken,
    containerId,
    paymentMethodCategory,
    labels.categoryMissing,
    labels.sdkError,
    labels.unavailable,
  ])

  const authorize = () => {
    if (
      !ready ||
      !available ||
      !cart ||
      !paymentMethodCategory ||
      !window.Klarna?.Payments ||
      phase !== "idle"
    ) {
      return
    }

    setPhase("authorizing")
    setLocalError(null)

    // Keep this SDK invocation directly inside the customer click handler. Klarna
    // may open a purchase-flow window and browsers can block it after async gaps.
    try {
      window.Klarna.Payments.authorize(
        { payment_method_category: paymentMethodCategory },
        {},
        (result) => {
          if (result.finalize_required) {
            setPhase("idle")
            setLocalError(labels.finalizeRequired)
            return
          }

          if (!result.approved) {
            setPhase("idle")
            const hasInvalidFields = Boolean(result.error?.invalid_fields?.length)
            setLocalError(hasInvalidFields ? labels.invalid : labels.declined)
            return
          }

          // The browser token is deliberately not persisted by the storefront.
          // Klarna's signed server authorization callback is authoritative.
          setPhase("synchronizing")
          void finishAfterServerAuthorization()
        }
      )
    } catch (reason) {
      console.error("COQUETTE Klarna authorization failed", reason)
      setPhase("idle")
      setLocalError(labels.sdkError)
    }
  }

  const finishAfterServerAuthorization = async () => {
    try {
      const authorizedCart = await waitForServerAuthorization({
        paymentSessionId,
        refreshCart,
      })

      if (!authorizedCart) {
        setLocalError(labels.callbackPending)
        return
      }

      const result = await completeCart()
      if (result.type !== "order") {
        setLocalError(result.error?.message || labels.completionFailed)
        return
      }

      const confirmationPath = language === "en"
        ? `/en/order-confirmation/${result.order.id}`
        : `/order-confirmation/${result.order.id}`
      router.replace(confirmationPath)
    } catch (reason) {
      console.error("COQUETTE Klarna order completion failed", reason)
      setLocalError(labels.completionFailed)
    } finally {
      setPhase("idle")
    }
  }

  return (
    <div className="mt-4">
      <div
        aria-hidden={!available}
        className={available ? "block" : "hidden"}
        id={containerId}
      />

      {!ready && available ? (
        <p className="mt-3 text-sm leading-6 text-neutral-600">{labels.loading}</p>
      ) : null}

      {ready && available ? (
        <button
          className="mt-4 w-full bg-neutral-950 px-6 py-4 text-xs uppercase tracking-[0.16em] text-white disabled:bg-neutral-400"
          disabled={phase !== "idle"}
          onClick={authorize}
          type="button"
        >
          {phase === "authorizing"
            ? labels.authorizing
            : phase === "synchronizing"
              ? labels.synchronizing
              : labels.authorize}
        </button>
      ) : null}

      {localError ? (
        <p className="mt-3 text-sm leading-6 text-red-700">{localError}</p>
      ) : null}
    </div>
  )
}

async function waitForServerAuthorization({
  paymentSessionId,
  refreshCart,
}: {
  paymentSessionId: string
  refreshCart: () => Promise<StoreCart | undefined>
}) {
  // The browser callback is a UX signal only. Give Klarna's mandatory server
  // callback a bounded synchronization window, while preserving the cart if it
  // arrives later or not at all.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const refreshed = await refreshCart()
    const session = refreshed?.payment_collection?.payment_sessions?.find(
      (candidate) => candidate.id === paymentSessionId
    )
    const data = session?.data as Record<string, unknown> | undefined

    if (typeof data?.authorization_token === "string" && data.authorization_token) {
      return refreshed
    }

    await delay(500)
  }

  return undefined
}

function klarnaPaymentMethodCategory(
  cart: StoreCart | undefined,
  paymentSessionId: string
) {
  const session = cart?.payment_collection?.payment_sessions?.find(
    (candidate) => candidate.id === paymentSessionId
  )
  const data = session?.data as Record<string, unknown> | undefined
  const categories = data?.payment_method_categories

  if (!Array.isArray(categories)) {
    return null
  }

  const identifiers = categories
    .map((category) => {
      if (!category || typeof category !== "object") {
        return null
      }
      const identifier = (category as Record<string, unknown>).identifier
      return typeof identifier === "string" && identifier ? identifier : null
    })
    .filter((identifier): identifier is string => Boolean(identifier))

  return identifiers.find((identifier) => identifier === "klarna") || identifiers[0] || null
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function loadKlarnaScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Klarna SDK requires a browser"))
  }

  if (window.Klarna?.Payments) {
    return Promise.resolve()
  }

  if (klarnaScriptPromise) {
    return klarnaScriptPromise
  }

  klarnaScriptPromise = new Promise<void>((resolve, reject) => {
    const previousCallback = window.klarnaAsyncCallback
    window.klarnaAsyncCallback = () => {
      previousCallback?.()
      if (window.Klarna?.Payments) {
        resolve()
      } else {
        reject(new Error("Klarna SDK loaded without Payments API"))
      }
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${KLARNA_SCRIPT_SRC}"]`
    )
    if (existing) {
      existing.addEventListener("error", () => reject(new Error("Klarna SDK failed to load")), {
        once: true,
      })
      return
    }

    const script = document.createElement("script")
    script.src = KLARNA_SCRIPT_SRC
    script.async = true
    script.addEventListener("error", () => reject(new Error("Klarna SDK failed to load")), {
      once: true,
    })
    document.body.appendChild(script)
  })

  return klarnaScriptPromise
}
