import Link from "next/link"
import { notFound } from "next/navigation"
import { ProductListingShell } from "../../../components/product-listing-shell"
import { ENGLISH_LOCALE } from "../../../lib/localization"
import { designerNames } from "../../../lib/navigation"

const clothingCategories: Record<string, string> = {
  "new-arrivals": "New Arrivals",
  dresses: "Dresses",
  tops: "Tops",
  trousers: "Trousers",
  outerwear: "Outerwear",
  jeans: "Jeans",
  leggings: "Leggings",
  skirts: "Skirts",
  activewear: "Activewear",
  jumpsuits: "Jumpsuits",
  knitwear: "Knitwear",
  swimwear: "Swimwear",
}

const accessoryCategories: Record<string, string> = {
  bags: "Bags",
  belts: "Belts",
  jewellery: "Jewellery",
  hats: "Hats",
  sunglasses: "Sunglasses",
  "hair-accessories": "Hair Accessories",
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const designers = Object.fromEntries(
  designerNames.map((name) => [slugify(name), name])
)

const placeholderTitles: Record<string, string> = {
  "": "Women Clothes",
  designers: "Designers",
  "our-story": "Our Story",
  search: "Search",
  account: "Account",
  cart: "Cart",
}

function EnglishPlaceholder({ title }: { title: string }) {
  return (
    <main className="min-h-[60vh] bg-[#f7f5f2] px-5 py-16 text-neutral-950 lg:px-8">
      <section className="mx-auto max-w-[1440px]">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">
          English storefront
        </p>
        <h1 className="mt-4 font-serif text-5xl capitalize sm:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-sm leading-7 text-neutral-600">
          This English surface is reserved and operational. Commerce catalogue data
          now uses Medusa translations; this specific editorial or customer feature
          will be connected in its dedicated roadmap phase.
        </p>
        <Link
          className="mt-8 inline-block border-b border-neutral-950 pb-1 text-xs uppercase tracking-[0.16em]"
          href="/en"
        >
          English home
        </Link>
      </section>
    </main>
  )
}

export default async function EnglishStorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments?: string[] }>
  searchParams: Promise<{ page?: string }>
}) {
  const [{ segments = [] }, { page }] = await Promise.all([params, searchParams])
  const pageNumber = Math.max(1, Number.parseInt(page || "1", 10) || 1)
  const [root = "", child, ...rest] = segments

  if (rest.length > 0) {
    notFound()
  }

  if (root === "clothing") {
    if (!child) {
      return (
        <ProductListingShell
          categoryHandle="clothing"
          description="New arrivals, dresses, tops, trousers, denim, knitwear, swimwear and the core Coquette Concept clothing edit."
          eyebrow="Clothing"
          hrefBase="/en/clothing"
          language="en"
          locale={ENGLISH_LOCALE}
          page={pageNumber}
          title="Women's Clothing"
        />
      )
    }

    const title = clothingCategories[child]
    if (!title) {
      notFound()
    }

    return (
      <ProductListingShell
        categoryHandle={child}
        eyebrow="Clothing · Category"
        hrefBase={`/en/clothing/${child}`}
        language="en"
        locale={ENGLISH_LOCALE}
        page={pageNumber}
        title={title}
      />
    )
  }

  if (root === "accessories") {
    if (!child) {
      return (
        <ProductListingShell
          categoryHandle="accessories"
          description="Bags, belts, jewellery, hats, sunglasses and hair accessories from the selected Coquette Concept designer portfolio."
          eyebrow="Accessories"
          hrefBase="/en/accessories"
          language="en"
          locale={ENGLISH_LOCALE}
          page={pageNumber}
          title="Accessories"
        />
      )
    }

    const title = accessoryCategories[child]
    if (!title) {
      notFound()
    }

    return (
      <ProductListingShell
        categoryHandle={child}
        eyebrow="Accessories · Category"
        hrefBase={`/en/accessories/${child}`}
        language="en"
        locale={ENGLISH_LOCALE}
        page={pageNumber}
        title={title}
      />
    )
  }

  if (root === "sale") {
    if (child) {
      notFound()
    }

    return (
      <ProductListingShell
        description="The dedicated sale edit remains a separate merchandising surface with strike-through pricing and promotional states."
        eyebrow="Sale"
        hrefBase="/en/sale"
        language="en"
        locale={ENGLISH_LOCALE}
        pendingMessage="Sale will not fall back to the full catalogue. It activates once the migrated sale-price/promotion rule is defined and verified."
        title="Sale"
      />
    )
  }

  if (root === "designers" && child) {
    const title = designers[child]
    if (!title) {
      notFound()
    }

    return (
      <ProductListingShell
        eyebrow="Designer"
        hrefBase={`/en/designers/${child}`}
        language="en"
        locale={ENGLISH_LOCALE}
        pendingMessage="Designer product grids will use COQUETTE's first-class Brand/Designer relationship. A generic product list is intentionally not shown as a substitute."
        title={title}
      />
    )
  }

  if (child) {
    notFound()
  }

  const title = placeholderTitles[root]
  if (!title) {
    notFound()
  }

  return <EnglishPlaceholder title={title} />
}
