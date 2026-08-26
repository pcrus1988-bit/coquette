# COQUETTE Public Storefront Reconstruction Plan

**Status:** active Phase 4 source strategy  
**Legacy source:** `https://coquetteconcept.gr/`  
**Evidence mode:** public storefront only  
**Reason:** administrative/database access to the legacy Magento installation is no longer available.

## Decision

COQUETTE will not wait for, require, or assume access to a Magento database, Magento Admin, filesystem, API credentials, customer export, order export, or `pub/media` archive.

Phase 4 is therefore a **forensic storefront reconstruction** rather than a conventional Magento migration.

The live public storefront becomes the recoverable source of evidence. Every captured record must retain its source URL, capture timestamp, checksum and extraction warnings so that reconstruction remains auditable and repeatable.

## What we will recover

### Catalogue discovery

Capture every discoverable Greek and English public URL from:

- homepage/navigation
- Clothing and all nested category pages
- Accessories and all nested category pages
- Designers / brand landing pages
- Sale
- New In / new-arrival surfaces
- pagination
- internal product links
- internal search/result surfaces where useful
- legacy `/default/` Greek routes
- `/en/` English routes
- indexable Magento internal product/category routes when encountered
- canonical, alternate/hreflang and redirect relationships visible publicly

Crawler discovery must not depend on one sitemap being present or correct.

### Products

For every publicly discoverable product, capture where exposed:

- source URL and canonical URL
- Greek and English URL pair
- title/name
- SKU
- regular price
- sale/special price
- displayed discount percentage
- public stock state
- low-stock text such as `Only 1 left` / `Μόνο 1 έμεινε`
- color
- size and size options
- other visible product options
- designer / brand
- categories and breadcrumbs
- short and long description
- composition/materials
- care instructions
- model dimensions / fit information
- country-of-manufacture text
- delivery message
- badges/states such as New, Sale and Out of Stock
- review count/rating/review text when publicly exposed
- product image gallery URLs
- size-guide image/document URLs
- SEO title and description
- structured-data fields when present

A product URL is the primary public source identifier. SKU is a high-value matching key, but duplicate/reused/missing SKUs must not collapse records automatically.

### Images and public media

For every discovered public asset:

- preserve original source URL
- follow safe same-site redirects
- download the highest-resolution public asset URL available
- retain filename and MIME type
- calculate SHA-256 checksum
- record source product/page relationships
- deduplicate identical bytes by checksum while preserving all relationships
- upload recovered commerce media to COQUETTE-controlled storage

Do not hotlink the legacy Magento site from the replacement storefront.

### Categories, designers and navigation

Recover:

- category hierarchy
- category names in both locales
- designer/brand list
- designer landing URLs
- navigation ordering visible in the storefront
- category/designer editorial copy
- category image/banner assets
- layered-navigation dimensions and public option labels
- visible sorting options

### Website content

Recover all publicly reachable merchant content, including where present:

- homepage copy and sections
- hero/banner content
- Our Story / About
- contact details
- delivery/shipping page
- payment-method page
- terms and conditions
- privacy/cookie pages
- returns information
- newsletter text
- service/trust-strip content
- footer/navigation content
- Greek and English variants
- images, icons and public downloadable assets

### SEO / URL preservation

Build an evidence-backed URL inventory containing:

- legacy URL
- locale
- resource type
- HTTP result observed during capture
- canonical URL
- hreflang/alternate URL when visible
- target COQUETTE URL
- redirect status/planned redirect

The redirect manifest must cover legacy `.html`, `/default/`, `/en/`, and any publicly indexed Magento internal routes discovered during capture.

## What cannot be reliably reconstructed from the public storefront

The following must be treated as unavailable unless another legitimate source is later provided:

- customer accounts and passwords
- customer address books
- historical orders
- invoices / credit memos / shipments
- payment transactions or tokens
- newsletter subscriber database
- private reviews/moderation state
- exact Magento entity IDs
- exact configurable/simple parent-child IDs when not inferable publicly
- hidden/unpublished products
- disabled categories/pages
- admin-only custom attributes
- cost prices / supplier data
- exact stock quantities when only public stock state is shown
- reserved inventory
- internal tax configuration
- private promotion/cart-rule definitions
- cron jobs and integration secrets
- extension configuration

These are **known source limitations**, not migration variances. They must never be fabricated.

## Reconstruction confidence

Recovered values should carry one of the following evidence grades:

- `direct` — explicitly displayed in the page/structured data or asset response
- `derived` — deterministically derived from direct public evidence, such as sale percentage from two displayed prices
- `inferred` — plausible relationship inferred from navigation/URL/product-option behavior and requiring review
- `unavailable` — not recoverable from public evidence

Critical commerce fields should prefer `direct` evidence. `inferred` price, tax, stock quantity or SKU values are not permitted.

## Capture artifacts

Each crawl/capture run stores a private immutable run package containing:

- `capture.json` — capture metadata and crawler commit
- `urls.ndjson` — complete discovered URL inventory
- `pages/` — raw response metadata + content checksum; raw HTML may be retained privately where operationally appropriate
- `products.ndjson`
- `categories.ndjson`
- `designers.ndjson`
- `content.ndjson`
- `media.ndjson`
- `redirects.ndjson`
- `errors.ndjson`
- `reconciliation.json`

Large/raw capture artifacts and downloaded images belong in private COQUETTE storage, never in the public Git repository.

## Crawl safety and repeatability

- use a descriptive COQUETTE crawler user agent
- obey applicable public access restrictions and avoid authenticated/private areas
- rate-limit requests conservatively
- retry transient failures with bounded backoff
- canonicalize URLs before queueing
- avoid infinite filter/query-string combinations
- store HTTP status and redirect chain
- checksum extracted normalized records
- make reruns idempotent
- never mutate the legacy site

## Reconciliation model

Because no Magento database count is available, reconciliation is based on the **captured public URL universe** rather than inaccessible database rows.

For each capture run report:

- discovered product URLs by locale
- successfully fetched product URLs
- parsed product records
- unique SKU count and SKU collisions
- products without SKU
- category URLs and parsed categories
- designer URLs and parsed designers
- media URLs discovered/downloaded/failed/deduplicated
- bilingual URL pairs found/unpaired
- content-page URLs captured
- redirect/canonical relationships
- parsing warnings/errors
- URLs remaining unclassified

A reconstruction rehearsal is accepted only when all discovered in-scope URLs are either successfully reconstructed or explicitly classified with a documented reason. There must be zero unexplained critical crawl variance.

## Public evidence confirmed on 2026-08-26

Live/public observations already confirm that the legacy site exposes recoverable data including:

- Greek and English storefronts
- category hierarchy and pagination
- designer lists
- price filters, designer filters, color filters and size labels
- product SKU
- color
- size where applicable
- designer
- regular and special prices
- sale percentage
- in-stock / out-of-stock state
- low-stock messaging
- descriptions, composition and care details
- product gallery surfaces

This evidence means a high-fidelity catalogue/content reconstruction is viable even without Magento administrative access, while private commerce history remains outside recoverable scope.

## Phase 4 exit gate — revised

Phase 4 is complete when:

1. a repeatable full public-storefront capture has completed;
2. all discovered in-scope public URLs are classified;
3. products/categories/designers/content/media are reconstructed into staging with source evidence retained;
4. media has been copied into COQUETTE-controlled storage;
5. Greek/English pairing and legacy redirect coverage are reconciled;
6. rerunning the same capture/import is idempotent;
7. zero unexplained critical variance remains within the captured public universe; and
8. unrecoverable private Magento data is explicitly documented rather than guessed.
