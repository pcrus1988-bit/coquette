# COQUETTE CONCEPT

Independent e-commerce rebuild for Coquette Concept.

## Project boundary

COQUETTE is a standalone project. It must not share source trees, databases, deployments, environment variables, secrets, storage buckets, queues, credentials, or runtime state with any other project.

Reusable architectural patterns may be reimplemented here, but project data and credentials remain isolated.

## Runtime architecture

- `apps/backend` — Medusa v2 commerce backend, merchant Admin, custom modules and integrations.
- `apps/storefront` — customer-facing Next.js storefront.
- `packages` — COQUETTE-local reusable packages.
- `infra` — COQUETTE-only local/staging/production infrastructure definitions.
- `docs` — blueprint, architecture, migration, integrations and operations reference.
- `.github` — COQUETTE-only CI/CD controls.

The merchant back office is Medusa Admin inside `apps/backend`; there is intentionally no separate `apps/backoffice` application.

## Requirements

- Node.js `^20.19.0 || >=22.12.0`
- pnpm `10.11.1`
- Docker with Docker Compose for the isolated local database/runtime services

## First local setup

```bash
corepack enable
pnpm install --frozen-lockfile
cp apps/backend/.env.example apps/backend/.env
cp apps/storefront/.env.local.example apps/storefront/.env.local
pnpm infra:up
pnpm db:migrate
```

Local infrastructure is deliberately namespaced and uses non-default host ports:

- PostgreSQL: `localhost:55432`
- Redis: `localhost:56379`
- storefront: `http://localhost:8000`
- Medusa API/Admin: `http://localhost:9000`
- health: `http://localhost:9000/health`

This makes accidental collision with unrelated local projects substantially less likely.

## Development

Run both applications:

```bash
pnpm dev
```

Or independently:

```bash
pnpm backend:dev
pnpm storefront:dev
```

Follow local service logs:

```bash
pnpm infra:logs
```

Stop the local infrastructure without deleting its volumes:

```bash
pnpm infra:down
```

## Custom COQUETTE domains

The backend already contains the first project-specific modules:

- `brand` — Designer/Brand records linked to Medusa products.
- `content` — bilingual (`el`/`en`) managed website pages with structured sections and SEO fields.

After changing a module data model, generate and review a migration before applying it:

```bash
pnpm db:generate:brand
pnpm db:generate:content
pnpm db:migrate
```

Migration files must be reviewed and committed; production schema changes are never applied ad hoc.

## Environments

- local
- staging
- production

Each environment uses separate writable data stores and credentials. Production integrations remain disabled until dedicated COQUETTE credentials are provisioned and approved.

## Repository security

GitHub: `pcrus1988-bit/coquette`

Repository visibility is public by owner decision. No secrets, customer data, private Magento exports, credentials, or production configuration may ever be committed.
