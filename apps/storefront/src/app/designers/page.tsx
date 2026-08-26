import Link from "next/link"
import { getBrands } from "../../lib/brands"
import { designerNames } from "../../lib/navigation"

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export default async function DesignersPage() {
  const result = await getBrands()
  const designers =
    result.state === "ready"
      ? result.brands.map((brand) => ({
          name: brand.name,
          handle: brand.handle,
        }))
      : designerNames.map((name) => ({
          name,
          handle: slugify(name),
        }))

  return (
    <main className="bg-[#f7f5f2] px-5 py-16 text-neutral-950 lg:px-8">
      <section className="mx-auto max-w-[1440px]">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
          Designer directory
        </p>
        <h1 className="mt-3 font-serif text-5xl sm:text-6xl">Σχεδιαστές</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-neutral-600">
          Το designer portfolio αποτελεί first-class catalogue dimension στο νέο
          COQUETTE. Όταν το staging Brand catalogue είναι συνδεδεμένο, αυτή η λίστα
          προέρχεται απευθείας από το Medusa backend.
        </p>

        {result.state === "ready" && designers.length === 0 ? (
          <div className="mt-12 border border-neutral-300 bg-white p-8 text-sm text-neutral-600">
            Δεν έχουν μεταφερθεί ακόμη Designer/Brand records στο Medusa catalogue.
          </div>
        ) : (
          <div className="mt-12 grid border-l border-t border-neutral-300 sm:grid-cols-2 lg:grid-cols-4">
            {designers.map((designer) => (
              <Link
                className="border-b border-r border-neutral-300 bg-white p-6 text-sm transition-colors hover:bg-neutral-950 hover:text-white"
                href={`/designers/${designer.handle}`}
                key={designer.handle}
              >
                {designer.name}
              </Link>
            ))}
          </div>
        )}

        {result.state !== "ready" ? (
          <p className="mt-6 text-xs leading-5 text-neutral-500">
            Προσωρινά εμφανίζεται το audited designer navigation set μέχρι να
            συνδεθεί το dedicated COQUETTE staging backend. Δεν χρησιμοποιείται ως
            authoritative migration source.
          </p>
        ) : null}
      </section>
    </main>
  )
}
