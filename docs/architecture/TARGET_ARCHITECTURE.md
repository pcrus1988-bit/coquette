# COQUETTE Target Architecture

Status: APPROVED FOR IMPLEMENTATION

## 1. Architecture goal

Replace Magento with a source-controlled, modular commerce stack that preserves or improves the current COQUETTE customer experience while substantially reducing platform lock-in and making daily shop administration simpler.

The system remains a single-merchant fashion e-commerce platform. It is not a marketplace.

## 2. Selected stack

### Commerce backend and merchant admin
- Medusa v2, pinned to an explicitly tested minor version before production cutover.
- TypeScript / Node.js.
- Medusa Admin as the main merchant back office.
- COQUETTE-specific features implemented as local Medusa modules, workflows, providers and Admin extensions.

### Storefront
- Next.js App Router storefront, based on the current Medusa DTC starter architecture but owned and customized inside this repository.
- React + TypeScript.
- Tailwind CSS for implementation primitives, with a dedicated COQUETTE design system on top.
- The storefront is not visually coupled to Medusa Admin and can reproduce the current COQUETTE UX/UI closely while being progressively improved.

### Repository
- pnpm workspace monorepo.
- `apps/backend` — Medusa server, Admin and worker code.
- `apps/storefront` — customer storefront.
- `packages/*` — COQUETTE-local shared libraries only.
- `docs/*` — architecture, migration, integration and operations reference.

The previous placeholder `apps/backoffice` directory is superseded by Medusa Admin hosted from `apps/backend`; custom merchant screens live as Admin extensions in the backend application.

## 3. Data and infrastructure

### PostgreSQL
A dedicated COQUETTE PostgreSQL database is the commerce system of record.

Recommended managed implementation: a dedicated Supabase project or equivalent managed PostgreSQL service. It must not share a database, schema or connection pool with another project.

### Redis
A dedicated Redis instance is required in production for Medusa production infrastructure modules, background workflows, events and locking.

### Media
Use Medusa's S3-compatible file provider against a dedicated COQUETTE bucket.

Preferred choices:
1. dedicated Supabase Storage bucket through its S3-compatible endpoint, if the database is also on Supabase;
2. Cloudflare R2 if independent object storage/CDN economics are preferable.

Original Magento media will be copied into COQUETTE-owned storage during migration. Production must not depend on Magento media URLs after cutover.

### Search
Phase 1 starts without an additional search service unless catalogue testing proves it necessary. Product/category filtering is implemented against the commerce API first.

Add Meilisearch as a dedicated service when one or more of the following becomes true:
- catalogue/filter latency is not acceptable;
- typo-tolerant search is required;
- faceted brand/size/color filtering needs a dedicated index;
- merchandising/search ranking becomes a business requirement.

This avoids introducing another production service before it provides measurable value.

## 4. Back office and website content

The merchant should not have to manage two unrelated admin systems.

Medusa Admin remains the single operational back office for:
- products and variants;
- prices and sale prices;
- inventory;
- categories and collections;
- customers;
- orders, payments, fulfillment, returns and refunds;
- promotions;
- users and operational settings.

A COQUETTE Content module will extend Medusa Admin with a `Website` section for:
- homepage sections;
- hero banners;
- promotional strips;
- navigation/mega-menu configuration;
- reusable image/text blocks;
- landing pages;
- informational pages;
- newsletter presentation content;
- footer content;
- SEO title, description, canonical and index settings;
- scheduled publication where useful.

Content is stored in the COQUETTE database and media bucket. The storefront consumes it through dedicated Store API endpoints.

## 5. Catalogue model

Use Medusa native commerce entities wherever possible and extend them rather than creating a parallel catalogue.

Required concepts:
- Product
- Product Variant
- Product Option (for example size/color)
- Inventory Item / Inventory Level
- Product Category
- Collection
- Brand / Designer (COQUETTE custom module or strongly typed product metadata, selected during catalogue mapping)
- Price / Sale Price
- Product media

All migrated records retain Magento source identifiers in dedicated metadata or migration mapping tables so migration can be resumed and re-run safely.

## 6. Checkout and orders

Medusa owns the cart, checkout, order, payment-collection, fulfillment, return and refund lifecycle.

The storefront owns the customer presentation of that lifecycle.

Payment providers are adapters behind Medusa's Payment Module contract. Courier integrations are adapters behind fulfillment/shipping boundaries. Provider-specific business logic must not be spread through storefront components.

## 7. Payments

Initial provider targets:
- PayPal
- Klarna
- existing/preferred card acquiring solution if it must be preserved from the Magento shop

PayPal is implemented using Medusa's documented provider pattern.

Klarna is implemented as a dedicated COQUETTE payment provider against the Medusa Payment Module interface. It must support the capabilities actually enabled by the merchant contract, including webhook handling and refund/capture behavior where applicable.

Every payment adapter must implement:
- idempotent webhook processing;
- signature/authentication validation;
- authorization/capture/refund mapping;
- failure/retry logging;
- reconciliation identifiers stored against the order/payment.

## 8. AADE / myDATA

AADE is a COQUETTE-specific fiscal integration module, not checkout code.

The module will:
- receive eligible commerce events after the appropriate order/payment state transition;
- create a fiscal preparation record;
- map order lines, VAT, discounts, shipping and payment information explicitly;
- submit to AADE/myDATA through dedicated COQUETTE credentials;
- store MARK/UID/provider references and request/response audit data;
- retry transient failures idempotently;
- route unmapped fiscal cases to manual review rather than guessing tax treatment.

Production fiscal issuance remains disabled until mapping and accountant acceptance are complete.

## 9. Shipping and couriers

Courier-specific code is implemented behind fulfillment/shipping providers or modules.

Capabilities are added per provider contract:
- shipping option/rate selection;
- label creation;
- tracking number creation;
- shipment status webhooks/polling;
- cancellation where supported;
- returns labels where supported.

The design must allow replacing a courier without rewriting checkout or order pages.

## 10. Authentication and roles

Use Medusa authentication for customer and admin actors unless a concrete requirement proves an external identity provider necessary.

Initial roles:
- customer;
- merchant administrator;
- merchant staff roles with least-privilege permissions where required.

No user/account state is shared with another project.

## 11. Magento migration

Selected approach: API-based, idempotent and re-runnable migration rather than a one-time CSV-only import.

The migration subsystem will:
1. read Magento through authenticated read-only APIs/export endpoints;
2. normalize products, variants, options, categories, brands, prices and stock;
3. copy/re-host media;
4. retain Magento source IDs;
5. create/update Medusa records idempotently;
6. produce migration reports and unresolved-item queues;
7. support repeated delta runs until cutover.

Customers and historic orders are migrated only after legal/operational requirements are confirmed. Password hashes are not assumed portable; customer account activation/reset may be required.

## 12. URL and SEO migration

Preserving organic visibility is a cutover requirement.

Before launch:
- inventory every indexable Magento URL;
- reproduce URLs where practical;
- maintain an explicit old URL -> new URL redirect table;
- issue permanent redirects for moved pages/products/categories;
- preserve product/category metadata where appropriate;
- generate canonical tags, sitemap XML and robots policy;
- verify structured data for products, offers, breadcrumbs and organization;
- test Greek and English locale behavior.

## 13. Environments

### Local
Developer-only database/Redis/storage or isolated development services.

### Staging
Independent data, Redis, storage and provider sandbox credentials. Never points to production payment, AADE or courier credentials.

### Production
Independent production resources and credentials.

No environment is allowed to share writable data stores with another environment.

## 14. Deployment topology

### Storefront
Vercel project dedicated to COQUETTE.

### Commerce backend / Admin
Long-running Node.js hosting with at least two process roles in production:
- server mode;
- worker mode.

Do not deploy the Medusa backend as ordinary Vercel serverless functions.

Initial hosting candidates are a managed container host or a small dedicated container/VPS environment. The final provider is selected during infrastructure provisioning based on predictable cost, EU region availability, backups and operational access.

### Database / storage
Dedicated COQUETTE managed services as described above.

## 15. Observability and resilience

Required before production:
- structured application logs;
- exception monitoring;
- uptime checks for storefront, backend and health endpoint;
- payment/webhook failure visibility;
- AADE failure/manual-review visibility;
- database backups and restore rehearsal;
- migration and deployment audit trail.

## 16. Design principle

COQUETTE should own its commerce experience and business logic.

Framework code provides commodity commerce primitives. All merchant-specific behavior is implemented through documented extension points and local modules, minimizing forks of framework internals and reducing future upgrade cost.
