import assert from "node:assert/strict"
import { extractPageEvidence } from "../reconstruction/html-evidence"
import { normalizeCrawlUrl } from "../reconstruction/capture-storefront"

const html = `<!doctype html>
<html lang="en">
<head>
  <title>Sample Dress | Coquette Concept</title>
  <meta name="description" content="Sample product description">
  <link rel="canonical" href="https://coquetteconcept.gr/en/sample-dress.html">
  <link rel="alternate" hreflang="el" href="https://coquetteconcept.gr/default/sample-dress.html">
  <link rel="alternate" hreflang="en" href="https://coquetteconcept.gr/en/sample-dress.html">
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"Product",
    "name":"Sample Dress",
    "sku":"SKU-42",
    "brand":{"@type":"Brand","name":"Ciel Concept"},
    "description":"A sample dress",
    "offers":{"@type":"Offer","price":"79.20","priceCurrency":"EUR","availability":"https://schema.org/InStock"}
  }
  </script>
</head>
<body class="catalog-product-view">
  <h1><span class="base">Sample Dress</span></h1>
  <span class="price">99,00 €</span>
  <span class="price">79,20 €</span>
  <div data-option-label="S"></div>
  <div data-option-label="M"></div>
  <div data-option-label="Passion Red"></div>
  <a href="/en/clothing.html?p=2&utm_source=test">More products</a>
  <a href="/customer/account/login/">Account</a>
  <img src="/media/catalog/product/sample.jpg" alt="Sample Dress">
</body>
</html>`

const evidence = extractPageEvidence(html, "https://coquetteconcept.gr/en/sample-dress.html")
assert.equal(evidence.pageType, "product")
assert.equal(evidence.product?.name, "Sample Dress")
assert.equal(evidence.product?.sku, "SKU-42")
assert.equal(evidence.product?.brand, "Ciel Concept")
assert.equal(evidence.product?.currency, "EUR")
assert.equal(evidence.product?.regularPrice, 99)
assert.equal(evidence.product?.salePrice, 79.2)
assert.equal(evidence.product?.availability, "https://schema.org/InStock")
assert.deepEqual(evidence.product?.sizes, ["S", "M"])
assert.deepEqual(evidence.product?.colors, ["Passion Red"])
assert.equal(evidence.media[0], "https://coquetteconcept.gr/media/catalog/product/sample.jpg")
assert.equal(evidence.hreflang.length, 2)

const legacyMagentoHtml = `<!doctype html>
<html><head><title>Women Clothes - Coquette Concept</title></head>
<body class="catalog-product-view">
  <h1 class="logo">Women Clothes - Coquette Concept</h1>
  <h2 class="product-title">FABBIA TOP CIEL</h2>
  <div class="product attribute sku"><span itemprop="sku">snp26-78ftc</span></div>
  <div class="swatch-attribute size" attribute-code="size">
    <div class="swatch-attribute-options">
      <div class="swatch-option text" option-label="S">S</div>
      <div class="swatch-option text" option-label="L">L</div>
    </div>
  </div>
</body></html>`
const legacyMagento = extractPageEvidence(
  legacyMagentoHtml,
  "https://coquetteconcept.gr/en/fabbia-top-ciel.html"
)
assert.equal(legacyMagento.pageType, "product")
assert.equal(legacyMagento.product?.name, "FABBIA TOP CIEL")
assert.equal(legacyMagento.product?.sku, "snp26-78ftc")
assert.deepEqual(legacyMagento.product?.sizes, ["S", "L"])

assert.equal(
  normalizeCrawlUrl(
    "https://coquetteconcept.gr/en/clothing.html?p=2&utm_source=test#products",
    "https://coquetteconcept.gr/"
  ),
  "https://coquetteconcept.gr/en/clothing.html?p=2"
)
assert.equal(
  normalizeCrawlUrl("https://coquetteconcept.gr/customer/account/login/", "https://coquetteconcept.gr/"),
  undefined
)
assert.equal(
  normalizeCrawlUrl("https://example.com/en/clothing.html", "https://coquetteconcept.gr/"),
  undefined
)

console.log("COQUETTE storefront capture contract checks passed")
