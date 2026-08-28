import assert from "node:assert/strict"
import {
  extractCategoryProductLinks,
  extractPublicProductStructure,
} from "../reconstruction/product-structure"

const pageUrl = "https://coquetteconcept.gr/default/sample-dress.html"
const categoryUrl = "https://coquetteconcept.gr/default/clothing.html"
const schemaImage =
  "https://coquetteconcept.gr/media/catalog/product/sample-schema.jpg"
const catalogImage =
  "https://coquetteconcept.gr/media/catalog/product/sample-gallery.jpg"
const relatedImage =
  "https://coquetteconcept.gr/media/catalog/product/related-product.jpg"
const ogImage =
  "https://coquetteconcept.gr/media/catalog/product/sample-social.jpg"
const logoImage = "https://coquetteconcept.gr/media/logo/stores/1/logo.png"
const footerImage = "https://coquetteconcept.gr/media/wysiwyg/footer-card.png"

const html = `<!doctype html>
<html>
<head>
  <meta property="og:image" content="${ogImage}">
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@graph":[
      {
        "@type":"BreadcrumbList",
        "itemListElement":[
          {"@type":"ListItem","position":1,"name":"Home","item":"https://coquetteconcept.gr/default/"},
          {"@type":"ListItem","position":2,"name":"Clothing","item":"${categoryUrl}"},
          {"@type":"ListItem","position":3,"name":"Sample Dress","item":"${pageUrl}"}
        ]
      },
      {
        "@type":"Product",
        "name":"Sample Dress",
        "sku":"STRUCT-1",
        "image":["${schemaImage}"]
      }
    ]
  }
  </script>
</head>
<body class="catalog-product-view">
  <nav class="breadcrumbs">
    <a href="/default/">Home</a>
    <a href="/default/clothing.html">Clothing</a>
  </nav>
  <img src="${logoImage}" alt="Logo">
  <div class="gallery-placeholder" data-gallery-role="gallery-placeholder">
    <img class="product-image-photo" src="${catalogImage}" alt="Sample Dress">
  </div>
  <section class="related-products">
    <img class="product-image-photo" src="${relatedImage}" alt="Related Dress">
  </section>
  <img src="${footerImage}" alt="Footer card">

  <div data-role="swatch-options"></div>
  <select data-attribute-code="color" aria-label="Color">
    <option value="">Choose</option>
    <option value="black">Black</option>
  </select>
  <select data-attribute-code="size" aria-label="Size">
    <option value="">Choose</option>
    <option value="s">S</option>
    <option value="m">M</option>
  </select>
</body>
</html>`

const structure = extractPublicProductStructure(html, pageUrl)

assert.deepEqual(structure.galleryMedia.sort(), [
  catalogImage,
  ogImage,
  schemaImage,
].sort())
assert.ok(!structure.galleryMedia.includes(relatedImage))
assert.ok(!structure.galleryMedia.includes(logoImage))
assert.ok(!structure.galleryMedia.includes(footerImage))

assert.deepEqual(structure.categoryReferences, [
  { name: "Clothing", url: categoryUrl },
])
assert.ok(
  !structure.categoryReferences.some((reference) =>
    reference.url.endsWith("/default/")
  )
)
assert.ok(
  !structure.categoryReferences.some((reference) => reference.url === pageUrl)
)

assert.deepEqual(structure.optionGroups, [
  { name: "color", values: ["Black"] },
  { name: "size", values: ["S", "M"] },
])
assert.equal(structure.typeHint, "configurable")
assert.match(structure.typeEvidence ?? "", /configurable-product/i)

const swatchHtml = `<!doctype html><html><body class="catalog-product-view">
<div class="swatch-attribute size" attribute-code="size">
  <span class="swatch-attribute-label">ΜΕΓΕΘΟΣ</span>
  <div class="swatch-attribute-options clearfix">
    <div class="swatch-option text" option-label="S">S</div>
    <div class="swatch-option text" option-label="L">L</div>
  </div>
</div>
</body></html>`
const swatchStructure = extractPublicProductStructure(swatchHtml, pageUrl)
assert.deepEqual(swatchStructure.optionGroups, [
  { name: "size", values: ["S", "L"] },
])
assert.equal(swatchStructure.typeHint, "configurable")

const listingHtml = `<!doctype html><html><body>
<a class="product-item-link" href="/default/sample-dress.html">Sample Dress</a>
<a class="action compare" href="/catalog/product_compare/add/product/1">Compare</a>
<a class="product-item-link" href="https://coquetteconcept.gr/default/sample-top.html">Sample Top</a>
</body></html>`
assert.deepEqual(
  extractCategoryProductLinks(listingHtml, categoryUrl),
  [
    "https://coquetteconcept.gr/default/sample-dress.html",
    "https://coquetteconcept.gr/default/sample-top.html",
  ]
)

const ambiguousSimpleHtml = `<!doctype html>
<html><body class="catalog-product-view">
  <img src="${catalogImage}">
</body></html>`
const ambiguous = extractPublicProductStructure(ambiguousSimpleHtml, pageUrl)
assert.equal(ambiguous.typeHint, undefined)
assert.equal(ambiguous.typeEvidence, undefined)
assert.deepEqual(ambiguous.galleryMedia, [])

const foreignMediaHtml = `<!doctype html>
<html><head>
  <meta property="og:image" content="https://example.com/foreign.jpg">
  <script type="application/ld+json">
  {"@type":"Product","image":"https://example.com/foreign-schema.jpg"}
  </script>
</head><body>
  <div data-gallery-role="gallery-placeholder">
    <img src="https://example.com/foreign-product.jpg">
  </div>
</body></html>`
const foreign = extractPublicProductStructure(foreignMediaHtml, pageUrl)
assert.deepEqual(foreign.galleryMedia, [])

console.log("COQUETTE public product structure contract checks passed")
