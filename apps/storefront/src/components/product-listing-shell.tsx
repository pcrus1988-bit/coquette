import Link from "next/link"

type ProductListingShellProps = {
  eyebrow: string
  title: string
  description?: string
}

const filterGroups = ["Τιμή", "Σχεδιαστής", "Χρώμα", "Μέγεθος"]

export function ProductListingShell({ eyebrow, title, description }: ProductListingShellProps) {
  return (
    <main className="bg-[#f7f5f2] text-neutral-950">
      <header className="mx-auto max-w-[1440px] px-5 pb-12 pt-16 lg:px-8">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">{eyebrow}</p>
        <div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h1 className="font-serif text-5xl sm:text-6xl">{title}</h1>
            {description ? <p className="mt-5 max-w-2xl text-sm leading-7 text-neutral-600">{description}</p> : null}
          </div>
          <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">0 προϊόντα · αναμονή migration</p>
        </div>
      </header>

      <section className="border-y border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 overflow-x-auto px-5 py-4 lg:px-8">
          <div className="flex gap-2">
            {filterGroups.map((filter) => (
              <button className="whitespace-nowrap border border-neutral-300 px-4 py-2 text-[11px] uppercase tracking-[0.12em]" key={filter} type="button">
                {filter} +
              </button>
            ))}
          </div>
          <button className="whitespace-nowrap text-[11px] uppercase tracking-[0.12em]" type="button">Ταξινόμηση ▾</button>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-14 lg:px-8">
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <article key={index}>
              <div className="aspect-[3/4] animate-pulse bg-neutral-200" />
              <div className="mt-4 h-3 w-2/3 bg-neutral-200" />
              <div className="mt-3 h-3 w-1/3 bg-neutral-200" />
            </article>
          ))}
        </div>
        <div className="mt-14 border-t border-neutral-200 pt-8 text-center">
          <p className="text-sm text-neutral-500">Τα προϊόντα θα συνδεθούν με το Medusa catalogue κατά τη migration phase.</p>
          <Link className="mt-4 inline-block text-xs uppercase tracking-[0.14em] underline underline-offset-4" href="/">Επιστροφή στην αρχική</Link>
        </div>
      </section>
    </main>
  )
}
