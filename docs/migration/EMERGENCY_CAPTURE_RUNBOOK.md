# COQUETTE Emergency Legacy Storefront Capture Runbook

## Why this exists

Magento administrative, database, filesystem and API access is unavailable. The still-live public storefront at `https://coquetteconcept.gr/` is therefore a perishable reconstruction source.

The purpose of this runbook is to preserve public legacy evidence before the Magento storefront disappears or changes.

This is not a Magento backup. It is a public-storefront evidence capture.

## Priority

Run a full capture as early as possible. Do not defer preservation behind storefront redesign or non-critical feature work.

Run another full capture immediately before production cutover so changes made on the legacy storefront after the first capture can be identified.

## Command

From the repository root after installing locked dependencies:

```bash
pnpm --filter @coquette/backend storefront:capture
```

Default source:

```text
https://coquetteconcept.gr/
```

Default output:

```text
migration-data/storefront-captures/<capture-id>/
```

`migration-data/` is intentionally excluded from Git.

## Important environment controls

```bash
COQUETTE_CAPTURE_BASE_URL=https://coquetteconcept.gr/
COQUETTE_CAPTURE_ID=coquetteconcept-YYYYMMDD-HHMM
COQUETTE_CAPTURE_DIR=/secure/path/coquette-capture
COQUETTE_CAPTURE_MAX_PAGES=5000
COQUETTE_CAPTURE_DELAY_MS=125
COQUETTE_CAPTURE_DOWNLOAD_MEDIA=true
COQUETTE_CAPTURE_MEDIA_CONCURRENCY=6
COQUETTE_CAPTURE_RESPECT_ROBOTS=true
```

The crawler does not attempt authentication, CAPTCHA bypass, session replay or access to private Magento surfaces.

## Crawl boundaries

The capture engine:

- remains on the `coquetteconcept.gr` host
- follows public HTML pages
- discovers standard XML sitemaps and sitemap references from `robots.txt`
- follows pagination while stripping unrelated query parameters
- excludes customer, checkout, wishlist, newsletter, search and API routes
- does not crawl third-party domains
- respects `robots.txt` by default
- uses a descriptive COQUETTE reconstruction user agent

If a legitimate business decision is made to change the robots setting, record the reason with the capture manifest. Do not use the crawler to bypass technical access controls.

## Raw evidence is primary

Every successfully captured HTML page is stored unchanged under `pages/` and receives a SHA-256 checksum.

This is important because structured extraction is deliberately secondary. If a later parser learns how to recover another Magento field, the original page can be reprocessed without depending on the live Magento site still existing.

## Structured outputs

### `manifest.json`

Capture-level metadata and totals:

- capture ID
- source origin
- start/end timestamps
- crawler settings
- robots/sitemap discovery state
- queued/visited URL totals
- captured/skipped/error page totals
- detected product total
- discovered/captured media totals
- byte total
- whether the crawl queue completed

### `url-inventory.jsonl`

One record per attempted public page with:

- requested source URL
- final URL after redirect
- capture status
- HTTP status
- inferred page type
- source checksum
- error/skipped reason where applicable

### `pages.jsonl`

Operational page capture records including raw-page filename, title, canonical, link count and media count.

### `products.jsonl`

Best-effort structured public product evidence. Raw HTML remains authoritative evidence when a field is not extracted cleanly.

Expected fields include, where publicly exposed:

- source URL
- source checksum
- title/name
- SKU
- designer/brand
- currency
- regular/sale price evidence
- public availability state
- visible size/color/option labels
- description
- JSON-LD product evidence
- canonical and hreflang relationships

### `media.jsonl`

One record per discovered media URL:

- public source URL
- status
- HTTP status
- content type
- byte size
- SHA-256 checksum
- local captured filename
- error reason where applicable

### `media/`

Recovered public product/editorial images.

Do not hotlink these images in the new storefront. After validation, move approved assets into COQUETTE-controlled media storage and preserve source-to-owned-object mapping.

## Reconciliation

A preservation run is not accepted just because the process exits successfully.

Review:

1. `manifest.complete` must be true for a declared full crawl.
2. `remainingQueue` must be zero.
3. Every error must be classified.
4. Product/category/content counts must be plausible against the live storefront surfaces.
5. Greek and English route coverage must be reviewed separately.
6. Media errors must be investigated, especially product gallery images.
7. Sitemaps and link discovery should be compared so orphaned public URLs are not silently missed.

A known inaccessible URL can be explicitly accepted. An unexplained missing catalogue area cannot.

## Storage and retention

The output is evidence, not source code.

Never commit raw capture output or downloaded media to the public Git repository.

Preserve at least:

- the first emergency full capture
- the last complete pre-cutover capture
- any materially different intermediate capture used for import/reconciliation

Preferred durable destination is COQUETTE-controlled private migration storage for raw HTML/manifests, with approved public product/editorial media copied to COQUETTE media storage.

## Known limits

The public storefront cannot reliably recover:

- customer passwords/accounts that are not public
- customer address books
- historical orders/invoices/shipments/refunds
- payment records/tokens
- unpublished products/content
- Magento internal numeric IDs
- private extension configuration
- exact hidden stock quantities
- private promotion/tax/integration rules

Do not fabricate these fields during import.
