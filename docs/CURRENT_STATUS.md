# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`  
**Purpose:** short operational companion showing what is actually implemented now. When this file and an older roadmap checkbox differ, use this file for delivery state and the roadmap for phase/exit-gate definitions.

## Shipped to `main`

Through merge `16a6e61bd346f867776a381b9f70c74719fa22a1`:

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
- persistent Medusa cart with Greece-region resolution
- explicit `el-GR` / `en-GB` cart localization
- real PDP variant selection and Add to Cart
- Greek `/cart` and English `/en/cart`
- line-item quantity update/removal and live header count
- real Medusa cart subtotal/total rendering
- CI with fresh PostgreSQL 17 + Redis, clean migrations, migration contract, Sale pricing-graph contract, backend production build and storefront production build

## Active implementation

Branch: `feature/checkout-address-shipping`

Implemented on branch and green on functional head `b00546918dce6e4cdff0681d2581a20d482d4c78`:

- cart CTA now enters a real checkout flow instead of a disabled placeholder
- Greek `/checkout` and English `/en/checkout`
- customer email capture
- shipping address form
- billing address initially mirrors shipping address
- country selector restricted to countries in the active Medusa region
- cart contact/address update through the Store Cart Update API
- live shipping-option discovery using `store.fulfillment.listCartOptions({ cart_id })`
- calculated shipping-rate retrieval through Medusa's documented Calculate Shipping Option Price route
- calculated options without a valid returned amount remain unselectable rather than receiving a guessed rate
- shipping-method selection through Medusa `cart.addShippingMethod`
- selected shipping method updates authoritative shipping/cart totals
- payment remains deliberately disabled until real providers are configured
- no old Magento courier charge, free-shipping rule, payment credential or fiscal rule is hard-coded
- architecture documented in `docs/architecture/CHECKOUT_ADDRESS_SHIPPING.md`

The checkout branch still requires documentation-inclusive exact-head CI, protected PR CI and merge before address/shipping checkout is considered shipped.

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

**Materially advanced.** Product detail, category PLPs, Designer PLPs, Sale PLPs, bilingual commerce data, pricing/inventory/media, pagination, catalogue discovery and cart are shipped. Wishlist, full editorial parity and final responsive/visual UAT remain.

### Phase 7 — Search, discovery and merchandising

**Substantially implemented.** Search, sorting, Color/Size and Designer filtering are shipped to `main` with URL-driven native query semantics. Context-correct Price filtering remains deferred.

### Phase 8 — Cart / checkout foundation

**Cart shipped; address/shipping active on feature branch.** Email, address and real shipping-option selection are implemented. Payment-session work has not started.

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
11. configure real service zones, shipping profiles/options and any fulfillment provider needed for calculated rates
12. connect storefront to staging backend
13. verify `/health`, Admin, Store API, Brand/Sale queries, filters/search, translations, cart, address/shipping checkout, media upload and worker operation

## Production boundary

Magento remains the production shop. `coquetteconcept.gr` must not move to the replacement until migration reconciliation, UAT, checkout/payment/courier/fiscal testing, SEO redirect verification, rollback preparation and all roadmap cutover gates pass.
