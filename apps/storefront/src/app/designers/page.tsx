import Link from "next/link"
import { designerNames } from "../../lib/navigation"

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export default function DesignersPage() {
  return (
    <main className="bg-[#f7f5f2] px-5 py-16 text-neutral-950 lg:px-8">
      <section className="mx-auto max-w-[1440px]">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Designer directory</p>
        <h1 className="mt-3 font-serif text-5xl sm:text-6xl">Σχεδιαστές</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-neutral-600">
          Το designer portfolio της σημερινής Magento εμπειρίας διατηρείται ως first-class catalogue dimension στη νέα πλατφόρμα.
        </p>
        <div className="mt-12 grid border-l border-t border-neutral-300 sm:grid-cols-2 lg:grid-cols-4">
          {designerNames.map((name) => (
            <Link
              className="border-b border-r border-neutral-300 bg-white p-6 text-sm transition-colors hover:bg-neutral-950 hover:text-white"
              href={`/designers/${slugify(name)}`}
              key={name}
            >
              {name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
