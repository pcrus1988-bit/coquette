# Indexed recovery evidence

## Purpose

This recovery layer exists so COQUETTE can reconcile the legacy Magento catalogue even if the old storefront becomes partially or fully unavailable before the authoritative Magento export is delivered.

It is a **secondary evidence source**. It is not a substitute for the Magento database, `pub/media`, configuration inventory, or a successful direct storefront capture.

The machine-readable baseline is `docs/migration/indexed-recovery-baseline.json` and is validated in CI by `pnpm --filter @coquette/backend indexed-recovery:contract`. The normal COQUETTE pull-request pipeline must pass this gate alongside the storefront-capture, migration, database, Admin CRUD, payment/bootstrap, pricing, Railway-build and storefront-build checks.

## Evidence hierarchy

Use the highest available evidence grade for each individual field, not one blanket source for an entire product.

1. **Authoritative Magento source** — database/media/config snapshot with source IDs and capture timestamp.
2. **Direct public storefront capture** — raw page/media evidence captured from the live legacy site at a known timestamp.
3. **Indexed public evidence** — search-indexed category, designer or product observations with explicit crawl/freshness metadata.
4. **Derived reconstruction** — a value reconstructed from relationships or surrounding evidence.
5. **Inferred/unavailable** — never publish as fact without review.

A newer lower-ranked observation may legitimately prove that an older authoritative snapshot changed later. When this happens, retain both observations and the chronology; do not overwrite provenance. Source priority is therefore evaluated **per field and observation time**, while unexplained conflicts remain review items rather than being silently resolved by source rank alone.

## Field reconciliation rules

### Identity

Magento source IDs, SKU and stable canonical identifiers win when available. Indexed titles are useful for discovery and cross-checking, but must not create a second product when an authoritative identifier maps to an existing record.

### URLs

Preserve every observed legacy URL exactly, including old spelling mistakes such as `sweemwear.html`. URL cleanup belongs in the target route design; the original URL remains redirect evidence.

### Price

A price needs source and observation time. Sale and regular prices must remain separate. Do not combine a regular price from one crawl date with a sale price from another crawl date as though they were observed together.

### Inventory and availability

Presence in a category, designer page or search index does **not** prove stock. Only an explicit stock/availability state or authoritative inventory source can set availability automatically.

### Designer and category membership

Indexed memberships are valid recovery seeds, not final truth. Magento relationships or a fresher direct storefront capture should reconcile them before publication.

### Media

Search thumbnails can establish that media existed but should not replace original-resolution Magento/public storefront media when the latter can be recovered. Preserve media URL provenance and checksums for downloaded originals.

### Bilingual content

Greek and English observations are distinct source records. Do not machine-translate one language merely to fill a missing legacy field during migration. Missing translations should be tracked for merchant review.

## Reconciliation workflow

For each entity:

1. establish source identity and observed timestamp;
2. retain the raw/source evidence reference;
3. normalize into the Phase 4 source-record shape;
4. compare against stronger/fresher evidence;
5. record conflicts instead of silently choosing a value;
6. resolve critical conflicts before import/publish;
7. store legacy URL mappings for redirect generation;
8. include the entity in source/imported/skipped/error reconciliation totals.

## What indexed evidence may safely do now

It may seed expected catalogue scale, designer/category names, legacy URLs and product candidates; expose likely holes in a later Magento export; help identify orphaned or historically indexed catalogue pages; and provide independent reconciliation counts.

It must **not** automatically mark a product in stock, create a customer/order record, infer private Magento data, override a newer direct observation without provenance, or satisfy the Phase 4 exit gate by itself.

## Phase 4 exit implication

The Phase 4 exit gate remains a repeatable staging import with documented reconciliation and zero unexplained critical variance. Indexed recovery evidence improves our ability to explain variance; it does not remove the requirement for an authoritative source package whenever that package can still be obtained.
