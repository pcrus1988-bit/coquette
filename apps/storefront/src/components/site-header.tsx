import Link from "next/link"
import { primaryNavigation } from "../lib/navigation"

const utilityLinks = [
  { label: "Αναζήτηση", href: "/search" },
  { label: "Λογαριασμός", href: "/account" },
  { label: "Καλάθι", href: "/cart" },
]

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white text-neutral-950">
      <div className="border-b border-neutral-200 bg-neutral-950 px-4 py-2 text-center text-[11px] uppercase tracking-[0.18em] text-white">
        Δωρεάν αποστολή σε αγορές άνω των 100€
      </div>

      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-5 lg:px-8">
        <div className="hidden min-w-40 text-xs text-neutral-600 lg:block">2731 0 20404</div>

        <Link href="/" className="text-center text-2xl font-medium tracking-[0.35em] sm:text-3xl">
          COQUETTE
        </Link>

        <nav aria-label="Utility" className="flex min-w-40 justify-end gap-4 text-xs uppercase tracking-[0.1em]">
          {utilityLinks.map((item) => (
            <Link className="hidden transition-opacity hover:opacity-55 sm:inline" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
          <Link className="transition-opacity hover:opacity-55" href="/en">
            EN
          </Link>
        </nav>
      </div>

      <nav aria-label="Primary" className="border-t border-neutral-100">
        <div className="mx-auto flex max-w-[1440px] gap-7 overflow-x-auto px-5 py-4 text-xs uppercase tracking-[0.14em] lg:justify-center lg:px-8">
          {primaryNavigation.map((item) => (
            <Link className="whitespace-nowrap transition-opacity hover:opacity-55" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}
