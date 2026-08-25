# COQUETTE Deployment Runbook

This runbook defines the deployment contract independently of any specific backend hosting vendor. The storefront and commerce backend are separate deployments and must have separate environment variables and operational ownership.

## Deployment topology

### Storefront

- Next.js application in `apps/storefront`
- intended deployment: dedicated COQUETTE Vercel project
- talks only to the Medusa Store API
- receives no database, Redis, S3 secret, payment secret, AADE secret or courier secret

### Medusa server

- Node.js production process built from `apps/backend`
- serves Store/Admin APIs and Medusa Admin
- `MEDUSA_WORKER_MODE=server`
- `DISABLE_MEDUSA_ADMIN=false`
- port `9000` unless hosting platform supplies another port
- public health endpoint: `/health`
- Admin path: `/app`

### Medusa worker

- second process built from the same backend commit/artifact
- `MEDUSA_WORKER_MODE=worker`
- `DISABLE_MEDUSA_ADMIN=true`
- no public traffic should be routed to this process

Do not run two independently versioned code copies. Server and worker must deploy the same commit/build release.

## Managed dependencies

### PostgreSQL

Dedicated Supabase project:

- project ref: `pijetwrxqznxaoacnakr`
- region: `eu-central-1`

`DATABASE_URL` is a backend secret. It must never be present in the storefront or Git.

### Redis

A dedicated production/staging Redis service is still to be provisioned. It must not reuse another project's instance/credentials.

### Object storage

Dedicated Supabase Storage:

- public commerce media: `coquette-media`
- private migration input: `coquette-imports`

Backend S3 credentials are secrets. Public media URLs are safe to expose.

## Build contract

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @coquette/backend build
```

The required production artifact is generated at:

```text
apps/backend/.medusa/server
```

A valid build must include at least:

- `medusa-config.js`
- `package.json`
- generated dependency lock file
- compiled `src/`
- `public/admin/` for the server/Admin process

CI verifies the first two artifact files after every branch/PR build.

The `.medusa` directory is generated output and must not be committed.

## Migration/predeploy contract

Before starting a newly deployed backend release, run the backend `predeploy` script exactly once against the target database:

```sh
pnpm --filter @coquette/backend predeploy
```

This runs:

```sh
medusa db:migrate
```

It applies Medusa core migrations, COQUETTE custom module migrations, and link synchronization.

Do not run database migrations concurrently from both server and worker startup hooks. The hosting release process should have one migration/predeploy step, followed by server/worker rollout.

## Production backend environment

Required on both server and worker unless noted otherwise:

```text
NODE_ENV=production
DATABASE_URL=<secret>
REDIS_URL=<secret>
JWT_SECRET=<secret>
COOKIE_SECRET=<secret>
STORE_CORS=<storefront origin(s)>
AUTH_CORS=<storefront + admin origin(s)>
MEDUSA_BACKEND_URL=<public server URL>
S3_FILE_URL=<safe public media base URL>
S3_ENDPOINT=<safe S3 endpoint>
S3_REGION=eu-central-1
S3_BUCKET=coquette-media
S3_ACCESS_KEY_ID=<secret>
S3_SECRET_ACCESS_KEY=<secret>
```

Server only:

```text
MEDUSA_WORKER_MODE=server
DISABLE_MEDUSA_ADMIN=false
ADMIN_CORS=<public Medusa/Admin origin>
PORT=9000
```

Worker only:

```text
MEDUSA_WORKER_MODE=worker
DISABLE_MEDUSA_ADMIN=true
```

The worker may receive the same CORS settings for configuration consistency, but it must not be exposed publicly.

## Storefront environment

Safe browser-visible configuration:

```text
NEXT_PUBLIC_BASE_URL=<storefront URL>
NEXT_PUBLIC_MEDUSA_BACKEND_URL=<public Medusa server URL>
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<Medusa publishable key>
NEXT_PUBLIC_DEFAULT_COUNTRY_CODE=gr
```

A Medusa publishable key is intentionally browser-visible and scoped through Medusa sales-channel configuration. It is not a substitute for a secret API key.

The storefront must never receive:

- `DATABASE_URL`
- database password
- Redis URL/password
- Supabase service/secret key
- S3 secret access key
- payment secrets
- AADE secrets
- courier secrets

## Admin backend URL

`medusa-config.ts` compiles Medusa Admin with:

```ts
admin: {
  backendUrl: process.env.MEDUSA_BACKEND_URL,
}
```

`MEDUSA_BACKEND_URL` must therefore be present at backend build time as well as runtime when the Admin is included in the server artifact.

## Store API connectivity

The storefront creates its Medusa SDK client from:

- `NEXT_PUBLIC_MEDUSA_BACKEND_URL`
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`

Until both are properly configured, Store API-backed pages deliberately render a safe unconfigured state rather than attempting to use a database connection or fake catalogue data.

Product-detail requests retrieve:

- product identity/content
- images
- options/variants
- calculated variant prices using the configured country context
- inventory quantity

Cart/wishlist/checkout mutations remain disabled until their dedicated roadmap phases.

## Staging release sequence

1. provision dedicated backend host/server process
2. provision dedicated worker process
3. provision dedicated Redis
4. add COQUETTE Supabase database secret to backend only
5. add dedicated COQUETTE S3 credentials to backend only
6. configure staging server/worker environment variables
7. build backend artifact
8. run `predeploy` once
9. start worker and server from the same release
10. verify `<backend>/health`
11. verify `<backend>/app`
12. create first COQUETTE Admin user
13. create Medusa publishable key and scope it to the intended sales channel
14. create dedicated COQUETTE Vercel project for `apps/storefront`
15. set storefront URL/backend URL/publishable key/country code
16. deploy storefront
17. verify Store API product-detail behavior
18. run smoke tests before any Magento import rehearsal

## Production release sequence

Production follows the same topology, but must additionally satisfy the master roadmap's UAT, payment, courier, fiscal, SEO, migration reconciliation, monitoring and rollback gates.

Do not point `coquetteconcept.gr` to the replacement merely because server health and storefront builds are green.

## Rollback principle

Application rollback and data rollback are different operations.

- application rollback: deploy the prior known-good backend/storefront release
- schema/data rollback: must follow migration-specific recovery/backup procedures; do not automatically reverse a production database migration during an incident without assessing data written under the new schema

Magento remains the production fallback until the formal cutover/rollback window is closed.
