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

The release-topology drift identified at the initial AUDIT boundary is corrected. The controlled release discipline has now been exercised successfully through guarded Studio variants, regular/sale pricing, variant identifiers, inventory quantity/location policy and category/designer placement.

### Verified current state

- architecture: consistent with Blueprint;
- merged application implementation baseline: `71aa81d9ff4281ecf04fadbb16accb58a2ead0f3`;
- guarded category/designer placement: PR #82 merged;
- exact-head Studio Placement Taxonomy CI: green;
- pricing, identifier, inventory and core Studio compatibility CI: green;
- full clean-database COQUETTE CI: green on the feature tree and exact controlled-release tree;
- exact release application tree: `1643c4308932e18b12bec3c2fb9bc77e559f2836`;
- controlled Railway release: `d450b35edc6e750004df72452950f9246ae3ffff`;
- Railway `coquette-backend`: success on `d450b35e…` at `coquette-backend-production-8b4f.up.railway.app`;
- Railway `coquette-worker`: success on the same release;
- Vercel storefront: healthy; staging release deployment succeeded;
- COQUETTE Studio production deployment: READY from merged `main` `71aa81d9…`;
- Supabase PostgreSQL/storage: isolated and healthy at the verified audit baseline;
- Medusa foundation: healthy;
- Railway `main`/`staging` release-history drift: resolved and release discipline preserved;
- Phase 4U dependency-provisioning evidence: shipped and validated;
- Studio guarded Size/Colour variant generation: shipped and validated;
- Studio guarded regular/sale pricing: shipped, deployed and runtime-aligned;
- Studio guarded SKU/EAN/UPC/barcode management: shipped, deployed and runtime-aligned;
- Studio guarded inventory quantity/location policy: shipped, deployed and runtime-aligned;
- Studio guarded category/designer placement: shipped, deployed and runtime-aligned;
- real legacy catalogue: not yet written into COQUETTE staging;
- production cutover: intentionally not reached;
- obsolete Vercel `backend`: still present/failing and remains account cleanup, not a Medusa failure.

The next true Phase 4 critical path is authoritative legacy browser capture → verified intake → dependency provisioning → guarded real staging reconstruction. Phase 5 merchant workflows may continue in parallel as long as each backend-dependent merge follows the verified controlled-release discipline.

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

COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine/API and technical administration foundation.

Verified Phase 5 progression includes guarded product drafts, governed media, reviewed variant generation, guarded regular/sale pricing, guarded identifiers, guarded inventory quantity/location management and guarded category/designer application.

Remaining Phase 5 catalogue gaps are guarded publication/unpublication lifecycle, explicit archive policy, merchant-facing tax controls where required, merchandising/SEO application and bulk operations. Broader order/customer/refund/fulfillment/payment/shipping/fiscal operations and merchant UAT also remain.

## Phase 6 onward

Storefront parity, search, cart, checkout and payment foundations are materially ahead of the original sequence, but final acceptance remains blocked on real reconstructed data plus staging E2E/UAT.

---

# 2. Runtime and platform audit

## GitHub

- repository: `pcrus1988-bit/coquette`;
- default implementation branch: `main`;
- current merged application implementation baseline: `71aa81d9ff4281ecf04fadbb16accb58a2ead0f3`;
- Studio placement, pricing, identifiers, inventory and full COQUETTE CI passed on the exact application tree;
- controlled release commit: `d450b35edc6e750004df72452950f9246ae3ffff`;
- exact-tree release validation used structurally identical two-parent candidates carrying tree `1643c4308932e18b12bec3c2fb9bc77e559f2836` before `staging` moved;
- release-head full COQUETTE CI passed including deployable Medusa artifact and storefront build;
- aggregate deployment status can still appear red because of obsolete Vercel `backend`;
- branch/ruleset protection remains account-level hardening.

### Release-branch drift — RESOLVED AND PROCESS REUSED SUCCESSFULLY

Initial AUDIT found `main` and Railway release branch `staging` badly diverged.

Recovery and subsequent release discipline:

1. histories were reconciled through controlled merges, never force-resetting staging;
2. backend and worker were verified together on the reconciled release;
3. Phase 4U and guarded variant generation were exact-head validated and released;
4. guarded Studio pricing was exact-head validated, merged and released;
5. guarded identifiers were exact-head validated, merged and released;
6. guarded inventory quantity/location management was exact-head validated, merged and released;
7. guarded category/designer placement was exact-head validated and merged as `71aa81d9…`;
8. a two-parent exact-tree validation candidate preserved previous staging `30084ff1…` and current main `71aa81d9…` before release promotion;
9. exact-tree full CI passed, including deployable Railway artifact and storefront build;
10. final two-parent release `d450b35e…` used the same tree and parents;
11. `staging` advanced without force;
12. both Railway backend and worker succeeded on `d450b35e…`.

This demonstrates the recovery process is now a working release discipline rather than a one-time repair.

## Vercel — storefront

**Status: HEALTHY**

Customer storefront deploys successfully. The staging release deployment for `d450b35e…` also completed successfully.

## Vercel — COQUETTE Studio

**Status: HEALTHY / CURRENT PRODUCT WORKFLOW LIVE**

Production Studio deployed merged `main` `71aa81d9…` successfully and is READY. Source/public Studio asset parity and feature contracts are green. Direct asset retrieval from the protected deployment requires Vercel access, so deployment readiness and repository parity—not a fabricated public HTTP assertion—are the verified signals.

## Vercel — `backend`

**Status: OBSOLETE / WRONG DEPLOYMENT TARGET / CLEANUP REQUIRED**

This project is not the Medusa runtime. Medusa belongs on Railway. The obsolete project continues to fail and pollutes aggregate GitHub deployment status.

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

Current verified release: `d450b35edc6e750004df72452950f9246ae3ffff`.

Both backend and worker report success on that release. Backend public runtime: `coquette-backend-production-8b4f.up.railway.app`.

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

## Implemented/merged/released foundations

- branded merchant experience and Today/dashboard direction;
- guarded Quick Draft creation and Guided New Piece flow;
- autosave/resume against Medusa drafts and optimistic concurrency;
- managed media upload, ordering and cover selection;
- fail-closed separation between descriptive autosave and commerce writes;
- reviewed Size/Colour blueprint → real Medusa option/variant graph;
- guarded regular EUR pricing and optional Studio-owned sale pricing;
- guarded SKU/EAN/UPC/barcode management;
- guarded inventory quantities fixed to `COQUETTE Greece`, with backorders off and reservation/incoming values protected;
- guarded existing category application, excluding internal/inactive categories;
- guarded existing designer assignment/replacement/removal through the Brand module;
- deterministic review hashes, locking and stale-write safeguards;
- explicit final confirmation for commerce-sensitive writes;
- post-workflow invariant verification;
- clean-database execution contracts and source/deployed static parity checks.

## Lifecycle findings that constrain the next implementation

Pinned Medusa 2.19 defines native product statuses only as:

- `draft`
- `proposed`
- `published`
- `rejected`

There is no native `archived` product status.

Pinned Medusa 2.19 Store Product middleware defaults customer-facing retrieval to `published` products and additionally filters by valid sales channels. Therefore:

- Studio `Publish` must review status and sales-channel exposure separately;
- changing status alone must not be treated as the full visibility contract;
- archive requires an explicit COQUETTE policy rather than a fabricated Medusa status;
- scheduled publication must remain separate until durable scheduling/persistence is deliberately designed.

## Still incomplete at the Studio layer

- guarded publication/unpublication lifecycle and visibility review;
- explicit archive semantics;
- scheduled publication, if retained as a requirement, with durable scheduler/persistence;
- merchant-facing tax controls where required;
- merchandising/SEO application;
- bulk catalogue operations;
- broader order/customer/refund/fulfillment/payment/shipping/fiscal daily operations;
- final merchant UAT.

---

# 4. Recovery and current execution sequence

## 1. Restore deployment topology alignment — RESOLVED

Controlled `main` → `staging` release history is restored and has been reused successfully through category/designer placement.

## 2. Remove false Vercel backend signal — OPEN / OWNER CLEANUP

The obsolete Vercel `backend` continues to fail. Connected tooling does not expose project deletion/disconnection, so removal remains an account-level UI action.

## 3. Keep backend-dependent Studio work release-aligned — ACTIVE STANDING RULE

Every backend-dependent Studio phase must follow:

1. exact-head feature validation;
2. merge to `main`;
3. controlled two-parent exact-tree staging release validation;
4. final release commit preserving staging history;
5. backend + worker same-release success;
6. only then allow the next dependent phase to assume the new API is deployed.

The placement release has passed this complete sequence.

## 4. Synchronize project documentation — ACTIVE

Canonical references remain `ROADMAP.md`, `AUDIT.md` and `CURRENT_STATUS.md`. This update records the shipped identifiers, inventory and category/designer milestones plus release `d450b35e…`.

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

The next bounded Studio workflow is guarded publication/unpublication readiness and customer-visibility review. Archive semantics must be designed separately because Medusa 2.19 has no native archived product status.

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
- Railway server and worker run the same successful current release `d450b35e…`;
- storefront and Studio are compatible with the released Medusa API surface;
- variants, pricing, identifiers, inventory and category/designer placement all passed the controlled release model;
- the Phase 4 critical path is real legacy capture/import rather than infrastructure drift.

Remaining housekeeping does not block safe development but must not be forgotten:

- remove obsolete Vercel `backend` false signal;
- configure repository protection where owner permissions allow;
- keep Blueprint/AUDIT/CURRENT_STATUS synchronized as implementation advances.
