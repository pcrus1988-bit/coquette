# COQUETTE — Master Implementation Roadmap

**Status:** Active blueprint  
**Last updated:** 2026-08-26  
**Repository:** `pcrus1988-bit/coquette`

This document is the canonical delivery blueprint for the COQUETTE replacement commerce platform. Future implementation decisions and project queries should be checked against this roadmap and the architecture decision records in `docs/architecture/`.

## 1. Non-negotiable principles

1. COQUETTE is an independent system with dedicated source, database, storage, deployments, credentials, integrations and operational history.
2. Reuse engineering patterns, never shared runtime state or credentials from another project.
3. Preserve the current shop's commercially important UX, content, catalogue semantics and indexed URLs before introducing redesign-only changes.
4. The merchant must receive one understandable back office. Medusa Admin is the commerce/admin foundation and COQUETTE-specific content tools extend it.
5. The storefront never talks directly to PostgreSQL. It consumes Medusa APIs.
6. Medusa remains the system of record for new customers, products, carts, orders, payments and fulfillment after reconstruction/cutover.
7. Supabase is infrastructure: managed PostgreSQL plus COQUETTE-only object storage.
8. Secrets never enter Git history. The public repository contains placeholders and safe resource coordinates only.
9. The legacy Magento storefront remains production until public-storefront reconstruction, staging UAT and cutover gates pass.
10. No big-bang reconstruction. Every recoverable legacy domain must be countable, repeatable, idempotent and reconcilable against captured public evidence.
11. Magento administrative/database/filesystem/API access is no longer available. Public values that cannot be recovered from `https://coquetteconcept.gr/` or another legitimate source are never invented.
12. No production payment, AADE or courier action during development unless the environment and credential are explicitly production-approved.
13. Every feature branch must pass frozen dependency install, backend type-check and storefront production build before merge. Infrastructure files receive their own validation where applicable.

---

## 2. Target architecture

### Commerce backend and merchant admin

- Medusa v2
- TypeScript / Node.js
- Medusa Admin extended with COQUETTE-specific modules
- Dedicated PostgreSQL database
- Dedicated Redis for production runtime concerns

### Storefront

- Next.js App Router
- React
- Independent deployment from the Medusa backend
- Greek primary storefront plus English storefront
- SEO-preserving canonical/redirect layer

### Managed data

Dedicated Supabase project:

- name: `coquette`
- ref: `pijetwrxqznxaoacnakr`
- region: `eu-central-1`
- database: PostgreSQL 17
- public media bucket: `coquette-media`
- private reconstruction/import bucket: `coquette-imports`

### Integrations

Planned provider boundaries:

- PayPal
- Klarna
- card/payment provider(s) selected for production
- AADE / myDATA
- courier/shipping providers
- transactional email
- analytics / consent / monitoring

Each provider receives dedicated COQUETTE credentials and webhook ownership.

---

## 3. Environments

### Local

- Storefront: local Next.js
- Backend/Admin: local Medusa
- PostgreSQL: isolated Docker service on host port `55432`
- Redis: isolated Docker service on host port `56379`
- local Medusa file provider
- sandbox/test integrations only

### Staging

Purpose:

- reconstructed catalogue rehearsal
- merchant back-office UAT
- checkout/payment sandbox testing
- courier sandbox tests
- AADE sandbox/pre-production validation where available
- SEO redirect verification
- performance/accessibility regression testing

No production customer traffic.

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
- secret-safe `.gitignore`
- project-boundary documentation
- environment strategy
- integration inventory
- reconstruction-data exclusion rules
- public-repository security policy

Exit gate: satisfied.

---

## Phase 1 — Current legacy storefront audit and architecture selection

**Status: COMPLETE / AUDIT REMAINS CONTINUOUS**

Delivered:

- Medusa v2 selected as commerce engine
- Next.js selected as storefront
- unified merchant experience through Medusa Admin extensions
- PostgreSQL/Redis/S3-compatible infrastructure model
- public-storefront reconstruction strategy
- current navigation/category/designer/filter audit
- bilingual URL analysis
- SEO preservation rules

Continue auditing the live public legacy storefront throughout reconstruction for presentation rules, discoverable catalogue relationships and content not obvious from the main navigation.

Exit gate: architecture approved and executable scaffold available.

---

## Phase 2 — Executable commerce foundation

**Status: COMPLETE**

Delivered:

- pnpm/Turbo monorepo
- Medusa backend and Admin
- Next.js storefront
- health endpoint
- pinned dependency baseline
- committed lockfile
- frozen-lockfile CI
- backend TypeScript validation
- storefront production build validation

Exit gate: green reproducible builds.

---

## Phase 3 — COQUETTE domain model and managed infrastructure

**Status: TECHNICAL EXIT GATE COMPLETE**

Delivered:

- first-class Designer/Brand module
- product-to-designer link definition
- bilingual Website Content module
- structured content/SEO fields
- workflow-backed Medusa Admin create/read/update for Designers
- workflow-backed Medusa Admin create/read/update for Website Content
- clean-database CI contract proving custom Admin CRUD
- dedicated Supabase project
- Medusa schema applied to managed PostgreSQL
- public `coquette-media` bucket
- private `coquette-imports` bucket
- media restrictions and Medusa S3 configuration
- live S3 media verification
- Railway Medusa server and separate worker
- dedicated Redis runtime
- Greece/EUR Medusa region
- Greek/English locale links
- Greece stock-location/fulfillment foundation
- Vercel storefront connected to Railway Store API
- Supabase Data API roles prevented from directly accessing Medusa commerce tables

Operational hardening remains tracked separately:

- backup/restore rehearsal
- repository branch-protection / secret-scanning verification

Exit gate:

- [x] clean Medusa migrations run against an empty staging database
- [x] Admin can create/read/update Designer and Website Content records
- [x] file upload succeeds through the Medusa S3 provider
- [x] no database or storage secret is present in Git

---

## Phase 4 — Public legacy storefront reconstruction

**Status: IN PROGRESS**

**Source boundary:** administrative/database/filesystem/API access to the Magento installation is unavailable. The public storefront at `https://coquetteconcept.gr/` is therefore the recoverable legacy evidence source.

Canonical detailed contract:

- `docs/migration/STOREFRONT_RECONSTRUCTION_PLAN.md`

### 4.1 Build immutable public URL inventory

Discover and capture Greek/English in-scope URLs from:

- homepage and navigation
- Clothing and nested categories
- Accessories and nested categories
- Designers/brands
- Sale
- New In
- category/designer pagination
- product links
- public internal-search surfaces where useful
- indexed/encountered Magento fallback routes
- canonical/hreflang relationships
- sitemap endpoints when present and usable

Do not depend on a single sitemap being complete or available.

### 4.2 Capture and reconstruct public commerce evidence

Products must capture where directly exposed:

- source URL and canonical URL
- Greek/English URL pair
- title/name
- SKU
- regular price
- sale/special price
- displayed discount state
- public stock state
- low-stock messaging
- color
- size and visible option values
- designer/brand
- categories and breadcrumbs
- short/long descriptions
- composition/materials
- care instructions
- model/fit details
- country-of-manufacture text
- delivery message
- New/Sale/Out-of-Stock badges
- public reviews where exposed
- image gallery URLs
- size-guide assets
- SEO metadata and structured data where exposed

No critical SKU, price, tax or exact stock quantity may be guessed.

### 4.3 Capture media into COQUETTE-controlled storage

For every discoverable public commerce/content asset:

- retain source URL
- follow safe same-site redirects
- download the highest-resolution public form available
- record MIME type and source filename
- calculate SHA-256 checksum
- preserve product/page relationships
- deduplicate identical bytes by checksum while preserving relationships
- copy recovered assets into COQUETTE-owned storage
- never hotlink the production replacement to legacy Magento assets

### 4.4 Capture categories, designers, navigation and content

Reconstruct where publicly reachable:

- category hierarchy
- category names/content in both locales
- designer/brand taxonomy
- designer landing pages
- visible navigation ordering
- category/designer editorial copy
- layered-filter dimensions and labels
- visible sort options
- homepage sections and banners
- Our Story/About
- contact
- shipping/delivery/returns
- payment-method content
- terms/privacy/cookies
- newsletter/service/footer content
- public downloadable assets

### 4.5 SEO and URL evidence

Build an evidence-backed URL inventory containing:

- legacy URL
- locale
- resource type
- observed response/redirect state
- canonical URL
- alternate/hreflang URL where visible
- target COQUETTE URL
- planned redirect state

Explicitly cover:

- `/default/` Greek routes
- `/en/` English routes
- legacy `.html` URLs
- publicly discoverable/indexed Magento internal routes
- pagination/filter query behavior without crawling infinite parameter combinations

### 4.6 Evidence-aware manifests

Every normalized public source record gets:

- stable source URL/source key
- locale
- source checksum
- evidence grade: `direct`, `derived`, `inferred`, or `unavailable`
- target Medusa ID when imported
- migration/reconstruction status
- warnings/errors
- retry count
- capture timestamp

Imports must be idempotent.

### 4.7 Known unavailable private Magento domains

Unless another legitimate source later becomes available, do not fabricate:

- customer accounts or passwords
- customer address books
- historical orders
- invoices / credit memos / shipments
- payment transactions/tokens
- private newsletter subscriber data
- exact Magento numeric entity IDs
- hidden/unpublished products/content
- admin-only custom attributes
- exact stock quantities where not public
- reserved inventory
- internal tax configuration
- private promotion/cart-rule definitions
- cron/integration secrets
- extension configuration

These are known source limitations, not unexplained migration failures.

### 4.8 Reconstruction order

1. URL inventory / locale relationships
2. categories
3. designers/brands
4. public option/filter taxonomy
5. products
6. reconstructable variants/options
7. displayed pricing/sale state
8. public stock state
9. media
10. public CMS/content
11. SEO metadata
12. redirect map

### 4.9 Reconciliation

For every capture/rehearsal compare:

- discovered in-scope URLs
- successfully fetched URLs
- product URLs vs parsed product records
- unique SKU count and SKU collisions
- products without SKU
- category URLs and parsed categories
- designer URLs and parsed designers
- media discovered/downloaded/failed/deduplicated
- bilingual URL pairs/unpaired resources
- content pages captured
- redirect/canonical relationships
- parse warnings/errors
- URLs remaining unclassified

No reconstruction is accepted based only on a successful crawler/script exit code.

Exit gate: repeatable full public-storefront capture/import with all discovered in-scope URLs either reconstructed or explicitly classified, media copied to COQUETTE storage, idempotent rerun, and zero unexplained critical variance within the captured public universe.

---

## Phase 5 — Merchant back office parity

**Status: FOUNDATION STARTED**

Required merchant capabilities:

### Catalogue

- create/edit/archive products
- variants/options/sizes/colors
- SKU/barcode fields
- categories
- designers
- prices and sale prices
- tax configuration
- inventory
- product media
- publish/unpublish
- bulk operations

### Website editor

- homepage sections
- navigation
- banners/promotional strips
- category editorial content
- designer landing content
- Our Story
- contact/service pages
- shipping/payment/policy pages
- Greek and English content
- SEO title/description/canonical fields
- draft/publish workflow

### Commerce operations

- orders
- customers
- refunds/returns
- fulfillments
- promotions/coupons
- payment state
- shipping state
- fiscal state

### Operational quality

- role-based admin access
- auditability for important changes
- clear validation messages
- no requirement for merchant staff to edit code or deploy the site for ordinary content/catalogue work

Exit gate: merchant can perform daily Magento-equivalent operations in staging without developer intervention.

---

## Phase 6 — Storefront parity and design migration

**Status: FOUNDATION COMPLETE; FULL IMPLEMENTATION PENDING**

Foundation already covers:

- header/navigation
- EL/EN surface
- Clothing
- Accessories
- Designers
- Sale
- Our Story
- Search/Account/Cart route surfaces
- product route foundation
- filters: price/designer/color/size
- service/trust strip
- footer/policy surfaces

Remaining:

### Homepage

- reconstruct real hero/editorial media
- current campaign sections
- real product feeds
- new arrivals
- category/editorial cards
- designer promotion
- newsletter
- responsive parity

### Product listing pages

- real Medusa catalogue queries
- pagination
- filtering
- sort
- sale/new/out-of-stock badges
- responsive product cards
- wishlist state
- quick/add-to-cart behavior where appropriate

### Product detail

- media gallery
- selected variant state
- color/size selection
- price/sale price
- stock state
- size guide
- product description/details
- designer link
- shipping/returns information
- wishlist
- related/recommended products
- structured data

### Mobile

Mobile parity is an explicit acceptance surface, not a desktop afterthought.

Exit gate: visual/functional comparison against the legacy public storefront approved for desktop and mobile.

---

## Phase 7 — Search, discovery and merchandising

**Status: PLANNED**

Required:

- fast search suggestions
- product/title/SKU/designer/category matching
- typo tolerance strategy
- empty-result handling
- category faceting
- designer faceting
- color/size/price faceting
- merchandising order
- new/sale availability rules
- canonical query/parameter SEO behavior

Start with PostgreSQL/Medusa capabilities where sufficient; introduce a dedicated search engine only when catalogue/UX requirements justify the operational cost.

Exit gate: search and filters meet or exceed the existing legacy storefront experience.

---

## Phase 8 — Customer account, wishlist and cart

**Status: PLANNED**

### Account

- registration
- login/logout
- password reset
- profile
- addresses
- order history
- order detail
- privacy/account deletion workflow

Legacy customer accounts/history cannot be reconstructed from the public storefront. New COQUETTE customer records begin in Medusa unless another legitimate private source later becomes available.

### Wishlist

- guest strategy
- authenticated persistence
- product/variant availability handling

### Cart

- variant-aware line items
- quantity editing
- removal
- promotional codes
- shipping estimate where applicable
- totals/tax visibility
- graceful stock changes

Exit gate: all paths survive refresh, device-size changes and authenticated/guest transitions correctly.

---

## Phase 9 — Checkout and payments

**Status: PLANNED**

Checkout goals:

- minimal friction
- guest checkout unless business requirements prohibit it
- address validation
- shipping choice
- clear taxes/totals
- explicit terms/privacy acknowledgement where legally required
- mobile-first payment flow
- idempotent order/payment processing

Provider workstreams:

### PayPal

- sandbox integration
- authorization/capture model
- webhook verification
- refunds
- reconciliation

### Klarna

- merchant account/API confirmation
- eligible-country/currency rules
- checkout/payment session
- webhook/callback validation
- capture/refund flows
- display requirements

### Card provider

- confirm existing/new provider
- 3DS/SCA
- webhook processing
- refund handling

No payment is considered integrated until asynchronous webhook states and duplicate callback handling are tested.

Exit gate: end-to-end sandbox checkout/refund suite green for every enabled payment method.

---

## Phase 10 — Shipping and courier integrations

**Status: PLANNED**

Required:

- shipping zones
- rates/free-shipping thresholds
- courier provider adapters
- pickup-point/locker support if required
- label/waybill creation where supported
- tracking number storage
- shipment events
- customer tracking links
- return-shipping flow
- failure/retry handling

Provider-specific code stays behind a shipping adapter boundary.

Exit gate: sandbox/test shipment lifecycle verified from checkout to delivery/return state.

---

## Phase 11 — AADE / myDATA fiscal integration

**Status: PLANNED**

Use proven architectural patterns only; all COQUETTE credentials, mappings and fiscal state remain dedicated.

Required:

- legal seller/entity confirmation
- document type mapping
- VAT/category mapping
- revenue classification mapping
- payment-method mapping where required
- invoice/receipt numbering strategy
- idempotency
- transmission UID/MARK storage
- cancellation/credit handling
- retry queue
- reconciliation dashboard
- manual-review state when tax treatment is not safely derivable

Never guess fiscal treatment from ambiguous order data.

Exit gate: accountant/business approval plus controlled sandbox/test evidence before production activation.

---

## Phase 12 — Email, notifications and CRM basics

**Status: PLANNED**

Transactional templates:

- registration
- password reset
- order confirmation
- payment status if needed
- shipment/tracking
- cancellation
- refund
- return

Legacy newsletter subscribers cannot be assumed recoverable. Any subscriber import must come from a legitimate source with consent provenance; otherwise build a fresh compliant COQUETTE list.

Exit gate: templates approved in EL/EN and transactional delivery verified.

---

## Phase 13 — SEO and URL reconstruction

**Status: FOUNDATION STARTED**

Rules:

- crawl all discoverable/indexed legacy storefront URLs before cutover
- preserve source URL, target URL, observed state and canonical target in a redirect manifest
- one-to-one `301/308` mappings for changed URLs
- avoid broad wildcard redirects that hide missing mappings
- avoid redirect chains
- preserve product/category/designer intent
- preserve language relationships
- generate XML sitemaps
- robots rules by environment
- canonical tags
- hreflang EL/EN
- Product/Breadcrumb/Organization structured data where valid
- Search Console validation after cutover

Observed legacy patterns include `/default/...` for Greek and `/en/...` for English. Legacy `.html` and discovered internal Magento routes must be explicitly mapped.

Search-engine indexes and public discovery can be used to find additional legacy URLs, but final mapping must retain evidence and must not invent content that cannot be recovered.

Exit gate: every captured/indexed high-value legacy URL resolves directly to the correct live target or an explicitly justified retirement response.

---

## Phase 14 — Security, privacy and compliance

**Status: CONTINUOUS**

Required:

- dependency scanning
- secret scanning
- admin authorization review
- secure cookies/session settings
- CSP/security headers
- rate limiting/abuse controls where needed
- payment webhook signature verification
- provider webhook idempotency
- least-privilege database/storage credentials
- privacy/terms/cookie content reconstruction and legal review
- consent manager review
- data export/deletion workflows
- backup access controls

Run Supabase security advisors after relevant schema changes.

Exit gate: no unresolved high-severity security issue.

---

## Phase 15 — Performance, accessibility and quality assurance

**Status: PLANNED / CI FOUNDATION ACTIVE**

Automated gates:

- frozen dependency install
- backend TypeScript
- storefront production build
- Docker Compose validation
- unit/integration tests as implementation grows
- checkout E2E
- reconstruction reconciliation tests

Manual/automated QA:

- responsive breakpoints
- keyboard navigation
- focus visibility
- form labels/errors
- contrast
- image alt strategy
- Core Web Vitals
- image sizing/optimization
- checkout on real mobile devices
- Safari/Chrome/Firefox coverage

Exit gate: agreed accessibility/performance budgets and critical-path test suite green.

---

## Phase 16 — Staging UAT and operational rehearsal

**Status: PLANNED**

Rehearse:

1. clean database
2. run migrations
3. run a dated public-storefront capture from the immutable URL inventory
4. import/reconstruct captured catalogue/content
5. reconcile all discovered in-scope public URLs
6. copy/checksum media into COQUETTE storage
7. smoke test storefront
8. merchant back-office tasks
9. place test orders
10. payment sandbox lifecycle
11. courier sandbox lifecycle
12. fiscal test lifecycle
13. refund/return
14. redirect crawl
15. backup
16. restore rehearsal

Exit gate: written UAT sign-off and no P0/P1 issue.

---

## Phase 17 — Production cutover

**Status: PLANNED**

### Pre-cutover

- complete a fresh full public-storefront capture as close to cutover as practical
- record immutable final legacy URL/product/media capture manifests
- perform manual inventory/price verification for commercially critical live products
- preserve current DNS configuration and legacy hosting coordinates where accessible
- DNS TTL reduced in advance if necessary
- production secrets validated
- payment webhooks configured
- courier webhooks configured
- AADE production mode explicitly approved
- monitoring dashboards active

Because Magento administrative access is unavailable, the cutover plan must not depend on a Magento maintenance/freeze mode or database delta export.

### Cutover sequence

1. run final public legacy-storefront crawl/capture
2. process only changed/new publicly observable records since the last accepted rehearsal
3. reconcile critical catalogue/content/media/redirect evidence
4. smoke test production backend
5. smoke test production storefront using non-public route/domain where possible
6. switch domain/routing
7. verify TLS
8. verify robots/canonicals/sitemap
9. place controlled production order
10. verify payment, order, email and fiscal pipeline
11. monitor logs/errors/404s

### Rollback

Rollback must be possible without rebuilding the application. Preserve the previous stable COQUETTE deployment/configuration and a record of pre-cutover DNS. If the legacy Magento host remains technically reachable, retain its coordinates during the agreed rollback window, but do not make rollback depend solely on administrative control of Magento.

Exit gate: production stability confirmed and rollback window closed deliberately.

---

## Phase 18 — Post-launch stabilization and improvement

**Status: PLANNED**

First priorities:

- 404/redirect monitoring
- checkout conversion/errors
- payment webhook failures
- fiscal reconciliation failures
- courier failures
- site speed/Core Web Vitals
- search quality
- merchant workflow friction
- product/media reconstruction defects
- Search Console indexing

Only after stabilization should broader UX redesigns, personalization or advanced merchandising move ahead of parity/operational defects.

---

# Current implementation pulse

## Completed

- workspace isolation
- architecture selection
- executable Medusa/Next.js monorepo
- CI/frozen lockfile
- dedicated Supabase PostgreSQL/storage
- Railway Medusa server + worker
- dedicated Redis
- Greece/EUR staging commerce foundation
- Vercel storefront-to-Store-API runtime verification
- live S3 media verification
- Designer/Brand domain
- Website Content domain
- real custom Admin CRUD + clean-database CI contract
- initial navigable storefront parity layer
- legacy URL preservation rules
- Supabase Data API hardening around Medusa commerce tables

## Active now

1. Phase 4 public storefront reconstruction crawler/capture foundation
2. immutable legacy URL inventory
3. public product/category/designer/content extraction
4. public image/media capture into COQUETTE storage
5. evidence-aware source-to-Medusa mapping and reconciliation
6. backup/restore operational rehearsal
7. repository protection/security hardening

## Current external/manual dependencies

The following require account-level access, credentials or external availability and cannot be placed in Git:

- continued public availability of `https://coquetteconcept.gr/` until reconstruction capture is accepted
- Supabase database/storage credentials
- dedicated hosted Redis credentials
- payment-provider credentials
- AADE credentials/configuration
- courier credentials
- email-provider credentials
- domain/DNS cutover authority

Magento administrative/database/export access is **not** an expected dependency anymore.

---

# Definition of launch-ready

COQUETTE is not launch-ready until all of the following are true:

- the reconstructed public catalogue reconciles against the accepted immutable legacy URL/capture inventory
- all discoverable in-scope legacy URLs are reconstructed or explicitly classified
- public product media is copied to COQUETTE-controlled storage with no unexplained critical failures
- known unrecoverable private Magento data is documented and not fabricated
- daily merchant workflows work without developer intervention
- account/cart/checkout paths are complete
- every enabled payment method passes sandbox and controlled production verification
- shipping/courier lifecycle is verified
- fiscal lifecycle is approved and verified
- transactional email is verified
- legacy URL redirect manifest is complete
- sitemap/robots/canonical/hreflang are verified
- staging UAT is signed off
- backup and rollback procedures are tested
- no unresolved P0/P1 defect exists
- monitoring and error alerting are active
- production domain cutover has an explicit rollback plan

This launch gate takes precedence over calendar pressure.
