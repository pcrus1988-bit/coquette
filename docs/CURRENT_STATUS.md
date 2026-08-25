# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`  
**Purpose:** short operational companion showing what is actually implemented now. When this status and an older roadmap checkbox differ, use this file for current completion state and keep the roadmap as the phase/exit-gate definition.

## Shipped to `main`

Through merge `1bb883794b9c6be5a7a23200c3ecd39eaf57155d`:

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
- deployment runbook

## Active implementation

Branch: `feature/catalogue-listing-foundation`

In progress:

- category lookup by Medusa handle
- category-specific product retrieval using `category_id`
- calculated-price/inventory/media fields on listing queries
- reusable product cards
- server-side catalogue pagination
- Clothing and nested Clothing routes backed by real category queries
- Accessories and nested Accessories routes backed by real category queries
- Sale deliberately kept source-specific until the actual sale/pricing rule is defined
- Designer product listings deliberately kept pending until the Brand/Designer product relationship is queryable from the storefront

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

Still outstanding:

- real staging backend host
- real staging worker process
- dedicated Redis
- runtime-only database connection secret
- runtime-only Supabase S3 credentials
- apply Medusa migrations to the chosen staging database environment
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

Blocked on controlled Magento administrative/database/export/media access. Public HTML is not accepted as authoritative migration data.

### Phase 5 — Merchant back office

**Foundation started.** Medusa Admin plus Designer and Website Content extensions exist. Full Magento-equivalent daily-operation parity is not complete.

### Phase 6 — Storefront parity

**Active.** Product detail is Store API-backed. Category PLP Store API work is in progress. Filtering, sorting, cart interaction, wishlist, full localization and final visual parity remain incomplete.

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
9. connect storefront to staging backend
10. verify `/health`, Admin, Store API, media upload and worker operation

## Production boundary

Magento remains the production shop. `coquetteconcept.gr` must not be moved to the replacement until migration reconciliation, UAT, checkout/payment/courier/fiscal testing, SEO redirect verification, rollback preparation and the roadmap cutover gates are complete.
