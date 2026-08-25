const foundation = [
  "Medusa v2 commerce backend",
  "COQUETTE merchant Admin",
  "Next.js storefront",
  "Dedicated data and integration boundaries",
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-stone-50 px-6 py-16 text-stone-950">
      <section className="mx-auto flex min-h-[70vh] max-w-5xl flex-col justify-between border border-stone-300 bg-white p-8 sm:p-12">
        <div className="flex items-center justify-between border-b border-stone-200 pb-5 text-xs uppercase tracking-[0.22em]">
          <span>COQUETTE CONCEPT</span>
          <span>Core scaffold</span>
        </div>

        <div className="max-w-3xl py-20">
          <p className="mb-5 text-xs uppercase tracking-[0.3em] text-stone-500">
            Independent commerce rebuild
          </p>
          <h1 className="font-serif text-5xl leading-[0.95] sm:text-7xl">
            A clean foundation for the next COQUETTE.
          </h1>
          <p className="mt-8 max-w-2xl text-base leading-7 text-stone-600">
            This is the runnable engineering shell. The approved COQUETTE design system,
            catalogue, content and checkout experience will replace this page incrementally.
          </p>
        </div>

        <ul className="grid gap-px border border-stone-200 bg-stone-200 sm:grid-cols-2">
          {foundation.map((item) => (
            <li className="bg-white p-5 text-sm" key={item}>
              {item}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
