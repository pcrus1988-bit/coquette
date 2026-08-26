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

Keep the Railway source root at the repository root. Do not set the service root to `apps/backend`, because pnpm workspace metadata and the root lockfile are required.

Build command for both Medusa services:

```sh
pnpm --filter @coquette/backend build:deploy
```

Start command for both Medusa services:

```sh
pnpm --filter @coquette/backend start:deploy
```

The deploy build creates `apps/backend/.medusa/server`, installs its production dependencies, and the start command launches the compiled artifact from that directory.

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

Pre-deploy command:

```sh
pnpm --filter @coquette/backend predeploy
```

This command runs Medusa migrations and link synchronization before the new server release starts.

Variables:

```text
NODE_ENV=production
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
7. Redis connectivity is healthy.

After this, create the first Medusa Admin user and a publishable Store API key, then configure the Vercel storefront with the public backend URL and publishable key.

## Railway configuration note

Do not add a new `railway.json` or `railway.toml` for this project. Railway deprecated Config as Code for new services in 2026; use Railway's current service settings / Infrastructure as Code workflow instead. The application-level deployment commands remain in `apps/backend/package.json` so hosting configuration stays small and auditable.
