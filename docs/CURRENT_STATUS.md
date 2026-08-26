# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`  
**Purpose:** short operational companion showing what is actually implemented now. When this file and an older roadmap checkbox differ, use this file for delivery state and the roadmap for phase/exit-gate definitions.

## Shipped to `main`

Through merge `4134a2dfe959d2c9ad6bf399dd1eccc89fa4305b`:

- isolated COQUETTE repository/workspace and dedicated Supabase project/storage
- pnpm/Turbo monorepo, Medusa v2.19 backend/Admin and Next.js storefront
- Brand/Designer and bilingual Website Content custom modules with migrations
- Medusa Translation Module and locale-aware commerce records
- Magento migration checksum/validation/reconciliation foundation
- production Medusa server/worker contract and deployment runbook
- guarded Store API client and real product-detail pages
- Greek/English Clothing and Accessories PLPs with descendant-category aggregation
- real product cards, calculated pricing, inventory, media and pagination
- public Brand Store API and Greek/English Brand-backed Designer PLPs
- verified public Sale pipeline and Greek/English Sale PLPs
- Sale badges/strike-through based on true Medusa `sale` price-list semantics
- CI with fresh PostgreSQL 17 + Redis, clean migrations, migration contract, Sale pricing-graph contract, backend production build and storefront production build

## Active implementation

Branch: `feature/catalogue-search-filter-sort`

Implemented on branch:

- real Greek and English `/search` product-result surfaces
- Medusa-native keyword search through `q`
- controlled product sorting through `order`
- Color and Size filters using real Medusa global Product Option value IDs and `option_value_id`
- live Designer filter using COQUETTE Brand records rather than product metadata
- Designer filtering resolves the Brand's complete linked product-ID set and intersects it inside the normal Store Product API query, preserving exact category/search/options counts and pagination
- URL-driven GET state: `q`, `sort`, repeated `option`, `designer`, `page`
- shared parser validates sort values, option-value IDs and Designer handles
- active query state is preserved across pagination
- Greek/English Clothing and Accessories top-level/nested PLPs use the same filter contract
- dedicated Designer PLPs and Sale PLPs deliberately retain their specialized relation/pricing pipelines
- Price filter remains deliberately disabled until a context-aware calculated-price range implementation can guarantee exact public pricing/count/pagination semantics
- query architecture documented in `docs/architecture/CATALOGUE_QUERY.md`

The branch still requires its final exact-head CI, protected PR CI and merge before these Phase 7 capabilities are considered shipped.

## Phase status

### Phase 0 — Workspace / isolation

Implementation: **complete**, except the GitHub repository remains public and should be made private before sensitive migration work.

### Phase 1 — Audit / architecture

**Complete; continuous Magento audit remains active.**

### Phase 2 — Executable foundation

**Complete.**

### Phase 3 — Domain model / managed infrastructure

**Code and managed-resource foundation substantially complete.** Remaining work is staging runtime provisioning: backend, worker, Redis, runtime-only DB/S3 secrets, real staging migrations, Admin user, publishable key, media-upload verification and backup/restore rehearsal.

### Phase 4 — Magento extraction / migration

**Pipeline foundation complete; authoritative source access pending.** Public HTML is not accepted as authoritative migration data.

### Phase 5 — Merchant back office

**Foundation started.** Medusa Admin plus Designer, Website Content, Translation and native pricing/price-list foundations exist. Full Magento-equivalent daily-operation parity is not complete.

### Phase 6 — Storefront parity

**Materially advanced.** Product detail, category PLPs, Designer PLPs, Sale PLPs, bilingual commerce data, pricing/inventory/media and pagination are implemented. Cart, wishlist, full editorial parity and final responsive/visual UAT remain.

### Phase 7 — Search, discovery and merchandising

**Active.** Search, sorting, Color/Size and Designer filtering are implemented on the active branch with URL-driven native query semantics. Context-correct Price filtering remains deferred.

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
9. configure supported locales
10. connect storefront to staging backend
11. verify `/health`, Admin, Store API, Brand/Sale queries, filters/search, translations, media upload and worker operation

## Production boundary

Magento remains the production shop. `coquetteconcept.gr` must not move to the replacement until migration reconciliation, UAT, checkout/payment/courier/fiscal testing, SEO redirect verification, rollback preparation and all roadmap cutover gates pass.
