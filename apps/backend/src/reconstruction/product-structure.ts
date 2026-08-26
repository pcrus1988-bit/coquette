export type ProductCategoryReference = {
  name?: string
  url: string
}

export type ProductOptionGroupEvidence = {
  name: string
  values: string[]
}

export type PublicProductStructureEvidence = {
  galleryMedia: string[]
  categoryReferences: ProductCategoryReference[]
  optionGroups: ProductOptionGroupEvidence[]
  typeHint?: "configurable"
  typeEvidence?: string
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
  }

  return value
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&([a-z]+);/gi, (match, name: string) =>
      named[name.toLowerCase()] ?? match
    )
}

function textContent(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "))
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

function safeUrl(value: string | undefined, pageUrl: string) {
  if (!value) return undefined
  try {
    const url = new URL(value, pageUrl)
    const page = new URL(pageUrl)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    if (url.hostname !== page.hostname) return undefined
    url.hash = ""
    return url.toString()
  } catch {
    return undefined
  }
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function schemaImageUrls(productSchema: Record<string, unknown> | undefined, pageUrl: string) {
  const result: string[] = []

  function collect(value: unknown) {
    if (typeof value === "string") {
      const url = safeUrl(value, pageUrl)
      if (url) result.push(url)
      return
    }
    if (Array.isArray(value)) {
      value.forEach(collect)
      return
    }
    if (!value || typeof value !== "object") return
    const record = value as Record<string, unknown>
    collect(record.url)
    collect(record.contentUrl)
  }

  collect(productSchema?.image)
  return unique(result)
}

function productCatalogMedia(html: string, pageUrl: string) {
  const result: string[] = []
  const tagPattern = /<(?:img|source|a)\b[^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(html))) {
    const tag = match[0]
    const candidates = [
      attribute(tag, "src"),
      attribute(tag, "data-src"),
      attribute(tag, "data-original"),
      attribute(tag, "href"),
    ]

    const srcset = attribute(tag, "srcset") ?? attribute(tag, "data-srcset")
    if (srcset) {
      for (const part of srcset.split(",")) {
        candidates.push(part.trim().split(/\s+/)[0])
      }
    }

    for (const candidate of candidates) {
      const url = safeUrl(candidate, pageUrl)
      if (!url) continue
      const pathname = new URL(url).pathname.toLowerCase()
      if (pathname.includes("/media/catalog/product/")) result.push(url)
    }
  }

  return unique(result)
}

function metaImage(html: string, pageUrl: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const property = attribute(tag, "property")?.toLowerCase()
    if (property !== "og:image" && property !== "og:image:url") continue
    const url = safeUrl(attribute(tag, "content"), pageUrl)
    if (url) return url
  }
  return undefined
}

function findBreadcrumbSchema(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findBreadcrumbSchema(entry)
      if (found) return found
    }
    return undefined
  }

  const record = value as Record<string, unknown>
  const type = record["@type"]
  if (
    type === "BreadcrumbList" ||
    (Array.isArray(type) && type.includes("BreadcrumbList"))
  ) {
    return record
  }

  for (const key of ["@graph", "mainEntity", "breadcrumb"]) {
    const found = findBreadcrumbSchema(record[key])
    if (found) return found
  }
  return undefined
}

function schemaBreadcrumbs(jsonLd: unknown[], pageUrl: string) {
  const breadcrumb = jsonLd.map(findBreadcrumbSchema).find(Boolean)
  const items = breadcrumb?.itemListElement
  if (!Array.isArray(items)) return []

  return items.flatMap<ProductCategoryReference>((item) => {
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    const nested =
      record.item && typeof record.item === "object" && !Array.isArray(record.item)
        ? (record.item as Record<string, unknown>)
        : undefined
    const rawUrl =
      typeof record.item === "string"
        ? record.item
        : typeof nested?.["@id"] === "string"
          ? (nested["@id"] as string)
          : typeof nested?.url === "string"
            ? (nested.url as string)
            : undefined
    const url = safeUrl(rawUrl, pageUrl)
    if (!url || url === pageUrl) return []
    const rawName =
      typeof record.name === "string"
        ? record.name
        : typeof nested?.name === "string"
          ? (nested.name as string)
          : undefined
    const name = rawName ? textContent(rawName) : undefined
    return [{ url, ...(name ? { name } : {}) }]
  })
}

function htmlBreadcrumbs(html: string, pageUrl: string) {
  const blocks = [
    ...html.matchAll(
      /<(?:div|nav|ul)\b[^>]*class=["'][^"']*breadcrumbs?[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|nav|ul)>/gi
    ),
  ]
  const result: ProductCategoryReference[] = []

  for (const block of blocks) {
    const anchorPattern = /<a\b[^>]*href=(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi
    let anchor: RegExpExecArray | null
    while ((anchor = anchorPattern.exec(block[1]))) {
      const url = safeUrl(anchor[1] ?? anchor[2] ?? anchor[3], pageUrl)
      if (!url || url === pageUrl) continue
      const name = textContent(anchor[4])
      result.push({ url, ...(name ? { name } : {}) })
    }
  }

  return result
}

function mergeCategoryReferences(
  left: ProductCategoryReference[],
  right: ProductCategoryReference[]
) {
  const byUrl = new Map<string, ProductCategoryReference>()
  for (const item of [...left, ...right]) {
    const existing = byUrl.get(item.url)
    if (!existing || (!existing.name && item.name)) byUrl.set(item.url, item)
  }
  return [...byUrl.values()]
}

function optionGroups(html: string) {
  const result: ProductOptionGroupEvidence[] = []
  const swatchPattern = /<div\b([^>]*)class=["'][^"']*swatch-attribute[^"']*["']([^>]*)>([\s\S]*?)<\/div>\s*<\/div>?/gi
  let swatch: RegExpExecArray | null

  while ((swatch = swatchPattern.exec(html))) {
    const openingTag = `<div ${swatch[1]} ${swatch[2]}>`
    const name =
      attribute(openingTag, "data-attribute-code") ??
      attribute(openingTag, "attribute-code") ??
      textContent(
        swatch[3].match(
          /<span\b[^>]*class=["'][^"']*swatch-attribute-label[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
        )?.[1] ?? ""
      )
    const values = unique(
      [...swatch[3].matchAll(/data-option-label\s*=\s*(?:"([^"]+)"|'([^']+)')/gi)]
        .map((match) => decodeHtml(match[1] ?? match[2]).trim())
        .filter(Boolean)
    )
    if (name && values.length) result.push({ name, values })
  }

  const selectPattern = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi
  let select: RegExpExecArray | null
  while ((select = selectPattern.exec(html))) {
    const openingTag = `<select ${select[1]}>`
    const name =
      attribute(openingTag, "data-attribute-code") ??
      attribute(openingTag, "name") ??
      attribute(openingTag, "aria-label")
    if (!name) continue
    const values = unique(
      [...select[2].matchAll(/<option\b[^>]*value=(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/option>/gi)]
        .filter((match) => Boolean((match[1] ?? match[2] ?? match[3])?.trim()))
        .map((match) => textContent(match[4]))
        .filter(Boolean)
    )
    if (values.length) result.push({ name, values })
  }

  const merged = new Map<string, string[]>()
  for (const group of result) {
    const key = group.name.trim().toLowerCase()
    merged.set(key, unique([...(merged.get(key) ?? []), ...group.values]))
  }

  return [...merged.entries()].map(([name, values]) => ({ name, values }))
}

function directTypeEvidence(html: string) {
  const explicitConfigurable =
    /spConfig|configurable\.js|Magento_ConfigurableProduct|data-role=["']swatch-options["']/i.test(
      html
    )
  if (explicitConfigurable) {
    return {
      typeHint: "configurable" as const,
      typeEvidence: "Public Magento configurable-product client configuration present",
    }
  }

  return {}
}

export function extractPublicProductStructure(
  html: string,
  pageUrl: string,
  productSchema: Record<string, unknown> | undefined,
  jsonLd: unknown[]
): PublicProductStructureEvidence {
  const schemaMedia = schemaImageUrls(productSchema, pageUrl)
  const ogImage = metaImage(html, pageUrl)
  const catalogMedia = productCatalogMedia(html, pageUrl)
  const galleryMedia = unique([
    ...schemaMedia,
    ...(ogImage ? [ogImage] : []),
    ...catalogMedia,
  ])

  const categoryReferences = mergeCategoryReferences(
    schemaBreadcrumbs(jsonLd, pageUrl),
    htmlBreadcrumbs(html, pageUrl)
  )
  const groups = optionGroups(html)
  const type = directTypeEvidence(html)

  return {
    galleryMedia,
    categoryReferences,
    optionGroups: groups,
    ...type,
  }
}
