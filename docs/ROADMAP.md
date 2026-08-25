# COQUETTE — Master Implementation Roadmap

**Status:** Active blueprint  
**Last updated:** 2026-08-26  
**Repository:** `pcrus1988-bit/coquette`

This document is the canonical delivery blueprint for the COQUETTE Magento replacement. Future implementation decisions and project queries should be checked against this roadmap and the architecture decision records in `docs/architecture/`.

## 1. Non-negotiable principles

1. COQUETTE is an independent system with dedicated source, database, storage, deployments, credentials, integrations and operational history.
2. Reuse engineering patterns, never shared runtime state or credentials from another project.
3. Preserve the current shop's commercially important UX, content, catalogue semantics and indexed URLs before introducing redesign-only changes.
4. The merchant must receive one understandable back office. Medusa Admin is the commerce/admin foundation and COQUETTE-specific content tools extend it.
5. The storefront never talks directly to PostgreSQL. It consumes Medusa APIs.
6. Medusa remains the system of record for customers, products, carts, orders, payments and fulfillment.
7. Supabase is infrastructure: managed PostgreSQL plus COQUETTE-only object storage.
8. Secrets never enter Git history. The public repository contains placeholders and safe resource coordinates only.
9. Magento remains production until migration reconciliation, staging UAT and cutover gates pass.
10. No big-bang data migration. Every migration domain must be countable, repeatable, idempotent and reconcilable.
11. No production payment, AADE or courier action during development unless the environment and credential are explicitly production-approved.
12. Every feature branch must pass frozen dependency install, backend type-check and storefront production build before merge. Infrastructure files receive their own validation where applicable.

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
- private migration bucket: `coquette-imports`

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

- real migrated catalogue rehearsal
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
- Magento cutover only after all launch gates pass

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
- migration-data exclusion rules
- public-repository security policy

Exit gate: satisfied.

---

## Phase 1 — Current Magento audit and architecture selection

**Status: COMPLETE / AUDIT REMAINS CONTINUOUS**

Delivered:

- Medusa v2 selected as commerce engine
- Next.js selected as storefront
- unified merchant experience through Medusa Admin extensions
- PostgreSQL/Redis/S3-compatible infrastructure model
- Magento migration strategy
- current navigation/category/designer/filter audit
- bilingual URL analysis
- SEO preservation rules

Continue auditing Magento throughout migration for hidden business rules, third-party modules and content not visible from the public storefront.

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

**Status: IN PROGRESS**

Delivered:

- first-class Designer/Brand module
- product-to-designer link definition
- bilingual Website Content module
- structured content/SEO fields
- Medusa Admin routes for Designers and Website
- dedicated Supabase project
- public `coquette-media` bucket
- private `coquette-imports` bucket
- media file restrictions
- optional Supabase S3 Medusa configuration
- isolated local PostgreSQL/Redis runtime

Remaining:

- generate/commit custom module migration files
- apply Medusa schema to managed PostgreSQL
- create production-safe database connection secret in hosting environment
- generate dedicated Supabase S3 access keys and store them only in backend hosting secrets
- provision dedicated production Redis
- run database/security/performance advisors after schema installation
- establish backup/restore rehearsal

Exit gate:

- clean Medusa migrations run against an empty staging database
- Admin can create/read/update Designer and Website Content records
- file upload succeeds through the Medusa S3 provider
- no database or storage secret is present in Git

---

## Phase 4 — Magento extraction and migration pipeline

**Status: PLANNED / PREPARATION STARTED**

### 4.1 Inventory Magento

Capture:

- Magento version and enabled modules
- store views/languages
- websites/stores
- categories
- products
- configurable/simple product relationships
- attributes and option values
- media gallery
- prices/special prices
- tax classes
- stock/inventory
- CMS pages and blocks
- navigation configuration
- customers and addresses
- orders/invoices/credit memos/shipments
- coupons/cart rules
- newsletter subscribers
- redirects/URL rewrites
- payment/shipping configuration
- transactional email templates
- cron/integration jobs
- third-party extensions

### 4.2 Build migration manifests

Every source record type gets:

- Magento source ID
- target Medusa ID
- source checksum
- migration timestamp
- migration status
- warnings/errors
- retry count

Imports must be idempotent.

### 4.3 Migration order

1. regions/currencies/tax primitives
2. sales channels/store defaults
3. categories/collections
4. designers/brands
5. product attributes/options
6. products
7. variants
8. prices
9. inventory
10. media
11. CMS/content
12. customers/addresses
13. historical orders if required
14. promotions/coupons
15. URL redirect map

### 4.4 Reconciliation

For each rehearsal compare:

- source count
- imported count
- skipped count
- error count
- published count
- product/variant price totals where meaningful
- inventory totals
- media counts
- customer counts
- order counts/statuses

No migration is accepted based only on a successful script exit code.

Exit gate: repeatable staging import with documented reconciliation and zero unexplained critical variance.

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

- migrate real hero/editorial media
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

Exit gate: visual/functional comparison against Magento approved for desktop and mobile.

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

Exit gate: search and filters meet or exceed the existing Magento experience.

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

Newsletter/subscriber migration must respect consent provenance and applicable privacy requirements.

Exit gate: templates approved in EL/EN and transactional delivery verified.

---

## Phase 13 — SEO and URL migration

**Status: FOUNDATION STARTED**

Rules:

- crawl/export all indexable Magento URLs before cutover
- preserve source URL, target URL, status and canonical target in a redirect manifest
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

Current Magento patterns observed include `/default/...` for Greek and `/en/...` for English. Legacy `.html` routes must be explicitly mapped.

Exit gate: every previously indexed high-value URL resolves directly to the correct live target or an explicitly justified retirement response.

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
- privacy/terms/cookie content migration
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
- migration reconciliation tests

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
3. import Magento snapshot
4. reconcile
5. upload/copy media
6. smoke test storefront
7. merchant back-office tasks
8. place test orders
9. payment sandbox lifecycle
10. courier sandbox lifecycle
11. fiscal test lifecycle
12. refund/return
13. redirect crawl
14. backup
15. restore rehearsal

Exit gate: written UAT sign-off and no P0/P1 issue.

---

## Phase 17 — Production cutover

**Status: PLANNED**

### Pre-cutover

- final Magento backup
- final URL crawl
- freeze window agreed
- incremental/final data delta export
- DNS TTL reduced in advance if necessary
- production secrets validated
- payment webhooks configured
- courier webhooks configured
- AADE production mode explicitly approved
- monitoring dashboards active

### Cutover sequence

1. enter Magento maintenance/read-only window as required
2. capture final delta
3. run final import
4. reconcile critical entities
5. smoke test production backend
6. smoke test production storefront using non-public route/domain where possible
7. switch domain/routing
8. verify TLS
9. verify robots/canonicals/sitemap
10. place controlled production order
11. verify payment, order, email and fiscal pipeline
12. monitor logs/errors/404s

### Rollback

Magento must remain recoverable during the agreed rollback window. A rollback decision must not depend on reconstructing the previous system from scratch.

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
- product/media migration defects
- Search Console indexing

Only after stabilization should broader UX redesigns, personalization or advanced merchandising move ahead of parity/operational defects.

---

# Current implementation pulse

## Completed

- workspace isolation
- architecture selection
- executable Medusa/Next.js monorepo
- CI/frozen lockfile
- local isolated PostgreSQL/Redis
- Designer/Brand domain
- Website Content domain
- initial Admin extensions
- dedicated Supabase project
- public/private storage boundaries
- first navigable storefront parity layer
- Magento URL migration rules

## Active now

1. generate custom Medusa migration files
2. finalize managed Supabase/Medusa configuration
3. provision backend hosting/runtime secrets
4. provision storefront Vercel project
5. establish staging
6. acquire Magento export/database/media access
7. build repeatable migration importer and reconciliation reports
8. connect real Medusa catalogue data to storefront listing/product pages

## Current external/manual dependencies

The following require account-level access or credentials and cannot be placed in Git:

- Supabase database connection secret
- Supabase S3 access-key pair
- dedicated hosted Redis credentials
- Magento administrative/database/export access
- payment-provider credentials
- AADE credentials/configuration
- courier credentials
- email-provider credentials
- domain/DNS cutover authority

---

# Definition of launch-ready

COQUETTE is not launch-ready until all of the following are true:

- migrated catalogue reconciles against Magento
- product media is complete
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
