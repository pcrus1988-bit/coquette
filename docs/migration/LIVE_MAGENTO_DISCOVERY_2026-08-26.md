# Live Magento Discovery — 2026-08-26

This is a dated public-storefront observation record. It is useful for migration coverage and parity checks, but it is **not** the authoritative Magento export.

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
- Account
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

These counts can change at any time. They are regression/reconciliation signals only and must not replace Magento database/export counts.

## Product-detail signals

Sample public product pages confirm that the migration/parity model must handle visible fields and states including:

- SKU
- regular price and sale price
- percentage-sale presentation
- in-stock / out-of-stock state
- low-stock messaging such as "only 1 left"
- delivery message
- quantity selector
- color
- size / one-size values
- designer
- country of manufacture where present
- long-form descriptions and bullet details
- size-guide surface on applicable products
- reviews/review form surface
- image gallery

Examples also show mixed localization quality: an English product page can contain a Greek product description. Content must therefore be migrated according to actual Magento store-view values rather than assuming that every English store-view field is translated.

One indexed English product was observed using Magento's internal catalog route (`/en/catalog/product/view/id/.../category/.../`) instead of only the pretty URL. URL-rewrite extraction and redirect coverage must include such indexable fallback routes where they appear in the source URL inventory.

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

The migration redirect manifest therefore needs explicit handling for:

- `/default/` Greek prefixes
- `/en/` English prefixes
- legacy `.html` category/designer/product URLs
- Magento internal `catalog/product/view/...` URLs if indexed
- pagination/filter query parameters and their canonical/indexing behavior

## Shipping/returns content observed

Current public English delivery page states, as a dated observation:

- Greece shipping: €4
- Cyprus shipping: €20
- free Greece shipping over €100
- COD additional fee: €2
- ELTA Courier and Geniki Taxydromiki named as courier partners
- store pickup available
- returns request window stated as 14 calendar days

These values are content/business-rule discovery inputs. They must be confirmed with the merchant and Magento configuration before implementation or production migration.

## Physical-store/contact signal

The current Greek contact page publicly presents a physical store at Βρασίδου 119, 23100, Αρχαία Σπάρτη and telephone 2731 0 20404. Contact/business identity data must be verified before the new production site is published.

## Data-access gap

Public crawling cannot reliably provide:

- Magento source IDs
- full SKU/variant relationship graph
- EAV attribute IDs and scopes
- authoritative stock quantities
- tax configuration
- customer data
- historical orders
- payment transactions
- URL-rewrite database state
- extension-owned fields
- cron/integration configuration

The next migration milestone therefore requires controlled Magento administrative/database/export and media access.
