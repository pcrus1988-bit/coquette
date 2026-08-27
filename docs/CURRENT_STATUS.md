# COQUETTE — Current Delivery Status

**Status date:** 2026-08-27  
**Canonical Blueprint:** `docs/ROADMAP.md`  
**Verified-state reference:** `docs/AUDIT.md`

## Current baseline

COQUETTE is an isolated Medusa v2 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime, Vercel storefront and COQUETTE Studio merchant experience.

The legacy `coquetteconcept.gr` Magento shop remains production until reconstruction, UAT and cutover gates pass. Magento Admin/database/filesystem/API access remains unavailable, so Phase 4 reconstructs only legitimately recoverable public storefront state and never invents private Magento-only values.

### Validated application baseline

- `main` application merge: `7a50b104de1af1f34479ec92c218a880bab01ebb`
- full COQUETTE CI: green on that exact merged application head
- COQUETTE Studio CI: green on that exact merged application head
- Railway release merge: `398074bc5355b80a318b0b5f8637272ee8566976`
- Railway `coquette-backend`: success on release commit `398074b…`
- Railway `coquette-worker`: success on release commit `398074b…`
- Vercel storefront: success on the same release history
- obsolete Vercel `backend`: still fails and must be removed/disconnected; it is not the Medusa runtime

A docs-only synchronization may advance the `main` commit after this application baseline without changing the validated application tree.

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
- clean PostgreSQL CI, Admin CRUD, payment/bootstrap, import/reconciliation, Railway artifact and storefront build gates

---

## Phase 4 — public reconstruction state

### Phase 4A–4S — shipped reconstruction foundation

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

No private Magento fact is fabricated and no qualitative stock signal is converted into an invented numeric quantity.

### Phase 4T — verified handoff reconciliation intake

**Status: SHIPPED TO `main`**

Delivered:

- one handoff archive is the receiver-side input
- handoff and embedded Phase 4P evidence are reverified before use
- capture ID/evidence checksums must match
- Phase 4N bundle is rebuilt from verified embedded ingestion state
- generated bundle is independently reverified
- unresolved review/URL state becomes deterministic worklists
- category/Brand/media requirements are emitted only from verified source state
- intake identity is checksum-bound and non-writing

The prior status document incorrectly described Phase 4T as active; AUDIT identified and this update corrects that drift.

### Phase 4U — dependency provisioning evidence

**Status: SHIPPED TO `main`**

Delivered and exact-head validated:

- deterministic evidence proving the required category, Brand and media target dependencies can be provisioned/verified before real staging import
- dependency states remain tied to accepted Phase 4 evidence rather than invented source facts
- full current-main CI passes the Phase 4U dependency-provisioning evidence contract
- clean migrations, Admin CRUD, payment/bootstrap, product/price lifecycle, Railway artifact and storefront build gates remain green

### Real-data boundary

**No real legacy catalogue reconstruction write has yet been performed against COQUETTE staging.**

The next unavoidable acquisition boundary is the authoritative operator-browser capture from an environment/network that can reach `coquetteconcept.gr` and satisfy the required provenance contract. Web retrieval is useful for research/audit but is not substituted for the required operator-local browser provenance.

After the handoff exists, receiver-side verification, reconstruction, review reconciliation, dependency planning and guarded staging import are automated/checksum-bound.

---

## COQUETTE Studio — merchant experience state

**Status: MATERIAL PHASE 5 IMPLEMENTATION SHIPPED**

Architectural rule:

> COQUETTE Studio is the primary day-to-day merchant experience. Medusa remains the authoritative commerce engine and technical administration foundation. Studio operates through constrained Medusa interfaces and never becomes a second system of record.

Shipped foundations include:

- branded high-class merchant experience direction
- Today/dashboard/personal-assistant model
- guarded Quick Draft product creation
- Guided New Piece editorial flow
- autosave/resume against Medusa drafts
- optimistic concurrency/stale-write protection
- managed product-media upload, ordering and cover selection
- human Size/Colour blueprint editing and review
- guarded creation of real Medusa option/variant graphs
- draft/provenance guards and product locking
- post-workflow structural verification
- source/Vercel static Studio parity contract
- explicit separation from SKU, pricing, inventory, sales-channel and publication mutation

Still required for Phase 5 exit:

- production-ready regular/sale pricing in Studio
- SKU/barcode management
- inventory quantities/location policy
- category/designer application flows
- merchandising and SEO application
- explicit publish/schedule/archive lifecycle
- broader order/customer/refund/fulfillment/payment/shipping/fiscal daily operations
- role-based acceptance and full merchant UAT

---

## Release/AUDIT recovery status

AUDIT identified that `main` and Railway `staging` had diverged badly and that Studio/backend work could outrun the deployed Medusa runtime.

**Resolved:**

1. `main` and `staging` release history were reconciled through controlled merges rather than force reset.
2. The reconciled Railway release deployed successfully to both server and worker.
3. Phase 4U was merged only after exact-head validation.
4. Studio guarded variant generation was refreshed against current `main`, revalidated and merged.
5. The resulting application tree was released again to Railway.
6. Both Railway services now report success on the same release commit `398074b…`.
7. Storefront is green.

**Remaining recovery cleanup:**

- remove/disconnect obsolete Vercel `backend` so its false red deployment signal disappears
- synchronize Blueprint/AUDIT/CURRENT_STATUS (this docs work)
- add appropriate GitHub branch/ruleset protection if account administration permits

---

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy reconstruction:** Technical chain very advanced through Phase 4U; real legacy capture/import pending.
- **Phase 5 — Merchant back office:** Material implementation shipped through COQUETTE Studio; full daily-operation parity pending.
- **Phase 6 — Storefront parity:** Materially advanced; real-data acceptance pending.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of original sequence; final real-data QA pending.
- **Phase 8 — Customer/cart/account:** Foundations materially implemented; final staging E2E pending.
- **Phase 9 — Checkout/payments:** Foundations materially implemented; provider E2E/business approval pending.
- **Phases 10–18:** governed by `docs/ROADMAP.md` and remain gated by real-data UAT/cutover readiness.

---

## Next executable milestones

1. finish docs synchronization and remove the obsolete Vercel backend signal;
2. acquire the authoritative legacy operator-browser handoff;
3. run verified handoff intake;
4. resolve only evidence-backed review/URL blockers until the Phase 4N bundle is staging-ready;
5. provision exact required categories/Brands and captured media into COQUETTE-owned storage;
6. build/reconcile the real verified dependency mapping plan;
7. complete backup/restore rehearsal before any real staging legacy-data write;
8. run guarded structural product import and guarded price import against staging;
9. reconcile catalogue/media/URL results;
10. complete Studio/storefront/payment/courier/fiscal/SEO/rollback UAT;
11. perform controlled production cutover only after Blueprint launch gates pass.

---

## Human/external dependencies

Needed before the next major data milestone:

- a browser/network environment capable of the authoritative `coquetteconcept.gr` operator capture
- continued public availability of the legacy storefront until accepted capture

Account-level cleanup may also require owner UI access:

- delete/disconnect obsolete Vercel `backend`
- configure GitHub branch/ruleset protection

Later launch dependencies include production payment/courier/AADE/email credentials, shipping/business policies, legal/privacy approval, DNS authority and merchant sign-off.

Do **not** yet change production DNS, disable Magento, activate production fiscal/payment/courier credentials or manually recreate legacy catalogue data.

---

## Fully-working-system boundary

The target is a working staging store and then a controlled cutover, not a permanent dry-run project.

COQUETTE remains intentionally pre-cutover until real reconstructed data is present in staging and the Blueprint's merchant UAT, payment/courier/fiscal, SEO redirect, backup/restore and rollback gates pass.
