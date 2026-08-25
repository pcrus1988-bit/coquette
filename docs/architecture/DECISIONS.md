# Architecture Decisions

This file is the concise decision register. Detailed reasoning lives in `TARGET_ARCHITECTURE.md` and future ADRs.

## ADR-001 — Commerce engine
Status: ACCEPTED

Selected: Medusa v2.

Why:
- self-hostable, MIT-licensed TypeScript commerce framework;
- strong product/variant/inventory/order primitives;
- extensible merchant Admin;
- payment and fulfillment provider contracts;
- workflow engine suited to fiscal, migration and integration jobs;
- official Magento migration guidance;
- official PayPal integration guidance;
- custom Admin pages/widgets can host COQUETTE website-management tools.

Alternatives considered:
- Vendure: technically strong and the closest alternative, but its React Dashboard transition is comparatively recent and COQUETTE gains more direct Magento/PayPal migration support from Medusa.
- Saleor: capable and scalable but operationally heavier than necessary for this single-store project.
- custom commerce from scratch: rejected because carts, payments, refunds, inventory and order state machines are commodity domains with high correctness cost.
- Magento continuation: rejected as the target runtime because reducing Magento operational cost and dependency is the project goal.

## ADR-002 — Storefront
Status: ACCEPTED

Selected: custom COQUETTE-owned Next.js storefront following the current Medusa DTC starter architecture, not a visual clone of a starter template.

The present Coquette UX/UI is the migration reference. The implementation may improve performance, mobile behavior, accessibility and checkout while preserving approved visual identity.

## ADR-003 — Merchant content management
Status: ACCEPTED

Selected: a COQUETTE Content module plus Medusa Admin extensions.

Reason: product/order administration and website content should be manageable from one back office. A second standalone CMS is unnecessary unless future editorial requirements exceed the custom content module.

## ADR-004 — Database
Status: ACCEPTED

Selected: dedicated PostgreSQL. A dedicated Supabase project is the preferred managed option unless provisioning reveals a material limitation.

## ADR-005 — Redis
Status: ACCEPTED

Selected: dedicated production Redis for workflow/event/cache/locking infrastructure. No Redis instance may be shared with another project.

## ADR-006 — Media
Status: ACCEPTED

Selected: dedicated S3-compatible object storage through Medusa's file provider. Preferred: dedicated Supabase Storage or Cloudflare R2.

All Magento media required after cutover will be re-hosted.

## ADR-007 — Search
Status: ACCEPTED WITH LATER GATE

Selected initially: commerce API/database-backed catalogue queries.

Meilisearch is introduced only when measured search/facet requirements justify another production service.

## ADR-008 — Authentication
Status: ACCEPTED

Selected: Medusa customer/admin authentication initially. External identity is deferred unless a concrete requirement appears.

## ADR-009 — Payments
Status: ACCEPTED

Selected: Medusa payment-provider boundary.

Initial providers: PayPal and Klarna, plus the merchant's chosen card acquiring method if required. Provider webhooks and reconciliation must be idempotent and auditable.

## ADR-010 — AADE/myDATA
Status: ACCEPTED

Selected: dedicated COQUETTE fiscal module triggered from commerce workflows/events. Fiscal mapping is explicit; unmapped tax treatment is manual-review, never guessed.

## ADR-011 — Shipping/courier
Status: ACCEPTED

Selected: provider adapters behind fulfillment/shipping boundaries. Checkout and order UI must remain provider-agnostic.

## ADR-012 — Magento migration
Status: ACCEPTED

Selected: API-based, idempotent and resumable migration with retained Magento source identifiers and re-hosted media. CSV is fallback only when Magento API access is unavailable.

## ADR-013 — Deployment split
Status: ACCEPTED

Selected:
- storefront: dedicated COQUETTE Vercel project;
- Medusa backend/Admin: long-running Node/container hosting with production server + worker roles;
- dedicated PostgreSQL, Redis and object storage.

The commerce backend will not be designed as a Vercel serverless application.

## Pending implementation decisions
- exact backend container host;
- Supabase Storage vs Cloudflare R2;
- exact card acquiring provider;
- courier provider(s) and contract capabilities;
- Magento API credentials/data availability;
- search-service activation threshold;
- customer/history migration scope;
- final fiscal mappings approved for production.
