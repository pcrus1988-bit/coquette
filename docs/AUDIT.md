# COQUETTE — AUDIT

**Status:** Canonical project audit and recovery reference  
**Audit date:** 2026-08-27  
**Last verified update:** 2026-08-27  
**Canonical Blueprint:** `docs/ROADMAP.md`  
**Current execution snapshot:** `docs/CURRENT_STATUS.md`  
**Repository:** `pcrus1988-bit/coquette`

Within this project, **AUDIT** means this document.

AUDIT complements the Blueprint: the Blueprint defines intended architecture, delivery phases and acceptance gates; AUDIT records verified current state, drift, corrective actions and external/manual dependencies. `CURRENT_STATUS.md` is the shorter execution snapshot derived from both.

---

## Executive conclusion

COQUETTE has a sound architecture and is materially ahead of several original sequential Blueprint labels, but it is not yet a complete staging shop and is not production-ready.

The major release-topology drift identified at the initial AUDIT boundary has been corrected and the corrected process has now been exercised again successfully for guarded Studio pricing.

### Verified current state

- architecture: consistent with Blueprint;
- merged implementation baseline: `4e6a28c497370ec2e810998841666325762e323f`;
- exact-head Studio Pricing CI: green;
- exact-head Studio CI: green;
- full clean-database COQUETTE CI: green, including real guarded pricing execution;
- Vercel storefront: healthy;
- COQUETTE Studio production deployment: READY on `main` `4e6a28c…`;
- deployed Studio guarded-pricing JavaScript: live HTTP 200;
- Supabase PostgreSQL/storage: isolated and healthy at the verified audit baseline;
- Medusa foundation: healthy;
- controlled Railway release: `358e770cf365f6842568ac6bec01b74d7934f3dc`;
- Railway `coquette-backend`: success on release `358e770…`;
- Railway `coquette-worker`: success on the same release;
- release-head COQUETTE CI: green including deployable Medusa artifact and storefront build;
- Railway `main`/`staging` release-history drift: resolved and release discipline preserved;
- Phase 4U dependency-provisioning evidence: shipped and validated;
- Studio guarded Size/Colour variant generation: shipped and validated;
- Studio guarded regular/sale pricing: shipped, deployed and runtime-aligned;
- real legacy catalogue: not yet written into COQUETTE staging;
- production cutover: intentionally not reached;
- obsolete Vercel `backend`: still present/failing and remains account cleanup, not a Medusa failure.

The next true Phase 4 critical path is authoritative legacy browser capture → verified intake → dependency provisioning → guarded real staging reconstruction. Phase 5 merchant workflows may continue in parallel as long as each backend-dependent merge is deliberately released before dependent work outruns Railway again.

---

# 1. Blueprint position

## Phase 0 — Workspace and isolation

**Status: COMPLETE**

Dedicated repository, database/storage boundaries, environments and project-specific runtime state are in place.

## Phase 1 — Legacy audit / architecture

**Status: COMPLETE; public audit remains continuous**

Medusa v2 + Next.js remains approved. COQUETTE Studio is explicitly the primary merchant experience over Medusa. The public Magento storefront remains the legitimate reconstruction evidence source because private Magento administrative/database/filesystem/API access is unavailable.

## Phase 2 — Executable commerce foundation

**Status: COMPLETE**

Medusa backend/Admin, Next.js storefront, reproducible dependency/build gates, clean database contracts and CI are established.

## Phase 3 — Domain model and managed infrastructure

**Status: TECHNICAL EXIT GATE COMPLETE**

Verified foundation includes dedicated Supabase PostgreSQL/storage, Medusa schema, Designer/Brand and Website Content domains, Greece/EUR region, stock-location/fulfillment foundation, Railway server/worker + Redis, Vercel storefront/Studio and managed S3-compatible media.

Backup/restore rehearsal and repository protection remain operational hardening items.

## Phase 4 — Public legacy reconstruction

**Status: VERY ADVANCED TECHNICALLY; REAL LEGACY DATA NOT YET IMPORTED**

The reconstruction framework covers evidence capture, URL inventory, checksums, products, categories, designers/brands, media, structural plans, pricing, qualitative inventory evidence, review decisions, checksum-bound bundles, handoff creation/intake, dependency reconciliation, dependency provisioning evidence and guarded staging execution.

Verified advancement:

- Phase 4T verified handoff reconciliation intake is shipped;
- Phase 4U dependency-provisioning evidence is shipped;
- no real legacy catalogue reconstruction write has yet been performed against staging.

## Phase 5 — Merchant back-office parity

**Status: MATERIAL IMPLEMENTATION UNDERWAY VIA COQUETTE STUDIO**

COQUETTE Studio is a formal project direction and the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine/API and technical administration foundation.

Verified Phase 5 progression now includes guarded product drafts, governed media, reviewed variant generation and guarded regular/sale pricing.

## Phase 6 onward

Storefront parity, search, cart, checkout and payment foundations are materially ahead of the original sequence, but final acceptance remains blocked on real reconstructed data plus staging E2E/UAT.

---

# 2. Runtime and platform audit

## GitHub

- repository: `pcrus1988-bit/coquette`;
- default implementation branch: `main`;
- current merged application baseline: `4e6a28c497370ec2e810998841666325762e323f`;
- pricing-specific, Studio and full COQUETTE CI all passed on the exact pricing implementation tree;
- controlled release commit: `358e770cf365f6842568ac6bec01b74d7934f3dc`;
- release-head full COQUETTE CI passed;
- aggregate deployment status can still appear red because of obsolete Vercel `backend`;
- branch/ruleset protection remains account-level hardening.

### Release-branch drift — RESOLVED AND PROCESS REUSED SUCCESSFULLY

Initial AUDIT found `main` and Railway release branch `staging` badly diverged.

Recovery and subsequent release discipline:

1. histories were reconciled through controlled merges, never force-resetting staging;
2. backend and worker were verified together on the reconciled release;
3. Phase 4U and guarded variant generation were exact-head validated and released;
4. guarded Studio pricing was exact-head validated and merged as `4e6a28c…`;
5. release commit `358e770…` was created with the prior staging release and current `main` as parents while using the exact validated application tree;
6. `staging` advanced by fast-forward;
7. release-head full CI passed;
8. both Railway backend and worker succeeded on `358e770…`.

This demonstrates the recovery process is now a working release discipline, not merely a one-time repair.

## Vercel — storefront

**Status: HEALTHY**

Customer storefront deploys successfully.

## Vercel — COQUETTE Studio

**Status: HEALTHY / GUARDED PRICING LIVE**

Production Studio deployed merged `main` `4e6a28c…` successfully. The new guarded pricing asset is directly served with HTTP 200. Studio's backend-dependent pricing surface is aligned with Railway release `358e770…`.

## Vercel — `backend`

**Status: OBSOLETE / WRONG DEPLOYMENT TARGET / CLEANUP REQUIRED**

This project is not the Medusa runtime. Medusa belongs on Railway. The obsolete project fails because it is configured as a Vite/static-style deployment and pollutes aggregate GitHub deployment status.

Correct action: remove/disconnect the project or its Git integration. Do not change the Medusa/Railway architecture to satisfy this false signal.

## Railway

**Architecture: HEALTHY**  
**Release alignment: RESTORED AND CURRENT**

Canonical topology:

- `coquette-backend` — Medusa server;
- `coquette-worker` — Medusa worker;
- dedicated Redis;
- Supabase PostgreSQL/storage;
- migrations server-side only;
- server and worker on the same controlled release commit.

Current verified release: `358e770cf365f6842568ac6bec01b74d7934f3dc`.

Both backend and worker report success on that release.

## Supabase

**Status: HEALTHY AT AUDIT BASELINE**

Dedicated project:

- name: `coquette`;
- ref: `pijetwrxqznxaoacnakr`;
- PostgreSQL 17;
- `coquette-media` public managed-media bucket;
- `coquette-imports` private reconstruction/import bucket.

The accepted audit baseline contained no real legacy catalogue import. That remains intentional until the verified reconstruction chain reaches the real staging-write gate.

---

# 3. COQUETTE Studio architectural status

Architectural rule:

> COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine and technical administration foundation. Studio must operate through authenticated, constrained Medusa interfaces and must never become a second commerce database or independent system of record.

## Implemented/merged/released foundations

- branded merchant experience;
- Today/dashboard direction;
- guarded Quick Draft product creation;
- Guided New Piece editorial flow;
- autosave/resume against Medusa drafts;
- optimistic concurrency;
- managed media upload, ordering and cover selection;
- fail-closed separation between descriptive autosave and commerce writes;
- human Size/Colour blueprint review;
- guarded conversion into real Medusa option/variant graphs;
- locking, hash/fingerprint and stale-write safeguards;
- post-workflow structural verification;
- guarded regular EUR price workflows;
- uniform and explicit per-variant price modes;
- optional lower sale pricing through a dedicated Studio-owned active Medusa sale price list;
- current → intended pricing review plus deterministic SHA-256 review hash;
- final explicit apply confirmation and immediate pre-write re-review;
- protection against conditional pricing and active foreign sale pricing;
- compensating Medusa workflow boundary for regular + sale mutations;
- clean-database execution proving create/update/idempotency/sale removal while draft/inventory/backorder invariants remain unchanged;
- source/deployed Studio static parity validation.

## Still incomplete at the Studio layer

- SKU/EAN/UPC/barcode management;
- inventory quantities/location policy;
- category/designer application;
- merchant-facing tax controls where required;
- merchandising/SEO application;
- explicit publish/schedule/archive lifecycle;
- broader order/customer/refund/fulfillment/payment/shipping/fiscal daily operations;
- final merchant UAT.

---

# 4. Recovery and current execution sequence

## 1. Restore deployment topology alignment — RESOLVED

Controlled `main` → `staging` release history is restored and has now been reused successfully for the guarded-pricing release.

## 2. Remove false Vercel backend signal — OPEN / OWNER CLEANUP

The obsolete Vercel `backend` continues to fail. Connected tooling does not expose project deletion/disconnection, so removal remains an account-level UI action.

## 3. Keep backend-dependent Studio work release-aligned — ACTIVE STANDING RULE

Every backend-dependent Studio phase must follow:

1. exact-head feature validation;
2. merge to `main`;
3. controlled staging release using the exact validated tree;
4. release-head CI;
5. backend + worker same-release success;
6. only then allow the next dependent phase to assume the new API is deployed.

The pricing release has passed this complete sequence.

## 4. Synchronize project documentation — ACTIVE

Canonical references remain `ROADMAP.md`, `AUDIT.md` and `CURRENT_STATUS.md`. Verified advancement should be recorded promptly so phase labels do not drift from shipped reality.

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

## 7. Continue Phase 5 merchant workflow parity — NEXT NON-BLOCKED DEVELOPMENT TRACK

The next bounded Studio workflow is variant identity: explicit SKU/EAN/UPC/barcode management, followed by guarded inventory quantities/location policy.

---

# 5. Human/external dependencies

## Needed for Phase 4

### Authoritative legacy browser capture

This remains the principal unavoidable external acquisition boundary.

### Account-level cleanup

May require owner UI access:

- remove/disconnect obsolete Vercel `backend`;
- configure appropriate GitHub branch/ruleset protection.

## Not required before development continues

Do not yet change production DNS, disable Magento, activate production payment/AADE/courier credentials, expose staging as production or manually recreate legacy catalogue data.

Magento remains production until Blueprint launch gates pass.

## Later business/account dependencies

Human-approved inputs will eventually be required for shipping policy, production payment/courier/AADE/email credentials, legal/privacy approval, DNS authority and merchant UAT/sign-off.

---

# 6. Definition of being back on track

The original AUDIT recovery objective is operationally satisfied.

Verified invariants:

- `main` is the validated implementation baseline;
- Railway `staging` is a deliberate release history rather than stale parallel development;
- Railway server and worker run the same successful current release;
- storefront and Studio are compatible with the released Medusa API surface;
- guarded pricing demonstrated that the controlled release process works for new backend-dependent Studio features;
- the Phase 4 critical path is real legacy capture/import rather than infrastructure drift.

Remaining housekeeping does not block safe development but must not be forgotten:

- remove obsolete Vercel `backend` false signal;
- configure repository protection where owner permissions allow;
- keep Blueprint/AUDIT/CURRENT_STATUS synchronized as implementation advances.
