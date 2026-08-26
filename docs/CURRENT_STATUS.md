# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`  
**Purpose:** concise operational snapshot of what is actually implemented now. Use `ROADMAP.md` for phase definitions and exit gates; use this file for current delivery state.

## Current baseline

COQUETTE is an isolated Medusa v2 / Next.js commerce platform with dedicated source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates are satisfied.

The active reconstruction source decision is explicit: Magento Admin/database/filesystem/API access is no longer available. Phase 4 therefore reconstructs the recoverable legacy shop from the **public storefront**, supported by indexed public evidence and explicit unavailable-data classification. Private Magento-only data is never guessed.

## Shipped to `main`

Through Phase 4B merge `2f68ae36a79431bd71d054b496aca2baa2644b8c`:

### Platform / managed infrastructure

- dedicated COQUETTE repository/workspace and environment separation
- pnpm/Turbo monorepo
- Medusa v2.19 backend + Medusa Admin
- Next.js bilingual storefront
- dedicated Supabase PostgreSQL 17 project
- `coquette-media` public bucket and `coquette-imports` private bucket
- Medusa S3 file provider with verified upload/read smoke path
- Railway long-running Medusa server and separate worker
- Redis-backed Medusa cache/event/workflow/locking modules
- Vercel storefront connected to the Railway Store API
- Greece/EUR region and Greece stock/fulfillment foundation
- Greek/English commerce localization
- Supabase Data API roles blocked from direct access to Medusa commerce tables
- Node 22.22+ runtime and full clean-database CI

### Domain / merchant foundation

- first-class Designer/Brand module
- product↔designer links
- bilingual Website Content module
- workflow-backed Admin CRUD for Designers and Website Content
- clean-database Admin CRUD contract
- structured content and SEO fields

### Storefront / commerce

- Greek/English catalogue routes
- product detail pages
- Clothing and Accessories PLPs
- Brand-backed Designer directory/PLPs
- verified Sale merchandising using Medusa Sale price-list semantics
- search, sorting, Color/Size/Designer filters
- URL-driven catalogue state
- persistent Medusa cart
- variant-aware Add to Cart
- quantity update/removal
- bilingual cart and checkout
- email, shipping/billing address and region-country validation
- live shipping-option discovery and calculated shipping-rate retrieval
- authoritative cart totals
- provider-agnostic payment-session foundation
- PayPal backend provider and browser approval/order-completion flow
- Klarna backend provider foundation, signed authorization callback and workflow hardening

### Phase 4 reconstruction

- public-storefront reconstruction source contract and roadmap
- immutable source/checksum/manifest/reconciliation foundation
- browser/HTTP capture tooling for HTML, URLs, product evidence and same-host media
- robots/sitemap/pagination handling and capture parser contract
- explicit capture failure classification
- GitHub-hosted HTTP/headless/headed Chrome tests proving the legacy Cloudflare configuration blocks CI-runner capture; zero-page runs are recorded as incomplete rather than success
- indexed recovery baseline with catalogue-scale signals, designers/categories, product observations and freshness/provenance
- indexed recovery contract in CI

## Active implementation

### Phase 4C — recovery candidate normalization

PR #46: `Phase 4C: provenance-aware recovery candidate normalization`

Current branch adds an intermediate product-candidate layer between evidence and Medusa import:

- `ready`, `needs_review`, `rejected` dispositions
- field-level evidence authority and conflict retention
- indexed/derived evidence cannot set stock automatically
- identity/pricing disagreements remain explicit review conflicts
- direct evidence must be timestamped before a candidate can become ready
- indexed observations map only facts actually observed; SKU, source ID, product type, status, visibility, categories, options, media and stock are not fabricated
- current indexed baseline generator must produce zero auto-ready products
- candidate safety contract and real-baseline candidate generation are CI gates

The current Phase 4C source documentation is aligned with issue #39: direct public storefront evidence is the canonical recoverable source; the `authoritative_magento` code class is retained only for compatibility if a legitimate historical snapshot unexpectedly becomes available later.

## Phase status

### Phase 0 — Workspace / isolation

**Complete.**

### Phase 1 — Audit / architecture

**Complete; public storefront audit remains continuous.**

### Phase 2 — Executable foundation

**Complete.**

### Phase 3 — Domain model / managed infrastructure

**Technical exit gate complete.** Runtime backend, worker, Redis, database/storage, Store API and S3 media path are operational. Remaining infrastructure work is operational hardening rather than a Phase 3 implementation blocker.

### Phase 4 — Public legacy storefront reconstruction

**Active.**

Current path:

1. direct public-storefront preservation tooling — shipped;
2. indexed recovery/reconciliation baseline — shipped;
3. provenance-aware recovery candidates — active in PR #46;
4. next: ingest successful capture artifacts into candidates and build the complete URL classification/reconciliation universe;
5. run direct capture from a legitimate operator/browser network accepted by the legacy Cloudflare configuration;
6. import recoverable catalogue/content/media to staging with COQUETTE-owned media and idempotent reconciliation.

The Phase 4 exit gate is the public-source gate in `ROADMAP.md` and issue #39. No unavailable private Magento data is required or fabricated.

### Phase 5 — Merchant back office parity

**Foundation started.** Medusa Admin plus Designer, Website Content, Translation and native catalogue/pricing foundations exist. Full daily-operation parity remains.

### Phase 6 — Storefront parity

**Materially advanced.** Catalogue, PDP, Designer, Sale, bilingual data, search/filtering, cart and checkout foundations are implemented. Editorial/visual parity, remaining customer features and final responsive UAT remain.

### Phase 7 — Search / discovery / merchandising

**Substantially implemented ahead of roadmap sequencing.** Search, sort and Color/Size/Designer filters are shipped. Context-safe calculated-price filtering and later merchandising refinements remain.

### Phase 8 / 9 — Customer/cart/checkout/payments

Cart and generic checkout foundations plus PayPal end-to-end browser integration and Klarna backend foundation are implemented ahead of formal phase completion. Klarna storefront authorization and real Playground end-to-end tests remain staging work; no production payment activation is implied.

### Phases 10–18

Remain governed by `docs/ROADMAP.md`; completion requires their documented exit gates.

## Operational follow-ups

These are real open controls but do not revert the completed Phase 3 technical gate:

- issue #40 — prove staging backup and non-destructive restore
- issue #41 — protect `main` and verify repository secret scanning/push protection
- `main` is currently not protected by GitHub branch protection/ruleset enforcement
- successful direct legacy capture still needs an accepted operator/browser network because GitHub-hosted runners are challenged by Cloudflare

## Payment staging gates

Before Live payment activation:

- use dedicated COQUETTE PayPal Sandbox credentials and webhook
- complete PayPal approval/cancel/failure/capture/void/refund/webhook E2E
- use dedicated Klarna Playground credentials
- verify Greece/EUR merchant eligibility and payment categories
- complete Klarna storefront client-token authorization
- test callback retry/race, accepted/pending/rejected states, Medusa order completion, capture/cancel/refund

No Live payment credential or production payment action is part of the current Phase 4 work.

## Production boundary

The legacy shop remains production. `coquetteconcept.gr` must not move to the replacement until public reconstruction reconciliation, COQUETTE-owned media recovery, merchant/customer UAT, payment/courier/fiscal testing, SEO redirect verification, rollback preparation and the roadmap cutover gates are satisfied.
