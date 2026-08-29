import { decodeHtml, extractPageEvidence } from "./html-evidence"

export type ConfigurableVariantEvidence = {
  sourceProductId: string
  optionValues: Record<string, string>
  regularPrice?: number
  salePrice?: number
}

export type AuthoritativeProductPageEvidence = {
  productType?: "simple" | "configurable" | "virtual"
  typeEvidence?: string
  parentProductId?: string
  regularPrice?: number
  salePrice?: number
  currencyCode?: "EUR"
  availability?: string
  configurableVariants: ConfigurableVariantEvidence[]
  configurableMatrixComplete: boolean
  configurableMatrixIssues: string[]
}

type JsonRecord = Record<string, unknown>

type PricePair = {
  regularPrice?: number
  salePrice?: number
}

function attribute(tag: string, name: string) {
  const pattern = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  )
  const match = tag.match(pattern)
  return decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim() || undefined
}

function numericPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return undefined
  const normalized = value.replace(/[^\d,.-]/g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined
}

function priceAmount(value: unknown) {
  const amount = numericPrice(record(value)?.amount)
  return amount !== undefined && amount >= 0 ? amount : undefined
}

function pricePair(value: unknown): PricePair {
  const prices = record(value)
  if (!prices) return {}

  const oldPrice = priceAmount(prices.oldPrice)
  const finalPrice = priceAmount(prices.finalPrice) ?? priceAmount(prices.basePrice)

  if (
    oldPrice !== undefined &&
    finalPrice !== undefined &&
    oldPrice > finalPrice
  ) {
    return { regularPrice: oldPrice, salePrice: finalPrice }
  }

  const regularPrice = finalPrice ?? oldPrice
  return regularPrice === undefined ? {} : { regularPrice }
}

function extractMagentoInitObjects(html: string) {
  const values: unknown[] = []
  const pattern = /<script\b[^>]*type=["']text\/x-magento-init["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(html))) {
    const raw = decodeHtml(match[1]).trim()
    if (!raw) continue
    try {
      values.push(JSON.parse(raw))
    } catch {
      // The archived HTML is retained for review. Invalid client JSON must not
      // be repaired or guessed during migration.
    }
  }
  return values
}

function collectJsonConfigs(value: unknown, result: JsonRecord[]) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectJsonConfigs(entry, result))
    return
  }
  const current = record(value)
  if (!current) return

  const jsonConfig = record(current.jsonConfig)
  if (
    jsonConfig &&
    (record(jsonConfig.attributes) ||
      record(jsonConfig.index) ||
      record(jsonConfig.optionPrices))
  ) {
    result.push(jsonConfig)
  }

  Object.values(current).forEach((entry) => collectJsonConfigs(entry, result))
}

function configurableJsonConfig(html: string) {
  const configs: JsonRecord[] = []
  for (const value of extractMagentoInitObjects(html)) {
    collectJsonConfigs(value, configs)
  }
  return configs.sort((left, right) => {
    const leftIndex = Object.keys(record(left.index) ?? {}).length
    const rightIndex = Object.keys(record(right.index) ?? {}).length
    return rightIndex - leftIndex
  })[0]
}

function explicitProductType(html: string, hasConfig: boolean) {
  if (/\bpage-product-configurable\b|catalog_product_view_type_configurable/i.test(html)) {
    return {
      productType: "configurable" as const,
      typeEvidence: "Magento product-view configurable body/handle evidence",
    }
  }
  if (/\bpage-product-simple\b|catalog_product_view_type_simple/i.test(html)) {
    return {
      productType: "simple" as const,
      typeEvidence: "Magento product-view simple body/handle evidence",
    }
  }
  if (/\bpage-product-virtual\b|catalog_product_view_type_virtual/i.test(html)) {
    return {
      productType: "virtual" as const,
      typeEvidence: "Magento product-view virtual body/handle evidence",
    }
  }
  if (hasConfig) {
    return {
      productType: "configurable" as const,
      typeEvidence: "Magento configurable jsonConfig evidence",
    }
  }
  return {}
}

function productFormId(html: string, sku?: string) {
  if (!sku?.trim()) return undefined
  const formPattern = /<form\b[^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = formPattern.exec(html))) {
    const opening = match[0]
    if (attribute(opening, "data-product-sku") !== sku) continue
    const close = html.indexOf("</form>", match.index + opening.length)
    const region = html.slice(
      match.index,
      close >= 0 ? close + "</form>".length : match.index + 10000
    )
    for (const input of region.match(/<input\b[^>]*>/gi) ?? []) {
      if (attribute(input, "name") !== "product") continue
      const value = attribute(input, "value")
      if (value) return value
    }
  }

  const handle = html.match(/catalog_product_view_id_(\d+)/i)
  return handle?.[1]
}

function productPriceBox(html: string, productId?: string): PricePair {
  if (!productId) return {}
  const pattern = /<div\b[^>]*class=["'][^"']*price-box[^"']*["'][^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(html))) {
    const opening = match[0]
    if (attribute(opening, "data-product-id") !== productId) continue

    // Keep the scan strictly inside the current price-box region. A fixed-size
    // slice alone can otherwise reach a recommendation/related-product box and
    // accidentally fill a missing price type from another product.
    pattern.lastIndex = match.index + opening.length
    const nextPriceBox = pattern.exec(html)
    const regionEnd = Math.min(
      nextPriceBox?.index ?? html.length,
      match.index + 4000
    )
    const region = html.slice(match.index, regionEnd)
    const amounts: Record<string, number> = {}

    for (const tag of region.match(/<(?:span|div)\b[^>]*data-price-(?:amount|type)=[^>]*>/gi) ?? []) {
      const type = attribute(tag, "data-price-type")
      const amount = numericPrice(attribute(tag, "data-price-amount"))
      if (!type || amount === undefined || amount < 0 || amounts[type] !== undefined) {
        continue
      }
      amounts[type] = amount
    }

    return pricePair({
      oldPrice:
        amounts.oldPrice === undefined ? undefined : { amount: amounts.oldPrice },
      finalPrice:
        amounts.finalPrice === undefined
          ? undefined
          : { amount: amounts.finalPrice },
      basePrice:
        amounts.basePrice === undefined ? undefined : { amount: amounts.basePrice },
    })
  }
  return {}
}

function metaContent(html: string, property: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attribute(tag, "property")?.toLowerCase() !== property.toLowerCase()) continue
    return attribute(tag, "content")
  }
  return undefined
}

function schemaOffer(productSchema: JsonRecord | undefined) {
  const rawOffers = productSchema?.offers
  const offers = Array.isArray(rawOffers) ? rawOffers[0] : rawOffers
  return record(offers)
}

function firstPricePair(...pairs: PricePair[]) {
  return pairs.find((pair) => pair.regularPrice !== undefined) ?? {}
}

function optionLookup(attributes: JsonRecord) {
  const lookup = new Map<
    string,
    { code: string; options: Map<string, { label: string; products: string[] }> }
  >()

  for (const [attributeKey, rawAttribute] of Object.entries(attributes)) {
    const attribute = record(rawAttribute)
    if (!attribute) continue
    const id = String(attribute.id ?? attributeKey).trim()
    const code = typeof attribute.code === "string" ? attribute.code.trim() : ""
    if (!id || !code) continue

    const options = new Map<string, { label: string; products: string[] }>()
    const rawOptions = Array.isArray(attribute.options) ? attribute.options : []
    for (const rawOption of rawOptions) {
      const option = record(rawOption)
      if (!option) continue
      const optionId = String(option.id ?? "").trim()
      const label = typeof option.label === "string" ? option.label.trim() : ""
      if (!optionId || !label) continue
      const products = Array.isArray(option.products)
        ? option.products.map(String).map((value) => value.trim()).filter(Boolean)
        : []
      options.set(optionId, { label, products })
    }
    lookup.set(id, { code, options })
  }

  return lookup
}

function configurableVariants(config: JsonRecord | undefined) {
  const issues: string[] = []
  const attributes = record(config?.attributes) ?? {}
  const index = record(config?.index) ?? {}
  const optionPrices = record(config?.optionPrices) ?? {}
  const lookup = optionLookup(attributes)
  const variants: ConfigurableVariantEvidence[] = []

  if (Object.keys(index).length === 0) {
    return {
      variants,
      complete: false,
      issues: ["configurable_child_index_missing"],
    }
  }
  if (lookup.size === 0) {
    return {
      variants,
      complete: false,
      issues: ["configurable_attribute_metadata_missing"],
    }
  }

  for (const [childId, rawMapping] of Object.entries(index).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const mapping = record(rawMapping)
    if (!mapping || !childId.trim()) {
      issues.push(`invalid_child_mapping:${childId}`)
      continue
    }

    const optionValues: Record<string, string> = {}
    let childComplete = true
    for (const [attributeId, metadata] of lookup) {
      const rawOptionId = mapping[attributeId]
      const optionId = rawOptionId === undefined ? "" : String(rawOptionId).trim()
      const option = metadata.options.get(optionId)
      if (!option) {
        childComplete = false
        issues.push(`child_option_unresolved:${childId}:${attributeId}:${optionId}`)
        continue
      }
      if (option.products.length > 0 && !option.products.includes(childId)) {
        childComplete = false
        issues.push(`child_option_membership_mismatch:${childId}:${attributeId}:${optionId}`)
        continue
      }
      optionValues[metadata.code] = option.label
    }

    if (!childComplete || Object.keys(optionValues).length !== lookup.size) continue
    const prices = pricePair(optionPrices[childId])
    variants.push({
      sourceProductId: childId,
      optionValues,
      ...prices,
    })
  }

  const complete =
    issues.length === 0 && variants.length === Object.keys(index).length && variants.length > 0
  return { variants, complete, issues: [...new Set(issues)].sort() }
}

export function extractAuthoritativeProductPageEvidence(
  html: string,
  pageUrl: string
): AuthoritativeProductPageEvidence {
  const base = extractPageEvidence(html, pageUrl)
  const config = configurableJsonConfig(html)
  const type = explicitProductType(html, Boolean(config))
  const parentProductId =
    (config?.productId === undefined ? undefined : String(config.productId).trim()) ||
    productFormId(html, base.product?.sku)

  const configPrices = pricePair(config?.prices)
  const boxPrices = productPriceBox(html, parentProductId)
  const productSchema = record(base.product?.jsonLd)
  const offer = schemaOffer(productSchema)
  const schemaFinalPrice = numericPrice(offer?.price ?? offer?.lowPrice)
  const metaFinalPrice = numericPrice(metaContent(html, "product:price:amount"))
  const fallbackFinalPrice = metaFinalPrice ?? schemaFinalPrice
  const fallbackPrice =
    fallbackFinalPrice === undefined ? {} : { regularPrice: fallbackFinalPrice }
  const prices = firstPricePair(boxPrices, configPrices, fallbackPrice)

  const currency =
    (typeof offer?.priceCurrency === "string" ? offer.priceCurrency.trim() : undefined) ??
    metaContent(html, "product:price:currency")
  const availability =
    typeof offer?.availability === "string" ? offer.availability.trim() : undefined
  const matrix = configurableVariants(config)

  return {
    ...type,
    ...(parentProductId ? { parentProductId } : {}),
    ...prices,
    ...(currency === "EUR" ? { currencyCode: "EUR" as const } : {}),
    ...(availability ? { availability } : {}),
    configurableVariants: matrix.variants,
    configurableMatrixComplete:
      type.productType === "configurable" ? matrix.complete : false,
    configurableMatrixIssues:
      type.productType === "configurable" ? matrix.issues : [],
  }
}
