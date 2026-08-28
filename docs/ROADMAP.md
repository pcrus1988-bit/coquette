# COQUETTE — Master Implementation Roadmap

**Status:** Active canonical Blueprint  
**Last updated:** 2026-08-28  
**Repository:** `pcrus1988-bit/coquette`  
**Verified-state companion:** `docs/AUDIT.md`  
**Current execution snapshot:** `docs/CURRENT_STATUS.md`

This document is the canonical delivery Blueprint for the COQUETTE replacement commerce platform.

Project governance uses three synchronized references:

- **Blueprint / ROADMAP** defines the intended architecture, phase sequence, acceptance criteria and launch gates.
- **AUDIT** records verified current state, drift, recovery findings, runtime topology and human/external dependencies.
- **CURRENT_STATUS** records the present implementation pulse and next executable milestones.

Future implementation decisions must be consistent with all three. When implementation advances beyond an older phase label, AUDIT and CURRENT_STATUS identify the verified advancement; the Blueprint's safety and launch gates remain binding.

---

## 1. Non-negotiable principles

1. COQUETTE is an independent system with dedicated source, database, storage, deployments, credentials, integrations and operational history.
2. Reuse engineering patterns only; never share runtime state or credentials with another project.
3. Preserve the existing shop's commercially important UX, content, catalogue semantics and indexed URLs before redesign-only changes outrun parity.
4. **COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine, API and technical administration foundation.** Studio must never become a second commerce database or independent system of record.
5. The storefront never talks directly to PostgreSQL. It consumes Medusa APIs.
6. Medusa remains the system of record for new customers, products, variants, carts, orders, payments and fulfillment after reconstruction/cutover.
7. Supabase is infrastructure: dedicated managed PostgreSQL plus COQUETTE-only object storage.
8. Secrets never enter Git history. Public source contains placeholders and safe resource coordinates only.
9. The legacy Magento storefront remains production until reconstruction, staging UAT and cutover gates pass.
10. No big-bang reconstruction. Every recoverable legacy domain must be countable, repeatable, idempotent and reconcilable against captured public evidence.
11. Magento administrative/database/filesystem/API access is unavailable. Public values that cannot be recovered from `https://coquetteconcept.gr/` or another legitimate source are never invented.
12. No production payment, AADE or courier action during development unless the environment and credential are explicitly production-approved.
13. Feature/release work must pass relevant exact-head validation before merge/release. Backend, database, Studio and storefront contracts receive their applicable gates.
14. Railway `staging` is a deliberate release branch, not a parallel implementation branch. Server and worker must run the same release commit.
15. A red status from an obsolete deployment target must be removed at the source; architecture is not changed merely to satisfy a wrong deployment target.
16. **A deployable backend is not proven by build success alone.** Full release CI must build the Medusa production artifact, execute the Railway-equivalent predeploy path, start the production server and receive HTTP 2xx from `/health`.
17. **If Railway backend cannot deploy a previously validated application tree, backend-dependent releases stop until service/platform evidence is inspected.** Do not invent source-code workarounds without evidence.
18. Studio must fail soft when a newer merchant control depends on an API not yet present on the deployed backend; unavailable capabilities are hidden or disabled rather than presented as broken actions.
19. A transient hosting/build-platform failure must be distinguished from application failure by exact-tree retry and history-preserving release evidence before architecture or source is changed.

---

## 2. Target architecture

### Merchant experience and commerce backend

- **COQUETTE Studio** — primary merchant-facing daily workspace.
- **Medusa v2 / TypeScript / Node.js** — authoritative commerce engine and API.
- Medusa Admin — technical/expert operational foundation and fallback surface.
- COQUETTE-specific Medusa modules for Designer/Brand, Website Content and governed workflows.
- Dedicated PostgreSQL database.
- Dedicated Redis runtime.
- Railway server + separate worker.

Studio operates through authenticated and constrained Medusa interfaces. Draft/catalogue mutations remain explicit, reviewable and fail closed around pricing, inventory, publication, archive and sales-channel state unless the workflow intentionally owns those domains.

### Storefront

- Next.js App Router / React.
- Independent Vercel deployment from the Railway Medusa runtime.
- Greek primary storefront plus English storefront.
- SEO-preserving canonical/redirect layer.
- No direct database access.

### Managed data

Dedicated Supabase project:

- name: `coquette`
- ref: `pijetwrxqznxaoacnakr`
- region: `eu-central-1`
- PostgreSQL 17
- public media bucket: `coquette-media`
- private reconstruction/import bucket: `coquette-imports`

### Integrations

Provider boundaries remain dedicated to COQUETTE:

- PayPal
- Klarna
- selected card/payment provider(s)
- AADE / myDATA
- courier/shipping providers
- transactional email
- analytics / consent / monitoring

Each provider receives COQUETTE-only credentials and webhook ownership.

---

## 3. Environments and release topology

### Local

- local Next.js storefront
- local Medusa backend/Admin/Studio development
- isolated PostgreSQL/Redis services
- local/test file provider where appropriate
- sandbox/test integrations only

### Staging

Purpose:

- reconstructed catalogue rehearsal
- COQUETTE Studio merchant UAT
- storefront parity and real-data validation
- checkout/payment sandbox testing
- courier sandbox testing
- AADE sandbox/pre-production validation where available
- SEO/redirect verification
- backup/restore rehearsal
- performance/accessibility regression testing

Canonical release topology:

- validated implementation baseline: `main`
- Railway release branch: `staging`
- `staging` receives controlled, history-preserving release commits from validated `main`
- `coquette-backend` and `coquette-worker` must deploy the same staging release commit
- Vercel hosts storefront/Studio surfaces, not the Medusa runtime
- release promotion is not complete until both Railway services succeed and runtime verification passes

### Current release state — restored 2026-08-28

The transient Railway builder/Docker Hub timeout incident is resolved. Exact-same-tree retry `eb03c253…` restored backend/worker health without an application change, proving the failure was external to COQUETTE source. The current validated tree then passed an exact-tree two-parent release candidate with all 8 applicable workflows green and was promoted as final release `ae4d971b0a4e30882474e81a769c5f0a32268eda`.

Current staging invariant:

- Railway backend: SUCCESS on `ae4d971b…`
- Railway worker: SUCCESS on `ae4d971b…`
- Vercel storefront: SUCCESS
- backend/worker same-release alignment: SATISFIED

Backend-dependent Phase 5 progression is therefore unblocked, subject to the same controlled release discipline for every subsequent backend-dependent workflow.

### Production

- `coquetteconcept.gr`
- production credentials only
- legacy-storefront cutover only after all launch gates pass

---

# Delivery phases

## Phase 0 — Workspace and project isolation

**Status: COMPLETE**

Delivered:

- dedicated GitHub repository
- isolated branch/PR workflow
- secret-safe repository rules
- project-boundary documentation
- environment strategy
- integration inventory
- reconstruction-data exclusion rules

**Exit gate:** satisfied.

---

## Phase 1 — Legacy storefront audit and architecture selection

**Status: COMPLETE / AUDIT REMAINS CONTINUOUS**

Delivered:

- Medusa v2 selected as commerce engine
- Next.js selected as storefront
- COQUETTE Studio established as primary merchant UX over Medusa
- PostgreSQL/Redis/S3-compatible infrastructure model
- public-storefront reconstruction strategy
- navigation/category/designer/filter audit
- bilingual URL analysis
- SEO preservation rules

Continue auditing the live public legacy storefront throughout reconstruction for presentation rules, catalogue relationships and content not obvious from primary navigation.

**Exit gate:** architecture approved and executable foundation available.

---

## Phase 2 — Executable commerce foundation

**Status: COMPLETE**

Delivered:

- pnpm/Turbo monorepo
- Medusa backend/Admin
- Next.js storefront
- health endpoint
- pinned dependency baseline and lockfile
- CI/frozen-install validation
- backend TypeScript and Medusa lint validation
- storefront production build validation
- Railway deployable-artifact validation
- Railway-equivalent predeploy + production-server startup + `/health` smoke validation

**Exit gate:** reproducible green builds and production-runtime startup contract.

---

## Phase 3 — COQUETTE domain model and managed infrastructure

**Status: TECHNICAL EXIT GATE COMPLETE / RAILWAY RELEASE ALIGNMENT HEALTHY**

Delivered:

- first-class Designer/Brand module and product links
- bilingual Website Content module with structured SEO fields
- workflow-backed Admin CRUD
- clean-database CRUD contract
- dedicated Supabase PostgreSQL/storage
- managed S3-compatible media
- Railway Medusa server + worker
- dedicated Redis
- Greece/EUR region
- stock-location/fulfillment foundation
- EL/EN locale links
- Vercel storefront connected to Railway Store API
- Supabase Data API isolated from direct commerce-table use
- history-preserving backend/worker release discipline
- production runtime health gate

Outstanding operational hardening:

- backup/restore rehearsal
- repository branch/ruleset protection and secret-scanning verification
- remove/disconnect obsolete Vercel `backend` deployment target

**Exit gate:** technical architecture satisfied; operational hardening continues before launch.

---

## Phase 4 — Public legacy storefront reconstruction

**Status: VERY ADVANCED TECHNICALLY / REAL LEGACY DATA IMPORT STILL PENDING**

**Source boundary:** private Magento access is unavailable. The public storefront and other legitimate public evidence are the recoverable legacy source.

Canonical detailed contract: `docs/migration/STOREFRONT_RECONSTRUCTION_PLAN.md`.

### Reconstruction requirements

Capture and classify the public universe across:

- Greek/English URLs and locale relationships
- homepage/navigation/category/designer/product/content pages
- pagination/search/indexed fallback routes where useful
- canonical/hreflang relationships
- legacy `.html`, `/default/` and `/en/` patterns
- product identity, SKU where exposed, public pricing/sale state, public qualitative stock state
- options/size/color/configurable relationships where reconstructable
- categories, brands/designers, breadcrumbs and editorial content
- descriptions, materials/care/model details where exposed
- media galleries and public downloadable assets
- SEO metadata and structured data where exposed

No critical SKU, price, tax treatment or exact stock quantity may be guessed.

### Evidence and media rules

Every normalized source record retains:

- stable source key/URL
- locale
- source/evidence checksum
- evidence grade/status
- target identity when imported
- warnings/errors/retry state
- capture timestamp/provenance

Recovered media must be copied into COQUETTE-controlled storage with checksums. Production must not hotlink legacy Magento assets.

### Shipped guarded reconstruction chain

The implemented chain includes:

- public URL/evidence capture and indexed recovery
- archive/capture integrity and traversal safety
- deterministic product structural plans
- independent deterministic pricing plans
- qualitative inventory evidence that never invents quantities
- evidence-bound review decisions and review application
- checksum-bound Phase 4N migration bundle
- mandatory reconciled staging input
- operator-local browser evidence package
- deterministic dependency mapping reconciliation
- verified dependency-plan staging input
- one-command portable operator capture handoff
- verified handoff reconciliation intake
- Phase 4U dependency-provisioning evidence for exact category/Brand/media dependencies
- guarded staging product and price execution contracts with idempotency/retry protection

The real legacy catalogue has not yet been written into staging. The authoritative browser capture remains the principal unavoidable external acquisition boundary.

### Reconstruction acceptance

For each capture/rehearsal reconcile:

- discovered/fetched/classified in-scope URLs
- product URLs vs parsed records
- unique SKU/collision/missing-SKU state
- categories/designers
- media discovered/downloaded/failed/deduplicated
- bilingual pairs/unpaired resources
- content and redirect relationships
- warnings/errors/unclassified URLs
- frozen checksums across accepted evidence and executable plans

**Exit gate:** repeatable full public capture/import with every discovered in-scope URL reconstructed or explicitly classified, media copied to COQUETTE storage, idempotent rerun and zero unexplained critical variance.

---

## Phase 5 — Merchant back-office parity / COQUETTE Studio

**Status: MATERIAL IMPLEMENTATION SHIPPED / CURRENT CATALOGUE API RELEASE-ALIGNED**

COQUETTE Studio is the primary Phase 5 merchant surface. Medusa remains authoritative underneath it.

### Shipped, validated and current-release Studio catalogue workflows

- branded, non-technical merchant experience
- Today/dashboard/personal-assistant direction
- guarded Quick Draft creation
- Guided New Piece editorial flow
- autosave/resume against Medusa drafts
- optimistic concurrency and stale-write protection
- managed product media upload/order/cover selection
- human Size/Colour blueprint review
- guarded creation of real Medusa option/variant graphs
- guarded regular/sale EUR pricing
- guarded SKU/EAN/UPC/barcode management
- guarded inventory quantity/location policy fixed to `COQUETTE Greece`
- guarded category assignment using existing active merchant-facing taxonomy
- guarded designer/Brand assignment, replacement and removal
- guarded publication/unpublication lifecycle with explicit status and sales-channel visibility review
- explicit reversible archive/restore policy preserving commerce data and restoring to draft only
- fail-soft Studio capability handling if archive API is absent on a future deployed backend
- deterministic review hashes, confirmation, locking and stale-write protection across sensitive workflows

Archive/restore is released on Railway in `ae4d971b…` with backend and worker aligned.

### Archive policy rule

Pinned Medusa 2.19 has no native `archived` product status. COQUETTE archive therefore remains an explicit metadata/policy layer. Archive must preserve product, variants, pricing, inventory, media and placement while removing the piece from active/public workflow. Restoration returns to `draft` and never republishes automatically.

### Required remaining catalogue operations

- merchant-facing tax configuration where appropriate
- merchandising/SEO application
- bulk operations
- durable scheduled publication only if explicitly retained as a requirement

### Website editor

- homepage sections
- navigation
- banners/promotional strips
- category/designer editorial content
- Our Story/contact/service pages
- shipping/payment/policy content
- Greek/English content
- SEO title/description/canonical fields
- draft/publish workflow

### Commerce operations

- orders
- customers
- refunds/returns
- fulfillments
- promotions/coupons
- payment/shipping/fiscal state

### Operational quality

- role-based access
- auditability for important changes
- clear validation messages
- no ordinary merchant requirement to edit code or deploy the site

**Standing release gate:** every new backend-dependent Studio workflow must pass relevant exact-head CI, an exact-tree history-preserving release candidate, then backend + worker same-release success before the next dependent workflow assumes the API is deployed.

**Exit gate:** merchant staff can perform daily Magento-equivalent operations in staging through Studio/Medusa without developer intervention.

---

## Phase 6 — Storefront parity and design migration

**Status: MATERIALLY ADVANCED / REAL-DATA ACCEPTANCE PENDING**

Foundation covers bilingual navigation, catalogue/PDP surfaces, Designers, Sale, account/cart/search routes, filter surfaces, service/footer structure and substantial UX work.

Remaining acceptance work must be exercised against real reconstructed data:

- real hero/editorial media and homepage merchandising
- real catalogue feeds
- PLP pagination/filter/sort/badges
- complete PDP gallery/variant/price/stock/size-guide/details state
- wishlist/related recommendations where required
- mobile parity
- structured data and final SEO behavior

**Exit gate:** desktop/mobile visual and functional comparison approved against legacy intent and real COQUETTE data.

---

## Phase 7 — Search, discovery and merchandising

**Status: SUBSTANTIALLY IMPLEMENTED AHEAD OF ORIGINAL SEQUENCE / FINAL REAL-DATA QA PENDING**

Required acceptance:

- fast suggestions
- product/title/SKU/designer/category matching
- typo-tolerance strategy
- useful zero-result handling
- price/designer/color/size faceting
- merchandising order/new/sale rules
- canonical parameter behavior

Introduce a dedicated search engine only when measured catalogue/UX requirements justify the operational cost.

**Exit gate:** search/filter experience meets or exceeds legacy behavior with real staging data.

---

## Phase 8 — Customer account, wishlist and cart

**Status: FOUNDATIONS MATERIALLY IMPLEMENTED / FINAL E2E PENDING**

Required acceptance:

- registration/login/logout/reset
- profile and addresses
- order history/detail
- privacy/account deletion workflow
- wishlist persistence strategy
- variant-aware cart
- quantity/removal/promotions
- tax/shipping/totals visibility
- graceful stock changes

Legacy customer accounts/history are not reconstructed from public evidence.

**Exit gate:** authenticated/guest/cart/account paths survive refresh, device changes and staging E2E.

---

## Phase 9 — Checkout and payments

**Status: FOUNDATIONS IMPLEMENTED / PROVIDER E2E AND BUSINESS APPROVAL PENDING**

Checkout remains low-friction, mobile-first and idempotent with clear totals, addresses, shipping and required legal acknowledgements.

Provider workstreams:

- PayPal
- Klarna
- selected card provider

No payment is complete until async webhook/callback, duplicate delivery, capture/refund and reconciliation behavior is tested.

**Exit gate:** end-to-end sandbox checkout/refund suite green for every enabled payment method.

---

## Phase 10 — Shipping and courier integrations

**Status: PLANNED / FOUNDATION ONLY WHERE ALREADY PRESENT**

Required:

- shipping zones/rates/free-shipping policy
- courier adapters
- pickup/locker support if required
- labels/waybills/tracking
- shipment events/customer links
- return shipping
- retry/failure handling

**Exit gate:** sandbox/test shipment lifecycle verified from checkout to delivery/return state.

---

## Phase 11 — AADE / myDATA fiscal integration

**Status: PLANNED**

Use proven architectural patterns only; all COQUETTE credentials, mappings and fiscal state remain dedicated.

Required:

- legal seller/entity confirmation
- document/VAT/revenue/payment mapping
- numbering strategy
- idempotency
- MARK/UID persistence
- cancellation/credit handling
- retry/reconciliation/manual-review state

Never guess fiscal treatment from ambiguous order data.

**Exit gate:** accountant/business approval plus controlled sandbox/test evidence.

---

## Phase 12 — Email, notifications and CRM basics

**Status: PLANNED**

Transactional EL/EN templates include registration/reset/order/payment/shipment/cancellation/refund/return flows.

Legacy subscribers may only be imported from a legitimate consent-bearing source.

**Exit gate:** approved templates and verified transactional delivery.

---

## Phase 13 — SEO and URL reconstruction

**Status: FOUNDATION STARTED / EVIDENCE PIPELINE ADVANCED**

Required:

- evidence-backed legacy URL inventory
- one-to-one 301/308 mappings for changed high-value URLs
- no broad wildcard redirects hiding missing mappings
- no redirect chains
- canonical/hreflang EL/EN
- XML sitemaps and environment robots rules
- valid Product/Breadcrumb/Organization structured data
- Search Console validation after cutover

**Exit gate:** every captured/indexed high-value legacy URL resolves directly to the correct target or justified retirement response.

---

## Phase 14 — Security, privacy and compliance

**Status: CONTINUOUS**

Required:

- dependency/secret scanning
- admin authorization review
- secure sessions/cookies/headers
- abuse/rate controls where needed
- webhook signature verification and idempotency
- least-privilege DB/storage credentials
- privacy/terms/cookie/legal review
- consent and data export/deletion workflows
- backup access controls

**Exit gate:** no unresolved high-severity security issue.

---

## Phase 15 — Performance, accessibility and QA

**Status: CI FOUNDATION ACTIVE / FULL QA PENDING**

Automated gates include dependency install, backend type-check/lint, clean migrations, Admin contracts, reconstruction/import lifecycle tests, Railway production artifact build/start/health smoke, Studio contracts and storefront build.

Acceptance additionally covers responsive behavior, keyboard/focus/forms/contrast, image strategy, Core Web Vitals and browser/device coverage.

**Exit gate:** agreed quality budgets and critical-path suite green.

---

## Phase 16 — Staging UAT and operational rehearsal

**Status: PLANNED; DEPENDS ON REAL RECONSTRUCTED DATA**

Rehearse:

1. clean database/migrations
2. authoritative legacy capture and verified intake
3. dependency provisioning and guarded import
4. reconciliation
5. storefront/Studio smoke tests
6. merchant daily tasks
7. test orders/payment lifecycle
8. courier/fiscal lifecycle
9. refund/return
10. redirect crawl
11. backup and restore rehearsal

**Exit gate:** written UAT sign-off and no P0/P1 issue.

---

## Phase 17 — Production cutover

**Status: PLANNED**

Pre-cutover requires a fresh accepted legacy capture, immutable final manifests, manual verification of commercially critical price/inventory state, production secrets/webhooks, monitoring and rollback coordinates.

Cutover sequence:

1. final public capture
2. changed/new evidence processing
3. reconciliation
4. backend/storefront smoke tests
5. switch domain/routing
6. verify TLS/robots/canonical/sitemap
7. controlled production order
8. verify payment/order/email/fiscal pipeline
9. monitor errors/404s

Rollback must preserve the previous stable COQUETTE deployment/configuration and pre-cutover DNS state.

**Exit gate:** production stability confirmed and rollback window deliberately closed.

---

## Phase 18 — Post-launch stabilization and improvement

**Status: PLANNED**

Priorities:

- 404/redirect monitoring
- checkout/payment/fiscal/courier errors
- Core Web Vitals
- search quality
- merchant workflow friction
- catalogue/media defects
- Search Console indexing

Broader redesign/personalization remains subordinate to parity and operational correctness until stabilization.

---

# Current implementation pulse

## Completed / verified foundations

- project isolation and architecture
- executable Medusa/Next.js monorepo
- CI and frozen dependency baseline
- dedicated Supabase PostgreSQL/storage
- Railway Medusa server + worker + Redis architecture
- Greece/EUR commerce foundation
- Vercel storefront/Studio surfaces
- managed media verification
- Designer/Brand and Website Content domains
- custom Admin CRUD and clean-database contracts
- substantial storefront/search/cart/checkout/payment foundations
- Phase 4 evidence/reconciliation/import safety chain through Phase 4U
- Studio guided draft/media/variant foundations
- Studio guarded pricing, identifiers, inventory, placement and publication lifecycle
- Studio guarded archive/restore implementation
- Studio fail-soft archive capability fallback deployed READY
- production Medusa startup and `/health` CI gate
- original `main` ↔ Railway `staging` history drift recovery
- transient Railway builder incident diagnosed and closed without source workaround
- archive-capable Railway release `ae4d971b…` with backend + worker aligned

## Active critical path

1. continue backend-dependent Phase 5 catalogue parity with merchant-facing tax controls using native Medusa tax constructs and no invented tax treatment;
2. continue merchandising/SEO application and bulk catalogue operations under the same controlled release discipline;
3. remove obsolete Vercel `backend` project/Git integration so false deployment failures disappear;
4. acquire the authoritative legacy operator-browser capture;
5. run verified handoff intake and resolve only evidence-backed blockers;
6. provision required categories/Brands/media and build the verified dependency plan;
7. complete backup/restore rehearsal before real staging legacy-data writes;
8. execute guarded structural product and price imports;
9. reconcile staging catalogue/media/URLs;
10. complete broader order/customer/refund/fulfillment/payment/shipping/fiscal Studio parity;
11. finish Studio/storefront/payment/courier/fiscal/SEO UAT against real data;
12. proceed to controlled production cutover only after launch gates pass.

## Current external/manual dependencies

Account/business-controlled inputs include:

- public availability of `https://coquetteconcept.gr/` until accepted capture
- authoritative browser/network environment for required capture provenance
- Vercel owner cleanup if project deletion/disconnection is not exposed through connected tooling
- GitHub repository protection/ruleset administration where required
- payment/courier/AADE/email production credentials
- shipping/business policy decisions
- legal/privacy approval
- production DNS authority
- merchant UAT/sign-off

Magento administrative/database/export access is not an expected dependency.

---

# Definition of launch-ready

COQUETTE is not launch-ready until all of the following are true:

- Railway backend and worker are healthy on the same controlled release
- reconstructed public catalogue reconciles against the accepted immutable legacy evidence universe
- every discoverable in-scope legacy URL is reconstructed or explicitly classified
- media is copied to COQUETTE-controlled storage with no unexplained critical failures
- unrecoverable private Magento data is documented and never fabricated
- daily merchant workflows work without developer intervention
- account/cart/checkout paths are complete
- every enabled payment method passes sandbox and controlled production verification
- shipping/courier lifecycle is verified
- fiscal lifecycle is approved and verified
- transactional email is verified
- redirect manifest and sitemap/robots/canonical/hreflang are verified
- staging UAT is signed off
- backup/restore and rollback procedures are tested
- no unresolved P0/P1 defect exists
- monitoring/error alerting are active
- production cutover has an explicit rollback plan

**This launch gate takes precedence over calendar pressure.**
