# COQUETTE — AUDIT

**Status:** Canonical project audit and recovery reference  
**Audit date:** 2026-08-27  
**Canonical blueprint:** `docs/ROADMAP.md`  
**Repository:** `pcrus1988-bit/coquette`

This document is the canonical infrastructure/readiness audit for COQUETTE. Within this project, **AUDIT** means this document. It complements the Blueprint (`docs/ROADMAP.md`): the Blueprint defines the intended delivery path; AUDIT records the verified current state, drift, immediate corrective actions, and human/external dependencies.

## Executive conclusion

COQUETTE has a sound core architecture and is materially ahead of several original Blueprint phase labels, but it is not yet a complete staging shop and is not production-ready.

Verified state at the audit boundary:

- architecture: strong and consistent with the Blueprint;
- GitHub codebase and CI: strong;
- Vercel storefront: deployed and healthy;
- Vercel COQUETTE Studio: deployed and healthy;
- Supabase PostgreSQL/storage: healthy and correctly isolated;
- Medusa foundation: healthy;
- Railway architecture: correct, but the documented Railway release branch is behind/diverged from `main` and must be realigned;
- real legacy catalogue: not yet written into COQUETTE staging;
- production cutover: intentionally not reached.

The highest-priority recovery action is to restore release alignment between validated `main` and the Railway `staging` release branch before adding further runtime-dependent features.

---

# 1. Blueprint position

## Phase 0 — Workspace and isolation

**Status: COMPLETE**

Dedicated repository, database/storage boundaries, environment separation and project-specific runtime state are in place.

## Phase 1 — Legacy audit / architecture

**Status: COMPLETE; public audit remains continuous**

Medusa v2 + Next.js remains the approved architecture. The public Magento storefront remains the legitimate reconstruction evidence source because private Magento administrative/database/filesystem/API access is unavailable.

## Phase 2 — Executable commerce foundation

**Status: COMPLETE**

Medusa backend/Admin, Next.js storefront, reproducible dependency/build gates and CI are established.

## Phase 3 — COQUETTE domain model and managed infrastructure

**Status: TECHNICAL EXIT GATE COMPLETE**

Verified foundation includes:

- dedicated Supabase PostgreSQL/storage;
- Medusa schema;
- Designer/Brand domain;
- Website Content domain;
- Greece/EUR region;
- stock-location and fulfillment foundation;
- Railway server/worker design with dedicated Redis;
- Vercel storefront integration;
- managed S3-compatible product media.

Operational hardening such as backup/restore rehearsal and repository protection remains outstanding.

## Phase 4 — Public legacy reconstruction

**Status: VERY ADVANCED TECHNICALLY; REAL LEGACY DATA NOT YET IMPORTED**

The reconstruction framework now covers evidence capture, URL inventory, checksums, products, categories, designers/brands, media, structural plans, pricing, qualitative inventory evidence, review decisions, dependency reconciliation, guarded staging execution and portable handoffs.

At the audit boundary, no real legacy catalogue reconstruction write had yet been performed against COQUETTE staging. Live Supabase commerce counts confirmed zero products and zero product variants.

Phase 4T has moved beyond the older status document and is effectively shipped into `main`. Phase 4U dependency-provisioning evidence is open work.

## Phase 5 — Merchant back-office parity

**Status: MATERIAL IMPLEMENTATION UNDERWAY VIA COQUETTE STUDIO**

COQUETTE Studio was not explicitly named in the original Blueprint. It is now the preferred merchant-facing evolution of Phase 5, with Medusa remaining the authoritative commerce engine and technical administration foundation.

## Phase 6 onward

Storefront parity, search, cart, checkout and payment foundations are materially ahead of the original sequential plan, but final acceptance cannot be granted until real catalogue data is present and staging E2E/UAT gates pass.

---

# 2. Runtime and platform audit

## GitHub

- repository: `pcrus1988-bit/coquette`;
- default branch: `main`;
- audit-time `main` head: `5a2cdc896d57a9376798f12b41e89c93c2cb8f60` before this AUDIT document was committed;
- code CI is green on validated heads;
- aggregate GitHub deployment status can appear red because of the obsolete Vercel `backend` project;
- `main` and `staging` were unprotected at the audit boundary.

### Release-branch drift

The documented Railway release source is `staging`.

Audit-time `staging` head:

`b68397a1796e11b9f1e80e67b7586f66019d89e8`

GitHub comparison showed `main` and `staging` diverged. `main` contained roughly 180 commits not present in `staging`, while `staging` contained 9 history commits not present in `main`.

The staging tip tree matched the earlier merge-base tree, so the unique staging history did not represent a newer application tree. Nevertheless, the histories must be reconciled through a controlled merge/release operation rather than treating Railway as if it already follows current `main`.

## Vercel — storefront

**Status: HEALTHY**

The real customer storefront deploys successfully from current `main`. No standalone redeployment is required unless new changes are merged.

## Vercel — COQUETTE Studio

**Status: HEALTHY**

The Studio project deploys successfully from current `main`. The frontend can nevertheless become functionally ahead of Railway when new Studio API/backend code has not yet reached the Railway release branch.

## Vercel — `backend`

**Status: OBSOLETE / WRONG DEPLOYMENT TARGET**

This project is not the Medusa runtime. Medusa belongs on Railway. The obsolete Vercel backend project fails its builds and pollutes GitHub deployment status.

Correct action: remove/disconnect it; do not attempt to make Medusa run there.

## Railway

**Architecture: HEALTHY**  
**Release alignment: NEEDS ACTION**

Canonical topology:

- `coquette-backend` — Medusa server;
- `coquette-worker` — Medusa worker;
- dedicated Redis;
- Supabase PostgreSQL and storage;
- migrations run server-side only;
- worker and server must run the same release commit.

The last documented Railway verification (2026-08-26) reported backend, worker, healthcheck, Medusa Admin, PostgreSQL and Redis operational. The audit did not have direct private Railway deployment/log access, so the currently running container SHA could not be independently read. Because the documented Git source is `staging` and that branch was stale/diverged, release realignment is required.

## Supabase

**Status: HEALTHY**

Dedicated project:

- name: `coquette`;
- ref: `pijetwrxqznxaoacnakr`;
- PostgreSQL 17;
- `coquette-media` public managed-media bucket;
- `coquette-imports` private reconstruction/import bucket.

Audit-time commerce baseline:

- Product: 0;
- Product Variant: 0;
- Brand: 0;
- Website Content Page: 0;
- Store: 1;
- Region: 1 (Greece / EUR);
- Sales Channel: 1;
- Stock Location: 1;
- Admin User: 1;
- API Keys: 2.

Supabase security advisor reported no security lints. Performance advisor findings were primarily low-value unused-index/unindexed-FK observations expected on an essentially empty Medusa staging database, plus one duplicate-index warning. These are not launch blockers at this stage and Medusa-generated indexes must not be deleted merely to clear advisory noise.

---

# 3. COQUETTE Studio architectural status

COQUETTE Studio is now an official project direction and should be treated as part of the Blueprint's merchant back-office phase.

Architectural rule:

> COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine and technical administration foundation. Studio must operate through authenticated, constrained Medusa interfaces and must never become a second commerce database or independent system of record.

Implemented/merged foundations include:

- branded merchant experience;
- Today/dashboard direction;
- guarded Quick Draft product creation;
- Guided New Piece eight-step editorial flow;
- autosave/resume against Medusa drafts;
- optimistic concurrency;
- managed media upload, ordering and cover selection;
- fail-closed protection against accidental publication, pricing, inventory and sales-channel mutations.

Open/current Studio work includes guarded conversion of saved human Size/Colour intent into a validated Medusa option/variant graph.

Still incomplete at the Studio layer include production-ready pricing, sale pricing, SKU/barcode management, inventory quantities/location policy, category/designer application, merchandising/SEO application, explicit publish/schedule/archive lifecycle and the broader daily order/customer/refund/fulfillment/fiscal operations required for full Phase 5 exit.

---

# 4. Immediate corrective sequence

This sequence governs the return-to-track work following AUDIT.

1. **Restore deployment topology alignment**
   - reconcile validated `main` into the Railway `staging` release branch without discarding release history;
   - require exact-head CI before release;
   - deploy/release Medusa server and worker from the reconciled staging head;
   - verify backend health, Admin, Store API, worker/Redis and Studio API compatibility where externally observable.

2. **Remove false Vercel backend signal**
   - disconnect/delete the obsolete Vercel `backend` project or its Git integration;
   - do not move Medusa to Vercel.

3. **Reconcile current open implementation work**
   - review/rebase/merge Phase 4U and Studio variant generation only after current-base validation;
   - perform a second controlled Railway staging release after backend-relevant merges.

4. **Keep Blueprint/status documentation synchronized**
   - Blueprint and AUDIT are the two canonical project references;
   - `CURRENT_STATUS.md` must reflect implemented phase advancement and runtime state;
   - future project decisions should be checked against both documents.

5. **Acquire the real legacy browser capture**
   - this is the principal unavoidable external/human acquisition boundary;
   - once the authoritative handoff exists, receiver-side reconstruction, reconciliation, dependency planning and guarded staging import remain automated/checksum-bound.

6. **Execute real staging reconstruction**
   - verified handoff intake;
   - evidence-only blocker resolution;
   - category/Brand/media provisioning;
   - guarded product import;
   - guarded price import;
   - reconciliation.

7. **Finish merchant/storefront work against real data**
   - catalogue UAT;
   - Studio pricing/inventory/publication;
   - final PLP/PDP/search;
   - checkout/payments;
   - shipping/courier;
   - orders/returns;
   - fiscal pipeline;
   - SEO/redirects;
   - backup/restore and rollback rehearsal.

---

# 5. Human/external dependencies

## Needed soon

### Authoritative legacy browser capture

The real public-storefront acquisition must come from an environment/browser that can satisfy the project's required operator-browser provenance. This is the main immediate human/external boundary.

### Account-level cleanup that may require owner UI access

- remove/disconnect the obsolete Vercel `backend` project if no connected administrative action is available;
- enable appropriate GitHub branch/ruleset protection if no connected administrative action is available.

These are account-administration tasks, not application-development tasks.

## Not required before development continues

Do not yet:

- change production DNS;
- disable Magento;
- activate production payment credentials;
- activate production AADE;
- activate production courier credentials;
- expose staging as the production shop;
- manually recreate products in Medusa.

Magento remains production until Blueprint launch gates pass.

## Later business/account dependencies

Human-approved information will eventually be required for:

- final shipping rates/free-shipping policy;
- production PayPal/Klarna/card credentials;
- courier credentials/contracts;
- AADE/myDATA credentials and mappings;
- transactional email credentials;
- legal/privacy approval;
- production DNS authority;
- merchant UAT/sign-off.

---

# 6. Definition of being back on track

COQUETTE is considered back on track after the immediate recovery sequence has restored these invariants:

- `main` is the validated implementation baseline;
- Railway `staging` is a deliberate reconciled release of that baseline, not a stale parallel history;
- Railway server and worker run the same reconciled release;
- storefront and Studio are compatible with the deployed Medusa API surface;
- obsolete Vercel backend failures no longer represent project health;
- AUDIT, Blueprint and current-status documentation agree;
- the next critical path is the real Phase 4 legacy capture/import rather than infrastructure drift.

Until then, new feature work should not outrun runtime release alignment again.
