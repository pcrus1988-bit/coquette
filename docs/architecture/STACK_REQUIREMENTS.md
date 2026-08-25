# COQUETTE Stack Requirements

Status: STACK SELECTED

## Selected foundation
- Medusa v2 commerce backend + merchant Admin
- Node.js / TypeScript
- Next.js storefront
- pnpm monorepo
- PostgreSQL
- Redis in staging/production where production infrastructure is exercised
- S3-compatible object storage
- Vercel for storefront deployment
- long-running Node/container hosting for Medusa server + worker

## Non-negotiable product requirements
- closely reproduce or improve the approved current COQUETTE UX/UI
- mobile-first premium fashion storefront
- Greek and English support
- products, variants, size/color options, prices, sale prices and stock
- categories, collections and designers/brands
- wishlist/customer account capability
- cart and checkout
- merchant-friendly orders, payments, fulfillment, returns and refunds
- promotions and discounting
- editable homepage/navigation/content/media/SEO from the merchant back office
- PayPal integration
- Klarna integration
- pluggable card acquiring provider
- pluggable courier integrations
- AADE/myDATA fiscal integration
- Magento migration and repeated delta synchronization before cutover
- URL redirect/SEO preservation
- staging and production isolation
- automated test/deployment gates
- backups, logging, monitoring and manual-recovery paths

## Engineering constraints
- no Magento runtime dependency after production cutover
- no cross-project database, Redis, storage, secrets or deployments
- no secrets or private Magento exports in Git
- payment, courier and AADE integrations implemented behind explicit module/provider boundaries
- all external webhooks authenticated where the provider supports it and processed idempotently
- source-platform identifiers retained for migration traceability
- framework internals should not be forked for normal COQUETTE features; use documented extension points
- exact dependency versions are pinned through the lockfile and upgraded deliberately

## Deferred until justified
- separate standalone CMS
- dedicated search engine
- external identity provider
- microservices
- multi-merchant/marketplace architecture

These can be introduced later only if a concrete COQUETTE requirement justifies the operational complexity.
