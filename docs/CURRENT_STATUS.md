# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`  
**Purpose:** short operational companion showing what is actually implemented now. When this file and an older roadmap checkbox differ, use this file for delivery state and the roadmap for phase/exit-gate definitions.

## Shipped to `main`

Through merge `f94681f9e63052cc8766a1101e86b374c7813b55`:

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
- custom PayPal Medusa Payment Module Provider using `@paypal/paypal-server-sdk@2.5.0`
- conditional PayPal provider registration only when backend credentials exist
- PayPal Sandbox-safe authorize/capture/refund/void/update/retrieve/status methods and verified webhook handling
- PayPal React SDK v6 storefront approval using `@paypal/react-paypal-js@10.3.0`
- browser reuses the Medusa-created PayPal order and never creates a duplicate PayPal order
- PayPal approval verifies the provider order ID before Medusa cart completion
- only Medusa `type === "order"` clears the persisted COQUETTE cart
- PayPal cancel/error/completion failure leaves the cart recoverable and never fabricates an order
- Greek `/order-confirmation/[id]` and English `/en/order-confirmation/[id]` routes exposing only the opaque order identifier
- PayPal storefront architecture documented in `docs/architecture/PAYPAL_STOREFRONT_APPROVAL.md`
- CI with PostgreSQL 17 + Redis, clean migrations, migration contract, payment-provider registration contract, Sale pricing-graph contract, backend production build and storefront production build

PayPal still requires a real end-to-end Sandbox test in the dedicated COQUETTE staging environment before any Live activation.

## Active implementation

Branch: `feature/klarna-provider-foundation`

Implemented on branch:

- custom credential-gated Klarna Medusa Payment Module Provider
- one shared Medusa Payment Module registration containing independently gated PayPal and Klarna providers
- Klarna Playground as the default environment; no Live credentials in code or CI
- EU API-region default, Greece purchase-country default and Greek locale default
- Klarna Payments session creation with authoritative amount, currency, order lines and tax amount
- explicit validation that payment totals/order lines come from checkout data; provider does not guess tax or line allocation
- Klarna client token/session ID/payment categories stored in Medusa payment-session data
- signed HMAC server authorization callback at `/hooks/klarna/authorization`
- timing-safe callback signature validation
- callback-to-payment-session lookup and Klarna session-ID match enforcement
- at-least-once callback idempotency for repeated identical authorization tokens
- rejection of conflicting authorization tokens
- server-side persistence of Klarna authorization token before order creation
- `authorizePayment` refuses cart completion without the stored authorization token
- Klarna order creation uses a stable idempotency key and persists order/fraud/redirect/payment-method state
- fraud status maps conservatively to Medusa authorized/pending or failure behavior
- Medusa 2.19 full-capture contract honored by capturing the stored authorized order amount
- refund, cancel/release, retrieve and payment-status operations
- CI forces PayPal + Klarna provider registration together with inert dummy credentials and no external payment network calls
- architecture documented in `docs/architecture/KLARNA_PAYMENT_PROVIDER.md`

The implementation branch has passed full branch CI at `4405968ec3dcac43124859383aed35ff632c1e7a`. Documentation-inclusive exact-head CI, protected PR CI and merge are still required before the Klarna backend foundation is considered shipped.

Klarna browser authorization is intentionally not claimed complete. It requires dedicated COQUETTE Klarna Playground credentials, an externally reachable staging backend callback, the current Klarna storefront SDK/client-token flow, customer authorize/cancel/error handling, callback/browser race testing and real end-to-end order/capture/cancel/refund tests.

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

**Materially advanced.** Product detail, category PLPs, Designer PLPs, Sale PLPs, bilingual commerce data, pricing/inventory/media, pagination, catalogue discovery, cart, address/shipping checkout and PayPal order completion are shipped. Klarna browser authorization, wishlist, full editorial parity and final responsive/visual UAT remain.

### Phase 7 — Search, discovery and merchandising

**Substantially implemented.** Search, sorting, Color/Size and Designer filtering are shipped to `main` with URL-driven native query semantics. Context-correct Price filtering remains deferred.

### Phase 8 — Cart / checkout foundation

**Generic checkout/payment-session foundation, PayPal backend provider and PayPal browser order-completion flow are shipped.** Klarna backend provider foundation is active on a feature branch. Klarna storefront authorization and the final card acquirer remain separate workstreams.

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
9. configure supported `el-GR` and `en-GB` commerce locales
10. configure the Greece-serving Medusa region and sales-channel relationship
11. configure real service zones, shipping profiles/options and any fulfillment provider needed for calculated rates
12. provision dedicated COQUETTE PayPal Sandbox merchant app and backend credentials
13. configure PayPal webhook and `PAYPAL_WEBHOOK_ID`
14. enable `pp_paypal_paypal` on the intended Medusa region
15. configure storefront with the matching public PayPal Sandbox Client ID
16. test PayPal approval, cancel, failed completion, successful order creation, capture, void, refund and webhook behavior end-to-end
17. provision dedicated COQUETTE Klarna Playground merchant credentials
18. confirm Klarna merchant agreement enables Greece/EUR and intended payment categories
19. configure externally reachable Klarna authorization callback URL and independent callback secret
20. enable the Klarna provider on the intended Medusa region
21. implement/test Klarna storefront client-token authorization flow
22. test Klarna callback retries/races, accepted/pending/rejected authorization, successful Medusa order creation, capture, cancel and refund
23. connect storefront to staging backend
24. verify `/health`, Admin, Store API, catalogue flows, translations, cart, address/shipping checkout, payment sessions, PayPal flow, Klarna flow, media upload and worker operation

## Production boundary

Magento remains the production shop. `coquetteconcept.gr` must not move to the replacement until migration reconciliation, UAT, checkout/payment/courier/fiscal testing, SEO redirect verification, rollback preparation and all roadmap cutover gates pass.
