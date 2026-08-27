# COQUETTE — Current Delivery Status

**Status date:** 2026-08-27  
**Canonical Blueprint:** `docs/ROADMAP.md`  
**Verified-state reference:** `docs/AUDIT.md`

## Current baseline

COQUETTE is an isolated Medusa v2 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime, Vercel storefront and COQUETTE Studio merchant experience.

The legacy `coquetteconcept.gr` Magento shop remains production until reconstruction, merchant UAT and cutover gates pass. Magento Admin/database/filesystem/API access remains unavailable, so Phase 4 reconstructs only legitimately recoverable public storefront state and never invents private Magento-only values.

### Validated application and release baseline

- merged application implementation head: `71aa81d9ff4281ecf04fadbb16accb58a2ead0f3`
- guarded Studio category/designer feature: PR #82 merged
- exact-head Studio placement-taxonomy CI: green
- Studio compatibility CI for pricing, identifiers, inventory and core Studio: green
- full clean-database COQUETTE CI: green on the feature tree and exact controlled-release tree
- exact-tree release candidates: `477da59655afb35db2056ed554b5f7f72af6b08b` for path-specific Studio gates and `95faf96e355b336a13c5cdccb8b94b7d5c1c012b` for full release CI; both carry tree `1643c4308932e18b12bec3c2fb9bc77e559f2836`
- controlled Railway release: `d450b35edc6e750004df72452950f9246ae3ffff`
- Railway `coquette-worker`: success on `d450b35e…`
- Railway `coquette-backend`: success on the same release, public runtime `coquette-backend-production-8b4f.up.railway.app`
- Vercel COQUETTE Studio production deployment from merged `main` `71aa81d9…`: READY
- Vercel storefront: healthy; staging-release deployment also completed successfully
- obsolete Vercel `backend`: still fails and must be removed/disconnected; it is not the Medusa runtime

The release invariant is preserved: `main` is implementation state; Railway `staging` is a deliberate controlled release history; server and worker run the same release commit.

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
- clean PostgreSQL CI, Admin CRUD, payment/bootstrap, reconstruction/import/reconciliation, Railway artifact and storefront build gates

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

**Status: MATERIAL PHASE 5 IMPLEMENTATION SHIPPED**

Architectural rule:

> COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine and technical administration foundation. Studio operates through constrained Medusa interfaces and never becomes a second system of record.

### Shipped foundations and guarded product workflow

- branded high-class merchant experience direction
- Today/dashboard/personal-assistant model
- guarded Quick Draft product creation
- Guided New Piece editorial flow
- autosave/resume against Medusa drafts
- optimistic concurrency/stale-write protection
- managed product-media upload, ordering and cover selection
- human Size/Colour blueprint editing and reviewed creation of real Medusa option/variant graphs
- guarded regular EUR pricing plus optional lower sale pricing through the Studio-owned Medusa sale price list
- guarded SKU/EAN/UPC/barcode management for real variants
- guarded inventory quantities with fixed `COQUETTE Greece` stock-location policy, backorders kept off and reservations/incoming stock read-only
- guarded multi-category assignment using existing active merchant-facing categories only
- guarded designer assignment/replacement/removal using the existing COQUETTE Brand module
- state → deterministic SHA-256 review plan → explicit confirmation → locked apply across commerce-sensitive workflows
- post-workflow invariant verification and clean-database runtime contracts
- source/public Studio asset parity and compatibility CI

The category/designer workflow never creates taxonomy, exposes internal/inactive categories, publishes products or mutates sales channels, pricing, inventory or identifiers.

### Still required for Phase 5 exit

- explicit guarded publication/unpublication lifecycle
- deliberate archive semantics; Medusa 2.19 has no native `archived` product status
- publication visibility review that treats product status and sales-channel exposure as separate concerns
- scheduled publication only after durable scheduling/persistence is deliberately designed
- merchant-facing tax controls where required
- merchandising and SEO application
- bulk catalogue operations
- broader order/customer/refund/fulfillment/payment/shipping/fiscal daily operations
- role-based acceptance and full merchant UAT

Pinned Medusa 2.19 defines product statuses as `draft`, `proposed`, `published`, `rejected`. Its Store Product routes additionally filter by valid sales channels. Therefore future Studio lifecycle controls must not equate a status change alone with customer visibility, and archive must be a COQUETTE-owned explicit policy rather than a fabricated Medusa status.

---

## Release/AUDIT recovery status

AUDIT originally identified badly diverged `main`/Railway `staging` history and the risk that Studio could outrun its deployed Medusa API.

**Resolved and maintained through the current placement release:**

1. `main` and `staging` histories were reconciled through controlled merges rather than force reset.
2. Backend and worker were brought onto one successful release.
3. Phase 4U and guarded variant generation were validated/merged/released.
4. Guarded regular/sale pricing was validated/merged/released.
5. Guarded variant identifiers were validated/merged/released.
6. Guarded inventory quantity/location policy was validated/merged/released.
7. Guarded category/designer placement was validated and merged as `71aa81d9…`.
8. The exact merged application tree was tested through controlled two-parent release candidates before `staging` advanced.
9. Final release `d450b35e…` preserves prior staging history and carries the exact validated main application tree.
10. Railway backend and worker both succeeded on `d450b35e…`; storefront deployment also succeeded.

**Remaining account-level cleanup:**

- remove/disconnect obsolete Vercel `backend` so its false red deployment signal disappears
- configure appropriate GitHub branch/ruleset protection if account administration permits

These cleanup items do not justify changing the correct Railway/Medusa architecture.

---

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy reconstruction:** Technical chain very advanced through Phase 4U; authoritative real legacy capture/import pending.
- **Phase 5 — Merchant back office:** Material implementation shipped through variants, pricing, identifiers, inventory and category/designer placement; lifecycle, broader daily operations and UAT pending.
- **Phase 6 — Storefront parity:** Materially advanced; real-data acceptance pending.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of original sequence; final real-data QA pending.
- **Phase 8 — Customer/cart/account:** Foundations materially implemented; final staging E2E pending.
- **Phase 9 — Checkout/payments:** Foundations materially implemented; provider E2E/business approval pending.
- **Phases 10–18:** governed by `docs/ROADMAP.md` and remain gated by real-data UAT/cutover readiness.

---

## Next executable milestones

Two tracks can advance without violating release alignment.

### Phase 4 real-data track

1. acquire the authoritative legacy operator-browser handoff;
2. run verified handoff intake;
3. resolve only evidence-backed review/URL blockers until the Phase 4N bundle is staging-ready;
4. provision exact required categories/Brands and captured media into COQUETTE-owned storage;
5. build/reconcile the real verified dependency mapping plan;
6. complete backup/restore rehearsal before any real staging legacy-data write;
7. run guarded structural product import and guarded price import against staging;
8. reconcile catalogue/media/URL results.

### Phase 5 merchant-workflow track

1. guarded publication/unpublication readiness and visibility lifecycle, explicitly reviewing sales-channel exposure;
2. define safe archive semantics separately from Medusa's native status enum;
3. merchant-facing tax controls where required;
4. merchandising/SEO application and bulk catalogue operations;
5. broader daily commerce operations and merchant UAT.

Production cutover remains forbidden until all Blueprint launch gates pass.

---

## Human/external dependencies

Needed before the next major Phase 4 data milestone:

- a browser/network environment capable of the authoritative `coquetteconcept.gr` operator capture
- continued public availability of the legacy storefront until accepted capture

Account-level cleanup may require owner UI access:

- delete/disconnect obsolete Vercel `backend`
- configure GitHub branch/ruleset protection

Later launch dependencies include production payment/courier/AADE/email credentials, shipping/business policies, legal/privacy approval, DNS authority and merchant sign-off.

Do **not** yet change production DNS, disable Magento, activate production fiscal/payment/courier credentials or manually recreate legacy catalogue data.

---

## Fully-working-system boundary

The target is a working staging store and then a controlled cutover, not a permanent dry-run project.

COQUETTE remains intentionally pre-cutover until real reconstructed data is present in staging and the Blueprint's merchant UAT, payment/courier/fiscal, SEO redirect, backup/restore and rollback gates pass.
