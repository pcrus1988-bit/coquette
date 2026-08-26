# COQUETTE Railway Staging Backend

This file defines the concrete Railway staging deployment for the Medusa backend. It supplements `DEPLOYMENT_RUNBOOK.md` and does not replace the general production gates in `docs/ROADMAP.md`.

## Boundary

- Vercel hosts only `apps/storefront`.
- Railway hosts the long-running Medusa server and Medusa worker.
- Supabase project `pijetwrxqznxaoacnakr` remains the dedicated COQUETTE PostgreSQL and object-storage environment.
- Railway Redis must be dedicated to COQUETTE.
- Magento remains production until formal cutover.

## Current verified state — 2026-08-26

- Railway project `coquette-staging` exists.
- `coquette-backend` is deployed successfully from the stable `staging` release flow.
- `coquette-worker` is deployed successfully from the same staging release flow.
- The public backend healthcheck was brought online during staging setup.
- Medusa Admin was reached during staging setup.
- Medusa migrations are applied to the dedicated COQUETTE Supabase database.
- Admin users and publishable Store API keys have been bootstrapped.
- The Vercel staging storefront deploys successfully.
- Repository CI validates the Railway production artifact and the staging commerce bootstrap on disposable PostgreSQL + Redis infrastructure.

The obsolete Vercel project named `backend` is not part of the COQUETTE runtime. Its deployment status must not be treated as a staging health signal and it must never receive database, Redis, S3 or payment secrets.

## Railway services

The staging project uses three services:

1. `coquette-backend` — GitHub source `pcrus1988-bit/coquette`, stable branch `staging`.
2. `coquette-worker` — the same GitHub source and release commit as the backend.
3. `Redis` — dedicated Railway-managed Redis.

The worker must not receive a public domain.

## Shared monorepo settings

Keep the Railway source root at the repository root. Do not set the service root to `apps/backend`, because pnpm workspace metadata and the root lockfile are required for the source build.

Preferred root build command for both Medusa services:

```sh
pnpm railway-build-backend
```

Preferred root start command for both Medusa services:

```sh
pnpm railway-start-backend
```

The root wrappers delegate to the backend package. The deploy build first runs Medusa through the repository pnpm workspace. Medusa recreates `apps/backend/.medusa/server` as a standalone application. The deployment script then installs only the standalone runtime's production dependencies with npm inside that generated directory. This deliberately avoids pnpm walking back up into the parent monorepo workspace during the second installation step. The start command launches the generated server from that directory and binds it to Railway's network interface and injected port.

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

Railway injects `PORT` automatically and performs the healthcheck on that port. Medusa is started with `--host 0.0.0.0 --port ${PORT:-9000}` through `railway-start-backend`, so the process is reachable over the Railway container network. Do not add a manual `PORT` unless Railway's generated-port behavior is intentionally overridden.

Pre-deploy command:

```sh
pnpm railway-predeploy-backend
```

This command runs Medusa migrations and link synchronization before the new server release starts. Database migrations must remain server-only and must not run independently from the worker.

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
STORE_CORS=<staging storefront origin>
AUTH_CORS=<staging storefront origin>,https://<railway-backend-domain>
```

Do not use a Supabase transaction-pooler URL on port 6543 for the persistent Medusa application. Use a direct connection where the host supports the required network path, otherwise use the Supabase Session Pooler on port 5432.

Do not set production payment, courier or AADE credentials during staging bootstrap.

S3 variables:

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

No public HTTP healthcheck is required.

No pre-deploy command is allowed on the worker. Database migrations must run only from the server release path.

Use the same backend build/start commands and the same database, Redis, JWT and cookie secrets as the server, but set:

```text
NODE_ENV=production
MEDUSA_WORKER_MODE=worker
DISABLE_MEDUSA_ADMIN=true
MEDUSA_BACKEND_URL=https://<railway-backend-domain>
```

The worker and server must deploy the same Git commit/release.

## Explicit staging commerce bootstrap

The repository contains an idempotent Medusa CLI bootstrap for the initial Greece commerce configuration:

```sh
pnpm --filter @coquette/backend staging:bootstrap
```

The command is intentionally **not** part of the normal Railway pre-deploy command. It must be run explicitly when establishing or repairing a staging commerce environment so routine application releases cannot silently overwrite merchant-controlled commerce settings.

The bootstrap safely ensures the following baseline:

- one COQUETTE store, creating it when a clean environment has none;
- one default sales channel, creating it when absent;
- Greece region using EUR;
- Greece (`gr`) assigned to the region;
- store defaults for the Greece region and sales channel;
- store locales `el-GR` and `en-GB`;
- stock location `COQUETTE Greece`;
- sales-channel ↔ stock-location linkage;
- manual fulfillment provider ↔ stock-location linkage;
- default shipping profile;
- fulfillment set `COQUETTE Greece delivery`;
- Greece service zone and country geo-zone;
- fulfillment-set ↔ stock-location linkage;
- registration of available staging PayPal/Klarna providers on the region when those providers are actually configured in the runtime.

The command refuses to guess if an environment unexpectedly contains multiple stores or multiple sales channels.

### Shipping price gate

A customer-facing shipping option is created only when the operator deliberately supplies:

```text
COQUETTE_STANDARD_SHIPPING_EUR=<approved flat shipping price in EUR>
```

If this variable is absent, the fulfillment structure is created but no shipping price is invented. The synthetic `4.90` value used by GitHub CI exists only to exercise the shipping-option code path on a disposable database and is **not** a COQUETTE business setting.

### CI proof

The COQUETTE CI workflow runs the staging commerce bootstrap twice against a clean disposable PostgreSQL 17 + Redis environment. Both executions must succeed before the release is considered valid. This verifies both first-run creation and idempotent re-execution.

## Staging verification

The integrated staging environment is considered ready only when all of these pass:

1. Railway server deployment is green.
2. Railway worker deployment is green.
3. Pre-deploy migration completes successfully.
4. `https://<railway-backend-domain>/health` returns `OK`.
5. `https://<railway-backend-domain>/app` loads Medusa Admin.
6. Worker remains running without a public endpoint.
7. Server and worker logs show healthy access to the dedicated COQUETTE Supabase database.
8. Server and worker logs confirm Redis-backed event bus, workflow engine, caching and locking modules connected successfully.
9. The explicit commerce bootstrap has been run once against staging and its resulting database state has been verified.
10. The Vercel storefront can call the Railway Store API with the intended publishable key.
11. An Admin media upload and public read through `coquette-media` succeeds.
12. Cart creation, shipping-option discovery and payment-session discovery succeed end-to-end.

## Railway configuration note

Do not add a new `railway.json` or `railway.toml` merely for this project setup. Keep hosting configuration in Railway's current service settings / Infrastructure-as-Code workflow and keep application-level commands in the repository where they remain auditable.
