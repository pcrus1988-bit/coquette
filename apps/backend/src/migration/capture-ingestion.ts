import { MedusaError } from "@medusajs/framework/utils"
import { readFile, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { discoverMedia } from "../reconstruction/html-evidence"
import {
  extractCategoryProductLinks,
  extractPublicProductStructure,
  type ProductCategoryReference,
  type PublicProductStructureEvidence,
} from "../reconstruction/product-structure"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductCandidate,
  type RecoveryProductFields,
  type RecoveryProductObservation,
} from "./recovery-candidates"

export const COQUETTE_LEGACY_HOST = "coquetteconcept.gr"

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
  title?: string
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
  productStructures?: Record<string, PublicProductStructureEvidence>
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
    return url
  } catch {
    return undefined
  }
}

function validHttpUrlOnHost(value: string | undefined, expectedHost: string) {
  const url = validHttpUrl(value)
  return url?.hostname === expectedHost ? url.toString() : undefined
}

function explicitLegacyLocale(value: string) {
  try {
    const path = new URL(value).pathname.toLowerCase()
    if (path === "/en" || path.startsWith("/en/")) return "en" as const
    if (path === "/default" || path.startsWith("/default/")) return "el" as const
    return undefined
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

function fallbackOptionValues(product: CapturedProductRecord) {
  const result: Record<string, string> = {}
  if (Array.isArray(product.colors) && product.colors.length === 1) {
    result.color = product.colors[0]
  }
  if (Array.isArray(product.sizes) && product.sizes.length === 1) {
    result.size = product.sizes[0]
  }
  return result
}

function structuralOptionValues(structure?: PublicProductStructureEvidence) {
  const result: Record<string, string> = {}
  for (const group of structure?.optionGroups ?? []) {
    if (group.values.length !== 1) continue
    const key = group.name.trim().toLowerCase()
    if (key) result[key] = group.values[0]
  }
  return result
}

function alternateLocaleUrl(product: CapturedProductRecord, expectedHost: string) {
  const source = validHttpUrlOnHost(product.sourceUrl, expectedHost)
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
        Boolean(validHttpUrlOnHost(candidate.url, expectedHost))
    )
    const url = validHttpUrlOnHost(match?.url, expectedHost)
    if (url) return url
  }
  return undefined
}

function productFields(
  product: CapturedProductRecord,
  structure: PublicProductStructureEvidence | undefined,
  expectedHost: string
): RecoveryProductFields {
  const fields: RecoveryProductFields = {}
  const sourceUrl = validHttpUrlOnHost(product.sourceUrl, expectedHost)
  const canonicalUrl = validHttpUrlOnHost(product.canonicalUrl, expectedHost)

  if (sourceUrl) fields.sourceId = sourceUrl
  if (canonicalUrl) fields.canonicalUrl = canonicalUrl

  if (sourceUrl) {
    const alternate = alternateLocaleUrl(product, expectedHost)
    if (alternate) fields.alternateLocaleUrl = alternate
  }

  if (nonEmptyString(product.sku)) fields.sku = product.sku.trim()
  if (nonEmptyString(product.name ?? product.title)) {
    fields.name = (product.name ?? product.title)!.trim()
  }
  if (nonEmptyString(product.description)) fields.description = product.description

  const stockState = mapStockState(product.availability)
  if (stockState) fields.stockState = stockState

  if (numeric(product.regularPrice) && product.regularPrice >= 0) {
    fields.regularPrice = product.regularPrice
  }
  if (numeric(product.salePrice) && product.salePrice >= 0) {
    fields.salePrice = product.salePrice
  }
  if (product.currency === "EUR") fields.currencyCode = "EUR"

  const options = {
    ...fallbackOptionValues(product),
    ...structuralOptionValues(structure),
  }
  if (Object.keys(options).length > 0) fields.optionValues = options

  const categorySourceIds = (structure?.categoryReferences ?? [])
    .map((reference) => validHttpUrlOnHost(reference.url, expectedHost))
    .filter((value): value is string => typeof value === "string")
  if (categorySourceIds.length > 0) {
    fields.categorySourceIds = [...new Set(categorySourceIds)]
  }

  const galleryMedia = (structure?.galleryMedia ?? [])
    .map((url) => validHttpUrlOnHost(url, expectedHost))
    .filter((value): value is string => typeof value === "string")
  if (galleryMedia.length > 0) fields.mediaSourceIds = [...new Set(galleryMedia)]

  if (structure?.typeHint === "configurable") fields.type = "configurable"

  return fields
}

function directObservation(
  product: CapturedProductRecord,
  capturedAt: string,
  productStructures: Record<string, PublicProductStructureEvidence>,
  expectedHost: string
): RecoveryProductObservation | undefined {
  const sourceUrl = validHttpUrlOnHost(product.sourceUrl, expectedHost)
  if (!sourceUrl) return undefined
  const structure = productStructures[sourceUrl]
  const structuralNote = structure
    ? [
        `categories=${structure.categoryReferences.length}`,
        `gallery_media=${structure.galleryMedia.length}`,
        `option_groups=${structure.optionGroups.length}`,
        structure.typeEvidence,
      ]
        .filter(Boolean)
        .join(", ")
    : undefined

  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt: capturedAt,
    note: [
      product.checksum
        ? `Phase 4A captured product checksum=${product.checksum}`
        : "Phase 4A direct public product capture",
      structuralNote,
    ]
      .filter(Boolean)
      .join("; "),
    fields: productFields({ ...product, sourceUrl }, structure, expectedHost),
  }
}

function mergeStringArrays(
  left: string[] | undefined,
  right: string[] | undefined
) {
  return [...new Set([...(left ?? []), ...(right ?? [])])]
}

function mergedLocalePairObservation(
  primary: RecoveryProductObservation,
  alternate: RecoveryProductObservation
) {
  const primaryFields = primary.fields
  const alternateFields = alternate.fields
  const fields: RecoveryProductFields = {
    ...alternateFields,
    ...primaryFields,
    sourceId: primary.sourceUrl,
    alternateLocaleUrl: alternate.sourceUrl,
  }

  const categorySourceIds =
    primaryFields.categorySourceIds?.length
      ? primaryFields.categorySourceIds
      : alternateFields.categorySourceIds
  if (categorySourceIds?.length) fields.categorySourceIds = categorySourceIds

  const mediaSourceIds = mergeStringArrays(
    primaryFields.mediaSourceIds,
    alternateFields.mediaSourceIds
  )
  if (mediaSourceIds.length) fields.mediaSourceIds = mediaSourceIds

  return {
    authority: "direct_storefront" as const,
    sourceUrl: primary.sourceUrl,
    observedAt: primary.observedAt,
    note: [
      primary.note,
      `Bilingual storefront identity reconciled by matching SKU; alternate_locale=${alternate.sourceUrl}`,
    ]
      .filter(Boolean)
      .join("; "),
    fields,
  }
}

function uniqueProductsBySourceUrl(
  products: CapturedProductRecord[],
  expectedHost: string
) {
  const byUrl = new Map<string, CapturedProductRecord>()
  for (const product of products) {
    const sourceUrl = validHttpUrlOnHost(product.sourceUrl, expectedHost)
    if (!sourceUrl || byUrl.has(sourceUrl)) continue
    byUrl.set(sourceUrl, { ...product, sourceUrl })
  }
  return [...byUrl.values()]
}

export function buildDirectCaptureProductCandidates(
  bundle: CaptureArtifactBundle,
  expectedHost = COQUETTE_LEGACY_HOST
): RecoveryProductCandidate[] {
  const capturedAt = bundle.manifest.completedAt ?? bundle.manifest.startedAt
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) return []
  const productStructures = bundle.productStructures ?? {}
  const observations = uniqueProductsBySourceUrl(bundle.products, expectedHost)
    .map((product) =>
      directObservation(product, capturedAt, productStructures, expectedHost)
    )
    .filter((value): value is RecoveryProductObservation => Boolean(value))

  const withSku = new Map<string, RecoveryProductObservation[]>()
  const withoutSku: RecoveryProductObservation[] = []
  for (const observation of observations) {
    const sku = observation.fields.sku?.trim()
    if (!sku) {
      withoutSku.push(observation)
      continue
    }
    const key = sku.toLowerCase()
    const group = withSku.get(key) ?? []
    group.push(observation)
    withSku.set(key, group)
  }

  const candidates: RecoveryProductCandidate[] = withoutSku.map((observation) =>
    buildRecoveryProductCandidate(`direct:${observation.sourceUrl}`, [observation])
  )

  for (const group of withSku.values()) {
    const sku = group[0].fields.sku!
    const byLocale = new Map<string, RecoveryProductObservation[]>()
    for (const observation of group) {
      const locale = explicitLegacyLocale(observation.sourceUrl) ?? "unknown"
      const entries = byLocale.get(locale) ?? []
      entries.push(observation)
      byLocale.set(locale, entries)
    }

    const el = byLocale.get("el") ?? []
    const en = byLocale.get("en") ?? []
    const unknown = byLocale.get("unknown") ?? []
    const cleanBilingualPair =
      group.length === 2 && el.length === 1 && en.length === 1 && unknown.length === 0

    if (cleanBilingualPair) {
      const primary = el[0]
      const alternate = en[0]
      const merged = mergedLocalePairObservation(primary, alternate)
      const alternateEvidence: RecoveryProductObservation = {
        authority: "direct_storefront",
        sourceUrl: alternate.sourceUrl,
        observedAt: alternate.observedAt,
        note: "Alternate-locale direct storefront evidence retained for the reconciled SKU identity.",
        fields: {},
      }
      candidates.push(
        buildRecoveryProductCandidate(
          `direct:sku:${encodeURIComponent(sku)}`,
          [merged, alternateEvidence]
        )
      )
      continue
    }

    // Never auto-merge multiple URLs from the same locale or other ambiguous
    // SKU groupings. Preserve them independently so the duplicate-SKU gate
    // remains visible for evidence review.
    for (const observation of group) {
      candidates.push(
        buildRecoveryProductCandidate(`direct:${observation.sourceUrl}`, [observation])
      )
    }
  }

  return candidates.sort((left, right) =>
    left.candidateKey.localeCompare(right.candidateKey)
  )
}

async function readJsonl<T>(path: string): Promise<T[]> {
  const raw = await readFile(path, "utf8")
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

function safeRelativeArchivePath(value?: string) {
  if (!value) return false
  const normalized = value.replace(/\\/g, "/")
  return (
    !normalized.startsWith("/") &&
    !normalized.split("/").includes("..") &&
    !/^[a-zA-Z]:\//.test(normalized)
  )
}

async function resolveArchiveFile(captureDir: string, archivePath?: string) {
  if (!safeRelativeArchivePath(archivePath)) return undefined

  try {
    const root = await realpath(captureDir)
    const candidate = await realpath(resolve(captureDir, archivePath!))
    const relativePath = relative(root, candidate)
    const escapesRoot =
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)

    return escapesRoot ? undefined : candidate
  } catch {
    return undefined
  }
}

async function requireArchiveFile(captureDir: string, archivePath: string) {
  const path = await resolveArchiveFile(captureDir, archivePath)
  if (path) return path

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Capture artifact file is missing, unsafe, or resolves outside the capture directory: ${archivePath}`
  )
}

async function reconstructPageMedia(
  captureDir: string,
  pages: CapturePageRecord[],
  media: CaptureMediaRecord[],
  expectedHost: string
) {
  const availableMedia = new Set(
    media
      .map((record) => validHttpUrlOnHost(record.sourceUrl, expectedHost))
      .filter((value): value is string => Boolean(value))
  )
  const relationships: Record<string, string[]> = {}

  for (const page of pages) {
    const pageUrl = validHttpUrlOnHost(
      page.finalUrl ?? page.sourceUrl,
      expectedHost
    )
    if (!pageUrl || page.status !== "captured") continue

    const archiveFile = await resolveArchiveFile(captureDir, page.pageFile)
    if (!archiveFile) {
      relationships[pageUrl] = []
      continue
    }

    try {
      const html = await readFile(archiveFile, "utf8")
      relationships[pageUrl] = discoverMedia(html, pageUrl)
        .map((url) => validHttpUrlOnHost(url, expectedHost))
        .filter(
          (url): url is string =>
            typeof url === "string" && availableMedia.has(url)
        )
    } catch {
      relationships[pageUrl] = []
    }
  }

  return relationships
}

function normalizedCategorySourceUrl(value: string | undefined, expectedHost: string) {
  const url = validHttpUrl(value)
  if (!url || url.hostname !== expectedHost) return undefined
  const path = url.pathname.replace(/\/+$/, "") || "/"
  if (path === "/" || path === "/default" || path === "/en") return undefined
  url.search = ""
  return url.toString()
}

async function reconstructListingCategoryRelationships(
  captureDir: string,
  pages: CapturePageRecord[],
  expectedHost: string
) {
  const byProduct = new Map<string, ProductCategoryReference[]>()

  for (const page of pages) {
    if (page.status !== "captured" || page.pageType !== "category") continue
    const pageUrl = validHttpUrlOnHost(
      page.finalUrl ?? page.sourceUrl,
      expectedHost
    )
    if (!pageUrl) continue
    const categoryUrl =
      normalizedCategorySourceUrl(page.canonicalUrl, expectedHost) ??
      normalizedCategorySourceUrl(pageUrl, expectedHost)
    if (!categoryUrl) continue

    const archiveFile = await resolveArchiveFile(captureDir, page.pageFile)
    if (!archiveFile) continue
    try {
      const html = await readFile(archiveFile, "utf8")
      for (const productUrl of extractCategoryProductLinks(html, pageUrl)) {
        const normalizedProductUrl = validHttpUrlOnHost(productUrl, expectedHost)
        if (!normalizedProductUrl) continue
        const existing = byProduct.get(normalizedProductUrl) ?? []
        if (!existing.some((reference) => reference.url === categoryUrl)) {
          existing.push({ url: categoryUrl })
        }
        byProduct.set(normalizedProductUrl, existing)
      }
    } catch {
      // The original category page remains preserved for review.
    }
  }

  return byProduct
}

function mergeCategoryReferences(
  left: ProductCategoryReference[],
  right: ProductCategoryReference[]
) {
  const byUrl = new Map<string, ProductCategoryReference>()
  for (const reference of [...left, ...right]) {
    if (!byUrl.has(reference.url)) byUrl.set(reference.url, reference)
  }
  return [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url))
}

async function reconstructProductStructures(
  captureDir: string,
  products: CapturedProductRecord[],
  pages: CapturePageRecord[],
  media: CaptureMediaRecord[],
  expectedHost: string
) {
  const productUrls = new Set(
    products
      .map((product) => validHttpUrlOnHost(product.sourceUrl, expectedHost))
      .filter((value): value is string => typeof value === "string")
  )
  const capturedMedia = new Set(
    media
      .filter((record) => record.status === "captured")
      .map((record) => validHttpUrlOnHost(record.sourceUrl, expectedHost))
      .filter((value): value is string => typeof value === "string")
  )
  const listingCategories = await reconstructListingCategoryRelationships(
    captureDir,
    pages,
    expectedHost
  )
  const structures: Record<string, PublicProductStructureEvidence> = {}

  for (const page of pages) {
    const pageUrl = validHttpUrlOnHost(
      page.finalUrl ?? page.sourceUrl,
      expectedHost
    )
    if (
      !pageUrl ||
      page.status !== "captured" ||
      (page.pageType !== "product" && !productUrls.has(pageUrl))
    ) {
      continue
    }

    const archiveFile = await resolveArchiveFile(captureDir, page.pageFile)
    if (!archiveFile) continue

    try {
      const html = await readFile(archiveFile, "utf8")
      const structure = extractPublicProductStructure(html, pageUrl)
      const canonicalUrl = validHttpUrlOnHost(page.canonicalUrl, expectedHost)
      const listingReferences = mergeCategoryReferences(
        listingCategories.get(pageUrl) ?? [],
        canonicalUrl ? listingCategories.get(canonicalUrl) ?? [] : []
      )
      structures[pageUrl] = {
        ...structure,
        categoryReferences: mergeCategoryReferences(
          structure.categoryReferences,
          listingReferences
        ),
        galleryMedia: structure.galleryMedia.filter((url) => capturedMedia.has(url)),
      }
    } catch {
      // The page record remains preserved and validation/reconciliation can surface the gap.
    }
  }

  return structures
}

export async function readCaptureArtifactBundle(
  captureDir: string,
  expectedHost = COQUETTE_LEGACY_HOST
): Promise<CaptureArtifactBundle> {
  const manifestPath = await requireArchiveFile(captureDir, "manifest.json")
  const productsPath = await requireArchiveFile(captureDir, "products.jsonl")
  const pagesPath = await requireArchiveFile(captureDir, "pages.jsonl")
  const mediaPath = await requireArchiveFile(captureDir, "media.jsonl")

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as CaptureManifest
  const products = await readJsonl<CapturedProductRecord>(productsPath)
  const pages = await readJsonl<CapturePageRecord>(pagesPath)
  const media = await readJsonl<CaptureMediaRecord>(mediaPath)

  return {
    manifest,
    products,
    pages,
    media,
    pageMedia: await reconstructPageMedia(
      captureDir,
      pages,
      media,
      expectedHost
    ),
    productStructures: await reconstructProductStructures(
      captureDir,
      products,
      pages,
      media,
      expectedHost
    ),
  }
}
