import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { discoverMedia } from "../reconstruction/html-evidence"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductCandidate,
  type RecoveryProductFields,
  type RecoveryProductObservation,
} from "./recovery-candidates"

export type CapturedProductRecord = {
  sourceUrl?: string
  checksum?: string
  title?: string
  canonicalUrl?: string
  hreflang?: Array<{ lang?: string; url?: string }>
  name?: string
  sku?: string
  brand?: string
  currency?: string
  regularPrice?: number
  salePrice?: number
  availability?: string
  colors?: string[]
  sizes?: string[]
  optionLabels?: string[]
  description?: string
}

export type CapturePageRecord = {
  sourceUrl?: string
  finalUrl?: string
  status?: "captured" | "skipped" | "error"
  httpStatus?: number
  capturedAt?: string
  pageFile?: string
  pageType?: string
  canonicalUrl?: string
  checksum?: string
  error?: string
}

export type CaptureMediaRecord = {
  sourceUrl?: string
  status?: "captured" | "skipped" | "error"
  httpStatus?: number
  contentType?: string
  bytes?: number
  checksum?: string
  mediaFile?: string
  capturedAt?: string
  error?: string
}

export type CaptureManifest = {
  captureId?: string
  source?: string
  evidenceMode?: string
  startedAt?: string
  completedAt?: string
  complete?: boolean
  failureReason?: string
}

export type CaptureArtifactBundle = {
  manifest: CaptureManifest
  products: CapturedProductRecord[]
  pages: CapturePageRecord[]
  media: CaptureMediaRecord[]
  pageMedia: Record<string, string[]>
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function validHttpUrl(value?: string) {
  if (!nonEmptyString(value)) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    url.hash = ""
    return url.toString()
  } catch {
    return undefined
  }
}

function numeric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function mapStockState(value?: string) {
  if (!nonEmptyString(value)) return undefined
  const normalized = value.toLowerCase()
  if (normalized.includes("out_of_stock") || normalized.includes("outofstock")) {
    return "out_of_stock" as const
  }
  if (normalized.includes("in_stock") || normalized.includes("instock")) {
    return "in_stock" as const
  }
  return undefined
}

function optionValues(product: CapturedProductRecord) {
  const result: Record<string, string> = {}
  if (Array.isArray(product.colors) && product.colors.length === 1) {
    result.color = product.colors[0]
  }
  if (Array.isArray(product.sizes) && product.sizes.length === 1) {
    result.size = product.sizes[0]
  }
  return result
}

function alternateLocaleUrl(product: CapturedProductRecord) {
  const source = validHttpUrl(product.sourceUrl)
  if (!source) return undefined
  const sourceIsEnglish = /\/en\//i.test(new URL(source).pathname)
  const candidates = Array.isArray(product.hreflang) ? product.hreflang : []

  const wanted = sourceIsEnglish
    ? ["el", "el-gr", "x-default"]
    : ["en", "en-gb", "en-us"]

  for (const language of wanted) {
    const match = candidates.find(
      (candidate) =>
        nonEmptyString(candidate.lang) &&
        candidate.lang.toLowerCase() === language &&
        Boolean(validHttpUrl(candidate.url))
    )
    const url = validHttpUrl(match?.url)
    if (url) return url
  }
  return undefined
}

function productFields(
  product: CapturedProductRecord,
  mediaSourceIds: string[] | undefined
): RecoveryProductFields {
  const fields: RecoveryProductFields = {}
  const sourceUrl = validHttpUrl(product.sourceUrl)
  const canonicalUrl = validHttpUrl(product.canonicalUrl)

  if (sourceUrl) fields.sourceId = sourceUrl
  if (canonicalUrl) fields.canonicalUrl = canonicalUrl

  if (sourceUrl) {
    const alternate = alternateLocaleUrl(product)
    if (alternate) fields.alternateLocaleUrl = alternate
  }

  if (nonEmptyString(product.sku)) fields.sku = product.sku.trim()
  if (nonEmptyString(product.name ?? product.title)) {
    fields.name = (product.name ?? product.title)!.trim()
  }
  if (nonEmptyString(product.description)) fields.description = product.description
  if (nonEmptyString(product.brand)) fields.brandSourceId = `public-brand:${product.brand}`

  const stockState = mapStockState(product.availability)
  if (stockState) fields.stockState = stockState

  if (numeric(product.regularPrice) && product.regularPrice >= 0) {
    fields.regularPrice = product.regularPrice
  }
  if (numeric(product.salePrice) && product.salePrice >= 0) {
    fields.salePrice = product.salePrice
  }
  if (product.currency === "EUR") fields.currencyCode = "EUR"

  const options = optionValues(product)
  if (Object.keys(options).length > 0) fields.optionValues = options
  if (mediaSourceIds) fields.mediaSourceIds = mediaSourceIds

  return fields
}

function directObservation(
  product: CapturedProductRecord,
  capturedAt: string,
  pageMedia: Record<string, string[]>
): RecoveryProductObservation | undefined {
  const sourceUrl = validHttpUrl(product.sourceUrl)
  if (!sourceUrl) return undefined

  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt: capturedAt,
    note: product.checksum
      ? `Phase 4A captured product checksum=${product.checksum}`
      : "Phase 4A direct public product capture",
    fields: productFields({ ...product, sourceUrl }, pageMedia[sourceUrl]),
  }
}

export function buildDirectCaptureProductCandidates(
  bundle: CaptureArtifactBundle
): RecoveryProductCandidate[] {
  const capturedAt = bundle.manifest.completedAt ?? bundle.manifest.startedAt
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) return []

  return bundle.products.flatMap((product) => {
    const observation = directObservation(product, capturedAt, bundle.pageMedia)
    if (!observation) return []
    return [
      buildRecoveryProductCandidate(
        `direct:${observation.sourceUrl}`,
        [observation]
      ),
    ]
  })
}

async function readJsonl<T>(path: string): Promise<T[]> {
  const raw = await readFile(path, "utf8")
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

async function reconstructPageMedia(
  captureDir: string,
  pages: CapturePageRecord[],
  media: CaptureMediaRecord[]
) {
  const availableMedia = new Set(
    media
      .map((record) => validHttpUrl(record.sourceUrl))
      .filter((value): value is string => Boolean(value))
  )
  const relationships: Record<string, string[]> = {}

  for (const page of pages) {
    const pageUrl = validHttpUrl(page.finalUrl ?? page.sourceUrl)
    if (!pageUrl || page.status !== "captured" || !page.pageFile) continue

    try {
      const html = await readFile(join(captureDir, page.pageFile), "utf8")
      relationships[pageUrl] = discoverMedia(html, pageUrl)
        .map((url) => validHttpUrl(url))
        .filter(
          (url): url is string => Boolean(url) && availableMedia.has(url)
        )
    } catch {
      relationships[pageUrl] = []
    }
  }

  return relationships
}

export async function readCaptureArtifactBundle(
  captureDir: string
): Promise<CaptureArtifactBundle> {
  const manifest = JSON.parse(
    await readFile(join(captureDir, "manifest.json"), "utf8")
  ) as CaptureManifest
  const products = await readJsonl<CapturedProductRecord>(
    join(captureDir, "products.jsonl")
  )
  const pages = await readJsonl<CapturePageRecord>(join(captureDir, "pages.jsonl"))
  const media = await readJsonl<CaptureMediaRecord>(join(captureDir, "media.jsonl"))

  return {
    manifest,
    products,
    pages,
    media,
    pageMedia: await reconstructPageMedia(captureDir, pages, media),
  }
}
