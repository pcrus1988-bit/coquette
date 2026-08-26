import Link from "next/link"

type StorefrontLanguage = "el" | "en"

const copy = {
  el: {
    eyebrow: "Παραγγελία",
    title: "Η παραγγελία σου καταχωρήθηκε",
    intro:
      "Η COQUETTE παρέλαβε την παραγγελία σου επιτυχώς. Θα ακολουθήσει η συνήθης ενημέρωση παραγγελίας και αποστολής από το κατάστημα.",
    reference: "Αναγνωριστικό παραγγελίας",
    continue: "Συνέχισε τις αγορές",
    note:
      "Κράτησε αυτό το αναγνωριστικό ως τεχνική αναφορά. Δεν εμφανίζουμε στοιχεία παραγγελίας σε αυτή τη δημόσια σελίδα χωρίς επαληθευμένη πρόσβαση πελάτη.",
  },
  en: {
    eyebrow: "Order",
    title: "Your order has been placed",
    intro:
      "COQUETTE received your order successfully. Normal order and delivery updates from the store will follow.",
    reference: "Order identifier",
    continue: "Continue shopping",
    note:
      "Keep this identifier as a technical reference. This public page does not expose order details without verified customer access.",
  },
} satisfies Record<StorefrontLanguage, Record<string, string>>

export function OrderConfirmationPage({
  language,
  orderId,
}: {
  language: StorefrontLanguage
  orderId: string
}) {
  const labels = copy[language]
  const shoppingHref = language === "en" ? "/en/clothing" : "/clothing"

  return (
    <main className="min-h-[60vh] bg-[#f7f5f2] px-5 py-16 text-neutral-950 lg:px-8">
      <section className="mx-auto max-w-3xl border border-neutral-200 bg-white p-8 sm:p-12">
        <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">
          {labels.eyebrow}
        </p>
        <h1 className="mt-4 font-serif text-4xl sm:text-5xl">{labels.title}</h1>
        <p className="mt-6 text-sm leading-7 text-neutral-600">{labels.intro}</p>

        <div className="mt-8 border-y border-neutral-200 py-5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">
            {labels.reference}
          </p>
          <p className="mt-2 break-all font-mono text-sm">{orderId}</p>
        </div>

        <p className="mt-6 text-xs leading-6 text-neutral-500">{labels.note}</p>

        <Link
          className="mt-8 inline-flex bg-neutral-950 px-6 py-4 text-xs uppercase tracking-[0.16em] text-white"
          href={shoppingHref}
        >
          {labels.continue}
        </Link>
      </section>
    </main>
  )
}
