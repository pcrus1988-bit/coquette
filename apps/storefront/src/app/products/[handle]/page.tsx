export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const title = handle.replace(/-/g, " ").toUpperCase()

  return (
    <main className="bg-[#f7f5f2] text-neutral-950">
      <section className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 lg:grid-cols-[1.15fr_.85fr] lg:px-8">
        <div className="grid grid-cols-2 gap-3">
          <div className="aspect-[3/4] bg-neutral-200" />
          <div className="aspect-[3/4] bg-neutral-100" />
          <div className="aspect-[3/4] bg-neutral-100" />
          <div className="aspect-[3/4] bg-neutral-200" />
        </div>
        <div className="lg:sticky lg:top-8 lg:self-start">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Designer · migration pending</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 text-xl">— €</p>
          <div className="mt-9 border-y border-neutral-300 py-6">
            <p className="text-xs uppercase tracking-[0.14em]">Μέγεθος</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["XS", "S", "M", "L", "Onesize"].map((size) => (
                <button className="min-w-12 border border-neutral-300 px-3 py-2 text-xs" key={size} type="button">{size}</button>
              ))}
            </div>
          </div>
          <button className="mt-6 w-full bg-neutral-950 px-6 py-4 text-xs uppercase tracking-[0.18em] text-white" type="button" disabled>
            Προσθήκη στο Καλάθι · σύνδεση catalogue pending
          </button>
          <button className="mt-3 w-full border border-neutral-300 px-6 py-4 text-xs uppercase tracking-[0.14em]" type="button">
            Προσθήκη στη Λίστα Επιθυμιών
          </button>
          <div className="mt-8 space-y-4 text-sm leading-6 text-neutral-600">
            <details className="border-t border-neutral-300 py-4"><summary className="cursor-pointer text-xs uppercase tracking-[0.14em] text-neutral-950">Περιγραφή</summary><p className="pt-4">Το πραγματικό Magento product content θα μεταφερθεί στο Medusa catalogue.</p></details>
            <details className="border-t border-neutral-300 py-4"><summary className="cursor-pointer text-xs uppercase tracking-[0.14em] text-neutral-950">Αποστολές & Επιστροφές</summary><p className="pt-4">Δωρεάν μεταφορικά άνω των €100 και επιστροφές έως 14 ημέρες.</p></details>
          </div>
        </div>
      </section>
    </main>
  )
}
