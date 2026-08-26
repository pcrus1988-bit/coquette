# Indexed recovery evidence

## Purpose

This recovery layer exists so COQUETTE can reconstruct and reconcile the legacy catalogue even if direct access to parts of the old public storefront is blocked or disappears before preservation completes.

As recorded in issue #39, Magento Admin/database/filesystem/API access is no longer available. The **direct public storefront is the canonical recoverable source for Phase 4**. Indexed public evidence is a secondary recovery and reconciliation source for URLs, catalogue scale, designer/category seeds and product observations that remain visible through search indexes.

The machine-readable baseline is `docs/migration/indexed-recovery-baseline.json` and is validated in CI by `pnpm --filter @coquette/backend indexed-recovery:contract`. The normal COQUETTE pull-request pipeline must pass this gate alongside the storefront-capture, migration, database, Admin CRUD, payment/bootstrap, pricing, Railway-build and storefront-build checks.

## Evidence hierarchy

Use the highest available evidence grade for each individual field, not one blanket source for an entire product.

1. **Direct public storefront capture** — raw page/media evidence captured from the live legacy site at a known timestamp. This is the current canonical recoverable source.
2. **Indexed public evidence** — search-indexed category, designer or product observations with explicit crawl/freshness metadata.
3. **Derived reconstruction** — a value reconstructed from relationships or surrounding evidence.
4. **Inferred/unavailable** — never publish as fact without review.

The candidate engine retains an `authoritative_magento` evidence class only as a compatibility path in case a legitimate historical Magento snapshot is ever recovered later. No such source is currently available or required for the active Phase 4 plan.

A newer lower-ranked observation may legitimately prove that an older stronger observation changed later. When this happens, retain both observations and the chronology; do not overwrite provenance. Source priority is therefore evaluated **per field and observation time**, while unexplained conflicts remain review items rather than being silently resolved by source rank alone.

## Field reconciliation rules

### Identity

Public SKU, canonical URL, locale relationship and other stable identifiers should be retained whenever exposed. Indexed titles are useful for discovery and cross-checking, but must not be promoted into fabricated Magento entity IDs or synthetic SKUs.

### URLs

Preserve every observed legacy URL exactly, including old spelling mistakes such as `sweemwear.html`. URL cleanup belongs in the target route design; the original URL remains redirect evidence.

### Price

A price needs source and observation time. Sale and regular prices must remain separate. Do not combine a regular price from one crawl date with a sale price from another crawl date as though they were observed together.

### Inventory and availability

Presence in a category, designer page or search index does **not** prove stock. Only an explicit public stock/availability state observed directly from the storefront can set public availability automatically. Exact stock quantities remain unavailable unless they are actually exposed publicly.

### Designer and category membership

Indexed memberships are valid recovery seeds, not final truth. A fresher direct storefront capture should reconcile them before publication whenever direct evidence can be obtained.

### Media

Search thumbnails can establish that media existed but should not replace original-resolution public storefront media when the latter can be recovered. Preserve media URL provenance and checksums for downloaded originals. Recovered assets must be copied into COQUETTE-controlled storage rather than hotlinked.

### Bilingual content

Greek and English observations are distinct source records. Do not machine-translate one language merely to fill a missing legacy field during migration. Missing translations should be tracked for merchant review.

## Reconciliation workflow

For each entity:

1. establish source identity and observed timestamp/freshness;
2. retain the raw/source evidence reference;
3. normalize into the Phase 4 source-record or recovery-candidate shape;
4. compare against stronger/fresher evidence;
5. record conflicts instead of silently choosing a value;
6. resolve critical conflicts before import/publish;
7. store legacy URL mappings for redirect generation;
8. classify every discovered in-scope URL as reconstructed, skipped, failed or unavailable with a documented reason;
9. include the entity in source/imported/skipped/error reconciliation totals.

## What indexed evidence may safely do now

It may seed expected catalogue scale, designer/category names, legacy URLs and product candidates; expose likely holes in direct capture; help identify orphaned or historically indexed catalogue pages; and provide independent reconciliation counts.

It must **not** automatically mark a product in stock, create a customer/order record, invent private Magento data, create synthetic Magento IDs/SKUs, override a newer direct observation without provenance, or satisfy the Phase 4 exit gate by itself.

## Known unavailable private legacy domains

Unless another legitimate source later becomes available, Phase 4 explicitly records rather than fabricates customers/passwords/address books, historical orders/invoices/shipments/credit memos, payment transactions/tokens, exact Magento entity IDs, hidden/unpublished catalogue data, admin-only attributes, exact non-public stock quantities, internal tax configuration, private promotion rules, and extension/cron/integration secrets.

## Phase 4 exit implication

The active Phase 4 exit gate is a repeatable public-source reconstruction/import with documented reconciliation and zero unexplained critical variance. All discovered in-scope public URLs must be reconstructed or explicitly classified with a failure/unavailable reason; recovered media must be owned by COQUETTE storage; Greek/English relationships and redirects must reconcile; and reruns must be idempotent.

Indexed recovery evidence improves our ability to discover and explain variance. It does not replace successful direct public capture where that evidence remains recoverable, and it does not permit unavailable private Magento data to be guessed.
