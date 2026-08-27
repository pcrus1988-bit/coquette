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

The major release-topology drift identified at the initial AUDIT boundary has now been corrected.

### Verified current state

- architecture: consistent with Blueprint;
- GitHub application baseline and CI: green on the validated merged application head;
- Vercel storefront: healthy;
- COQUETTE Studio: healthy and formally part of Phase 5 architecture;
- Supabase PostgreSQL/storage: isolated and healthy;
- Medusa foundation: healthy;
- Railway `coquette-backend`: healthy on release commit `398074bc5355b80a318b0b5f8637272ee8566976`;
- Railway `coquette-worker`: healthy on the same release commit;
- Railway `main`/`staging` release-history drift: **resolved through controlled merge/release operations**;
- Phase 4U dependency-provisioning evidence: shipped and validated;
- Studio guarded Size/Colour variant generation: shipped and validated;
- real legacy catalogue: not yet written into COQUETTE staging;
- production cutover: intentionally not reached;
- obsolete Vercel `backend`: still present/failing and remains a cleanup item, not a real backend failure.

The next true critical path is no longer infrastructure drift. It is the authoritative legacy browser capture → verified intake → dependency provisioning → guarded real staging reconstruction.

---

# 1. Blueprint position

## Phase 0 — Workspace and isolation

**Status: COMPLETE**

Dedicated repository, database/storage boundaries, environments and project-specific runtime state are in place.

## Phase 1 — Legacy audit / architecture

**Status: COMPLETE; public audit remains continuous**

Medusa v2 + Next.js remains approved. COQUETTE Studio is now explicitly the primary merchant experience over Medusa. The public Magento storefront remains the legitimate reconstruction evidence source because private Magento administrative/database/filesystem/API access is unavailable.

## Phase 2 — Executable commerce foundation

**Status: COMPLETE**

Medusa backend/Admin, Next.js storefront, reproducible dependency/build gates, clean database contracts and CI are established.

## Phase 3 — Domain model and managed infrastructure

**Status: TECHNICAL EXIT GATE COMPLETE**

Verified foundation includes:

- dedicated Supabase PostgreSQL/storage;
- Medusa schema;
- Designer/Brand and Website Content domains;
- Greece/EUR region;
- stock-location/fulfillment foundation;
- Railway server/worker + dedicated Redis;
- Vercel storefront/Studio surfaces;
- managed S3-compatible media.

Operational hardening such as backup/restore rehearsal and repository protection remains outstanding.

## Phase 4 — Public legacy reconstruction

**Status: VERY ADVANCED TECHNICALLY; REAL LEGACY DATA NOT YET IMPORTED**

The reconstruction framework covers evidence capture, URL inventory, checksums, products, categories, designers/brands, media, structural plans, pricing, qualitative inventory evidence, review decisions, checksum-bound bundles, handoff creation/intake, dependency reconciliation, dependency provisioning evidence and guarded staging execution.

### Corrected phase drift

- Phase 4T verified handoff reconciliation intake is shipped.
- Phase 4U dependency-provisioning evidence is shipped.
- no real legacy catalogue reconstruction write has yet been performed against staging.

## Phase 5 — Merchant back-office parity

**Status: MATERIAL IMPLEMENTATION UNDERWAY VIA COQUETTE STUDIO**

COQUETTE Studio is now a formal project direction, not an incidental feature. It is the primary day-to-day merchant experience while Medusa remains the authoritative commerce engine/API and technical administration foundation.

## Phase 6 onward

Storefront parity, search, cart, checkout and payment foundations are materially ahead of the original sequence, but final acceptance remains blocked on real reconstructed data plus staging E2E/UAT.

---

# 2. Runtime and platform audit

## GitHub

- repository: `pcrus1988-bit/coquette`;
- default implementation branch: `main`;
- validated application merge: `7a50b104de1af1f34479ec92c218a880bab01ebb`;
- exact-head COQUETTE CI: green on that application merge;
- exact-head COQUETTE Studio CI: green on that application merge;
- aggregate deployment status can still appear red because of obsolete Vercel `backend`;
- branch/ruleset protection remains an account-level hardening item.

### Release-branch drift — RESOLVED

Initial AUDIT found `main` and Railway release branch `staging` badly diverged.

Recovery actions completed:

1. histories were reconciled through normal controlled merges rather than force-resetting `staging`;
2. Railway picked up the reconciled staging release;
3. backend and worker both completed successfully;
4. Phase 4U was then validated/merged to `main`;
5. Studio guarded variant generation was refreshed onto current `main`, revalidated and merged;
6. a second controlled staging release was issued;
7. both Railway services now report success on the same release commit `398074bc5355b80a318b0b5f8637272ee8566976`.

This restores the invariant that Railway staging is a deliberate release of validated implementation state rather than a stale parallel history.

## Vercel — storefront

**Status: HEALTHY**

Customer storefront deploys successfully.

## Vercel — COQUETTE Studio

**Status: HEALTHY**

Studio's shipped backend-dependent functionality is now aligned with the released Railway Medusa API surface after the controlled release recovery.

## Vercel — `backend`

**Status: OBSOLETE / WRONG DEPLOYMENT TARGET / CLEANUP REQUIRED**

This project is not the Medusa runtime. Medusa belongs on Railway. The obsolete project fails its builds and pollutes GitHub deployment status.

Correct action: remove/disconnect the project or its Git integration. Do not move Medusa to Vercel merely to satisfy this false signal.

## Railway

**Architecture: HEALTHY**  
**Release alignment: RESTORED**

Canonical topology:

- `coquette-backend` — Medusa server;
- `coquette-worker` — Medusa worker;
- dedicated Redis;
- Supabase PostgreSQL/storage;
- migrations server-side only;
- server and worker on the same controlled release commit.

Current verified release commit: `398074bc5355b80a318b0b5f8637272ee8566976`.

Both backend and worker report success on that release.

## Supabase

**Status: HEALTHY AT AUDIT BASELINE**

Dedicated project:

- name: `coquette`;
- ref: `pijetwrxqznxaoacnakr`;
- PostgreSQL 17;
- `coquette-media` public managed-media bucket;
- `coquette-imports` private reconstruction/import bucket.

Audit baseline had zero real legacy Products/Product Variants/Brands imported. This is intentional until the verified reconstruction chain reaches the real staging-write gate.

The security advisor had no high-severity security lint at the audit boundary. Low-value unused-index/unindexed-FK observations on an essentially empty Medusa staging database are not launch blockers and Medusa-generated indexes must not be removed only to silence advisory noise.

---

# 3. COQUETTE Studio architectural status

Architectural rule:

> COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine and technical administration foundation. Studio must operate through authenticated, constrained Medusa interfaces and must never become a second commerce database or independent system of record.

Implemented/merged foundations include:

- branded merchant experience;
- Today/dashboard direction;
- guarded Quick Draft product creation;
- Guided New Piece editorial flow;
- autosave/resume against Medusa drafts;
- optimistic concurrency;
- managed media upload, ordering and cover selection;
- fail-closed guards against accidental price/inventory/publication/sales-channel mutations;
- human Size/Colour blueprint review;
- guarded conversion into real Medusa option/variant graphs;
- locking, hash/fingerprint and stale-write safeguards;
- post-workflow structural verification;
- source/deployed Studio static parity validation.

Still incomplete at the Studio layer:

- regular/sale pricing workflows;
- SKU/barcode management;
- inventory quantities/location policy;
- category/designer application;
- merchandising/SEO application;
- explicit publish/schedule/archive lifecycle;
- broader order/customer/refund/fulfillment/payment/shipping/fiscal daily operations;
- final merchant UAT.

---

# 4. Recovery sequence status

## 1. Restore deployment topology alignment — RESOLVED

- controlled `main` → `staging` reconciliation complete;
- exact-head validation enforced before releases;
- backend/worker same-release success confirmed;
- Studio backend/API compatibility restored to released state.

## 2. Remove false Vercel backend signal — OPEN

- obsolete Vercel `backend` still fails;
- removal/disconnection remains account cleanup if connected tooling cannot perform deletion.

## 3. Reconcile current implementation work — RESOLVED

- Phase 4U merged after validation;
- Studio guarded variant generation refreshed/revalidated/merged;
- second controlled Railway release completed successfully.

## 4. Synchronize project documentation — IN PROGRESS IN DOCS SYNC

Canonical references are:

- `docs/ROADMAP.md` — Blueprint;
- `docs/AUDIT.md` — verified-state/recovery reference;
- `docs/CURRENT_STATUS.md` — current execution snapshot.

They must agree before further phase-status conclusions are treated as authoritative.

## 5. Acquire real legacy browser capture — NEXT EXTERNAL BOUNDARY

The authoritative capture must come from an environment/browser satisfying required operator-local provenance.

## 6. Execute real staging reconstruction — NEXT TECHNICAL CRITICAL PATH

- verified handoff intake;
- evidence-only blocker resolution;
- exact category/Brand/media provisioning;
- verified dependency mapping plan;
- backup/restore rehearsal;
- guarded product import;
- guarded price import;
- reconciliation.

## 7. Finish merchant/storefront work against real data — PENDING

- catalogue/Studio UAT;
- final PLP/PDP/search;
- checkout/payments;
- shipping/courier;
- orders/returns;
- fiscal pipeline;
- SEO/redirects;
- backup/restore and rollback rehearsal.

---

# 5. Human/external dependencies

## Needed next

### Authoritative legacy browser capture

This is the principal unavoidable external acquisition boundary.

### Account-level cleanup

May require owner UI access if connected administrative actions are unavailable:

- remove/disconnect obsolete Vercel `backend`;
- configure appropriate GitHub branch/ruleset protection.

## Not required before development continues

Do not yet:

- change production DNS;
- disable Magento;
- activate production payment credentials;
- activate production AADE;
- activate production courier credentials;
- expose staging as production;
- manually recreate legacy products in Medusa.

Magento remains production until Blueprint launch gates pass.

## Later business/account dependencies

Human-approved inputs will eventually be required for:

- shipping rates/free-shipping policy;
- production PayPal/Klarna/card credentials;
- courier credentials/contracts;
- AADE/myDATA credentials and mappings;
- transactional email credentials;
- legal/privacy approval;
- production DNS authority;
- merchant UAT/sign-off.

---

# 6. Definition of being back on track

The original AUDIT recovery objective is now **substantially satisfied**.

Verified invariants:

- `main` is the validated implementation baseline;
- Railway `staging` is a deliberate reconciled release path rather than stale parallel history;
- Railway server and worker run the same successful release;
- storefront and Studio are compatible with the released Medusa API surface;
- the next critical path is real Phase 4 legacy capture/import rather than runtime drift.

Remaining cleanup before declaring the recovery chapter fully closed:

- obsolete Vercel `backend` no longer produces false project-health failures;
- Blueprint/AUDIT/CURRENT_STATUS docs sync is merged;
- branch/ruleset hardening is addressed or explicitly deferred with owner rationale.

Once those cleanup items are resolved or explicitly owner-deferred, new feature work may proceed while preserving release alignment as a standing invariant.
