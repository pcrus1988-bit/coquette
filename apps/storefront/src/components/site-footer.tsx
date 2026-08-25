import Link from "next/link"

const serviceItems = [
  ["ΔΩΡΕΑΝ ΜΕΤΑΦΟΡΙΚΑ", "Για αγορές άνω των €100"],
  ["ΕΠΙΣΤΡΟΦΗ ΕΩΣ 14 ΗΜΕΡΕΣ", "Εύκολη διαδικασία επιστροφής"],
  ["100% ΑΣΦΑΛΕΙΣ ΑΓΟΡΕΣ", "Ασφαλείς πληρωμές"],
  ["ΕΞΥΠΗΡΕΤΗΣΗ ΠΕΛΑΤΩΝ", "2731 0 20404"],
]

export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white text-neutral-900">
      <section className="mx-auto grid max-w-[1440px] divide-y divide-neutral-200 border-x border-neutral-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {serviceItems.map(([title, body]) => (
          <div className="p-6 text-center" key={title}>
            <p className="text-xs font-medium tracking-[0.14em]">{title}</p>
            <p className="mt-2 text-sm text-neutral-500">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <p className="text-lg tracking-[0.28em]">COQUETTE</p>
          <p className="mt-5 max-w-xs text-sm leading-6 text-neutral-500">
            Unique & stylish fashion, selected in Sparta and available online.
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em]">Coquette</p>
          <div className="mt-5 flex flex-col gap-3 text-sm text-neutral-600">
            <Link href="/our-story">Σχετικά με εμάς</Link>
            <Link href="/contact">Επικοινωνία</Link>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em]">Εξυπηρέτηση πελατών</p>
          <div className="mt-5 flex flex-col gap-3 text-sm text-neutral-600">
            <Link href="/shipping">Αποστολές</Link>
            <Link href="/payments">Τρόποι πληρωμής</Link>
            <Link href="/terms">Όροι & Προϋποθέσεις</Link>
            <Link href="/privacy">Πολιτική Απορρήτου</Link>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em]">Επικοινωνία</p>
          <div className="mt-5 space-y-2 text-sm leading-6 text-neutral-600">
            <p>Βρασίδου 119, ΤΚ 23100</p>
            <p>Αρχαία Σπάρτη</p>
            <p>2731 0 20404</p>
          </div>
        </div>
      </section>
    </footer>
  )
}
