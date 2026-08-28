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

COQUETTE remains architecturally sound and materially advanced beyond the original sequential Blueprint labels. It is not yet a complete staging shop and is not production-ready because authoritative real legacy data, broader merchant operations, provider E2E/UAT and cutover gates remain.

The 2026-08-28 Railway backend deployment incident is **resolved**. The failure was isolated to Railway's build infrastructure, not demonstrated to be a COQUETTE or Medusa defect.

### Incident proof and recovery

- PR #85 archive/restore implementation passed its dedicated runtime contract and exact-tree release validation;
- the initial archive release and same-tree retry failed on Railway backend while worker behavior showed the application tree itself was not sufficient to explain the failure;
- a forward-only rollback carrying the prior known-good application tree also failed on Railway backend;
- PR #86 permanently added a Railway-equivalent production runtime smoke gate: production artifact build → predeploy migrations → built production server start → HTTP 2xx `/health`;
- that runtime contract is green;
- the decisive Railway Build Log reported a timeout fetching `https://registry-1.docker.io/v2/library/alpine/manifests/latest` from Railway's build daemon;
- repository inspection found no `alpine:latest` or `FROM alpine` application reference;
- no Deploy Logs existed because image build had not completed;
- exact-same-tree recovery release `eb03c253919171dd6d5c0a96d253b70174ee8afb` then succeeded on both Railway backend and worker without an application change;
- current `main` tree was re-promoted through an exact-tree candidate and final history-preserving release;
- all 8 applicable candidate workflows succeeded;
- final release `ae4d971b0a4e30882474e81a769c5f0a32268eda` succeeded on both Railway backend and worker;
- storefront deployment also succeeded;
- issue #89 was closed as completed.

The transient Railway builder / Docker Hub connectivity incident is therefore closed. No architecture change or speculative Medusa workaround was required.

### Verified current state

- architecture: consistent with Blueprint;
- current `main`: `23b66c145cf128c4eec2f1d269c8d04e2f2d394a`;
- current validated tree: `ffab2f2f15f0bd3910a38acd67c7c84837edba31`;
- guarded publication/unpublication lifecycle: merged, validated and release-aligned;
- guarded archive/restore policy: PR #85 merged, validated and Railway-released;
- production-runtime smoke gate: PR #86 merged as `e72534dc4a35752a785c75986ef04aa94779b32c`;
- Studio fail-soft archive/backend compatibility: PR #87 merged as `4536ba68…` and deployed READY on Vercel;
- canonical status synchronization: PR #88 merged as `23b66c14…`;
- recovered Railway same-tree baseline: `eb03c253…`, backend SUCCESS + worker SUCCESS;
- archive recovery candidate: `aabe3c1af20ccc545a54dd0c36bd55682ce42e32`, all 8 applicable workflows SUCCESS;
- current Railway `staging` release: `ae4d971b0a4e30882474e81a769c5f0a32268eda`;
- Railway `coquette-backend`: SUCCESS on `ae4d971b…`;
- Railway `coquette-worker`: SUCCESS on `ae4d971b…`;
- server/worker same-release invariant: SATISFIED;
- Vercel storefront: SUCCESS on the final release;
- COQUETTE Studio production: READY with capability fallback;
- Supabase PostgreSQL/storage: isolated and healthy at the verified audit baseline;
- Medusa build/migration/runtime artifact: green in CI, including actual production start and HTTP-health smoke;
- real legacy catalogue: not yet written into COQUETTE staging;
- production cutover: intentionally not reached;
- obsolete Vercel `backend`: still present and remains cleanup noise, tracked in issue #90.

**Current governing rule:** backend-dependent Phase 5 progression may resume, but each new workflow must continue to use the established exact-head → exact-tree candidate → history-preserving staging release → backend/worker same-release verification discipline.

---

# 1. Blueprint position

## Phase 0 — Workspace and isolation

**Status: COMPLETE**

Dedicated repository, database/storage boundaries, environments and project-specific runtime state are in place.

## Phase 1 — Legacy audit / architecture

**Status: COMPLETE; PUBLIC AUDIT REMAINS CONTINUOUS**

Medusa v2 + Next.js remains approved. COQUETTE Studio is the primary merchant experience over Medusa. The public Magento storefront remains the legitimate reconstruction evidence source because private Magento administrative/database/filesystem/API access is unavailable.

## Phase 2 — Executable commerce foundation

**Status: COMPLETE**

Medusa backend/Admin, Next.js storefront, reproducible dependency/build gates, clean database contracts and CI are established. PR #86 closes the former gap between “build succeeds” and “server actually starts” by exercising the built production server through predeploy and HTTP-health verification.

## Phase 3 — Domain model and managed infrastructure

**Status: TECHNICAL EXIT GATE COMPLETE; RELEASE ALIGNMENT HEALTHY**

Verified foundation includes dedicated Supabase PostgreSQL/storage, Medusa schema, Designer/Brand and Website Content domains, Greece/EUR region, stock-location/fulfillment foundation, Railway server/worker + Redis, Vercel storefront/Studio and managed S3-compatible media.

Railway backend and worker are again aligned on controlled release `ae4d971b…`.

Backup/restore rehearsal and repository protection remain operational hardening items before launch.

## Phase 4 — Public legacy reconstruction

**Status: VERY ADVANCED TECHNICALLY; REAL LEGACY DATA NOT YET IMPORTED**

The reconstruction framework covers evidence capture, URL inventory, checksums, products, categories, designers/brands, media, structural plans, pricing, qualitative inventory evidence, review decisions, checksum-bound bundles, handoff creation/intake, dependency reconciliation, dependency provisioning evidence and guarded staging execution.

Verified advancement:

- Phase 4T verified handoff reconciliation intake is shipped;
- Phase 4U dependency-provisioning evidence is shipped;
- no real legacy catalogue reconstruction write has yet been performed against staging.

The next unavoidable Phase 4 boundary remains authoritative legacy browser capture followed by verified intake and guarded real staging reconstruction.

## Phase 5 — Merchant back-office parity

**Status: MATERIAL IMPLEMENTATION SHIPPED; CURRENT CATALOGUE API RELEASE-ALIGNED**

COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine/API and technical administration foundation.

Verified implementation and current release coverage now includes:

- guarded product drafts and governed media;
- reviewed Size/Colour variant generation;
- guarded regular/sale pricing;
- guarded SKU/EAN/UPC/barcode identifiers;
- guarded inventory quantity/location policy;
- guarded category/designer placement;
- guarded publication/unpublication lifecycle and customer-visibility review;
- explicit reversible archive/restore policy with restore-to-draft semantics;
- Studio capability fallback that hides archive controls if a future deployed backend lacks the archive API.

Archive/restore is now considered **Railway-released** in `ae4d971b…` because backend and worker both succeeded on the exact controlled release after 8/8 candidate gates passed.

Remaining Phase 5 catalogue work includes merchant-facing tax controls where required, merchandising/SEO application and bulk operations. Broader order/customer/refund/fulfillment/payment/shipping/fiscal operations and merchant UAT also remain.

## Phase 6 onward

Storefront parity, search, cart, checkout and payment foundations are materially ahead of the original sequence, but final acceptance remains blocked on real reconstructed data plus staging E2E/UAT.

---

# 2. Runtime and platform audit

## GitHub

- repository: `pcrus1988-bit/coquette`;
- default implementation branch: `main`;
- current implementation/documentation head before this status update: `23b66c145cf128c4eec2f1d269c8d04e2f2d394a`;
- PR #85: guarded archive/restore policy merged;
- PR #86: Railway-equivalent production runtime health smoke merged;
- PR #87: Studio archive/backend compatibility merged;
- PR #88: canonical documentation synchronized through the incident boundary;
- all archive-recovery candidate workflows passed on exact tree `ffab2f2f…`;
- full CI verifies production build, predeploy, actual production-server startup and HTTP-health;
- aggregate status may still appear red because of obsolete Vercel `backend`;
- branch/ruleset protection remains account-level hardening.

### Release history and 2026-08-28 recovery

Before the builder incident, controlled release history had already been reconciled and reused successfully through lifecycle release work.

Archive incident and recovery sequence:

1. PR #85 merged guarded archive/restore to `main`;
2. original exact-tree two-parent archive candidate passed all applicable workflows;
3. release `fb3a931349f52457135300393bd67edf56c554ce` advanced `staging` without force; worker succeeded, backend failed;
4. PR #86 introduced the production-start smoke contract and corrected it to HTTP-success semantics;
5. same-tree retry `86c668a8d3488d7f0111f2034021839ab4ec10cd` again failed on Railway backend;
6. forward-only rollback `2b4f20e0678669b23be697b7108bb55510c8554d` carried the prior known-good application tree; worker succeeded and backend failed;
7. Railway Build Logs identified a build-daemon Docker Hub manifest timeout before deploy;
8. no application Alpine reference was present in the repository;
9. exact-same-tree retry `eb03c253919171dd6d5c0a96d253b70174ee8afb` succeeded on backend and worker without source changes;
10. exact-tree recovery candidate `aabe3c1af20ccc545a54dd0c36bd55682ce42e32` used tree `ffab2f2f15f0bd3910a38acd67c7c84837edba31`, first parent recovered staging `eb03c253…`, second parent current main `23b66c14…`;
11. all 8 applicable workflows succeeded, including production artifact/runtime smoke and storefront build;
12. distinct final release `ae4d971b0a4e30882474e81a769c5f0a32268eda` used the same tree and ordered parents;
13. `staging` advanced without force;
14. Railway backend and worker both succeeded on `ae4d971b…`;
15. Vercel storefront succeeded;
16. issue #89 closed as completed.

This reconfirms that the release discipline is both history-preserving and capable of distinguishing application defects from external platform incidents.

## Vercel — storefront

**Status: HEALTHY**

Customer storefront deploys successfully. The final archive recovery release deployment succeeded.

## Vercel — COQUETTE Studio

**Status: HEALTHY / COMPATIBILITY-SAFE**

Production Studio from PR #87 is READY. Source/public parity and applicable Studio contracts are green.

The archive capability fallback remains valuable even though the current Railway backend now contains the archive API: if the API is absent in a future backend, Studio hides Archive/Restore rather than presenting a broken merchant action.

## Vercel — `backend`

**Status: OBSOLETE / WRONG DEPLOYMENT TARGET / CLEANUP REQUIRED**

This Vercel project is not the Medusa runtime. Medusa belongs on Railway. The obsolete project may succeed or fail independently and pollutes aggregate GitHub deployment status.

Correct action: remove/disconnect the project or its Git integration. Tracked in issue #90. Do not change the Medusa/Railway architecture to satisfy this false signal.

## Railway

**Architecture: CORRECT**  
**Backend deployment: HEALTHY**  
**Release alignment: RESTORED**

Canonical topology:

- `coquette-backend` — Medusa server;
- `coquette-worker` — Medusa worker;
- dedicated Redis;
- Supabase PostgreSQL/storage;
- migrations server-side only;
- server and worker run the same controlled release commit.

Current staging release: `ae4d971b0a4e30882474e81a769c5f0a32268eda`.

Deployment result:

- backend: SUCCESS;
- worker: SUCCESS;
- storefront: SUCCESS.

The release candidate also passed the Railway-equivalent build/predeploy/start/HTTP-health contract in GitHub CI. A separate external HTTP health assertion is not fabricated where the current tool runtime cannot resolve the Railway hostname; the verified Railway deployment states and CI runtime contract are the recorded evidence.

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

## Implemented, validated and currently release-aligned foundations

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
- fail-soft archive capability detection across frontend/backend release differences.

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

PR #87 is merged and Vercel READY. Capability fallback remains in place even though the current backend now exposes archive/restore.

## 2. Diagnose Railway backend deployment — COMPLETE

The supplied Railway Build Log identified the causal Docker Hub timeout before deploy. Repository code did not contain the referenced Alpine base. No application workaround was required.

## 3. Restore backend + worker same-release alignment — COMPLETE

Recovery release `eb03c253…` proved the unchanged known-good tree could deploy once Railway connectivity recovered. Final archive-capable release `ae4d971b…` then restored the fully validated current tree with backend and worker both successful.

## 4. Remove false Vercel backend signal — OPEN / OWNER CLEANUP

Remove/disconnect obsolete Vercel `backend` or its Git integration. Tracked in issue #90.

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

## 7. Continue Phase 5 backend-dependent parity — UNBLOCKED

The next bounded catalogue workflow is merchant-facing tax controls where appropriate. It must use native Medusa tax constructs, remain reviewable/fail-closed and must not invent tax treatment or fiscal facts.

Then continue merchandising/SEO application, bulk operations and broader daily commerce workflows under the same release discipline.

---

# 5. Human/external dependencies

## Required for the next major Phase 4 milestone

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

# 6. Definition of being back on track after the Railway incident

**SATISFIED.**

Verified recovery invariants:

- Railway backend deployed a controlled staging release successfully;
- Railway worker and backend succeeded on the same release `ae4d971b…`;
- exact candidate CI passed production build, predeploy, server start and HTTP-health smoke;
- archive/restore is included in the released tree;
- no force-reset or history rewrite was used;
- the transient Railway builder failure and recovery evidence are recorded in closed issue #89;
- AUDIT, Blueprint and CURRENT_STATUS are being synchronized to the restored release baseline.

Archive/restore is therefore **implemented, validated and released on Railway**. New backend-dependent Phase 5 work may resume under the established controlled-release rules.
