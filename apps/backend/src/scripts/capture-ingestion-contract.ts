import assert from "node:assert/strict"
import {
  buildDirectCaptureProductCandidates,
  type CaptureArtifactBundle,
} from "../migration/capture-ingestion"
import { validateCaptureArtifactBundle } from "../migration/capture-validation"
import type { IndexedRecoveryBaseline } from "../migration/indexed-recovery"
import { buildReconstructionUrlUniverse } from "../migration/url-universe"

const capturedAt = "2026-08-26T18:30:00.000Z"
const productUrl = "https://coquetteconcept.gr/default/fixture-product.html"
const englishProductUrl = "https://coquetteconcept.gr/en/fixture-product.html"
const mediaUrl = "https://coquetteconcept.gr/media/catalog/product/fixture.jpg"

const bundle: CaptureArtifactBundle = {
  manifest: {
    captureId: "fixture-capture",
    source: "https://coquetteconcept.gr",
    evidenceMode: "public_storefront",
    startedAt: "2026-08-26T18:00:00.000Z",
    completedAt: capturedAt,
    complete: false,
  },
  products: [
    {
      sourceUrl: productUrl,
      checksum: "fixture-checksum",
      canonicalUrl: productUrl,
      hreflang: [{ lang: "en", url: englishProductUrl }],
      name: "Direct fixture product",
      sku: "COQ-FIXTURE-1",
      brand: "Fixture Designer",
      currency: "EUR",
      regularPrice: 129,
      salePrice: 99,
      availability: "https://schema.org/InStock",
      colors: ["Black"],
      sizes: ["S", "M"],
      optionLabels: ["Black", "S", "M"],
      description: "Captured public description",
    },
  ],
  pages: [
    {
      sourceUrl: productUrl,
      finalUrl: productUrl,
      status: "captured",
      httpStatus: 200,
      capturedAt,
      pageFile: "pages/fixture.html",
      pageType: "product",
      canonicalUrl: productUrl,
      checksum: "fixture-checksum",
    },
    {
      sourceUrl: "https://coquetteconcept.gr/default/failing.html",
      status: "error",
      httpStatus: 403,
      capturedAt,
      error: "HTTP 403",
    },
    {
      sourceUrl: "https://coquetteconcept.gr/default/robots-skipped.html",
      status: "skipped",
      capturedAt,
      error: "robots.txt disallow",
    },
  ],
  media: [
    {
      sourceUrl: mediaUrl,
      status: "captured",
      httpStatus: 200,
      contentType: "image/jpeg",
      bytes: 1234,
      checksum: "media-fixture-checksum",
      mediaFile: "media/fixture.jpg",
      capturedAt,
    },
  ],
  pageMedia: {
    [productUrl]: [mediaUrl],
  },
}

const validation = validateCaptureArtifactBundle(bundle)
assert.equal(validation.isValid, true)
assert.equal(validation.critical, 0)

const invalidBundle: CaptureArtifactBundle = {
  ...bundle,
  products: [
    ...bundle.products,
    {
      sourceUrl: "https://example.com/foreign-product.html",
      name: "Foreign fixture",
    },
  ],
  pages: [
    ...bundle.pages,
    {
      sourceUrl: "https://coquetteconcept.gr/default/path-escape.html",
      status: "captured",
      capturedAt,
      pageFile: "../escape.html",
    },
  ],
}

const invalidValidation = validateCaptureArtifactBundle(invalidBundle)
assert.equal(invalidValidation.isValid, false)
assert.ok(
  invalidValidation.issues.some(
    (issue) => issue.code === "invalid_product_source_url"
  )
)
assert.ok(
  invalidValidation.issues.some(
    (issue) => issue.code === "unsafe_page_archive_path"
  )
)

const candidates = buildDirectCaptureProductCandidates(bundle)
assert.equal(candidates.length, 1)
const direct = candidates[0]
assert.equal(direct.disposition, "needs_review")
assert.equal(direct.selected.sourceId, productUrl)
assert.equal(direct.selected.canonicalUrl, productUrl)
assert.equal(direct.selected.alternateLocaleUrl, englishProductUrl)
assert.equal(direct.selected.sku, "COQ-FIXTURE-1")
assert.equal(direct.selected.name, "Direct fixture product")
assert.equal(direct.selected.regularPrice, 129)
assert.equal(direct.selected.salePrice, 99)
assert.equal(direct.selected.currencyCode, "EUR")
assert.equal(direct.selected.stockState, "in_stock")
assert.equal(direct.selected.brandSourceId, "public-brand:Fixture Designer")
assert.equal(direct.selected.optionValues?.color, "Black")
assert.equal(direct.selected.optionValues?.size, undefined)
assert.deepEqual(direct.selected.mediaSourceIds, [mediaUrl])
assert.ok(direct.missingRequiredFields.includes("status"))
assert.ok(direct.missingRequiredFields.includes("visibility"))
assert.ok(direct.missingRequiredFields.includes("type"))
assert.ok(direct.missingRequiredFields.includes("categorySourceIds"))
assert.ok(!direct.missingRequiredFields.includes("mediaSourceIds"))
assert.equal(direct.normalizedProduct, undefined)

const baseline: IndexedRecoveryBaseline = {
  schemaVersion: 1,
  observedAt: "2026-08-26T15:00:00Z",
  provenance: {
    kind: "public_search_index",
    sourceHost: "coquetteconcept.gr",
    confidence: "derived",
    freshnessWarning: "fixture indexed freshness",
  },
  catalogSignals: [
    {
      url: productUrl,
      observedCount: 1,
      unit: "product",
      indexFreshness: "today",
    },
    {
      url: "https://coquetteconcept.gr/default/indexed-only.html",
      observedCount: 1,
      unit: "product",
      indexFreshness: "today",
    },
  ],
  recentProductSpotChecks: [],
}

const unresolved = buildReconstructionUrlUniverse(bundle.pages, baseline)
assert.equal(unresolved.totals.captured, 1)
assert.equal(unresolved.totals.skipped, 1)
assert.equal(unresolved.totals.error, 1)
assert.equal(unresolved.totals.indexed_only, 1)
assert.equal(unresolved.totals.unavailable, 0)
assert.equal(unresolved.unresolved, 2)
assert.equal(unresolved.isFullyClassified, false)

const classified = buildReconstructionUrlUniverse(bundle.pages, baseline, [
  {
    url: "https://coquetteconcept.gr/default/failing.html",
    note: "Direct recovery unavailable after documented repeated challenge response",
  },
  {
    url: "https://coquetteconcept.gr/default/indexed-only.html",
    note: "Indexed historical URL no longer directly recoverable",
  },
])

assert.equal(classified.totals.captured, 1)
assert.equal(classified.totals.skipped, 1)
assert.equal(classified.totals.error, 0)
assert.equal(classified.totals.indexed_only, 0)
assert.equal(classified.totals.unavailable, 2)
assert.equal(classified.unresolved, 0)
assert.equal(classified.isFullyClassified, true)

const capturedEntry = classified.entries.find((entry) => entry.url === productUrl)
assert.equal(capturedEntry?.status, "captured")
assert.equal(capturedEntry?.evidence.length, 2)

console.log("COQUETTE capture ingestion and URL universe contract checks passed")
