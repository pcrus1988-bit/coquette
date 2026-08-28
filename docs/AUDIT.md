# COQUETTE — AUDIT

**Status:** Canonical project audit and recovery reference  
**Audit date:** 2026-08-28  
**Last verified update:** 2026-08-28  
**Canonical Blueprint:** `docs/ROADMAP.md`  
**Current execution snapshot:** `docs/CURRENT_STATUS.md`  
**Repository:** `pcrus1988-bit/coquette`

Within this project, **AUDIT** means this document.

AUDIT complements the Blueprint: the Blueprint defines intended architecture, delivery phases and acceptance gates; AUDIT records verified current state, drift, corrective actions and external/manual dependencies. `CURRENT_STATUS.md` is the shorter execution snapshot derived from both.

---

## Executive conclusion

COQUETTE remains architecturally sound and materially advanced beyond the original sequential Blueprint labels, but it is not yet a complete staging shop and is not production-ready.

The original `main`/Railway `staging` history drift was repaired and the controlled release discipline worked successfully through Studio variants, pricing, identifiers, inventory, category/designer placement and publication lifecycle. On 2026-08-28, however, deployment of the guarded archive/restore release exposed a new **Railway backend service deployment incident**.

The incident has been isolated carefully:

- archive/restore implementation merged in PR #85 and passed its dedicated runtime contract;
- the exact release tree passed all applicable GitHub workflows before release;
- Railway worker accepted the release while Railway backend failed;
- PR #86 added a permanent Railway-equivalent production runtime smoke gate to full CI;
- that gate runs backend predeploy migrations, starts the built `.medusa/server` production artifact and requires HTTP 2xx from `/health`;
- the corrected smoke contract is green;
- a same-tree Railway retry failed again on backend;
- a forward-only rollback release carrying the prior known-good application tree also failed on Railway backend while the worker succeeded;
- therefore the archive application tree is **not** the demonstrated cause of the backend deployment failure;
- the remaining fault boundary is Railway backend service/environment/platform configuration or state and requires Railway deployment diagnostics.

### Verified current state

- architecture: consistent with Blueprint;
- current merged implementation head: `4536ba682e6587f7b330f4acb1cfb9d0a67f5e6e`;
- guarded publication/unpublication lifecycle: merged and validated;
- guarded archive/restore policy: PR #85 merged and validated on `main`;
- production-runtime release smoke gate: PR #86 merged as `e72534dc4a35752a785c75986ef04aa94779b32c`;
- Studio fail-soft archive/backend compatibility: PR #87 merged as `4536ba68…` and deployed READY on Vercel;
- current Railway `staging` ref: forward-only rollback release `2b4f20e0678669b23be697b7108bb55510c8554d`;
- Railway `coquette-worker`: **success** on `2b4f20e…`;
- Railway `coquette-backend`: **failure** on `2b4f20e…`;
- Railway server/worker release alignment invariant: **currently not satisfied** because backend cannot deploy the current staging release;
- last previously verified successful aligned Railway baseline before the incident: `d450b35edc6e750004df72452950f9246ae3ffff`;
- Vercel storefront: healthy on current staging pushes;
- COQUETTE Studio production: READY from `4536ba68…`;
- Supabase PostgreSQL/storage: isolated and healthy at the verified audit baseline;
- Medusa build/migration/runtime artifact: green in CI, including actual production start and `/health` smoke;
- real legacy catalogue: not yet written into COQUETTE staging;
- production cutover: intentionally not reached;
- obsolete Vercel `backend`: still present/failing and remains cleanup noise, not the canonical Medusa runtime.

**Current governing rule:** do not advance any new backend-dependent Phase 5 release assumption until Railway `coquette-backend` can deploy successfully again and backend + worker are re-established on one controlled release.

---

# 1. Blueprint position

## Phase 0 — Workspace and isolation

**Status: COMPLETE**

Dedicated repository, database/storage boundaries, environments and project-specific runtime state are in place.

## Phase 1 — Legacy audit / architecture

**Status: COMPLETE; public audit remains continuous**

Medusa v2 + Next.js remains approved. COQUETTE Studio is the primary merchant experience over Medusa. The public Magento storefront remains the legitimate reconstruction evidence source because private Magento administrative/database/filesystem/API access is unavailable.

## Phase 2 — Executable commerce foundation

**Status: COMPLETE**

Medusa backend/Admin, Next.js storefront, reproducible dependency/build gates, clean database contracts and CI are established. As of PR #86, the full CI also starts the built Medusa production artifact after predeploy and verifies `/health`, closing the former gap between “build succeeds” and “server actually starts.”

## Phase 3 — Domain model and managed infrastructure

**Status: TECHNICAL EXIT GATE COMPLETE; RAILWAY BACKEND DEPLOYMENT INCIDENT OPEN**

Verified foundation includes dedicated Supabase PostgreSQL/storage, Medusa schema, Designer/Brand and Website Content domains, Greece/EUR region, stock-location/fulfillment foundation, Railway server/worker + Redis, Vercel storefront/Studio and managed S3-compatible media.

The architecture is not being changed because of the current deployment incident. The incident is isolated to the Railway backend service deployment boundary.

Backup/restore rehearsal and repository protection remain operational hardening items.

## Phase 4 — Public legacy reconstruction

**Status: VERY ADVANCED TECHNICALLY; REAL LEGACY DATA NOT YET IMPORTED**

The reconstruction framework covers evidence capture, URL inventory, checksums, products, categories, designers/brands, media, structural plans, pricing, qualitative inventory evidence, review decisions, checksum-bound bundles, handoff creation/intake, dependency reconciliation, dependency provisioning evidence and guarded staging execution.

Verified advancement:

- Phase 4T verified handoff reconciliation intake is shipped;
- Phase 4U dependency-provisioning evidence is shipped;
- no real legacy catalogue reconstruction write has yet been performed against staging.

The next unavoidable Phase 4 boundary remains authoritative legacy browser capture followed by verified intake and guarded real staging reconstruction.

## Phase 5 — Merchant back-office parity

**Status: MATERIAL IMPLEMENTATION SHIPPED; BACKEND-DEPENDENT RELEASES TEMPORARILY BLOCKED**

COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine/API and technical administration foundation.

Verified implementation now includes:

- guarded product drafts and governed media;
- reviewed Size/Colour variant generation;
- guarded regular/sale pricing;
- guarded SKU/EAN/UPC/barcode identifiers;
- guarded inventory quantity/location policy;
- guarded category/designer placement;
- guarded publication/unpublication lifecycle and customer-visibility review;
- explicit reversible archive/restore policy with restore-to-draft semantics;
- Studio capability fallback that hides archive controls when the deployed backend does not expose the archive API.

The archive policy is implemented and validated on `main`, but is **not yet considered Railway-released** because the backend service cannot deploy the release. PR #87 prevents Studio from exposing a broken archive control until backend capability becomes available.

Remaining Phase 5 catalogue work includes merchant-facing tax controls where required, merchandising/SEO application and bulk operations. Broader order/customer/refund/fulfillment/payment/shipping/fiscal operations and merchant UAT also remain.

## Phase 6 onward

Storefront parity, search, cart, checkout and payment foundations are materially ahead of the original sequence, but final acceptance remains blocked on real reconstructed data plus staging E2E/UAT.

---

# 2. Runtime and platform audit

## GitHub

- repository: `pcrus1988-bit/coquette`;
- default implementation branch: `main`;
- implementation head after compatibility safeguard: `4536ba682e6587f7b330f4acb1cfb9d0a67f5e6e`;
- PR #85: guarded archive/restore policy merged;
- PR #86: Railway-equivalent production runtime health smoke merged;
- PR #87: Studio archive/backend compatibility merged;
- full CI, Studio CI and archive-specific CI are green on the relevant exact feature heads;
- full CI now verifies production build **and actual production-server startup**;
- aggregate deployment status can still appear red because of obsolete Vercel `backend` and the real Railway backend incident;
- branch/ruleset protection remains account-level hardening.

### Release history and 2026-08-28 incident

Before the incident, controlled release history was reconciled and reused successfully through release `d450b35e…`.

Archive release sequence:

1. PR #85 merged guarded archive/restore to `main`;
2. exact-tree two-parent candidate passed all applicable workflows;
3. final release `fb3a931349f52457135300393bd67edf56c554ce` advanced `staging` without force;
4. Vercel storefront succeeded;
5. Railway worker succeeded;
6. Railway backend failed;
7. PR #86 introduced the missing production-start smoke contract;
8. the first diagnostic smoke reached healthy `/health` but falsely required body text `OK`; that assertion was corrected to HTTP-success semantics;
9. corrected full CI passed build, predeploy, production start and `/health`;
10. same-tree retry release `86c668a8d3488d7f0111f2034021839ab4ec10cd` again failed on Railway backend;
11. forward-only rollback release `2b4f20e0678669b23be697b7108bb55510c8554d` used the prior known-good application tree;
12. Railway worker succeeded on the rollback release;
13. Railway backend also failed on the rollback release.

Conclusion: repository code is not sufficient to explain the Railway backend failure. The backend service/environment must be inspected directly.

## Vercel — storefront

**Status: HEALTHY**

Customer storefront continues to deploy successfully from staging pushes.

## Vercel — COQUETTE Studio

**Status: HEALTHY / COMPATIBILITY-SAFE**

Production Studio deployment from `4536ba68…` is READY. Source/public parity and applicable Studio contracts are green.

When the current Railway backend lacks `/admin/studio/archive`, Studio now treats that as an unavailable capability and hides Archive/Restore controls rather than presenting a broken merchant action. Once the backend API is successfully released, the same UI activates automatically.

## Vercel — `backend`

**Status: OBSOLETE / WRONG DEPLOYMENT TARGET / CLEANUP REQUIRED**

This project is not the Medusa runtime. Medusa belongs on Railway. The obsolete project continues to fail and pollutes aggregate GitHub deployment status.

Correct action: remove/disconnect the project or its Git integration. Do not change the Medusa/Railway architecture to satisfy this false signal.

## Railway

**Architecture: CORRECT**  
**Backend deployment: BLOCKED**  
**Release alignment: TEMPORARILY BROKEN**

Canonical topology remains:

- `coquette-backend` — Medusa server;
- `coquette-worker` — Medusa worker;
- dedicated Redis;
- Supabase PostgreSQL/storage;
- migrations server-side only;
- server and worker must run the same controlled release commit.

Current staging release ref: `2b4f20e0678669b23be697b7108bb55510c8554d`.

Current deployment result:

- worker: success;
- backend: failure.

Required evidence to proceed: failed Railway backend deployment **Build Logs / Deploy Logs** and current backend service settings/environment relevant to build, predeploy, start and healthcheck. No further source-code workaround should be invented before those diagnostics are inspected.

## Supabase

**Status: HEALTHY AT AUDIT BASELINE**

Dedicated project:

- name: `coquette`;
- ref: `pijetwrxqznxaoacnakr`;
- PostgreSQL 17;
- `coquette-media` public managed-media bucket;
- `coquette-imports` private reconstruction/import bucket.

The accepted audit baseline contains no real legacy catalogue import. That remains intentional until the verified reconstruction chain reaches the real staging-write gate.

---

# 3. COQUETTE Studio architectural status

Architectural rule:

> COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine and technical administration foundation. Studio must operate through authenticated, constrained Medusa interfaces and must never become a second commerce database or independent system of record.

## Implemented and validated foundations

- branded merchant experience and Today/dashboard direction;
- guarded Quick Draft creation and Guided New Piece flow;
- autosave/resume against Medusa drafts and optimistic concurrency;
- managed media upload, ordering and cover selection;
- fail-closed separation between descriptive autosave and commerce writes;
- reviewed Size/Colour blueprint → real Medusa option/variant graph;
- guarded regular EUR pricing and optional Studio-owned sale pricing;
- guarded SKU/EAN/UPC/barcode management;
- guarded inventory quantities fixed to `COQUETTE Greece`, with backorders off and reservation/incoming values protected;
- guarded category and designer/Brand placement;
- guarded publication/unpublication with explicit status and sales-channel visibility review;
- reversible archive policy layered over Medusa, preserving product/variant/pricing/inventory/media/placement state;
- restoration always returns to editable draft and never republishes automatically;
- deterministic review hashes, locking and stale-write safeguards;
- explicit confirmation for commerce-sensitive writes;
- post-workflow invariant verification;
- clean-database execution contracts and source/deployed static parity checks;
- fail-soft archive capability detection while Railway backend is behind `main`.

## Important lifecycle invariant

Pinned Medusa 2.19 native product statuses remain:

- `draft`
- `proposed`
- `published`
- `rejected`

There is no native `archived` product status. Archive therefore remains a deliberate COQUETTE metadata/policy layer; customer visibility still requires status and sales-channel reasoning separately.

## Still incomplete at the Studio layer

- merchant-facing tax controls where required;
- merchandising/SEO application;
- bulk catalogue operations;
- broader order/customer/refund/fulfillment/payment/shipping/fiscal daily operations;
- scheduled publication only if durable scheduler/persistence is deliberately implemented;
- final merchant UAT.

---

# 4. Recovery and current execution sequence

## 1. Preserve safe merchant compatibility — COMPLETE

PR #87 is merged and Vercel READY. Archive controls stay hidden until the deployed backend exposes the archive capability.

## 2. Diagnose Railway backend deployment — BLOCKING / OWNER-PLATFORM EVIDENCE REQUIRED

Inspect the failed `coquette-backend` deployment Build Logs / Deploy Logs and service settings. The repository already proves the same production artifact can migrate, start and answer `/health` outside Railway.

## 3. Restore backend + worker same-release alignment — REQUIRED BEFORE NEXT BACKEND-DEPENDENT RELEASE

After correcting the Railway service issue:

1. choose the controlled staging application tree;
2. exact-tree validate if necessary;
3. advance `staging` without force;
4. require both backend and worker success on the same release;
5. verify backend `/health` and Store/Admin API behavior;
6. only then mark archive/restore as released and unblock the next backend-dependent Phase 5 work.

## 4. Remove false Vercel backend signal — OPEN / OWNER CLEANUP

Remove/disconnect obsolete Vercel `backend` or its Git integration.

## 5. Acquire real legacy browser capture — NEXT PHASE 4 EXTERNAL BOUNDARY

The authoritative capture must come from an environment/browser satisfying required operator-local provenance.

## 6. Execute real staging reconstruction — NEXT PHASE 4 TECHNICAL CRITICAL PATH

- verified handoff intake;
- evidence-only blocker resolution;
- exact category/Brand/media provisioning;
- verified dependency mapping plan;
- backup/restore rehearsal;
- guarded product import;
- guarded price import;
- reconciliation.

## 7. Continue non-backend-dependent work cautiously

Documentation, storefront-only work, evidence processing and other work that does not assume a newer deployed Medusa API may continue. New backend-dependent Phase 5 releases remain paused until Railway alignment is restored.

---

# 5. Human/external dependencies

## Required now

### Railway backend deployment diagnostics

Provide/access the failed `coquette-backend` deployment Build Logs and Deploy Logs plus relevant service build/start/predeploy/healthcheck configuration. This is the immediate blocker.

### Authoritative legacy browser capture

Still required for the next real Phase 4 reconstruction milestone.

### Account-level cleanup

May require owner UI access:

- remove/disconnect obsolete Vercel `backend`;
- configure appropriate GitHub branch/ruleset protection.

## Not required before safe development continues

Do not change production DNS, disable Magento, activate production payment/AADE/courier credentials, expose staging as production or manually recreate legacy catalogue data.

Magento remains production until Blueprint launch gates pass.

## Later business/account dependencies

Human-approved inputs will eventually be required for shipping policy, production payment/courier/AADE/email credentials, legal/privacy approval, DNS authority and merchant UAT/sign-off.

---

# 6. Definition of being back on track after this incident

The 2026-08-28 Railway incident is resolved only when all of the following are true:

- Railway backend deploys a controlled staging release successfully;
- Railway worker and backend report success on the **same** release commit;
- backend `/health` and required Store/Admin APIs are verified;
- Studio archive capability becomes available without compatibility fallback errors;
- no rollback/force-reset was used to hide history;
- AUDIT, Blueprint and CURRENT_STATUS record the restored release baseline.

Until then, archive/restore remains **implemented and validated on `main`, but not released on Railway**.
