# COQUETTE — Current Delivery Status

**Status date:** 2026-08-27  
**Canonical Blueprint:** `docs/ROADMAP.md`  
**Verified-state reference:** `docs/AUDIT.md`

## Current baseline

COQUETTE is an isolated Medusa v2 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime, Vercel storefront and COQUETTE Studio merchant experience.

The legacy `coquetteconcept.gr` Magento shop remains production until reconstruction, UAT and cutover gates pass. Magento Admin/database/filesystem/API access remains unavailable, so Phase 4 reconstructs only legitimately recoverable public storefront state and never invents private Magento-only values.

### Validated application and release baseline

- merged `main` application head: `4e6a28c497370ec2e810998841666325762e323f`
- guarded Studio pricing feature PR: #76 merged
- exact-head COQUETTE Studio Pricing CI: green
- exact-head COQUETTE Studio CI: green
- full clean-database COQUETTE CI: green on the pricing implementation tree and on the controlled Railway release tree
- controlled Railway release merge: `358e770cf365f6842568ac6bec01b74d7934f3dc`
- Railway `coquette-backend`: success on release `358e770…`
- Railway `coquette-worker`: success on the same release
- Vercel COQUETTE Studio production deployment from `main` `4e6a28c…`: READY
- deployed `/new-piece-pricing.js`: live HTTP 200 and verified to contain the guarded pricing UI
- Vercel storefront: healthy
- obsolete Vercel `backend`: still fails and must be removed/disconnected; it is not the Medusa runtime

The release invariant is restored and preserved: `main` is implementation state; Railway `staging` is a deliberate controlled release history; server and worker run the same release commit.

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

The shipped chain covers:

- public HTML/media/URL evidence capture
- indexed recovery and provenance/freshness rules
- field-level conflicts and explicit unavailable states
- archive containment/traversal safety
- direct + indexed URL universe classification
- archive-native PDP reconstruction
- deterministic structural ProductImportPlan
- configurable-parent safeguards
- guarded staging product execution
- deterministic independent pricing reconstruction
- guarded staging price execution and lifecycle idempotency
- Product ↔ Brand link execution
- qualitative inventory evidence that never fabricates quantities
- checksum-bound review decisions and evidence-selection application
- checksum-bound Phase 4N migration input reconciliation
- mandatory reconciled staging input
- operator-local browser evidence package
- deterministic category/Brand/media dependency mapping reconciliation
- verified dependency-plan staging input
- one-command portable operator capture handoff
- Phase 4T verified handoff reconciliation intake
- Phase 4U deterministic dependency-provisioning evidence

No private Magento fact is fabricated and no qualitative stock signal is converted into an invented numeric quantity.

### Real-data boundary

**No real legacy catalogue reconstruction write has yet been performed against COQUETTE staging.**

The next unavoidable acquisition boundary is the authoritative operator-browser capture from an environment/network that can reach `coquetteconcept.gr` and satisfy the required provenance contract. Web retrieval may support research/audit but does not replace the required operator-local capture provenance.

After the handoff exists, receiver-side verification, reconstruction, review reconciliation, dependency planning and guarded staging import are automated/checksum-bound.

---

## COQUETTE Studio — merchant experience state

**Status: MATERIAL PHASE 5 IMPLEMENTATION SHIPPED**

Architectural rule:

> COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine and technical administration foundation. Studio operates through constrained Medusa interfaces and never becomes a second system of record.

### Shipped foundations

- branded high-class merchant experience direction
- Today/dashboard/personal-assistant model
- guarded Quick Draft product creation
- Guided New Piece editorial flow
- autosave/resume against Medusa drafts
- optimistic concurrency/stale-write protection
- managed product-media upload, ordering and cover selection
- human Size/Colour blueprint editing and server review
- guarded creation of real Medusa option/variant graphs
- draft/provenance guards, locking and post-workflow verification
- guarded regular EUR pricing
- uniform or explicit per-variant pricing modes
- optional lower sale price through a Studio-owned Medusa sale price list
- current → intended price review with deterministic SHA-256 review hash
- second explicit apply confirmation and immediate pre-write re-review
- blocking of conditional/foreign active pricing instead of silent overwrite
- clean-database create/update/idempotency/sale-removal pricing execution contract
- source/Vercel static Studio parity contracts

The pricing workflow intentionally leaves inventory, SKU/barcode, backorders, sales channels, categories/designers and publication untouched.

### Still required for Phase 5 exit

- SKU/EAN/UPC/barcode management
- inventory quantities and stock-location policy
- category/designer application flows
- tax controls where merchant-facing control is required
- merchandising and SEO application
- explicit publish/schedule/archive lifecycle
- bulk catalogue operations
- broader order/customer/refund/fulfillment/payment/shipping/fiscal daily operations
- role-based acceptance and full merchant UAT

---

## Release/AUDIT recovery status

AUDIT originally identified badly diverged `main`/Railway `staging` history and the risk that Studio could outrun its deployed Medusa API.

**Resolved and maintained:**

1. `main` and `staging` histories were reconciled through controlled merges rather than force reset.
2. Backend and worker were brought onto one successful release.
3. Phase 4U and guarded variant generation were validated/merged/released.
4. Guarded regular/sale pricing was exact-head validated and merged as `4e6a28c…`.
5. A new controlled release `358e770…` preserved staging history while carrying the exact merged application tree.
6. Release-head full CI passed, including clean-database guarded pricing execution and deployable Railway artifact construction.
7. Railway backend and worker both succeeded on `358e770…`.
8. Production COQUETTE Studio is READY and serves the new pricing asset.

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
- **Phase 5 — Merchant back office:** Material implementation shipped through variants and guarded regular/sale pricing; full daily-operation parity pending.
- **Phase 6 — Storefront parity:** Materially advanced; real-data acceptance pending.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of original sequence; final real-data QA pending.
- **Phase 8 — Customer/cart/account:** Foundations materially implemented; final staging E2E pending.
- **Phase 9 — Checkout/payments:** Foundations materially implemented; provider E2E/business approval pending.
- **Phases 10–18:** governed by `docs/ROADMAP.md` and remain gated by real-data UAT/cutover readiness.

---

## Next executable milestones

Two tracks can now advance without violating release alignment:

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

1. guarded SKU/EAN/UPC/barcode management for real Medusa variants;
2. guarded inventory quantities/location policy;
3. category/designer application;
4. publication/schedule/archive lifecycle;
5. broader daily commerce operations and merchant UAT.

Production cutover remains forbidden until all Blueprint launch gates pass.

---

## Human/external dependencies

Needed before the next major data milestone:

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
