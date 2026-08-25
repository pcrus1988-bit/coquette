# Magento Data Contract

This contract defines how Magento data enters the COQUETTE migration pipeline. Raw exports are private input data and must never be committed to this public repository.

## Goals

The migration must be:

- repeatable
- idempotent
- countable
- resumable
- auditable
- safe to rehearse multiple times
- explicit about records that require manual review

A successful process exit is not migration success. Reconciliation against source counts is mandatory.

## Source key

Every normalized source record is identified by:

- `entityType`
- Magento `sourceId`
- optional locale (`el` or `en`)

The compound source key remains stable across rehearsals even when target Medusa IDs change.

## Checksum

Every normalized source record receives a SHA-256 checksum calculated from canonical JSON. Object key ordering must not affect the checksum.

The checksum lets the importer distinguish:

- never imported
- unchanged since last successful import
- changed and requiring re-import
- previous error requiring retry

## Manifest entry

Each source record gets a migration manifest entry containing:

- entity type
- source ID
- locale when applicable
- source checksum
- target Medusa ID when created
- status: `pending`, `imported`, `skipped`, or `error`
- warnings
- errors
- attempts
- source update timestamp when available
- first successful import timestamp
- last attempt timestamp

Private manifests containing customer/order identifiers belong in migration storage, not Git.

## Planned entity order

1. category
2. brand/designer
3. product
4. variant
5. price
6. inventory
7. media
8. content page
9. customer
10. address
11. order
12. promotion
13. URL rewrite

The importer must preserve source relationships through source-ID maps instead of relying on target IDs known in advance.

## Product normalization

A normalized product must preserve at minimum:

- Magento source ID
- SKU
- product name
- enabled/disabled status
- visibility
- Magento type
- URL key when present
- description and short description
- designer/brand source reference
- category source references
- option values
- media source references
- source update timestamp

Magento configurable parents and purchasable simple variants must not be collapsed accidentally. Parent-child relationships and option axes must be reconstructed explicitly in Medusa.

Unknown Magento product types are manual-review records, not guessed mappings.

## Price and sale rules

The export must distinguish, where Magento exposes them:

- regular price
- special price
- special-price start/end dates
- website/store scope
- customer-group pricing if configured
- tax inclusion/exclusion semantics

A visible percentage discount scraped from the storefront is not authoritative pricing input.

## Inventory

Inventory import must identify the Magento inventory model in use before mapping quantities. If MSI / source inventory is enabled, source-item and salable-quantity semantics must be understood before importing stock.

No stock value is guessed from public "in stock" / "out of stock" labels.

## Media

Media records must preserve:

- source media identity/path
- product relationship
- ordering/position
- image roles where available
- labels/alt text when available
- disabled state
- checksum or equivalent integrity marker when practical

Public media is copied into the dedicated `coquette-media` bucket. Raw migration archives may use the private `coquette-imports` bucket.

## Content and localization

CMS pages/blocks and other editorial content must retain store-view/language ownership. Greek and English are normalized as explicit localized records rather than silently overwriting one another.

## Customer and order data

Customer/order migration is private-data processing. These exports must never appear in GitHub Actions artifacts intended for public access, repository fixtures, logs, screenshots or public storage buckets.

Before historical orders are imported, confirm the business requirement and legal/operational value of retaining them in the new back office.

## URL rewrites

Magento URL-rewrite export is authoritative for redirect planning where available. The pipeline records:

- source path
- store view / locale
- target entity/source ID
- redirect type/state
- final new storefront URL

Legacy `.html` URLs and language prefixes must be explicitly mapped. Query-string filter and pagination URLs require separate canonical/indexability decisions; they are not automatically redirected as individual landing pages.

## Reconciliation

For every entity type produce:

- expected source count
- manifest count
- imported count
- skipped count
- error count
- pending count
- duplicate source keys
- unexplained variance

A domain is reconciled only when:

- unexplained variance is zero
- duplicate source keys are zero
- errors are zero or explicitly approved exceptions outside the automated reconciled state
- pending records are zero

`skipped` is not synonymous with harmless; every skip reason must be classified and reviewable.

## Required Magento access for full migration

The preferred source is a controlled Magento database/export snapshot plus media archive and configuration/module inventory. Administrative exports alone may omit relationships or extension-owned fields.

Required discovery includes:

- exact Magento version
- enabled modules/extensions
- websites/stores/store views
- EAV product attributes and option values
- product entity/type relationships
- categories
- pricing scopes/rules
- inventory configuration/MSI
- CMS pages/blocks
- customers/addresses
- sales entities
- URL rewrites
- tax configuration
- shipping/payment configuration
- media directory
- cron/integration configuration

## Public-site crawling

Public crawling is useful for parity and reconciliation signals, but it is not the authoritative business-data export. It can help identify:

- routes missing from the export plan
- public navigation/category taxonomy
- visible designers
- current catalogue counts
- filter dimensions
- indexed URLs
- content pages

Public HTML must not be used to invent hidden SKU, tax, inventory or order data.
