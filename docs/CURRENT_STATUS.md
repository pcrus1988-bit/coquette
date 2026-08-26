# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`  
**Purpose:** short operational companion showing what is actually implemented now. When this file and an older roadmap checkbox differ, use this file for delivery state and the roadmap for phase/exit-gate definitions.

## Shipped to `main`

Through merge `2c6fbfbd5d73dcb3f51077423763bc81d91ccc09`:

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
- real Greek/English product search using Medusa `q`
- controlled catalogue sorting using Medusa `order`
- Color/Size filters using global Product Option value IDs
- Designer filters using first-class Brand links intersected inside normal Store Product API queries
- URL-driven catalogue state: `q`, `sort`, repeated `option`, `designer`, `page`
- exact query-state preservation across pagination
- CI with fresh PostgreSQL 17 + Redis, clean migrations, migration contract, Sale pricing-graph contract, backend production build and storefront production build

## Active implementation

Branch: `feature/cart-foundation`

Implemented on branch and green on functional head `1e7cf2f47be9d492b6c268759f70c06512e1698b`:

- client Region provider resolves the Medusa region serving Greece and persists the region ID
- persistent Medusa cart ID stored locally; invalid/expired carts are discarded safely
- cart is created lazily and remains Medusa-authoritative
- explicit cart locales: Greek `el-GR`, English `en-GB`, configurable by environment
- persisted cart is idempotently aligned with the current region and storefront locale
- one cart survives EL/EN navigation while translated line-item content follows cart locale
- real product option/variant selection on product detail
- Add to Cart only becomes available after selected option values resolve to an actual Medusa variant
- selected variant controls displayed calculated price and stock state
- quantity selection and real Store API add-line-item operation
- live cart item count in the site header
- real Greek `/cart` and English `/en/cart`
- line-item quantity update and removal
- product thumbnails/variant labels and real cart subtotal/total
- checkout remains deliberately disabled until addresses, shipping and payments are implemented together
- no provisional shipping fee, payment credential or fiscal rule is hard-coded
- architecture documented in `docs/architecture/CART.md`

The cart branch still requires final documentation-inclusive exact-head CI, protected PR CI and merge before cart is considered shipped.

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

**Materially advanced.** Product detail, category PLPs, Designer PLPs, Sale PLPs, bilingual commerce data, pricing/inventory/media, pagination and catalogue discovery are shipped. Cart interaction is implemented on the active branch; wishlist, full editorial parity and final responsive/visual UAT remain.

### Phase 7 — Search, discovery and merchandising

**Substantially implemented.** Search, sorting, Color/Size and Designer filtering are shipped to `main` with URL-driven native query semantics. Context-correct Price filtering remains deferred.

### Phase 8 — Cart / checkout foundation

**Cart active on feature branch.** Persistent cart and line-item operations are implemented. Checkout address, shipping and payment-session work has not started yet.

### Phases 9–18

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
9. configure supported `el-GR` and `en-GB` locales
10. configure the Greece-serving Medusa region and sales-channel relationship
11. connect storefront to staging backend
12. verify `/health`, Admin, Store API, Brand/Sale queries, filters/search, translations, real cart flow, media upload and worker operation

## Production boundary

Magento remains the production shop. `coquetteconcept.gr` must not move to the replacement until migration reconciliation, UAT, checkout/payment/courier/fiscal testing, SEO redirect verification, rollback preparation and all roadmap cutover gates pass.
