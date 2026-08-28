# COQUETTE — Current Delivery Status

**Status date:** 2026-08-28  
**Canonical Blueprint:** `docs/ROADMAP.md`  
**Verified-state reference:** `docs/AUDIT.md`

## Current baseline

COQUETTE is an isolated Medusa v2 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime, Vercel storefront and COQUETTE Studio merchant experience.

The legacy `coquetteconcept.gr` Magento shop remains production until reconstruction, merchant UAT and cutover gates pass. Magento Admin/database/filesystem/API access remains unavailable, so Phase 4 reconstructs only legitimately recoverable public storefront state and never invents private Magento-only values.

### Validated implementation and current release

- current `main`: `23b66c145cf128c4eec2f1d269c8d04e2f2d394a`
- current validated application/documentation tree: `ffab2f2f15f0bd3910a38acd67c7c84837edba31`
- PR #85: guarded archive/restore policy merged and validated
- PR #86: Railway-equivalent production runtime smoke gate merged
- PR #87: Studio archive/backend fail-soft compatibility merged and deployed READY on Vercel
- PR #88: Blueprint/AUDIT/CURRENT_STATUS synchronization merged
- recovered same-tree Railway baseline: `eb03c253919171dd6d5c0a96d253b70174ee8afb`
- exact-tree archive recovery candidate: `aabe3c1af20ccc545a54dd0c36bd55682ce42e32`
- all 8 applicable candidate workflows: SUCCESS
- current controlled Railway release: `ae4d971b0a4e30882474e81a769c5f0a32268eda`
- Railway `coquette-backend`: SUCCESS on `ae4d971b…`
- Railway `coquette-worker`: SUCCESS on `ae4d971b…`
- Railway server/worker same-release invariant: RESTORED
- Vercel storefront: SUCCESS on the final release
- Vercel COQUETTE Studio: READY from the compatibility-safe `main` deployment
- obsolete Vercel `backend`: remains cleanup noise and is not the Medusa runtime

The release invariant is again satisfied: `main` is the validated implementation baseline; Railway `staging` is a deliberate history-preserving release line; backend and worker are successful on the exact same release commit.

### Resolved Railway builder incident

The 2026-08-28 backend failures were ultimately traced to Railway's build infrastructure rather than COQUETTE code. The decisive failed build reported:

`DeadlineExceeded: failed to load cache key: failed to do request: Head "https://registry-1.docker.io/v2/library/alpine/manifests/latest": ... i/o timeout`

Repository verification found no `alpine:latest` or `FROM alpine` application reference. The failure occurred before the COQUETTE build completed, and there were no Deploy Logs because no deployable image had been produced.

A forward-only exact-same-tree retry `eb03c253…` then succeeded on both Railway backend and worker without any application change. That proves the earlier failure was a transient Railway builder / Docker Hub connectivity incident rather than a demonstrated defect in Medusa, migrations, Redis, start commands, healthcheck configuration or the archive implementation.

After recovery, the full current `main` tree was re-promoted through the controlled release discipline and succeeded as `ae4d971b…`.

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
- actual production Medusa predeploy/start/HTTP-2xx `/health` CI gate from PR #86
- controlled exact-tree Railway release process proven again after the builder incident

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

**Status: MATERIAL PHASE 5 IMPLEMENTATION SHIPPED AND CURRENT BACKEND API RELEASED**

Architectural rule:

> COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine and technical administration foundation. Studio operates through constrained Medusa interfaces and never becomes a second system of record.

### Implemented, validated and release-aligned product workflow

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

### Archive deployment state

Archive/restore is now **Railway-released** in controlled release `ae4d971b…`.

PR #87 remains a permanent compatibility safeguard:

- if `/admin/studio/archive` is unavailable on a future deployed backend, Studio treats archive as an unavailable capability;
- Archive/Restore controls hide instead of failing visibly;
- other product workflows remain usable;
- when the API is available, the same UI activates automatically.

Pinned Medusa 2.19 defines native product statuses as `draft`, `proposed`, `published`, `rejected`; it has no native `archived` status. Archive therefore remains a COQUETTE metadata/policy layer, while customer visibility continues to require separate status and sales-channel reasoning.

### Still required for Phase 5 exit

- merchant-facing tax controls where required
- merchandising and SEO application
- bulk catalogue operations
- broader order/customer/refund/fulfillment/payment/shipping/fiscal daily operations
- scheduled publication only if durable persistence/scheduling is deliberately implemented
- role-based acceptance and full merchant UAT

---

## Release/AUDIT status

The original AUDIT release-history problem and the later Railway builder incident are both resolved.

### Verified 2026-08-28 incident and recovery sequence

1. Guarded archive/restore merged in PR #85.
2. Original exact-tree archive release validation passed.
3. Release `fb3a9313…` advanced `staging` without force; worker succeeded and backend failed.
4. PR #86 added production-start `/health` verification to full CI.
5. Corrected runtime smoke passed.
6. Same-tree archive retry still failed on Railway backend.
7. Forward-only rollback `2b4f20e…` restored the prior known-good application tree; worker succeeded and backend again failed.
8. Railway Build Logs identified the failure before deploy: Docker Hub `alpine:latest` manifest request timed out in Railway's build daemon.
9. Repository inspection confirmed the Alpine reference was not COQUETTE application configuration.
10. Exact-same-tree retry `eb03c253…` succeeded on both Railway backend and worker, confirming a transient builder/network incident.
11. Current `main` tree was carried into exact-tree two-parent candidate `aabe3c1…`, preserving recovered staging as first parent and current main as second parent.
12. All 8 applicable candidate workflows passed, including production artifact build, predeploy, actual server start, HTTP-2xx `/health` smoke and storefront build.
13. Final release `ae4d971b…` used the exact same tree and ordered parents and advanced `staging` without force.
14. Railway backend and worker both succeeded on `ae4d971b…`; storefront deployment also succeeded.
15. GitHub issue #89 was closed as completed.

### Remaining account-level cleanup

- remove/disconnect obsolete Vercel `backend` so its false red deployment signal disappears; tracked in issue #90
- configure appropriate GitHub branch/ruleset protection if account administration permits

---

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete, including production runtime-start smoke verification.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete; Railway release alignment restored.
- **Phase 4 — Public legacy reconstruction:** Technical chain very advanced through Phase 4U; authoritative real legacy capture/import pending.
- **Phase 5 — Merchant back office:** Material implementation through variants, pricing, identifiers, inventory, placement, publication lifecycle and archive/restore; current catalogue API release aligned. Tax/SEO/bulk/broader daily operations and UAT remain.
- **Phase 6 — Storefront parity:** Materially advanced; real-data acceptance pending.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of original sequence; final real-data QA pending.
- **Phase 8 — Customer/cart/account:** Foundations materially implemented; final staging E2E pending.
- **Phase 9 — Checkout/payments:** Foundations materially implemented; provider E2E/business approval pending.
- **Phases 10–18:** governed by `docs/ROADMAP.md` and remain gated by real-data UAT/cutover readiness.

---

## Next executable milestones

### Phase 5 merchant-workflow track

With Railway release alignment restored, the next bounded backend-dependent catalogue workflow is merchant-facing tax controls where appropriate. It must use native Medusa tax concepts and may not invent tax treatment or fiscal facts.

After tax controls:

1. merchandising/SEO application;
2. bulk catalogue operations;
3. broader order/customer/refund/fulfillment/payment/shipping/fiscal daily operations;
4. role-based merchant UAT.

### Phase 4 real-data track

1. acquire the authoritative legacy operator-browser handoff;
2. run verified handoff intake;
3. resolve only evidence-backed review/URL blockers;
4. provision exact required categories/Brands and captured media;
5. build/reconcile the real verified dependency mapping plan;
6. complete backup/restore rehearsal before any real staging legacy-data write;
7. run guarded structural product import and guarded price import;
8. reconcile catalogue/media/URL results.

Production cutover remains forbidden until all Blueprint launch gates pass.

---

## Human/external dependencies

Needed for the next major Phase 4 milestone:

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

- real reconstructed data is present in staging;
- merchant UAT passes;
- payment/courier/fiscal/SEO redirect gates pass;
- backup/restore and rollback procedures are verified.
