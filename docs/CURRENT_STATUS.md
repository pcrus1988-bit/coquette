# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`  
**Purpose:** short operational companion showing what is actually implemented now. When this file and an older roadmap checkbox differ, use this file for delivery state and the roadmap for phase/exit-gate definitions.

## Shipped to `main`

Through merge `8bc13b4a3e456cab094a1357f05873551c22c943`:

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
- Greek `/checkout` and English `/en/checkout`
- customer email + shipping/billing address updates
- country selection restricted to the active Medusa region
- live Store API shipping-option discovery
- calculated shipping-rate retrieval without guessed fallback prices
- real Medusa shipping-method selection and authoritative cart totals
- CI with fresh PostgreSQL 17 + Redis, clean migrations, migration contract, Sale pricing-graph contract, backend production build and storefront production build

## Active implementation

Branch: `feature/payment-session-foundation`

Implemented on branch and green on functional head `8242db8c1e9a9b0604fdd9df8740ff105d05243c`:

- checkout payment step is provider-agnostic and remains inside the existing Medusa cart flow
- payment providers are discovered using the cart `region_id`
- payment selection activates only after address + shipping method are present
- zero-total carts do not initialize an online payment session
- Medusa's `pp_system_default` manual provider is hidden from customers by default
- manual payment can only be surfaced with explicit `NEXT_PUBLIC_ALLOW_MANUAL_PAYMENT=true`
- typed `initiatePaymentSession` operation is derived from the installed Medusa SDK signature
- Medusa creates/updates the payment collection/session; storefront does not fabricate payment state
- cart is re-fetched with `payment_collection.payment_sessions` after initialization
- active provider/session is rendered from authoritative cart state
- no `completeCart` call exists in this branch
- no PayPal/Klarna/card credentials are stored or required
- provider-specific authorization/redirect UI remains deliberately unimplemented
- no payment authorization, capture, refund or successful-order state can be triggered from the new step
- architecture documented in `docs/architecture/PAYMENT_SESSION.md`

The payment-session branch still requires documentation-inclusive exact-head CI, protected PR CI and merge before this foundation is considered shipped.

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

**Materially advanced.** Product detail, category PLPs, Designer PLPs, Sale PLPs, bilingual commerce data, pricing/inventory/media, pagination, catalogue discovery, cart and address/shipping checkout are shipped. Wishlist, full editorial parity and final responsive/visual UAT remain.

### Phase 7 — Search, discovery and merchandising

**Substantially implemented.** Search, sorting, Color/Size and Designer filtering are shipped to `main` with URL-driven native query semantics. Context-correct Price filtering remains deferred.

### Phase 8 — Cart / checkout foundation

**Cart + address/shipping shipped; payment-session foundation active on feature branch.** Generic provider discovery and session initialization are implemented without order completion. Provider-specific PayPal/Klarna/card authorization is not implemented yet.

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
12. install and enable real payment providers on the intended region using sandbox/test credentials
13. connect storefront to staging backend
14. verify `/health`, Admin, Store API, catalogue flows, translations, cart, address/shipping checkout, payment-provider discovery/session initialization, media upload and worker operation

## Production boundary

Magento remains the production shop. `coquetteconcept.gr` must not move to the replacement until migration reconciliation, UAT, checkout/payment/courier/fiscal testing, SEO redirect verification, rollback preparation and all roadmap cutover gates pass.
