# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`  
**Purpose:** short operational companion showing what is actually implemented now. When this file and an older roadmap checkbox differ, use this file for delivery state and the roadmap for phase/exit-gate definitions.

## Shipped to `main`

Through merge `6f918059efd0668a0cb8558f297831dc26a6a1a3`:

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
- provider-agnostic payment-provider discovery by Medusa region
- typed Medusa payment-session initialization
- authoritative payment collection/session state reloaded into the cart
- customer-facing manual/system payment provider hidden by default
- no order completion or fake paid state in generic checkout
- CI with fresh PostgreSQL 17 + Redis, clean migrations, migration contract, PayPal registration contract, Sale pricing-graph contract, backend production build and storefront production build

## Active implementation

Branch: `feature/paypal-provider-foundation`

Implemented on branch:

- pinned `@paypal/paypal-server-sdk@2.5.0` using the workspace lockfile
- custom Medusa PayPal Payment Module Provider under `apps/backend/src/modules/paypal`
- provider identifier `paypal`; runtime Medusa provider ID `pp_paypal_paypal`
- provider is registered only when both `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` exist
- absence of PayPal credentials leaves local development and normal backend startup provider-free
- Sandbox is the safe/default environment; Live requires explicit `PAYPAL_ENVIRONMENT=production`
- authorize-only is the default; `PAYPAL_AUTO_CAPTURE=true` enables immediate capture behavior
- PayPal order creation stores Medusa session ID as PayPal `custom_id`
- provider methods implemented for initiate, authorize, capture, refund, update, retrieve, cancel, delete/no-op and payment-status mapping
- PayPal webhook signature verification implemented using the configured PayPal webhook ID
- supported webhook actions include authorization-created, authorization-voided, capture-completed and capture-denied
- backend environment template documents PayPal runtime variables without credentials
- CI now forces the PayPal registration path with dummy sandbox credentials after clean migrations
- backend TypeScript compatibility with PayPal SDK 2.5.0 passed
- conditional Medusa provider registration/constructor path passed with dummy sandbox credentials
- architecture documented in `docs/architecture/PAYPAL_PROVIDER.md`
- temporary dependency-lock bootstrap workflow has been removed; normal frozen-lockfile CI remains authoritative

The branch still requires final documentation-inclusive exact-head CI, protected PR CI and merge before the PayPal backend provider is considered shipped.

## Phase status

### Phase 0 — Workspace / isolation

Implementation: **complete**, except the GitHub repository remains public and should be made private before sensitive migration work.

### Phase 1 — Audit / architecture

**Complete; continuous Magento audit remains active.**

### Phase 2 — Executable foundation

**Complete.**

### Phase 3 — Domain model / managed infrastructure

**Code and managed-resource foundation substantially complete.** Remaining work is staging runtime provisioning: backend, worker, Redis, runtime-only DB/S3/payment secrets, real staging migrations, Admin user, publishable key, media-upload verification and backup/restore rehearsal.

### Phase 4 — Magento extraction / migration

**Pipeline foundation complete; authoritative source access pending.** Public HTML is not accepted as authoritative migration data.

### Phase 5 — Merchant back office

**Foundation started.** Medusa Admin plus Designer, Website Content, Translation and native pricing/price-list foundations exist. Full Magento-equivalent daily-operation parity is not complete.

### Phase 6 — Storefront parity

**Materially advanced.** Product detail, category PLPs, Designer PLPs, Sale PLPs, bilingual commerce data, pricing/inventory/media, pagination, catalogue discovery, cart, address/shipping checkout and generic payment-session selection are shipped. Wishlist, full editorial parity, provider-specific payment authorization and final responsive/visual UAT remain.

### Phase 7 — Search, discovery and merchandising

**Substantially implemented.** Search, sorting, Color/Size and Designer filtering are shipped to `main` with URL-driven native query semantics. Context-correct Price filtering remains deferred.

### Phase 8 — Cart / checkout foundation

**Generic checkout/payment-session foundation shipped.** The PayPal backend provider is active on a feature branch. PayPal browser approval/order completion, Klarna and the final card acquirer remain separate provider workstreams.

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
12. provision PayPal Sandbox merchant app and backend credentials
13. configure PayPal webhook and `PAYPAL_WEBHOOK_ID`
14. enable `pp_paypal_paypal` on the intended Medusa region
15. add/test the provider-specific PayPal browser approval flow before enabling order completion
16. connect storefront to staging backend
17. verify `/health`, Admin, Store API, catalogue flows, translations, cart, address/shipping checkout, payment sessions, PayPal authorization/webhooks, media upload and worker operation

## Production boundary

Magento remains the production shop. `coquetteconcept.gr` must not move to the replacement until migration reconciliation, UAT, checkout/payment/courier/fiscal testing, SEO redirect verification, rollback preparation and all roadmap cutover gates pass.
