import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildDirectCaptureProductCandidates,
  readCaptureArtifactBundle,
} from "../migration/capture-ingestion"

const capturedAt = "2026-08-26T19:30:00.000Z"
const productUrl = "https://coquetteconcept.gr/default/archive-dress.html"
const categoryUrl = "https://coquetteconcept.gr/default/clothing/dresses.html"
const productMedia =
  "https://coquetteconcept.gr/media/catalog/product/archive-dress.jpg"
const relatedMedia =
  "https://coquetteconcept.gr/media/catalog/product/related-dress.jpg"
const logoMedia = "https://coquetteconcept.gr/media/logo/stores/1/logo.png"

async function main() {
  const root = await mkdtemp(join(tmpdir(), "coquette-structure-archive-"))
  const captureDir = join(root, "capture")
  const pagesDir = join(captureDir, "pages")
  const mediaDir = join(captureDir, "media")

  try {
    await mkdir(pagesDir, { recursive: true })
    await mkdir(mediaDir, { recursive: true })

    const html = `<!doctype html>
<html>
<head>
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@graph":[
      {
        "@type":"BreadcrumbList",
        "itemListElement":[
          {"@type":"ListItem","position":1,"name":"Home","item":"https://coquetteconcept.gr/default/"},
          {"@type":"ListItem","position":2,"name":"Dresses","item":"${categoryUrl}"},
          {"@type":"ListItem","position":3,"name":"Archive Dress","item":"${productUrl}"}
        ]
      },
      {
        "@type":"Product",
        "name":"Archive Dress",
        "sku":"ARCHIVE-1",
        "image":"${productMedia}"
      }
    ]
  }
  </script>
</head>
<body class="catalog-product-view">
  <img src="${logoMedia}">
  <div data-gallery-role="gallery-placeholder">
    <img src="${productMedia}">
  </div>
  <section class="related-products"><img src="${relatedMedia}"></section>
  <div data-role="swatch-options"></div>
  <select data-attribute-code="color">
    <option value="">Choose</option>
    <option value="black">Black</option>
  </select>
  <select data-attribute-code="size">
    <option value="">Choose</option>
    <option value="s">S</option>
    <option value="m">M</option>
  </select>
</body>
</html>`

    await writeFile(join(pagesDir, "product.html"), html, "utf8")
    await writeFile(join(mediaDir, "product.jpg"), "product", "utf8")
    await writeFile(join(mediaDir, "related.jpg"), "related", "utf8")
    await writeFile(join(mediaDir, "logo.png"), "logo", "utf8")

    await writeFile(
      join(captureDir, "manifest.json"),
      `${JSON.stringify({
        captureId: "archive-structure-fixture",
        source: "https://coquetteconcept.gr",
        evidenceMode: "public_storefront",
        startedAt: capturedAt,
        completedAt: capturedAt,
        complete: true,
      })}\n`,
      "utf8"
    )
    await writeFile(
      join(captureDir, "products.jsonl"),
      `${JSON.stringify({
        sourceUrl: productUrl,
        checksum: "fixture-product-checksum",
        canonicalUrl: productUrl,
        name: "Archive Dress",
        sku: "ARCHIVE-1",
        currency: "EUR",
        regularPrice: 120,
        availability: "https://schema.org/InStock",
      })}\n`,
      "utf8"
    )
    await writeFile(
      join(captureDir, "pages.jsonl"),
      `${JSON.stringify({
        sourceUrl: productUrl,
        finalUrl: productUrl,
        status: "captured",
        httpStatus: 200,
        capturedAt,
        pageFile: "pages/product.html",
        pageType: "product",
        canonicalUrl: productUrl,
        checksum: "fixture-product-checksum",
      })}\n`,
      "utf8"
    )
    await writeFile(
      join(captureDir, "media.jsonl"),
      [
        {
          sourceUrl: productMedia,
          status: "captured",
          mediaFile: "media/product.jpg",
          capturedAt,
        },
        {
          sourceUrl: relatedMedia,
          status: "captured",
          mediaFile: "media/related.jpg",
          capturedAt,
        },
        {
          sourceUrl: logoMedia,
          status: "captured",
          mediaFile: "media/logo.png",
          capturedAt,
        },
      ]
        .map((record) => JSON.stringify(record))
        .join("\n") + "\n",
      "utf8"
    )

    const bundle = await readCaptureArtifactBundle(captureDir)
    const structure = bundle.productStructures?.[productUrl]
    assert.ok(structure)
    assert.deepEqual(structure.galleryMedia, [productMedia])
    assert.ok(!structure.galleryMedia.includes(relatedMedia))
    assert.ok(!structure.galleryMedia.includes(logoMedia))
    assert.deepEqual(structure.categoryReferences, [
      { name: "Dresses", url: categoryUrl },
    ])
    assert.deepEqual(structure.optionGroups, [
      { name: "color", values: ["Black"] },
      { name: "size", values: ["S", "M"] },
    ])
    assert.equal(structure.typeHint, "configurable")
    assert.deepEqual(structure.configurableVariants, [])
    assert.equal(structure.configurableVariantMatrixComplete, false)

    const candidates = buildDirectCaptureProductCandidates(bundle)
    assert.equal(candidates.length, 1)
    const candidate = candidates[0]
    assert.deepEqual(candidate.selected.mediaSourceIds, [productMedia])
    assert.deepEqual(candidate.selected.categorySourceIds, [categoryUrl])
    assert.equal(candidate.selected.optionValues, undefined)
    assert.deepEqual(candidate.selected.configurableVariants, [])
    assert.equal(candidate.selected.configurableVariantMatrixComplete, false)
    assert.equal(candidate.selected.type, "configurable")
    assert.ok(candidate.missingRequiredFields.includes("status"))
    assert.ok(candidate.missingRequiredFields.includes("visibility"))
    assert.ok(candidate.missingRequiredFields.includes("optionValues"))
    assert.equal(candidate.disposition, "needs_review")

    console.log("COQUETTE archive-native product structure contract checks passed")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
