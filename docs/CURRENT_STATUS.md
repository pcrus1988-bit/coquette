# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`  
**Purpose:** short operational companion showing what is actually implemented now. When this status and an older roadmap checkbox differ, use this file for current completion state and keep the roadmap as the phase/exit-gate definition.

## Shipped to `main`

Through merge `e957a831908ac3ad2d27a68a01442e2737c76dec`:

- isolated COQUETTE repository/workspace
- pnpm/Turbo monorepo
- Medusa v2 backend and Admin
- Next.js storefront
- dedicated Supabase project `pijetwrxqznxaoacnakr`
- dedicated public `coquette-media` bucket
- dedicated private `coquette-imports` bucket
- Brand/Designer module and generated migration
- bilingual Website Content module and generated migration
- Magento migration contract, checksums, validation and reconciliation foundation
- live Magento discovery record and controlled-access checklist
- CI with frozen install, Compose validation, backend type-check, migration-contract check, Medusa production build verification and storefront production build
- Medusa production server/worker process contract
- migration predeploy command
- Admin backend URL configuration
- guarded Medusa JS SDK Store API client
- real Store API-backed product detail route for product content, gallery, options, calculated prices and inventory state
- real Store API category product-listing surfaces for Greek Clothing and Accessories
- descendant-category aggregation so top-level categories include products assigned to nested categories
- reusable product cards with media, stock state and calculated/sale pricing
- server-side catalogue pagination
- deployment runbook

## Active implementation

Branch: `feature/commerce-localization-foundation`

In progress / implemented on branch:

- Medusa Translation Module enabled behind the required `translation` feature flag
- Store API catalogue/product helpers accept BCP-47 locale context
- English commerce locale configurable through `NEXT_PUBLIC_ENGLISH_LOCALE` (default `en-GB`)
- shared Greek/English product cards and product-detail surface
- `/en/products/<handle>` retrieves translated commerce fields from the same product record
- `/en/clothing` and nested Clothing routes use localized Store API category/product queries
- `/en/accessories` and nested Accessories routes use localized Store API category/product queries
- English Sale remains source-specific until the real sale/promotion rule exists
- English Designer grids remain bound to the Brand/Designer workstream rather than showing generic catalogue data
- CI now boots clean PostgreSQL 17 + Redis and runs all Medusa migrations before production builds
- clean-database migration test has passed with Translation + Brand + Website Content + core Medusa migrations together
- branch CI concurrency cancels superseded push validations
- localization architecture documented in `docs/architecture/LOCALIZATION.md`

## Phase status correction

### Phase 0 — Workspace / isolation

Implementation: **complete**, except one account-level security setting is outstanding: the GitHub repository is currently public and should be changed to private during rebuild/migration.

### Phase 1 — Audit / architecture

**Complete; continuous Magento audit remains active.**

### Phase 2 — Executable foundation

**Complete.**

### Phase 3 — Domain model / managed infrastructure

**Code and managed-resource foundation substantially complete.**

Already complete relative to the older roadmap wording:

- custom module migrations generated and committed
- dedicated Supabase project created
- storage buckets provisioned and restricted
- Supabase security/performance advisors clean after infrastructure setup
- Medusa production artifact verified by CI
- server/worker deployment contract documented
- clean PostgreSQL migration smoke test added to CI
- Translation Module migrations validated together with custom/core migrations

Still outstanding:

- real staging backend host
- real staging worker process
- dedicated runtime Redis
- runtime-only database connection secret
- runtime-only Supabase S3 credentials
- apply Medusa migrations to the actual staging database environment
- create merchant Admin user
- create storefront publishable API key
- verify real S3 upload through Medusa
- backup/restore rehearsal

### Phase 4 — Magento extraction / migration

**Pipeline foundation complete; authoritative source access pending.**

Already complete:

- deterministic source checksums
- stable Magento source keys
- change/retry detection
- normalized validation primitives
- reconciliation accounting
- CI migration-contract self-check
- migration data contract
- public-site discovery inventory
- access/export checklist
- localization architecture ready for mapping Magento English store-view overrides to Medusa translations

Blocked on controlled Magento administrative/database/export/media access. Public HTML is not accepted as authoritative migration data.

### Phase 5 — Merchant back office

**Foundation started.** Medusa Admin plus Designer and Website Content extensions exist. Translation management is enabled in the active localization branch. Full Magento-equivalent daily-operation parity is not complete.

### Phase 6 — Storefront parity

**Active and materially advanced.**

Implemented or active:

- Store API product detail
- Greek Clothing/Accessories PLPs
- nested category PLPs
- product cards
- pricing/inventory/media
- pagination
- English locale-aware commerce routes on active branch

Still incomplete:

- real filter/sort behavior
- cart interaction
- wishlist
- final Sale query semantics
- Designer product grids
- full editorial English route parity
- final visual parity and responsive UAT

### Phases 7–18

Remain governed by `docs/ROADMAP.md`; no phase should be marked complete without its documented exit gate.

## Account-level staging gates

Tracked in GitHub issue #9:

1. make repository private
2. create dedicated COQUETTE Vercel storefront project with root `apps/storefront`
3. provision long-running Medusa server host
4. provision separate worker process from the same release
5. provision dedicated Redis
6. place Supabase DB/S3 credentials only in backend hosting secrets
7. migrate staging schema
8. create Admin account and publishable Store API key
9. configure supported store locales / translation settings in staging
10. connect storefront to staging backend
11. verify `/health`, Admin, Store API, translations, media upload and worker operation

## Production boundary

Magento remains the production shop. `coquetteconcept.gr` must not be moved to the replacement until migration reconciliation, UAT, checkout/payment/courier/fiscal testing, SEO redirect verification, rollback preparation and the roadmap cutover gates are complete.
