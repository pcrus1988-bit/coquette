# COQUETTE Workspace

This document is the operational entry point for the COQUETTE engineering workspace.

## Repository
`pcrus1988-bit/coquette`

## Application areas
- `apps/storefront` — public customer storefront
- `apps/backoffice` — merchant/admin management interface
- `packages` — reusable code owned only by COQUETTE
- `infra` — deployment, database, storage and infrastructure definitions
- `docs` — blueprint, architecture, integrations, migration and operations

## Environment sequence
1. local
2. staging
3. production

No direct production-first development.

## Current Phase 0 status
- GitHub repository created and connected
- project isolation documented
- secret-safe repository rules established
- local/staging/production boundaries documented
- storefront/backoffice/package/infra work areas created
- dedicated Vercel, database and storage projects still to be provisioned

## Next decisions
Before application scaffolding, finalize the technical architecture in the COQUETTE blueprint: framework, commerce domain model, database, storage, authentication, search, CMS/content-editing strategy, Magento migration path, payments, shipping and AADE integration boundaries.
