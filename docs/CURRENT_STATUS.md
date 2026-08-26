# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`  
**Purpose:** short operational companion showing what is actually implemented now. When this status and an older roadmap checkbox differ, use this file for current completion state and keep the roadmap as the phase/exit-gate definition.

## Shipped to `main`

Through merge `5cd7d026fffaeaeaa01f06031af42ff22a9ce0fa`:

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
- Medusa production server/worker process contract
- migration predeploy command
- Admin backend URL configuration
- guarded Medusa JS SDK Store API client
- Store API product-detail pages with media, options, calculated prices and inventory
- Greek and English Clothing/Accessories PLPs and nested category PLPs
- descendant-category aggregation
- product cards with media, stock state and calculated pricing
- server-side catalogue pagination
- Medusa Translation Module and locale-aware Store API requests
- shared Greek/English product cards and product-detail rendering
- configurable English BCP-47 locale (`NEXT_PUBLIC_ENGLISH_LOCALE`, default `en-GB`)
- public Brand Store API directory and Brand-product link queries
- Greek and English Designer directories and Brand-backed Designer PLPs
- CI with PostgreSQL 17 + Redis, clean `medusa db:migrate`, backend type-check, migration-contract check, production backend build and production storefront build
- CI concurrency cancelling superseded branch validations
- localization architecture and deployment runbook

## Active implementation

Branch: `feature/sale-merchandising-foundation`

Implemented on branch and green in branch CI:

- true Sale detection uses Medusa calculated-price metadata: only prices originating from a price list whose `price_list_type` is `sale` receive Sale treatment
- override pricing cannot masquerade as a discount simply because `original_amount` differs
- backend public Sale-candidate discovery queries active Sale price lists and follows Price List → Price → Price Set → Variant → Product
- future and expired Sale lists are excluded by date
- price lists with price-list-level rules are excluded from the general public Sale feed so customer-group/restricted pricing is not published as a universal offer
- a dedicated `/store/sale-candidates` endpoint exposes only candidate product IDs/count, not pricing internals
- storefront rehydrates candidates through the normal Store Product API using the current Greece price context and requested locale
- a product is admitted to the public Sale PLP only if its currently calculated Store API price still resolves to a Medusa Sale price list
- Sale membership/count are computed before page slicing, enabling real pagination
- Greek `/sale` is active
- English `/en/sale` is active with translated product fields
- normal category cards retain lowest-calculated-price behavior; Sale cards deliberately prefer the cheapest currently applicable Sale variant so the badge and strike-through match the displayed price
- PDP and product-card strike-through behavior now uses the same Sale semantic helper
- CI includes a Sale pricing-graph contract executed against a clean migrated Medusa database
- Sale pricing-graph contract, Medusa production build and storefront production build pass on the branch

## Phase status correction

### Phase 0 — Workspace / isolation

Implementation: **complete**, except one account-level security setting is outstanding: the GitHub repository is currently public and should be changed to private during rebuild/migration.

### Phase 1 — Audit / architecture

**Complete; continuous Magento audit remains active.**

### Phase 2 — Executable foundation

**Complete.**

### Phase 3 — Domain model / managed infrastructure

**Code and managed-resource foundation substantially complete.**

Already complete:

- custom module migrations generated and committed
- dedicated Supabase project and storage buckets
- Supabase security/performance advisors clean after infrastructure setup
- production Medusa artifact verified by CI
- server/worker deployment contract
- clean PostgreSQL migration smoke test
- Translation, Brand, Website Content and core Medusa migrations validated together

Still outstanding:

- real staging backend host
- real staging worker process
- dedicated runtime Redis
- runtime-only database connection secret
- runtime-only Supabase S3 credentials
- apply migrations to the actual staging database environment
- create merchant Admin user
- create storefront publishable API key
- verify real S3 upload through Medusa
- backup/restore rehearsal

### Phase 4 — Magento extraction / migration

**Pipeline foundation complete; authoritative source access pending.**

Already complete:

- deterministic source checksums and stable Magento source keys
- change/retry detection
- normalized validation primitives
- reconciliation accounting
- migration data contract and CI self-check
- public-site discovery inventory and controlled-access checklist
- localization target architecture
- first-class Brand/Designer target and storefront boundary
- Sale target semantics based on Medusa Sale price lists rather than scraped storefront badges

Blocked on controlled Magento administrative/database/export/media access. Public HTML is not accepted as authoritative migration data.

### Phase 5 — Merchant back office

**Foundation started.** Medusa Admin plus Designer, Website Content, Translation and native Medusa pricing/price-list foundations exist. Full Magento-equivalent daily-operation parity is not complete.

### Phase 6 — Storefront parity

**Active and materially advanced.**

Implemented or active:

- Greek/English Store API product detail
- Greek/English Clothing and Accessories PLPs
- nested category PLPs
- Brand/Designer directories and PLPs
- verified Greek/English Sale PLPs on the active branch
- media, pricing, inventory and pagination
- locale-aware commerce records

Still incomplete:

- real filter/sort behavior
- search experience
- cart interaction
- wishlist
- full editorial English route parity
- final visual parity and responsive UAT

### Phase 7 — Search, discovery and merchandising

**Next implementation focus after the Sale slice merges.** Filter/sort/search controls must remain non-functional until backed by real query semantics.

### Phases 8–18

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
11. verify `/health`, Admin, Store API, Brand/Sale queries, translations, media upload and worker operation

## Production boundary

Magento remains the production shop. `coquetteconcept.gr` must not be moved to the replacement until migration reconciliation, UAT, checkout/payment/courier/fiscal testing, SEO redirect verification, rollback preparation and the roadmap cutover gates are complete.
