# COQUETTE — Current Delivery Status

**Status date:** 2026-08-28  
**Canonical Blueprint:** `docs/ROADMAP.md`  
**Verified-state reference:** `docs/AUDIT.md`

## Current baseline

COQUETTE is an isolated Medusa v2 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime, Vercel storefront and COQUETTE Studio merchant experience.

The legacy `coquetteconcept.gr` Magento shop remains production until reconstruction, merchant UAT and cutover gates pass. Magento Admin/database/filesystem/API access remains unavailable, so Phase 4 reconstructs only legitimately recoverable public storefront state and never invents private Magento-only values.

### Current implementation head

- `main`: `4536ba682e6587f7b330f4acb1cfb9d0a67f5e6e`
- PR #85: guarded archive/restore policy merged and validated
- PR #86: Railway-equivalent production runtime smoke gate merged
- PR #87: Studio archive/backend fail-soft compatibility merged and deployed READY on Vercel

### Railway incident state

The archive release did **not** fail because CI merely built an invalid Medusa artifact. Full CI now performs the Railway-equivalent backend path: migrations/predeploy → built production server start → HTTP 2xx `/health`, and that contract is green.

Railway evidence instead shows a service-level deployment blocker:

- archive release `fb3a931349f52457135300393bd67edf56c554ce`: worker succeeded, backend failed;
- identical-application retry `86c668a8d3488d7f0111f2034021839ab4ec10cd`: backend failed again;
- forward-only rollback release `2b4f20e0678669b23be697b7108bb55510c8554d`, carrying the prior known-good application tree: worker succeeded, backend failed;
- therefore the current fault boundary is the Railway backend service/environment/platform deployment path, not a demonstrated archive-code defect.

Current Railway `staging` points to `2b4f20e…`. The server/worker same-release invariant is currently **not satisfied**, because the worker accepted that release and the backend could not deploy it.

The last previously verified aligned Railway baseline before this incident was `d450b35edc6e750004df72452950f9246ae3ffff`.

**Immediate release rule:** no new backend-dependent Studio phase may assume deployment until Railway backend is repaired and backend + worker are again successful on one controlled release.

---

## Platform and commerce foundation

Verified/shipped:

- dedicated COQUETTE repository/workspace and environment isolation
- Medusa backend/Admin + bilingual Next.js storefront
- COQUETTE Studio merchant UX over Medusa
- dedicated Supabase PostgreSQL/storage
- Railway Medusa server + separate worker + Redis-backed modules
- Vercel storefront connected to Railway Store API
- Greece/EUR region and fulfillment foundation
- Designer/Brand and bilingual Website Content modules
- managed S3-compatible media
- EL/EN catalogue/PDP/Designer/Sale foundations
- variant-aware cart/checkout foundations
- PayPal and Klarna foundations
- clean PostgreSQL CI, Admin CRUD, payment/bootstrap, reconstruction/import/reconciliation and storefront build gates
- Railway production artifact build gate
- **actual production Medusa startup + `/health` gate** added in PR #86

---

## Phase 4 — public reconstruction state

### Phase 4A–4U — technical reconstruction chain shipped

The shipped chain covers public HTML/media/URL evidence capture, indexed recovery, provenance/freshness rules, field conflicts, archive safety, deterministic URL and product reconstruction, guarded structural/price execution, Product ↔ Brand linking, qualitative stock evidence, checksum-bound review/reconciliation, dependency mapping/provisioning, operator-local capture handoff and verified intake.

No private Magento fact is fabricated and no qualitative stock signal is converted into an invented numeric quantity.

### Real-data boundary

**No real legacy catalogue reconstruction write has yet been performed against COQUETTE staging.**

The next unavoidable Phase 4 acquisition boundary is the authoritative operator-browser capture from an environment/network that can reach `coquetteconcept.gr` and satisfy the required provenance contract. After that handoff exists, receiver-side verification, reconstruction, dependency planning and guarded staging import are automated/checksum-bound.

---

## COQUETTE Studio — merchant experience state

**Status: MATERIAL PHASE 5 IMPLEMENTATION SHIPPED; RAILWAY RELEASE OF NEWEST BACKEND API BLOCKED**

Architectural rule:

> COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine and technical administration foundation. Studio operates through constrained Medusa interfaces and never becomes a second system of record.

### Implemented and validated product workflow

- branded high-class merchant experience direction
- Today/dashboard/personal-assistant model
- guarded Quick Draft product creation
- Guided New Piece editorial flow
- autosave/resume against Medusa drafts
- optimistic concurrency/stale-write protection
- managed product-media upload, ordering and cover selection
- reviewed Size/Colour → real Medusa option/variant graph
- guarded regular EUR pricing plus optional lower sale pricing
- guarded SKU/EAN/UPC/barcode management
- guarded inventory quantities with fixed `COQUETTE Greece` stock-location policy
- guarded multi-category assignment using existing active merchant-facing categories only
- guarded designer assignment/replacement/removal using the COQUETTE Brand module
- guarded publication/unpublication with customer-visibility review
- reversible guarded archive/restore policy preserving commerce data and restoring only to draft
- state → deterministic SHA-256 review plan → explicit confirmation → locked apply across sensitive workflows
- post-workflow invariant verification and clean-database runtime contracts
- source/public Studio asset parity and compatibility CI

### Archive deployment compatibility

Archive/restore is implemented and validated on `main`, but is **not yet Railway-released**.

PR #87 prevents Studio from outrunning the backend:

- if `/admin/studio/archive` is unavailable on the deployed backend, Studio treats archive as an unavailable capability;
- Archive/Restore controls are hidden instead of failing visibly;
- other product workflows remain usable;
- once Railway successfully deploys the archive API, the same Studio UI activates automatically.

Vercel production deployment from `4536ba68…` is READY.

### Still required for Phase 5 exit

- merchant-facing tax controls where required
- merchandising and SEO application
- bulk catalogue operations
- broader order/customer/refund/fulfillment/payment/shipping/fiscal daily operations
- scheduled publication only if durable persistence/scheduling is deliberately implemented
- role-based acceptance and full merchant UAT

Pinned Medusa 2.19 defines native product statuses as `draft`, `proposed`, `published`, `rejected`; it has no native `archived` status. Archive is therefore a COQUETTE policy layer, while customer visibility continues to require separate status and sales-channel reasoning.

---

## Release/AUDIT status

The original AUDIT release-history problem was resolved previously. The current issue is different: Railway backend deployment itself is failing even for a rollback carrying the prior known-good application tree.

### Verified 2026-08-28 sequence

1. Guarded archive/restore merged in PR #85.
2. Exact-tree release validation passed.
3. Release `fb3a9313…` advanced `staging` without force.
4. Worker succeeded, backend failed.
5. PR #86 added production-start `/health` verification to full CI.
6. Corrected runtime smoke passed.
7. Same-tree retry still failed on Railway backend.
8. Forward-only rollback `2b4f20e…` restored the prior known-good application tree without rewriting history.
9. Worker succeeded on rollback; backend failed again.
10. PR #87 added Studio capability fallback and is READY on Vercel.

### Required next evidence

Railway `coquette-backend` failed deployment:

- Build Logs
- Deploy Logs
- build/predeploy/start/healthcheck service settings relevant to the failure
- current injected environment/configuration relevant to those stages

Do not invent a source-code workaround before inspecting those diagnostics.

### Remaining account-level cleanup

- remove/disconnect obsolete Vercel `backend` so its false red deployment signal disappears
- configure appropriate GitHub branch/ruleset protection if account administration permits

---

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete, including production runtime-start smoke verification.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete; Railway backend deployment incident open.
- **Phase 4 — Public legacy reconstruction:** Technical chain very advanced through Phase 4U; authoritative real legacy capture/import pending.
- **Phase 5 — Merchant back office:** Material implementation through variants, pricing, identifiers, inventory, placement, publication lifecycle and archive policy; newest backend-dependent release blocked on Railway.
- **Phase 6 — Storefront parity:** Materially advanced; real-data acceptance pending.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of original sequence; final real-data QA pending.
- **Phase 8 — Customer/cart/account:** Foundations materially implemented; final staging E2E pending.
- **Phase 9 — Checkout/payments:** Foundations materially implemented; provider E2E/business approval pending.
- **Phases 10–18:** governed by `docs/ROADMAP.md` and remain gated by real-data UAT/cutover readiness.

---

## Next executable milestones

### Immediate release-recovery track — BLOCKING

1. inspect Railway backend Build Logs / Deploy Logs and relevant service settings;
2. correct the Railway backend service/environment issue without changing architecture unnecessarily;
3. create/advance a controlled staging release without force;
4. require backend and worker success on the same release;
5. verify backend `/health`, Store API, Admin API and Studio compatibility;
6. mark archive/restore Railway-released only after this alignment exists.

### Phase 4 real-data track

1. acquire the authoritative legacy operator-browser handoff;
2. run verified handoff intake;
3. resolve only evidence-backed review/URL blockers;
4. provision exact required categories/Brands and captured media;
5. build/reconcile the real verified dependency mapping plan;
6. complete backup/restore rehearsal before any real staging legacy-data write;
7. run guarded structural product import and guarded price import;
8. reconcile catalogue/media/URL results.

### Phase 5 non-blocked work

Documentation, storefront-only work, evidence processing and design work that do not depend on a newer Railway Medusa API can proceed. New backend-dependent merchant workflows remain release-paused until alignment is restored.

Production cutover remains forbidden until all Blueprint launch gates pass.

---

## Human/external dependencies

Needed now:

- Railway backend deployment diagnostics/service configuration access
- browser/network environment capable of the authoritative `coquetteconcept.gr` operator capture
- continued public availability of the legacy storefront until accepted capture

Account-level cleanup may require owner UI access:

- delete/disconnect obsolete Vercel `backend`
- configure GitHub branch/ruleset protection

Later launch dependencies include production payment/courier/AADE/email credentials, shipping/business policies, legal/privacy approval, DNS authority and merchant sign-off.

Do **not** yet change production DNS, disable Magento, activate production fiscal/payment/courier credentials or manually recreate legacy catalogue data.

---

## Fully-working-system boundary

The target is a working staging store and then a controlled cutover, not a permanent dry-run project.

COQUETTE remains intentionally pre-cutover until:

- Railway backend/worker release alignment is restored;
- real reconstructed data is present in staging;
- merchant UAT passes;
- payment/courier/fiscal/SEO redirect gates pass;
- backup/restore and rollback procedures are verified.
