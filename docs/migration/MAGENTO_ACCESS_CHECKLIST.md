# Magento Access & Export Checklist

This checklist defines what is needed from the current Magento installation to perform a complete, repeatable COQUETTE migration. Credentials must be shared through an approved secure channel and must never be committed to Git.

## Minimum discovery access

Prefer a temporary dedicated technical/admin account rather than sharing a personal owner account.

Need access sufficient to determine:

- Magento exact version/edition
- enabled modules/extensions and versions
- websites, stores and store views
- product/category attribute configuration
- inventory configuration
- tax configuration
- payment methods
- shipping methods
- CMS pages/blocks
- URL rewrite configuration
- cron/integration configuration

## Preferred migration source package

### 1. Database snapshot

A consistent database dump taken for migration/rehearsal.

Preferred properties:

- created from a known timestamp
- compressed
- checksummed (SHA-256)
- encrypted in transit/at rest where it contains personal data
- never committed to this repository

### 2. Media archive

Archive of Magento public media required for products and CMS content, especially `pub/media` content relevant to the storefront.

Record:

- archive timestamp
- byte size
- checksum
- source Magento release/environment

### 3. Application/configuration inventory

Need enough configuration information to reproduce business rules without copying secrets into source control.

Capture provider names and non-secret configuration separately from credentials.

### 4. URL inventory

Prefer export of Magento URL rewrites plus a final crawl of the public production site before cutover.

### 5. Store-view content

Ensure Greek and English store-view values can be distinguished for:

- product names/descriptions
- category names/content
- CMS pages/blocks
- metadata
- URL keys where scoped

## Magento entities to verify in source

### Catalogue

- catalog_product_entity and relevant EAV values
- configurable/simple relationships
- product options
- categories and category-product assignments
- product websites/store scopes
- media gallery
- regular/special pricing
- catalog/cart price rules
- designer/brand attribute or extension-owned representation

### Inventory

Determine whether legacy catalog inventory or MSI is active.

If MSI is active, capture source items, stocks/source assignments and enough configuration to map salable inventory correctly.

### Customers

- customer entities
- addresses
- account status/groups if operationally needed
- newsletter consent source/provenance separately

### Sales

- orders
- order items
- invoices
- shipments
- credit memos/refunds
- payment metadata needed for historical operational reference

Do not assume payment tokens or sensitive card data should or can be migrated.

### Content

- CMS pages
- CMS blocks
- widgets where used
- theme-managed content not stored in standard CMS tables

### SEO

- URL rewrites
- product/category metadata
- canonical-related extension settings if any
- robots configuration
- sitemap configuration

## Third-party modules requiring explicit review

For every enabled extension classify it as:

1. replace with Medusa/native COQUETTE feature
2. replace with a new provider integration
3. migrate its data
4. retire deliberately
5. unknown/manual review

Priority extension categories:

- payment
- Klarna
- PayPal
- shipping/courier
- AADE/myDATA/invoicing
- search
- layered navigation
- SEO
- consent/cookies
- newsletter/email
- ERP/accounting
- feeds/marketplaces
- analytics
- reviews/wishlist

## Snapshot rehearsal procedure

For every rehearsal record:

- snapshot timestamp
- database checksum
- media archive checksum
- importer code commit SHA
- migration start/end
- counts per entity
- errors/warnings
- reconciliation report

Never overwrite evidence from an earlier rehearsal; use a new run ID.

## Final cutover delta

The final migration must account for changes after the last rehearsal snapshot.

Agree in advance whether final cutover uses:

- a short Magento write/freeze window plus final complete snapshot, or
- a supported incremental/delta extraction strategy

The simpler complete-final-snapshot approach is preferred unless downtime/business constraints make it impractical.

## Credentials policy

Never put passwords, API keys, private certificates or database dumps in:

- Git commits
- GitHub issues/PR descriptions
- public CI artifacts
- screenshots
- public Supabase buckets
- storefront environment variables prefixed for browser exposure

Credentials belong only in dedicated COQUETTE secret stores for the environment that requires them.
