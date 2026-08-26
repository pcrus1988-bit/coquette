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
- [x] Add CI coverage for direct pushes to `staging`
- [x] Add CI proof for the idempotent Greece commerce bootstrap by executing it twice against disposable infrastructure
- [ ] Protect `main` with required CI/review rules (account-level setting; write access not exposed through the current GitHub integration)

## Storefront hosting — Vercel
- [x] Create dedicated Vercel project `storefront` for COQUETTE
- [x] Connect only to `pcrus1988-bit/coquette`
- [x] Verify the project builds only `@coquette/storefront` from `apps/storefront`
- [x] Verify successful `main` production builds on Vercel-owned hostnames
- [x] Verify stable `staging` deployments are `READY`
- [x] Verify feature-branch preview deployments
- [ ] Verify the stable staging deployment makes a successful Store API request to the intended Railway backend with the intended publishable key
- [ ] Keep `coquetteconcept.gr` on Magento until the formal cutover gate

## Commerce backend hosting — Railway
- [x] Confirm that the experimental Vercel project named `backend` is not the target Medusa runtime
- [x] Provision Railway staging runtime for the Medusa server process
- [x] Provision a separate Railway worker process from the same release flow
- [x] Configure `/health` on the public server process
- [x] Ensure only the server receives public HTTP traffic
- [x] Fix Railway command resolution and bind Medusa to `0.0.0.0` with Railway's injected `PORT`
- [x] Verify GitHub deployment status reports success for `coquette-backend`
- [x] Verify GitHub deployment status reports success for `coquette-worker`
- [ ] Independently inspect current server/worker runtime logs for database, Redis and background-job health

## Data — Supabase
- [x] Select dedicated PostgreSQL + object-storage stack
- [x] Create dedicated Supabase project `coquette` (`pijetwrxqznxaoacnakr`, `eu-central-1`)
- [x] Verify project is healthy on PostgreSQL 17
- [x] Create public `coquette-media` bucket
- [x] Create private `coquette-imports` migration bucket
- [x] Keep Magento migration/export material outside public Git history
- [x] Run Medusa core + COQUETTE staging migrations
- [x] Verify live Medusa commerce schema exists in the dedicated database
- [ ] Independently verify dedicated S3 credentials are installed only in the backend runtime
- [ ] Verify an actual Medusa Admin media upload + public read through `coquette-media`
- [ ] Finalize backup/restore policy and perform a restore rehearsal

## Redis
- [x] Railway staging topology includes a dedicated COQUETTE Redis service
- [x] Application is configured to use Redis-backed cache, event bus, workflow engine and locking when `REDIS_URL` is present
- [ ] Independently confirm both Railway server and worker receive the same dedicated `REDIS_URL`
- [ ] Verify current server/worker logs contain no Redis connection errors

## Medusa staging bootstrap
- [x] Run the backend migration step against staging
- [x] Verify server `/health` during interactive setup
- [x] Verify Medusa Admin `/app` during interactive setup
- [x] Create dedicated COQUETTE merchant Admin accounts; 2 Admin users currently exist
- [x] Create Medusa publishable Store API keys; 2 active publishable keys currently exist
- [x] Link publishable keys to the sales channel
- [x] Create one store, one sales channel and one EUR Greece region
- [x] Add explicit idempotent `staging:bootstrap` command for Greece commerce configuration
- [x] CI validates the bootstrap twice from a clean database, including a synthetic shipping-option creation path
- [ ] Run `pnpm --filter @coquette/backend staging:bootstrap` once against the real Railway staging runtime. This is deliberately separate from normal deploy/pre-deploy and is not executed merely by syncing the branch.
- [ ] Verify live store name/default region/default location/default sales channel after bootstrap
- [ ] Verify live `el-GR` and `en-GB` store locale links after bootstrap
- [ ] Verify Greece is assigned to the Medusa region after bootstrap
- [ ] Verify stock location + sales-channel link after bootstrap
- [ ] Verify Greece fulfillment set/service zone/geo-zone after bootstrap
- [ ] Choose the real COQUETTE standard shipping price/policy before creating a customer-facing shipping option
- [ ] Enable and verify PayPal Sandbox / Klarna Playground on the staging region only when real staging credentials are present
- [ ] Verify Store API product query, media upload and worker operation
- [ ] Verify cart creation, shipping discovery and payment-session discovery end-to-end

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
- [ ] Confirm no unrelated project has access to COQUETTE runtime secrets
- [ ] Separate production/staging credentials for every external integration
- [ ] Add credential rotation record
- [ ] Verify/enable repository secret scanning and push protection
