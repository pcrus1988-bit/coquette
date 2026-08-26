# COQUETTE Railway Staging Backend

This file defines the concrete Railway staging deployment for the Medusa backend. It supplements `DEPLOYMENT_RUNBOOK.md` and does not replace the general production gates in `docs/ROADMAP.md`.

## Boundary

- Vercel hosts only `apps/storefront`.
- Railway hosts the long-running Medusa server and Medusa worker.
- Supabase project `pijetwrxqznxaoacnakr` remains the dedicated COQUETTE PostgreSQL and object-storage environment.
- Railway Redis must be dedicated to COQUETTE.
- Magento remains production until formal cutover.

## Railway project

Recommended staging project name:

```text
coquette-staging
```

Create three Railway services:

1. `coquette-backend` — GitHub source `pcrus1988-bit/coquette`, branch `staging` or `main` during initial bring-up.
2. `coquette-worker` — the same GitHub source and commit as the backend.
3. `Redis` — Railway managed Redis.

The worker must not receive a public domain.

## Shared monorepo settings

Keep the Railway source root at the repository root. Do not set the service root to `apps/backend`, because pnpm workspace metadata and the root lockfile are required for the source build.

Build command for both Medusa services:

```sh
pnpm --filter @coquette/backend build:deploy
```

Start command for both Medusa services:

```sh
pnpm --filter @coquette/backend start:deploy
```

The deploy build first runs Medusa through the repository pnpm workspace. Medusa recreates `apps/backend/.medusa/server` as a standalone application. The deployment script then installs only the standalone runtime's production dependencies with npm inside that generated directory. This deliberately avoids pnpm walking back up into the parent monorepo workspace during the second installation step. The start command launches the generated server from that directory.

## Redis production infrastructure

A single dedicated COQUETTE `REDIS_URL` is shared by Medusa's Redis-backed infrastructure modules. When the variable is present, the backend registers:

- Redis Caching Module Provider
- Redis Event Bus Module
- Redis Workflow Engine Module
- Redis Locking Module Provider

This is required for the separate server + worker topology. Do not create separate local/in-memory event or locking state on either service, and do not reuse a Redis instance from another project.

The application enables Medusa's caching feature flag automatically when `REDIS_URL` is configured. Event jobs are retained for up to one hour or 1,000 completed/failed jobs to keep the staging queue inspectable without unbounded growth.

## Server-only Railway settings

Service:

```text
coquette-backend
```

Public networking: enabled.

Healthcheck path:

```text
/health
```

Railway injects `PORT` automatically and performs the healthcheck on that port. Medusa honors the `PORT` environment variable, but its default `HOST` is `localhost`. Railway must be able to reach the process over the container network, so set `HOST=0.0.0.0` on the backend service. Do not add a manual `PORT` unless Railway's generated port behavior is intentionally overridden.

Pre-deploy command:

```sh
pnpm --filter @coquette/backend predeploy
```

This command runs Medusa migrations and link synchronization before the new server release starts.

Variables:

```text
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=<Supabase Session Pooler URL, port 5432>
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<dedicated random COQUETTE secret>
COOKIE_SECRET=<different dedicated random COQUETTE secret>
MEDUSA_WORKER_MODE=server
DISABLE_MEDUSA_ADMIN=false
MEDUSA_BACKEND_URL=https://<railway-backend-domain>
ADMIN_CORS=https://<railway-backend-domain>
STORE_CORS=<staging storefront origin; temporary backend origin is acceptable before storefront exists>
AUTH_CORS=<staging storefront origin>,https://<railway-backend-domain>
```

Do not use a Supabase transaction-pooler URL on port 6543 for the persistent Medusa application. Use a direct connection where the host supports the required network path, otherwise use the Supabase Session Pooler on port 5432.

Do not set payment, courier or AADE production credentials during staging bootstrap.

S3 variables can be added after the base server is healthy:

```text
S3_FILE_URL=https://pijetwrxqznxaoacnakr.supabase.co/storage/v1/object/public/coquette-media
S3_ENDPOINT=https://pijetwrxqznxaoacnakr.storage.supabase.co/storage/v1/s3
S3_REGION=eu-central-1
S3_BUCKET=coquette-media
S3_ACCESS_KEY_ID=<secret>
S3_SECRET_ACCESS_KEY=<secret>
```

Supabase S3 access keys are server-side credentials with broad Storage access and must never be added to the storefront or Git history.

## Worker-only Railway settings

Service:

```text
coquette-worker
```

Public networking: disabled.

No healthcheck is required.

No pre-deploy command is allowed on the worker. Database migrations must run only from the server release path.

Use the same backend build/start commands and the same database, Redis, JWT and cookie secrets as the server, but set:

```text
NODE_ENV=production
MEDUSA_WORKER_MODE=worker
DISABLE_MEDUSA_ADMIN=true
MEDUSA_BACKEND_URL=https://<railway-backend-domain>
```

The worker and server must deploy the same Git commit/release.

## First staging verification

Do not proceed to storefront connection until all of these pass:

1. Railway server deployment is green.
2. Pre-deploy migration completes successfully.
3. `https://<railway-backend-domain>/health` returns `OK`.
4. `https://<railway-backend-domain>/app` loads Medusa Admin.
5. Worker remains running without a public endpoint.
6. PostgreSQL logs show normal connectivity to the dedicated COQUETTE Supabase project.
7. Logs confirm Redis-backed event bus, workflow engine, caching and locking modules connected successfully.

After this, create the first Medusa Admin user and a publishable Store API key, then configure the Vercel storefront with the public backend URL and publishable key.

## Railway configuration note

Do not add a new `railway.json` or `railway.toml` for this project. Railway deprecated Config as Code for new services in 2026; use Railway's current service settings / Infrastructure as Code workflow instead. The application-level deployment commands remain in `apps/backend/package.json` so hosting configuration stays small and auditable.
