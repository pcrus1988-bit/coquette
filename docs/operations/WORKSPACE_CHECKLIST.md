# Workspace Provisioning Checklist

**Last verified:** 2026-08-26

## Repository
- [x] Create GitHub repository `pcrus1988-bit/coquette`
- [x] Confirm repository is isolated from other projects
- [x] Establish `main` as default branch
- [x] Create stable `staging` branch from `main`
- [x] Add secret-safe `.gitignore`
- [x] Add `.env.example`
- [x] Add public-repository security policy
- [x] Prepare and merge the repository workspace bootstrap into `main`
- [x] Add CI for PostgreSQL 17, Redis, clean Medusa migrations, contract checks, backend production build and storefront production build
- [ ] Protect `main` with required CI/review rules (account-level setting; not verified through the current GitHub integration)
- [ ] Merge CI coverage for direct pushes to `staging`

## Storefront hosting — Vercel
- [x] Create dedicated Vercel project `storefront` for COQUETTE
- [x] Connect only to `pcrus1988-bit/coquette`
- [x] Verify the project builds only `@coquette/storefront` from `apps/storefront`
- [x] Verify successful `main` production build on a Vercel-owned hostname
- [x] Verify feature-branch preview deployments
- [ ] Configure the stable staging deployment with the real Medusa staging URL and Medusa publishable key
- [ ] Keep `coquetteconcept.gr` on Magento until the formal cutover gate

## Commerce backend hosting
- [x] Confirm that the experimental Vercel project named `backend` is not the target Medusa runtime
- [ ] Provision a long-running Node.js host for the Medusa server process
- [ ] Provision a separate worker process from the same release
- [ ] Configure `/health` on the public server process
- [ ] Ensure only the server receives public traffic

## Data — Supabase
- [x] Select dedicated PostgreSQL + object-storage stack
- [x] Create dedicated Supabase project `coquette` (`pijetwrxqznxaoacnakr`, `eu-central-1`)
- [x] Verify project is healthy on PostgreSQL 17
- [x] Create public `coquette-media` bucket
- [x] Create private `coquette-imports` migration bucket
- [x] Keep Magento migration/export material outside public Git history
- [ ] Provision dedicated S3 credentials for the backend runtime only
- [ ] Run Medusa staging migrations after the backend runtime and secrets are provisioned
- [ ] Finalize backup/restore policy and perform a restore rehearsal

## Redis
- [ ] Provision a dedicated COQUETTE Redis instance
- [ ] Put `REDIS_URL` only in Medusa server/worker runtime secrets
- [ ] Verify server and worker use the same dedicated staging Redis

## Medusa staging bootstrap
- [ ] Add `DATABASE_URL`, Redis, S3, JWT/cookie and CORS settings to backend runtime secrets
- [ ] Run the backend `predeploy` migration step exactly once per release
- [ ] Verify server `/health`
- [ ] Verify Medusa Admin `/app`
- [ ] Create first dedicated COQUETTE merchant Admin account
- [ ] Create and scope a Medusa publishable Store API key
- [ ] Connect the Vercel storefront to the staging backend + publishable key
- [ ] Verify Store API product query, media upload and worker operation

## Integrations
- [ ] PayPal dedicated Sandbox app/credentials and end-to-end staging test
- [ ] Klarna dedicated Playground credentials and end-to-end staging test
- [ ] AADE/myDATA dedicated configuration
- [ ] Courier credentials
- [ ] Email provider/domain configuration

## Security
- [x] Document no-shared-secrets rule
- [x] Add webhook ownership inventory
- [x] Add credential ownership inventory
- [x] Keep database/S3/payment secrets out of the Vercel storefront
- [ ] Separate production/staging credentials when provisioned
- [ ] Add credential rotation record
- [ ] Verify/enable repository secret scanning and push protection
