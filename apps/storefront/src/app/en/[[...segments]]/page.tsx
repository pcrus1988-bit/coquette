import Link from "next/link"

const titles: Record<string, string> = {
  "": "Women Clothes",
  clothing: "Clothing",
  designers: "Designers",
  accessories: "Accessories",
  sale: "Sale",
  "our-story": "Our Story",
  search: "Search",
  account: "Account",
  cart: "Cart",
}

export default async function EnglishStorefrontPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  const root = segments[0] || ""
  const title = titles[root] || segments.at(-1)?.replace(/-/g, " ") || "Coquette Concept"

  return (
    <main className="min-h-[60vh] bg-[#f7f5f2] px-5 py-16 text-neutral-950 lg:px-8">
      <section className="mx-auto max-w-[1440px]">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">English storefront</p>
        <h1 className="mt-4 font-serif text-5xl capitalize sm:text-6xl">{title}</h1>
        <p className="mt-6 max-w-2xl text-sm leading-7 text-neutral-600">
          The English route is reserved and operational. English catalogue and editorial content will be populated from the same Medusa records during migration, with localized fields rather than a duplicated product database.
        </p>
        <Link className="mt-8 inline-block border-b border-neutral-950 pb-1 text-xs uppercase tracking-[0.16em]" href="/en">
          English home
        </Link>
      </section>
    </main>
  )
}
