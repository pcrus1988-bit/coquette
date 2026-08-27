# COQUETTE — Current Delivery Status

**Status date:** 2026-08-27  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2.19 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates pass.

Magento Admin/database/filesystem/API access is unavailable. Phase 4 reconstructs only legitimately recoverable public storefront state, supported by indexed evidence and explicit unavailable-data classification. Private Magento-only values are never guessed.

## Shipped to `main`

Through Phase 4M merge `4ed85681c11468838bc536f7f61f38e51616a906`.

### Platform and commerce foundation

- dedicated COQUETTE repository/workspace and environment isolation
- Medusa backend/Admin + bilingual Next.js storefront
- dedicated Supabase PostgreSQL/storage
- Railway server + worker + Redis-backed Medusa modules
- Vercel storefront connected to Railway Store API
- Greece/EUR region and fulfillment foundation
- Designer/Brand and bilingual Website Content modules
- EL/EN catalogue/PDP/Designer/Sale surfaces
- variant-aware cart/checkout
- PayPal and Klarna foundations
- clean PostgreSQL CI, Railway deployable-artifact build and storefront build gates

### Phase 4A–4E — public reconstruction foundation

- public HTML/media/URL capture with checksums and explicit incomplete states
- indexed public recovery baseline and provenance/freshness rules
- field-level evidence conflicts
- archive containment/traversal safety
- direct + indexed URL universe with unresolved/unavailable classification
- archive-native PDP reconstruction for categories, gallery media, options and configurable hints
- no fabricated SKU/source/type/status/visibility/category/media/brand IDs
- GitHub-hosted direct crawling remains correctly classified as Cloudflare-challenged instead of silently complete

### Phase 4F — deterministic structural product plan

Merged PR #49.

- candidates become `ready`, `blocked` or `rejected`
- structural checksum excludes price and inventory state
- configurable parents remain blocked until child identity/relationships are explicitly reconstructed
- category/media dependencies and duplicate identity gates fail closed

Canonical detail: `docs/migration/PRODUCT_IMPORT_PLAN.md`.

### Phase 4G — guarded structural product execution

Merged PR #50 as `c9b97033bbad2932d1ee5cd9a49d2a8eefdb351b`.

- dry-run by default
- staging-only explicit write authorization and exact database host/name verification
- supported Medusa product workflow
- no price or invented inventory quantity in structural payload
- COQUETTE-controlled serving-media requirement
- manifest-gap recovery, Product↔Brand linking and idempotent checkpoints

Canonical detail: `docs/migration/STAGING_PRODUCT_EXECUTION.md`.

### Phase 4H–4J — deterministic pricing and guarded price execution

Phase 4H merged as `fc17896cfe07d9060d05bde1d17a7afae95a80dc`.  
Phase 4J merged as `891e9111331161cd22a9b1b9a1f99b0ae6024b5c`.

- independent price checksum/manifest domain
- missing public price becomes explicit `unavailable`
- regular EUR and recovered sale prices use supported Medusa workflows
- no cents conversion, sale schedule or inventory quantity invented
- changed-price update, sale removal, live drift repair and foreign-sale protection are deterministic
- clean PostgreSQL CI proves pricing lifecycle

Canonical detail: `docs/migration/PRICE_RECONSTRUCTION_PLAN.md`.

### Phase 4I — Product ↔ Brand link execution

Merged PR #53 as `aad7837d26779c333c781f23edd37993f30a80c9`.

- mapped Brand target required for brand-bearing products
- exact existing relation accepted idempotently
- conflicting relation fails closed
- relation is created and re-verified through Medusa Link service

### Phase 4K — deterministic inventory evidence/accountability

Merged PR #55 as `f2c0dcd4d852e2750ef8d04ca894bdf7d9a58bfb`.

- qualitative public stock evidence is independent from numeric inventory
- `in_stock` never becomes `1`; `out_of_stock` never becomes `0`
- low-stock wording is never parsed into a guessed count
- missing/unknown evidence is explicitly unavailable
- no runtime inventory manifest or quantity writer exists

Canonical detail: `docs/migration/INVENTORY_EVIDENCE_PLAN.md`.

### Phase 4L — deterministic reconstruction review decisions

Merged PR #56 as `9d51e7005c8049a2b866c312bf30d03cd5328fb7`.

- every review item is bound to an exact evidence checksum
- stale decisions are invalid
- evidence selection can only choose an actually observed value
- publication target policy remains `policy_only`
- localization can be marked unavailable without inventing URLs
- configurable/child variant identity cannot be fabricated
- duplicate/orphan decisions fail reconciliation

Canonical detail: `docs/migration/RECONSTRUCTION_REVIEW_DECISIONS.md`.

### Phase 4M — apply validated evidence selections

Merged PR #57 as `4ed85681c11468838bc536f7f61f38e51616a906` after exact-head CI passed every gate, including Railway artifact and storefront build.

- applies only validated `evidence_selection` / `select_observed_value` decisions
- replacement value is read from the exact captured observation
- resolved structural conflict is removed only for the selected field
- candidate normalization and ProductImportPlan are rebuilt deterministically
- every applied decision retains review/evidence/observation/value checksums and reviewer metadata
- stale/unreconciled review plans apply zero changes
- `policy_only`, localization `unavailable` and `defer` never become recovered legacy facts
- configurable identity remains fail-closed
- Phase 4M itself performs no staging/production writes

Canonical detail: `docs/migration/REVIEW_DECISION_APPLICATION.md`.

No real COQUETTE staging or production reconstruction writes were performed while validating Phases 4I–4M.

## Active implementation

### Phase 4N — checksum-bound migration input reconciliation

Branch: `phase4/migration-input-reconciliation`.

Implemented on the branch:

- builds one canonical migration reconciliation bundle from the Phase 4F ingestion report plus Phase 4L decisions
- deterministically rebuilds the source ProductImportPlan from candidate records and blocks if the embedded report plan does not match
- applies Phase 4M evidence selections and derives reviewed ProductImportPlan, PricePlan and InventoryPlan
- requires capture artifact validation to pass
- requires the direct capture to be explicitly declared complete with no remaining capture failure reason
- requires at least one recovered product candidate
- requires zero open, deferred or invalid review items for staging readiness
- requires the reviewed ProductImportPlan to be executable
- requires the PricePlan to be reconciled; explicitly unavailable public prices remain warnings rather than invented values
- requires the InventoryPlan to be reconciled while remaining deliberately non-executable with zero runtime manifest entries
- requires the reconstruction URL universe to be fully classified with zero unresolved URLs
- records independent checksums for capture, candidates, source plan, decisions, review plan/application, reviewed product plan, price plan, inventory plan and URL universe
- records one deterministic bundle checksum; `generatedAt` does not affect bundle identity
- verifies embedded plan integrity and blocks tampered/stale bundle contents
- adds an operator CLI that writes an auditable reconciliation result and exits non-zero when staging readiness is not achieved
- Phase 4N itself performs no Medusa writes and emits no runtime inventory manifest

New CI gate:

1. checksum-bound migration input reconciliation contract proving complete-capture requirements, review closure, stale-plan rejection, URL classification, unavailable price/inventory accounting, cross-domain checksum independence and post-reconciliation tamper detection.

Canonical detail: `docs/migration/MIGRATION_INPUT_RECONCILIATION.md`.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4M shipped, Phase 4N active.
- **Phase 5 — Merchant back office parity:** Foundation started.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md`.

## Next Phase 4 milestones

1. make Phase 4N exact-head CI fully green and merge it;
2. replace the historical raw Phase 4F staging-executor input interfaces with mandatory verified Phase 4N reconciliation bundles;
3. obtain a complete useful direct legacy capture from an accepted legitimate operator/browser network;
4. ingest/reconcile the real archive and drive candidate/review/URL blockers toward zero without weakening evidence gates;
5. identify an authoritative exact inventory source before designing any numeric inventory execution path;
6. perform backup/restore rehearsal before any explicitly authorized real staging dry-run/write sequence.

## Production boundary

The legacy shop remains production. Phase 4N only freezes and verifies migration input; it cannot write migration targets. The existing historical Phase 4G/4J executors must not be used for a real staging write from a raw Phase 4F report. No real COQUETTE staging or production migration writes have been performed in this continuation. `coquetteconcept.gr` must not move until reconstruction reconciliation, COQUETTE-owned media recovery, merchant/customer UAT, payment/courier/fiscal testing, SEO redirect verification, rollback preparation and blueprint cutover gates pass.
