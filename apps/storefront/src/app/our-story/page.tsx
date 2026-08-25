import Link from "next/link"

export default function OurStoryPage() {
  return (
    <main className="bg-[#f7f5f2] text-neutral-950">
      <section className="mx-auto grid max-w-[1440px] lg:grid-cols-2">
        <div className="min-h-[520px] bg-[linear-gradient(140deg,#c9b6ab,#eee5df)]" />
        <div className="flex flex-col justify-center px-8 py-16 sm:px-14 lg:px-16">
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Η ιστορία μας · Since 2018</p>
          <h1 className="mt-5 font-serif text-5xl leading-tight sm:text-6xl">Unique & Stylish</h1>
          <div className="mt-8 space-y-5 text-sm leading-7 text-neutral-650">
            <p>
              Η ιστορία του Coquette Concept ξεκίνησε το 2018, όταν η Κωνσταντίνα και η Δέσποινα αποφάσισαν να μετατρέψουν την αγάπη τους για τη μόδα και το προσωπικό στυλ σε έναν χώρο με ξεχωριστή ταυτότητα.
            </p>
            <p>
              Η νέα πλατφόρμα θα διατηρήσει την αυθεντικότητα, την κομψότητα και τη boutique εμπειρία του φυσικού καταστήματος, με ταχύτερη online αγορά και πολύ απλούστερη καθημερινή διαχείριση.
            </p>
          </div>
          <blockquote className="mt-9 border-l border-neutral-400 pl-6 font-serif text-2xl italic leading-snug">
            “Style is a way to say who you are without having to speak.”
          </blockquote>
          <Link className="mt-9 w-fit border-b border-neutral-950 pb-1 text-xs uppercase tracking-[0.18em]" href="/contact">
            Επισκεφτείτε το κατάστημα
          </Link>
        </div>
      </section>
    </main>
  )
}
