# Managed Data Foundation

## Dedicated Supabase project

COQUETTE uses a dedicated Supabase project for managed PostgreSQL and object storage only.

- Project name: `coquette`
- Project ref: `pijetwrxqznxaoacnakr`
- Region: `eu-central-1`
- Database host: `db.pijetwrxqznxaoacnakr.supabase.co`
- Project URL: `https://pijetwrxqznxaoacnakr.supabase.co`
- PostgreSQL major version at provisioning: 17

This project must never be shared with another application.

## Ownership boundary

Medusa remains the commerce system of record for:

- customers and commerce authentication
- products and variants
- prices and inventory
- carts and checkout
- orders and returns
- discounts/promotions
- payment state
- fulfillment state
- custom Designer/Brand records
- Website Content records

Supabase is infrastructure for:

- the PostgreSQL database used by Medusa
- public commerce media
- private migration/import material

The storefront must talk to Medusa APIs. It must not query the PostgreSQL database directly and must not introduce a parallel Supabase-auth commerce identity model.

## Storage buckets

Two COQUETTE-only buckets are provisioned:

### `coquette-media`

- public read
- intended for product images, designer media and public website assets
- uploads/deletes are server-side through dedicated S3 credentials

Public base URL:

`https://pijetwrxqznxaoacnakr.supabase.co/storage/v1/object/public/coquette-media`

S3 endpoint:

`https://pijetwrxqznxaoacnakr.storage.supabase.co/storage/v1/s3`

### `coquette-imports`

- private
- intended for temporary Magento migration material and controlled import artifacts
- must never be exposed through the storefront

Raw exports containing customer/order/private data must stay outside Git history.

## Database connections

Secrets are never committed.

For migrations and long-lived backends where IPv6 is available, prefer the direct PostgreSQL connection supplied by Supabase. For IPv4-only persistent hosts, use Supabase's session-mode shared pooler. Transaction-mode pooling should not be used for Medusa migrations.

The storefront deployment receives no database password.

## File provider

Medusa uses its local file provider automatically in local development. When all `S3_*` variables are present in a hosted environment, `medusa-config.ts` switches to Medusa's S3 file provider with `forcePathStyle: true`, as required for Supabase's S3-compatible endpoint.

Required hosted secrets/configuration:

- `DATABASE_URL`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_FILE_URL`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `REDIS_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`

S3 access keys must be dedicated to COQUETTE and generated from the COQUETTE Supabase project's Storage S3 configuration. Supabase API publishable keys are not substitutes for persistent Medusa S3 credentials.

## Migration rule

Medusa's own schema is managed using Medusa migrations. Do not manually reproduce Medusa core tables in SQL.

Custom module migration files are generated with `medusa db:generate` and committed to Git. Deployment then runs `medusa db:migrate`, which applies Medusa core migrations, custom module migrations and link synchronization.

The Supabase migration history is reserved for Supabase-specific infrastructure changes such as bucket definitions or deliberate platform-level database configuration, not for duplicating Medusa's schema management.
