# COQUETTE — Replacement Commerce Platform Roadmap

> Canonical project blueprint. Detailed phase status is also tracked in `docs/CURRENT_STATUS.md`.

## Guiding rules

- COQUETTE is completely isolated from unrelated projects at repository, database, deployment, secrets, storage and documentation levels.
- Magento remains the production storefront until formal cutover.
- No production cutover occurs without reconciliation, UAT, payment/shipping/fiscal verification, SEO redirects and rollback readiness.
- Values and business rules are never guessed where authoritative or direct evidence is required.
- Legacy Magento administrative/database access is no longer available. Phase 4 therefore reconstructs the recoverable legacy storefront from public evidence at `https://coquetteconcept.gr/`.

---

## Phase 0 — Workspace / isolation

**Status: COMPLETE**

Delivered:

- dedicated `pcrus1988-bit/coquette` repository
- isolated environment/configuration model
- dedicated staging branch and CI
- secret-safe repository conventions
- explicit project separation policy

Exit gate: satisfied.

---

## Phase 1 — Current Magento audit and architecture selection

**Status: COMPLETE / AUDIT REMAINS CONTINUOUS**

Delivered:

- Medusa v2 selected as commerce engine
- Next.js selected as storefront
- unified merchant experience through Medusa Admin extensions
- PostgreSQL/Redis/S3-compatible infrastructure model
- legacy-storefront reconstruction strategy
- current navigation/category/designer/filter audit
- bilingual URL analysis
- SEO preservation rules

Continue auditing the public legacy storefront throughout reconstruction for hidden presentation/business rules and content not obvious from the main navigation.

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
- real Medusa Admin create/read/update flows for Designers and Website Content
- workflow-backed Admin mutations
- clean-database CI contract proving custom Admin CRUD
- dedicated Supabase project
- Medusa schema applied to managed PostgreSQL
- public `coquette-media` bucket
- private `coquette-imports` bucket
- Medusa S3 media provider and live media verification
- Railway Medusa server + separate worker
- dedicated Redis runtime
- Greece/EUR region and Greece stock/fulfillment foundation
- Greek/English locale links
- Vercel storefront linked to Railway Store API
- Supabase Data API roles prevented from directly accessing Medusa commerce tables

Operational hardening tracked separately:

- backup/restore rehearsal
- repository branch protection / secret-scanning verification

Exit gate:

- [x] clean Medusa migrations run against an empty staging database
- [x] Admin can create/read/update Designer and Website Content records
- [x] file upload succeeds through the Medusa S3 provider
- [x] no database or storage secret is present in Git

---

## Phase 4 — Public legacy storefront reconstruction

**Status: IN PROGRESS**

**Source boundary:** Magento Admin/database/filesystem/API access is unavailable. The public storefront at `https://coquetteconcept.gr/` is the recoverable legacy evidence source.

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

Do not depend on one sitemap being complete or available.

### 4.2 Capture and reconstruct public commerce evidence

Products must capture where directly exposed:

- legacy/canonical URL
- locale pair
- name/title
- SKU
- regular/sale price
- displayed sale state
- public stock state
- low-stock messaging
- color
- size/options
- designer
- categories/breadcrumbs
- descriptions
- composition/care/fit data
- public image gallery
- size-guide assets
- SEO metadata

No critical price, SKU, tax or exact stock quantity may be guessed.

### 4.3 Capture media into COQUETTE-controlled storage

For every discoverable public commerce/content asset:

- retain source URL
- download highest-resolution public form available
- record MIME/filename
- SHA-256 checksum bytes
- deduplicate bytes while retaining relationships
- copy into COQUETTE-owned storage
- never hotlink production content from legacy Magento

### 4.4 Capture categories, designers, content and SEO

Reconstruct:

- category hierarchy
- designer/brand taxonomy
- layered-filter labels
- visible sorting/navigation structure
- homepage/editorial content
- service/policy/contact pages
- Greek/English content variants
- canonical/hreflang relationships
- legacy redirect inventory including `.html`, `/default/`, `/en/` and discovered Magento internal routes

### 4.5 Evidence-aware manifests

Every normalized public source record gets:

- stable source URL/source key
- locale
- source checksum
- evidence grade (`direct`, `derived`, `inferred`, `unavailable`)
- target Medusa ID when imported
- status
- warnings/errors
- retry count
- capture timestamp

Imports must remain idempotent.

### 4.6 Known unavailable private Magento domains

Unless a separate legitimate source becomes available, do not attempt to fabricate:

- customers/passwords/address books
- historical orders/invoices/shipments/credit memos
- payment transaction data/tokens
- exact Magento numeric IDs
- hidden/unpublished catalogue/content
- admin-only attributes
- exact stock quantities where not public
- internal tax configuration
- private promotion rules
- extension/cron/integration secrets

These are documented source limitations, not unexplained migration failures.

### 4.7 Reconstruction order

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

### 4.8 Reconciliation

For every capture/rehearsal compare:

- discovered vs fetched in-scope URLs
- product URLs vs parsed product records
- unique SKU count and collisions
- products without SKU
- category/designer URL counts
- media discovered/downloaded/failed/deduplicated
- bilingual URL pairs/unpaired resources
- content pages captured
- redirect/canonical relationships
- parse warnings/errors
- unclassified URLs

A successful crawler process exit is not reconstruction success.

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

Remaining work is governed by public legacy-storefront capture, parity/UAT and the later detailed implementation phases.

---

## Phases 7–18

Continue under the existing COQUETTE blueprint principles: discovery/merchandising, checkout/payments, shipping, AADE/myDATA, communications, legal/compliance, analytics/observability, SEO/cutover, UAT and production launch.

No phase is considered complete without its documented exit gate and evidence.
