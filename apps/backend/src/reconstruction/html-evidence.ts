import { createHash } from "node:crypto"

export type EvidenceGrade = "direct" | "derived" | "inferred" | "unavailable"

export type HreflangReference = {
  lang: string
  url: string
}

export type ProductEvidence = {
  name?: string
  sku?: string
  brand?: string
  currency?: string
  regularPrice?: number
  salePrice?: number
  availability?: string
  colors: string[]
  sizes: string[]
  optionLabels: string[]
  description?: string
  jsonLd?: Record<string, unknown>
}

export type PageEvidence = {
  sourceUrl: string
  checksum: string
  title?: string
  metaDescription?: string
  canonicalUrl?: string
  hreflang: HreflangReference[]
  pageType: "product" | "category" | "content" | "unknown"
  product?: ProductEvidence
  links: string[]
  media: string[]
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  euro: "€",
}

export function checksum(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

export function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&([a-z]+);/gi, (match, name: string) =>
      HTML_ENTITIES[name.toLowerCase()] ?? match
    )
}

export function textContent(value: string) {
  return decodeHtml(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim()
}

function attribute(tag: string, name: string) {
  const pattern = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  )
  const match = tag.match(pattern)
  return decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim() || undefined
}

function tags(html: string, tagName: string) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? []
}

function metaContent(html: string, key: string, keyAttribute: "name" | "property" = "name") {
  for (const tag of tags(html, "meta")) {
    if (attribute(tag, keyAttribute)?.toLowerCase() === key.toLowerCase()) {
      return attribute(tag, "content")
    }
  }
  return undefined
}

function linkHref(html: string, rel: string, hreflang?: string) {
  for (const tag of tags(html, "link")) {
    const tagRel = attribute(tag, "rel")?.toLowerCase().split(/\s+/) ?? []
    if (!tagRel.includes(rel.toLowerCase())) continue
    if (hreflang && attribute(tag, "hreflang")?.toLowerCase() !== hreflang.toLowerCase()) {
      continue
    }
    return attribute(tag, "href")
  }
  return undefined
}

function safeUrl(value: string, pageUrl: string) {
  try {
    const url = new URL(value, pageUrl)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    url.hash = ""
    return url.toString()
  } catch {
    return undefined
  }
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

export function discoverLinks(html: string, pageUrl: string) {
  const links = tags(html, "a")
    .map((tag) => attribute(tag, "href"))
    .map((href) => (href ? safeUrl(href, pageUrl) : undefined))

  return unique(links)
}

const MEDIA_EXTENSIONS = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i

function isMediaUrl(value: string) {
  try {
    const url = new URL(value)
    return MEDIA_EXTENSIONS.test(url.pathname) || url.pathname.includes("/media/")
  } catch {
    return false
  }
}

export function discoverMedia(html: string, pageUrl: string) {
  const candidates: string[] = []

  for (const tagName of ["img", "source", "a"]) {
    for (const tag of tags(html, tagName)) {
      for (const name of ["src", "data-src", "data-original", "href"]) {
        const value = attribute(tag, name)
        if (value) candidates.push(value)
      }

      const srcset = attribute(tag, "srcset") ?? attribute(tag, "data-srcset")
      if (srcset) {
        for (const part of srcset.split(",")) {
          candidates.push(part.trim().split(/\s+/)[0])
        }
      }
    }
  }

  const cssUrlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi
  let cssMatch: RegExpExecArray | null
  while ((cssMatch = cssUrlPattern.exec(html))) {
    candidates.push(cssMatch[1])
  }

  const embeddedImagePattern = /https?:\\?\/\\?\/[^
\r\t"'<> ]+?\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?[^"'<> ]*)?/gi
  let embeddedMatch: RegExpExecArray | null
  while ((embeddedMatch = embeddedImagePattern.exec(html))) {
    candidates.push(embeddedMatch[0].replace(/\\\//g, "/"))
  }

  return unique(
    candidates
      .map((value) => safeUrl(value, pageUrl))
      .filter((value): value is string => Boolean(value) && isMediaUrl(value))
  )
}

function extractJsonLd(html: string) {
  const values: unknown[] = []
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(html))) {
    const raw = decodeHtml(match[1]).trim()
    if (!raw) continue
    try {
      values.push(JSON.parse(raw))
    } catch {
      // Raw HTML is retained by the capture pipeline, so malformed JSON-LD can be reparsed later.
    }
  }

  return values
}

function findProductSchema(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProductSchema(item)
      if (found) return found
    }
    return undefined
  }

  const record = value as Record<string, unknown>
  const type = record["@type"]
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
    return record
  }

  for (const key of ["@graph", "mainEntity", "itemListElement"]) {
    const found = findProductSchema(record[key])
    if (found) return found
  }
  return undefined
}

function schemaString(value: unknown) {
  return typeof value === "string" ? textContent(value) : undefined
}

function schemaBrand(value: unknown) {
  if (typeof value === "string") return textContent(value)
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return schemaString((value as Record<string, unknown>).name)
  }
  return undefined
}

function schemaOffers(value: unknown) {
  const offers = Array.isArray(value) ? value[0] : value
  if (!offers || typeof offers !== "object") return undefined
  return offers as Record<string, unknown>
}

function numericPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return undefined
  const normalized = value.replace(/[^\d,.-]/g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function firstTextMatch(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const value = textContent(match[1])
      if (value) return value
    }
  }
  return undefined
}

function optionLabels(html: string) {
  const labels: string[] = []
  const pattern = /data-option-label\s*=\s*(?:"([^"]+)"|'([^']+)')/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html))) {
    labels.push(decodeHtml(match[1] ?? match[2]).trim())
  }
  return unique(labels)
}

function classifyOptionValues(values: string[]) {
  const sizePattern = /^(?:one size|ένα μέγεθος|xxs|xs|s|m|l|xl|xxl|\d{2}|xs\/s|s\/m|m\/l|l\/xl)$/i
  const sizes = values.filter((value) => sizePattern.test(value.trim()))
  const colors = values.filter(
    (value) => !sizePattern.test(value.trim()) && !/^choose an option|επιλέξτε/i.test(value)
  )
  return { sizes: unique(sizes), colors: unique(colors) }
}

function inferPageType(html: string, productSchema?: Record<string, unknown>) {
  if (productSchema || /product-info-main|product\.info\.main|itemprop=["']sku["']/i.test(html)) {
    return "product" as const
  }
  if (/products-grid|product-items|toolbar-products|layered-filter-block/i.test(html)) {
    return "category" as const
  }
  if (/<main\b|page-main|cms-page-view/i.test(html)) return "content" as const
  return "unknown" as const
}

export function extractPageEvidence(html: string, sourceUrl: string): PageEvidence {
  const jsonLd = extractJsonLd(html)
  const productSchema = jsonLd.map(findProductSchema).find(Boolean)
  const offers = schemaOffers(productSchema?.offers)
  const labels = optionLabels(html)
  const classified = classifyOptionValues(labels)

  const title =
    firstTextMatch(html, [/<h1\b[^>]*>[\s\S]*?<\/h1>/i, /<title\b[^>]*>([\s\S]*?)<\/title>/i]) ??
    metaContent(html, "og:title", "property")

  const canonical = linkHref(html, "canonical")
  const canonicalUrl = canonical ? safeUrl(canonical, sourceUrl) : undefined

  const hreflang: HreflangReference[] = []
  for (const tag of tags(html, "link")) {
    const rel = attribute(tag, "rel")?.toLowerCase().split(/\s+/) ?? []
    if (!rel.includes("alternate")) continue
    const lang = attribute(tag, "hreflang")
    const href = attribute(tag, "href")
    const url = href ? safeUrl(href, sourceUrl) : undefined
    if (lang && url) hreflang.push({ lang, url })
  }

  const pageType = inferPageType(html, productSchema)
  let product: ProductEvidence | undefined

  if (pageType === "product") {
    const schemaName = schemaString(productSchema?.name)
    const schemaSku = schemaString(productSchema?.sku)
    const schemaDescription = schemaString(productSchema?.description)
    const schemaPrice = numericPrice(offers?.price ?? offers?.lowPrice)
    const schemaCurrency = schemaString(offers?.priceCurrency)
    const schemaAvailability = schemaString(offers?.availability)

    const sku =
      schemaSku ??
      firstTextMatch(html, [
        /itemprop=["']sku["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
        /class=["'][^"']*value[^"']*["'][^>]*itemprop=["']sku["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
      ])

    const prices = [...html.matchAll(/class=["'][^"']*price[^"']*["'][^>]*>([^<]*[\d][^<]*)</gi)]
      .map((match) => numericPrice(textContent(match[1])))
      .filter((value): value is number => value !== undefined)

    const distinctPrices = [...new Set(prices)]
    const regularPrice = distinctPrices.length > 1 ? Math.max(...distinctPrices) : schemaPrice ?? distinctPrices[0]
    const salePrice = distinctPrices.length > 1 ? Math.min(...distinctPrices) : undefined

    const bodyText = textContent(html).toLowerCase()
    const availability =
      schemaAvailability ??
      (/(out of stock|εξαντλημένο|μη διαθέσιμο)/i.test(bodyText)
        ? "out_of_stock"
        : /(in stock|διαθέσιμο|αγορά|add to cart)/i.test(bodyText)
          ? "in_stock"
          : undefined)

    product = {
      name: schemaName ?? title,
      sku,
      brand: schemaBrand(productSchema?.brand),
      currency: schemaCurrency ?? metaContent(html, "product:price:currency", "property"),
      regularPrice,
      salePrice,
      availability,
      colors: classified.colors,
      sizes: classified.sizes,
      optionLabels: labels,
      description:
        schemaDescription ??
        firstTextMatch(html, [
          /class=["'][^"']*product attribute description[^"']*["'][^>]*>[\s\S]*?<div\b[^>]*class=["'][^"']*value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
        ]),
      jsonLd: productSchema,
    }
  }

  return {
    sourceUrl,
    checksum: checksum(html),
    title,
    metaDescription:
      metaContent(html, "description") ?? metaContent(html, "og:description", "property"),
    canonicalUrl,
    hreflang,
    pageType,
    product,
    links: discoverLinks(html, sourceUrl),
    media: discoverMedia(html, sourceUrl),
  }
}
