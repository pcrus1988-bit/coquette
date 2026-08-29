import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildDirectCaptureProductCandidates,
  readCaptureArtifactBundle,
  type CaptureArtifactBundle,
} from "../migration/capture-ingestion"
import { validateCaptureArtifactBundle } from "../migration/capture-validation"
import type { IndexedRecoveryBaseline } from "../migration/indexed-recovery"
import { buildReconstructionUrlUniverse } from "../migration/url-universe"

const capturedAt = "2026-08-26T18:30:00.000Z"
const productUrl = "https://coquetteconcept.gr/default/fixture-product.html"
const englishProductUrl = "https://coquetteconcept.gr/en/fixture-product.html"
const categoryUrl = "https://coquetteconcept.gr/default/clothing.html"
const mediaUrl = "https://coquetteconcept.gr/media/catalog/product/fixture.jpg"
const externalMediaUrl = "https://brand-assets.example/images/fixture.jpg"

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
  productStructures: {
    [productUrl]: {
      galleryMedia: [mediaUrl],
      categoryReferences: [{ name: "Clothing", url: categoryUrl }],
      optionGroups: [
        { name: "color", values: ["Black"] },
        { name: "size", values: ["S", "M"] },
      ],
      configurableVariants: [],
      configurableVariantMatrixComplete: false,
      configurableVariantMatrixIssues: [],
    },
  },
}

const validation = validateCaptureArtifactBundle(bundle)
assert.equal(validation.isValid, true)
assert.equal(validation.critical, 0)

const externalMediaBundle: CaptureArtifactBundle = {
  ...bundle,
  media: [
    ...bundle.media,
    {
      sourceUrl: externalMediaUrl,
      status: "captured",
      httpStatus: 200,
      contentType: "image/jpeg",
      bytes: 4321,
      checksum: "external-media-fixture-checksum",
      mediaFile: "media/external-fixture.jpg",
      capturedAt,
    },
  ],
  pageMedia: {
    [productUrl]: [mediaUrl, externalMediaUrl],
  },
}
const externalMediaValidation = validateCaptureArtifactBundle(externalMediaBundle)
assert.equal(externalMediaValidation.isValid, true)
assert.equal(externalMediaValidation.critical, 0)
assert.ok(
  externalMediaValidation.issues.some(
    (issue) =>
      issue.severity === "review" && issue.code === "external_media_source_url"
  )
)
assert.ok(
  externalMediaValidation.issues.some(
    (issue) =>
      issue.severity === "review" &&
      issue.code === "external_page_media_asset_url"
  )
)

const insecureExternalMediaBundle: CaptureArtifactBundle = {
  ...bundle,
  media: [
    ...bundle.media,
    {
      sourceUrl: "http://brand-assets.example/images/insecure.jpg",
      status: "error",
      capturedAt,
      error: "fixture",
    },
  ],
}
const insecureExternalMediaValidation = validateCaptureArtifactBundle(
  insecureExternalMediaBundle
)
assert.equal(insecureExternalMediaValidation.isValid, false)
assert.ok(
  insecureExternalMediaValidation.issues.some(
    (issue) =>
      issue.severity === "critical" && issue.code === "invalid_media_source_url"
  )
)

const invalidBundle: CaptureArtifactBundle = {
  ...bundle,
  products: [
    ...bundle.products,
    {
      sourceUrl: "https://example.com/foreign-product.html",
      canonicalUrl: "https://example.com/foreign-canonical.html",
      hreflang: [{ lang: "en", url: "https://example.com/en/foreign.html" }],
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
    (issue) => issue.code === "invalid_product_canonical_url"
  )
)
assert.ok(
  invalidValidation.issues.some(
    (issue) => issue.code === "invalid_product_hreflang_url"
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
assert.equal(direct.selected.brandSourceId, undefined)
assert.equal(direct.selected.optionValues?.color, "Black")
assert.equal(direct.selected.optionValues?.size, undefined)
assert.deepEqual(direct.selected.categorySourceIds, [categoryUrl])
assert.deepEqual(direct.selected.mediaSourceIds, [mediaUrl])
assert.ok(direct.missingRequiredFields.includes("status"))
assert.ok(direct.missingRequiredFields.includes("visibility"))
assert.ok(direct.missingRequiredFields.includes("type"))
assert.ok(!direct.missingRequiredFields.includes("categorySourceIds"))
assert.ok(!direct.missingRequiredFields.includes("mediaSourceIds"))
assert.equal(direct.normalizedProduct, undefined)

const foreignOnly = buildDirectCaptureProductCandidates({
  ...bundle,
  products: [
    {
      sourceUrl: "https://example.com/foreign-product.html",
      canonicalUrl: "https://example.com/foreign-product.html",
      name: "Foreign",
      sku: "FOREIGN-1",
    },
  ],
  pageMedia: {},
  productStructures: {},
})
assert.equal(foreignOnly.length, 0)

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
    {
      url: "https://example.com/foreign-indexed.html",
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
assert.ok(
  !unresolved.entries.some((entry) => entry.url.includes("example.com"))
)

const classified = buildReconstructionUrlUniverse(bundle.pages, baseline, [
  {
    url: "https://coquetteconcept.gr/default/failing.html",
    note: "Direct recovery unavailable after documented repeated challenge response",
  },
  {
    url: "https://coquetteconcept.gr/default/indexed-only.html",
    note: "Indexed historical URL no longer directly recoverable",
  },
  {
    url: "https://example.com/foreign-manual.html",
    note: "Must never enter the COQUETTE legacy URL universe",
  },
])

assert.equal(classified.totals.captured, 1)
assert.equal(classified.totals.skipped, 1)
assert.equal(classified.totals.error, 0)
assert.equal(classified.totals.indexed_only, 0)
assert.equal(classified.totals.unavailable, 2)
assert.equal(classified.unresolved, 0)
assert.equal(classified.isFullyClassified, true)
assert.ok(
  !classified.entries.some((entry) => entry.url.includes("example.com"))
)

const capturedEntry = classified.entries.find((entry) => entry.url === productUrl)
assert.equal(capturedEntry?.status, "captured")
assert.equal(capturedEntry?.evidence.length, 2)

async function verifyArchiveReadBoundary() {
  const root = await mkdtemp(join(tmpdir(), "coquette-capture-boundary-"))
  const captureDir = join(root, "capture")
  const pagesDir = join(captureDir, "pages")
  const outsideHtml = join(root, "outside.html")
  const traversalUrl = "https://coquetteconcept.gr/default/traversal.html"
  const symlinkUrl = "https://coquetteconcept.gr/default/symlink.html"

  try {
    await mkdir(pagesDir, { recursive: true })
    await writeFile(
      outsideHtml,
      `<html><body><img src="${mediaUrl}"></body></html>`,
      "utf8"
    )
    await symlink(outsideHtml, join(pagesDir, "outside-link.html"))

    await writeFile(
      join(captureDir, "manifest.json"),
      `${JSON.stringify({
        captureId: "boundary-fixture",
        source: "https://coquetteconcept.gr",
        evidenceMode: "public_storefront",
        startedAt: capturedAt,
        completedAt: capturedAt,
        complete: false,
      })}\n`,
      "utf8"
    )
    await writeFile(join(captureDir, "products.jsonl"), "", "utf8")
    await writeFile(
      join(captureDir, "pages.jsonl"),
      [
        {
          sourceUrl: traversalUrl,
          finalUrl: traversalUrl,
          status: "captured",
          capturedAt,
          pageFile: "../outside.html",
        },
        {
          sourceUrl: symlinkUrl,
          finalUrl: symlinkUrl,
          status: "captured",
          capturedAt,
          pageFile: "pages/outside-link.html",
        },
      ]
        .map((record) => JSON.stringify(record))
        .join("\n") + "\n",
      "utf8"
    )
    await writeFile(
      join(captureDir, "media.jsonl"),
      `${JSON.stringify({
        sourceUrl: mediaUrl,
        status: "captured",
        mediaFile: "media/fixture.jpg",
        capturedAt,
      })}\n`,
      "utf8"
    )

    const readBundle = await readCaptureArtifactBundle(captureDir)
    assert.deepEqual(readBundle.pageMedia[traversalUrl], [])
    assert.deepEqual(readBundle.pageMedia[symlinkUrl], [])
    assert.equal(readBundle.productStructures?.[traversalUrl], undefined)
    assert.equal(readBundle.productStructures?.[symlinkUrl], undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

verifyArchiveReadBoundary()
  .then(() => {
    console.log(
      "COQUETTE capture ingestion, archive containment and URL universe contract checks passed"
    )
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
