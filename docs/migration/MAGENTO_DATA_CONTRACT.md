# Legacy Magento Data Contract — Superseded by Public Storefront Reconstruction

**Status:** superseded on 2026-08-26

The original COQUETTE migration design assumed controlled Magento database/export access. That access is no longer available.

The public storefront at `https://coquetteconcept.gr/` is now the only legacy-system evidence source available to the project. The active contract is defined in:

- `docs/migration/STOREFRONT_RECONSTRUCTION_PLAN.md`

## Retained principles

The following principles remain mandatory even though the source changed:

- every normalized source record has a stable source identifier
- source evidence is checksummed
- imports are idempotent
- source-to-target mappings are durable
- warnings/errors are retained per record
- migration/reconstruction runs are immutable and auditable
- reconciliation, not script exit status, determines acceptance
- values that cannot be recovered from public evidence are never invented

## Source identifier change

Magento numeric entity IDs are no longer assumed to exist.

For public reconstruction, the primary source identifier is generally the canonicalized public source URL. SKU is used as an additional product matching signal when exposed, but SKU alone must not silently collapse duplicate or inconsistent legacy records.

## Reconciliation change

No inaccessible Magento database totals may be used as expected counts.

Expected counts are derived from the immutable URL/capture inventory for each crawl run. All discovered in-scope URLs must be successfully reconstructed or explicitly classified with a documented reason.

## Public commerce data

Visible storefront values such as SKU, displayed prices, sale states, designer, color, size, stock state, low-stock messaging, descriptions, categories and public media are valid reconstruction evidence when captured directly from the legacy public storefront.

Critical values may not be guessed. In particular, exact stock quantity, tax configuration, hidden variants, customer data and historical orders are unavailable unless a separate legitimate source becomes available.
