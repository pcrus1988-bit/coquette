# COQUETTE CONCEPT

Independent e-commerce rebuild workspace for Coquette Concept.

## Isolation rule
This repository is a standalone project. It must not share source trees, databases, deployments, environment variables, secrets, storage buckets, queues, credentials, issue tracking, or runtime state with any other project.

Reusable architectural patterns may be reimplemented here, but project data and credentials remain isolated.

## Workspace
- `apps/storefront` — customer-facing commerce experience
- `apps/backoffice` — merchant/admin experience
- `packages` — COQUETTE-local reusable packages
- `infra` — infrastructure/configuration owned only by COQUETTE
- `docs` — blueprint, architecture, integrations, migration and operations
- `.github` — COQUETTE-only CI/CD and contribution controls

## Environments
- local
- staging
- production

Production integrations remain disabled until dedicated COQUETTE credentials are provisioned and approved.

## Repository
GitHub: `pcrus1988-bit/coquette`

Repository visibility is public by owner decision. No secrets, customer data, private exports, credentials or production configuration may ever be committed.
