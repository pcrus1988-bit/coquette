import assert from "node:assert/strict"
import { extractAuthoritativeProductPageEvidence } from "../reconstruction/authoritative-product-page"
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
assert.deepEqual(
  extractCategoryProductLinks(
    listingHtml,
    "https://coquetteconcept.gr/default/checkout/cart/"
  ),
  []
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

// Real-capture regression shape: the page contains unrelated recommendation
// prices, while the current configurable product has its own price box/jsonConfig.
// Only the current product evidence may be accepted.
const authoritativeConfigurableHtml = `<!doctype html>
<html>
<head>
  <meta property="product:price:currency" content="EUR">
  <script type="application/ld+json">
    {"@type":"Product","name":"Current Product","sku":"PARENT-1","offers":{"@type":"Offer","price":"16","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}
  </script>
</head>
<body class="catalog-product-view page-product-configurable catalog_product_view_type_configurable catalog_product_view_id_500">
  <form id="product_addtocart_form" data-product-sku="PARENT-1">
    <input type="hidden" name="product" value="500">
  </form>
  <div class="price-box" data-product-id="500">
    <span data-price-type="oldPrice" data-price-amount="80"><span class="price">€80</span></span>
    <span data-price-type="finalPrice" data-price-amount="16"><span class="price">€16</span></span>
  </div>
  <section class="related-products">
    <div class="price-box" data-product-id="999">
      <span data-price-type="oldPrice" data-price-amount="139"><span class="price">€139</span></span>
      <span data-price-type="finalPrice" data-price-amount="31"><span class="price">€31</span></span>
    </div>
  </section>
  <script type="text/x-magento-init">
  {
    "#product_addtocart_form": {
      "configurable": {
        "jsonConfig": {
          "productId": "500",
          "prices": {
            "oldPrice": {"amount": 80},
            "basePrice": {"amount": 16},
            "finalPrice": {"amount": 16}
          },
          "attributes": {
            "144": {
              "id": "144",
              "code": "size",
              "label": "Size",
              "options": [
                {"id": "10", "label": "S", "products": ["501"]},
                {"id": "11", "label": "M", "products": ["502"]}
              ]
            },
            "93": {
              "id": "93",
              "code": "color",
              "label": "Color",
              "options": [
                {"id": "20", "label": "Black", "products": ["501","502"]}
              ]
            }
          },
          "index": {
            "501": {"144":"10","93":"20"},
            "502": {"144":"11","93":"20"}
          },
          "optionPrices": {
            "501": {"oldPrice":{"amount":80},"basePrice":{"amount":16},"finalPrice":{"amount":16}},
            "502": {"oldPrice":{"amount":80},"basePrice":{"amount":20},"finalPrice":{"amount":20}}
          },
          "images": []
        }
      }
    }
  }
  </script>
</body>
</html>`

const authoritative = extractAuthoritativeProductPageEvidence(
  authoritativeConfigurableHtml,
  pageUrl
)
assert.equal(authoritative.productType, "configurable")
assert.equal(authoritative.parentProductId, "500")
assert.equal(authoritative.regularPrice, 80)
assert.equal(authoritative.salePrice, 16)
assert.equal(authoritative.currencyCode, "EUR")
assert.equal(authoritative.availability, "https://schema.org/InStock")
assert.equal(authoritative.configurableMatrixComplete, true)
assert.deepEqual(authoritative.configurableMatrixIssues, [])
assert.deepEqual(authoritative.configurableVariants, [
  {
    sourceProductId: "501",
    optionValues: { size: "S", color: "Black" },
    regularPrice: 80,
    salePrice: 16,
  },
  {
    sourceProductId: "502",
    optionValues: { size: "M", color: "Black" },
    regularPrice: 80,
    salePrice: 20,
  },
])
assert.ok(
  !authoritative.configurableVariants.some((variant) => "sku" in variant),
  "Child SKU must remain absent when Magento jsonConfig does not expose it"
)

const simpleHtml = `<!doctype html>
<html><head>
<script type="application/ld+json">
{"@type":"Product","name":"Simple Product","sku":"SIMPLE-1","offers":{"@type":"Offer","price":"49","priceCurrency":"EUR"}}
</script>
</head><body class="catalog-product-view page-product-simple catalog_product_view_type_simple catalog_product_view_id_700">
<form data-product-sku="SIMPLE-1"><input name="product" value="700"></form>
<div class="price-box" data-product-id="700"><span data-price-type="finalPrice" data-price-amount="49">€49</span></div>
<div class="related-products"><span class="price">€999</span></div>
</body></html>`
const simple = extractAuthoritativeProductPageEvidence(simpleHtml, pageUrl)
assert.equal(simple.productType, "simple")
assert.equal(simple.parentProductId, "700")
assert.equal(simple.regularPrice, 49)
assert.equal(simple.salePrice, undefined)
assert.deepEqual(simple.configurableVariants, [])
assert.equal(simple.configurableMatrixComplete, false)

console.log("COQUETTE public product structure contract checks passed")
