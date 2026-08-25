import Link from "next/link"

const categoryCards = [
  { title: "Φορέματα", href: "/clothing/dresses", note: "Dresses" },
  { title: "Νέες Παραλαβές", href: "/clothing/new-arrivals", note: "New in" },
  { title: "Αξεσουάρ", href: "/accessories", note: "Accessories" },
]

const arrivalPlaceholders = [
  { name: "SYLIA MINI DRESS", price: "139,00 €", badge: "ΝΕΟ" },
  { name: "SUNKISSED BACKLESS DRESS", price: "169,00 €", badge: "ΝΕΟ" },
  { name: "KISS OF LIFE SHOULDER BAG", price: "183,00 €", badge: "ΝΕΟ" },
  { name: "IRIS BIKINI", price: "65,10 €", badge: "SALE" },
]

export default function HomePage() {
  return (
    <main className="bg-[#f7f5f2] text-neutral-950">
      <section className="mx-auto grid min-h-[68vh] max-w-[1440px] lg:grid-cols-[1.05fr_.95fr]">
        <div className="flex flex-col justify-center px-7 py-20 sm:px-12 lg:px-16">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Coquette Concept · Sparta</p>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl leading-[0.95] sm:text-7xl lg:text-8xl">
            Style that speaks before you do.
          </h1>
          <p className="mt-8 max-w-xl text-base leading-7 text-neutral-600">
            Επιλεγμένα κομμάτια από αγαπημένους designers, με την αισθητική και την προσωπική
            εξυπηρέτηση του Coquette Concept.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link className="bg-neutral-950 px-7 py-4 text-xs uppercase tracking-[0.18em] text-white" href="/clothing/new-arrivals">
              Νέες Παραλαβές
            </Link>
            <Link className="border border-neutral-950 px-7 py-4 text-xs uppercase tracking-[0.18em]" href="/designers">
              Designers
            </Link>
          </div>
        </div>
        <div className="min-h-[480px] bg-[linear-gradient(145deg,#d9cbc2_0%,#f2ece7_38%,#bba89e_100%)] p-8">
          <div className="flex h-full items-end border border-white/60 p-7">
            <p className="max-w-xs font-serif text-3xl leading-tight text-white">The COQUETTE edit — refined, expressive, distinctly yours.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-20 lg:px-8">
        <div className="mb-9 flex items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Shop the edit</p>
            <h2 className="mt-3 font-serif text-4xl sm:text-5xl">Ανακάλυψε το στυλ σου</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {categoryCards.map((item, index) => (
            <Link
              className="group flex aspect-[4/5] flex-col justify-between border border-neutral-200 bg-white p-7 transition-transform duration-300 hover:-translate-y-1"
              href={item.href}
              key={item.href}
            >
              <span className="text-xs uppercase tracking-[0.2em] text-neutral-400">0{index + 1} · {item.note}</span>
              <div>
                <h3 className="font-serif text-4xl">{item.title}</h3>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-neutral-500 group-hover:text-neutral-950">Ανακάλυψε →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-white">
        <div className="mx-auto max-w-[1440px] px-5 py-20 lg:px-8">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">New arrivals</p>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl">Μόλις έφτασαν</h2>
            </div>
            <Link className="text-xs uppercase tracking-[0.14em] underline underline-offset-4" href="/clothing/new-arrivals">Όλα τα νέα</Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {arrivalPlaceholders.map((product, index) => (
              <article key={product.name}>
                <div className="relative aspect-[3/4] bg-[linear-gradient(145deg,#ebe7e2,#d5cec8)]">
                  <span className="absolute left-3 top-3 bg-white px-2 py-1 text-[10px] tracking-[0.15em]">{product.badge}</span>
                  <span className="absolute bottom-4 right-4 text-5xl font-serif text-white/80">0{index + 1}</span>
                </div>
                <h3 className="mt-4 text-xs font-medium tracking-[0.08em]">{product.name}</h3>
                <p className="mt-2 text-sm text-neutral-600">{product.price}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] lg:grid-cols-2">
        <div className="min-h-[430px] bg-[linear-gradient(135deg,#cdbbb0,#efe7df)]" />
        <div className="flex flex-col justify-center bg-neutral-950 px-8 py-16 text-white sm:px-14 lg:px-16">
          <p className="text-xs uppercase tracking-[0.25em] text-white/55">Since 2018</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight sm:text-5xl">Μία εμπειρία που μιλάει στην καρδιά.</h2>
          <p className="mt-6 max-w-xl text-sm leading-7 text-white/70">
            Το Coquette Concept γεννήθηκε στη Σπάρτη από αγάπη για τη μόδα, την αυθεντικότητα και την προσωπική έκφραση. Το νέο e-shop κρατά αυτή την ταυτότητα και την κάνει ταχύτερη, καθαρότερη και πιο εύκολη στη διαχείριση.
          </p>
          <Link className="mt-9 w-fit border-b border-white pb-1 text-xs uppercase tracking-[0.18em]" href="/our-story">Η ιστορία μας</Link>
        </div>
      </section>
    </main>
  )
}
