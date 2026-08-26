# Live Legacy Storefront Discovery — 2026-08-26

The public storefront at `https://coquetteconcept.gr/` is now the **primary recoverable legacy evidence source** because Magento administrative/database access is no longer available.

This document records dated observations that guide the Phase 4 reconstruction crawler. The crawler must preserve source URL, capture timestamp, checksum and extraction warnings for each reconstructed record.

## Observed storefront shape

Current public storefront surfaces include:

- Greek and English storefronts
- Clothing catalogue
- nested clothing categories
- Designers
- Accessories and nested accessory categories
- Sale
- Our Story / content pages
- Search
- Account/login surfaces
- Cart
- Wishlist
- product listings with pagination and sorting
- layered filters including price, designer, color and size
- product new/sale/out-of-stock states
- newsletter signup
- delivery/returns content
- physical-store/contact content

## Dated catalogue signals

Observed through the public storefront/search index on 2026-08-26:

- English Clothing page: 509 items
- English New In page: 499 items
- English Swimwear category: 27 items
- English Ciel Concept designer page: 17 items
- English Individual Art Leather designer page: 37 items
- Greek Bags accessory category: 18 items
- Greek Dresses page observed with 101 items and 12-item pagination

These counts can change and must be captured per crawl run. They are discovery/reconciliation signals for the public URL universe, not inaccessible database totals.

## Product-detail evidence confirmed publicly

Sample public product pages confirm direct recoverability of fields/states including:

- SKU
- regular price
- sale price
- percentage-sale presentation
- in-stock / out-of-stock state
- low-stock messaging such as `Μόνο 1 έμεινε` / `Only 1 left`
- delivery message
- quantity selector
- color
- size / one-size values where exposed
- designer
- country of manufacture where present
- long-form descriptions and bullet details
- composition/materials
- care instructions
- fit/model dimensions
- size-guide surface on applicable products
- reviews/review form surface
- image gallery surface

Examples show mixed localization quality: an English product page can contain Greek product description content. Reconstruction must preserve actual observed locale values rather than assuming translation quality.

One indexed English product was observed using Magento's internal catalog route (`/en/catalog/product/view/id/.../category/.../`) instead of only the pretty URL. URL discovery and redirect coverage must therefore include publicly indexed fallback routes where found.

## URL patterns observed

Examples show Magento-style locale and `.html` routes such as:

- `/en/clothing.html`
- `/en/designers/ciel-concept.html`
- `/en/clothing/clothing-categories/sweemwear.html`
- `/default/designers/ciel-concept.html`
- `/default/accessories/accessories-category/bags.html`

Pagination and layered navigation are query-string based, for example:

- `?p=2`
- `?color=<attribute-option-id>`

The reconstruction crawler/redirect manifest must explicitly handle:

- `/default/` Greek prefixes
- `/en/` English prefixes
- legacy `.html` category/designer/product URLs
- Magento internal `catalog/product/view/...` URLs if discoverable/indexed
- pagination/filter query parameters without allowing infinite URL expansion
- canonical/indexing behavior visible from the public storefront

## Shipping/returns content observed

Current public English delivery page states, as a dated observation:

- Greece shipping: €4
- Cyprus shipping: €20
- free Greece shipping over €100
- COD additional fee: €2
- ELTA Courier and Geniki Taxydromiki named as courier partners
- store pickup available
- returns request window stated as 14 calendar days

These are legacy public-content observations. They are not automatically the future COQUETTE business policy and must be merchant-confirmed before production configuration.

## Physical-store/contact signal

The current Greek contact page publicly presents a physical store at Βρασίδου 119, 23100, Αρχαία Σπάρτη and telephone 2731 0 20404. Contact/business identity data must be verified before the replacement production site is published.

## Known non-recoverable legacy domains

Public storefront reconstruction cannot reliably provide:

- Magento numeric source IDs
- authoritative hidden configurable/simple relationship graph where not exposed by options
- exact stock quantities when the site shows only stock state/low-stock text
- admin-only EAV attributes
- tax configuration
- customer accounts/passwords/address books
- historical orders/invoices/shipments/credit memos
- payment transactions/tokens
- private promotion/cart-rule definitions
- disabled/unpublished content
- extension configuration
- cron/integration secrets

These are known source limitations and must be classified as unavailable rather than fabricated.

## Active Phase 4 plan

The canonical reconstruction strategy is documented in:

- `docs/migration/STOREFRONT_RECONSTRUCTION_PLAN.md`

A full capture must discover, fetch, classify, checksum and reconstruct all in-scope publicly reachable catalogue/content/media/SEO evidence before the legacy storefront is retired.
