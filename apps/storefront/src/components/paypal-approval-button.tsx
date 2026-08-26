"use client"

import {
  PayPalOneTimePaymentButton,
  PayPalProvider,
  type OnApproveDataOneTimePayments,
  type OnErrorData,
} from "@paypal/react-paypal-js/sdk-v6"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useCart } from "../providers/cart"

type StorefrontLanguage = "el" | "en"

const copy = {
  el: {
    missingClientId:
      "Το PayPal δεν είναι ακόμη συνδεδεμένο στο storefront. Απαιτείται το δημόσιο PayPal Client ID του COQUETTE staging περιβάλλοντος.",
    processing: "Ολοκλήρωση παραγγελίας…",
    cancelled:
      "Η πληρωμή μέσω PayPal ακυρώθηκε. Δεν δημιουργήθηκε παραγγελία και το καλάθι σου παραμένει διαθέσιμο.",
    approvalMismatch:
      "Η έγκριση PayPal δεν αντιστοιχεί στη συνεδρία πληρωμής αυτού του checkout.",
    completionFailed:
      "Η PayPal έγκριση ολοκληρώθηκε, αλλά η παραγγελία δεν δημιουργήθηκε. Η Medusa επανέφερε την πληρωμή όπου απαιτείται. Μπορείς να δοκιμάσεις ξανά.",
    providerError:
      "Παρουσιάστηκε σφάλμα στο PayPal. Δεν ολοκληρώθηκε παραγγελία.",
  },
  en: {
    missingClientId:
      "PayPal is not connected to the storefront yet. The public PayPal Client ID for the COQUETTE staging environment is required.",
    processing: "Completing order…",
    cancelled:
      "PayPal checkout was cancelled. No order was created and your cart remains available.",
    approvalMismatch:
      "The PayPal approval does not match this checkout payment session.",
    completionFailed:
      "PayPal approval completed, but the order was not created. Medusa reverted the payment where required. You can try again.",
    providerError:
      "PayPal returned an error. No order was completed.",
  },
} satisfies Record<StorefrontLanguage, Record<string, string>>

const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ""
const paypalEnvironment =
  process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT === "production"
    ? "production"
    : "sandbox"

export function PayPalApprovalButton({
  language,
  orderId,
}: {
  language: StorefrontLanguage
  orderId: string
}) {
  const labels = copy[language]
  const router = useRouter()
  const { completeCart } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  if (!paypalClientId) {
    return (
      <p className="mt-4 text-sm leading-6 text-amber-800">
        {labels.missingClientId}
      </p>
    )
  }

  const handleApprove = async (data: OnApproveDataOneTimePayments) => {
    setSubmitting(true)
    setLocalError(null)

    try {
      if (data.orderId !== orderId) {
        throw new Error(labels.approvalMismatch)
      }

      const result = await completeCart()
      if (result.type !== "order" || !result.order) {
        setLocalError(result.error?.message || labels.completionFailed)
        return
      }

      const confirmationPath = language === "en"
        ? `/en/order-confirmation/${result.order.id}`
        : `/order-confirmation/${result.order.id}`
      router.replace(confirmationPath)
    } catch (reason) {
      console.error("COQUETTE PayPal approval completion failed", reason)
      setLocalError(
        reason instanceof Error && reason.message
          ? reason.message
          : labels.completionFailed
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleError = (error: OnErrorData) => {
    console.error("COQUETTE PayPal browser approval failed", error)
    setSubmitting(false)
    setLocalError(error.message || labels.providerError)
  }

  if (submitting) {
    return (
      <div className="mt-4 border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
        {labels.processing}
      </div>
    )
  }

  return (
    <div className="mt-4">
      <PayPalProvider
        clientId={paypalClientId}
        components={["paypal-payments"]}
        environment={paypalEnvironment}
        pageType="checkout"
      >
        <PayPalOneTimePaymentButton
          onApprove={handleApprove}
          onCancel={() => {
            setSubmitting(false)
            setLocalError(labels.cancelled)
          }}
          onError={handleError}
          orderId={orderId}
          presentationMode="auto"
        />
      </PayPalProvider>

      {localError ? (
        <p className="mt-3 text-sm leading-6 text-red-700">{localError}</p>
      ) : null}
    </div>
  )
}
