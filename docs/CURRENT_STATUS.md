# COQUETTE — Current Delivery Status

**Status date:** 2026-08-27  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2.19 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates pass.

Magento Admin/database/filesystem/API access is unavailable. Phase 4 reconstructs only legitimately recoverable public storefront state, supported by indexed evidence and explicit unavailable-data classification. Private Magento-only values are never guessed.

## Shipped to `main`

Through Phase 4L merge `9d51e7005c8049a2b866c312bf30d03cd5328fb7`.

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
- GitHub-hosted direct crawling correctly classified as Cloudflare-challenged rather than silently treated as complete

### Phase 4F — deterministic structural product plan

Merged PR #49.

- every candidate becomes `ready`, `blocked` or `rejected`
- structural checksum excludes price and inventory state
- configurable parents remain blocked until child identities/relationships are reconstructed
- category/media dependencies are mandatory for automatic structural import
- duplicate candidate/SKU/source/runtime identities block execution

Canonical detail: `docs/migration/PRODUCT_IMPORT_PLAN.md`.

### Phase 4G — guarded structural product execution

Merged PR #50 as `c9b97033bbad2932d1ee5cd9a49d2a8eefdb351b`.

- dry-run by default
- staging-only explicit write authorization and exact database host/name verification
- supported `createProductsWorkflow` path
- no price or invented inventory quantity in structural product payload
- COQUETTE-controlled serving-media requirement; no legacy hotlinks
- SKU collision protection and manifest-gap recovery
- atomic product-manifest checkpoints and retry/error semantics
- clean-DB CI proves synthetic product creation and rerun idempotency

Canonical detail: `docs/migration/STAGING_PRODUCT_EXECUTION.md`.

### Phase 4H — deterministic public price plan

Merged PR #52 as `fc17896cfe07d9060d05bde1d17a7afae95a80dc`.

- independent `price` manifest domain
- explicit regular EUR price required for automatic price planning
- optional sale price must be positive and strictly lower than regular price
- missing public price becomes explicit `unavailable`
- pricing conflicts remain in the pricing domain instead of blocking otherwise valid structural reconstruction
- price checksum contains SKU/currency/regular/sale only
- Medusa major-unit price semantics preserved; no cents multiplication
- no sale schedule or inventory quantity invented

Canonical detail: `docs/migration/PRICE_RECONSTRUCTION_PLAN.md`.

### Phase 4I — Product ↔ Brand link execution

Merged PR #53 as `aad7837d26779c333c781f23edd37993f30a80c9` after exact-head CI passed all gates.

- imported Brand mapping is required for brand-bearing products
- Brand target is never substituted with metadata
- write mode verifies the mapped Brand exists
- exact existing Product ↔ Brand link is accepted idempotently
- conflicting existing Brand link fails closed
- missing relationship is created through Medusa's Link service and re-queried before product manifest completion
- disposable PostgreSQL CI creates a real synthetic Product ↔ Brand relation and proves rerun idempotency

### Phase 4J — guarded staging price execution

Merged PR #54 as `891e9111331161cd22a9b1b9a1f99b0ae6024b5c` after exact-head CI passed all gates.

- pricing requires the exact imported structural product checksum/target
- live SKU must resolve to exactly one variant on that exact product
- regular EUR and migration-owned sale prices use supported Medusa workflows
- changed-price updates, sale removal, live drift repair and foreign-sale protection are deterministic
- post-write verification reads authoritative Pricing Module records
- disposable PostgreSQL CI proves create/rerun/update/sale-removal lifecycle

Canonical detail: `docs/migration/PRICE_RECONSTRUCTION_PLAN.md`.

### Phase 4K — deterministic inventory evidence/accountability

Merged PR #55 as `f2c0dcd4d852e2750ef8d04ca894bdf7d9a58bfb` after exact-head CI passed all gates.

- qualitative public stock evidence is separated from numeric inventory
- `in_stock` is never converted to quantity `1`
- `out_of_stock` is never converted to quantity `0`
- low-stock wording is not parsed into an invented count
- missing/unknown stock is explicitly unavailable; conflicts block review
- no runtime inventory manifest or quantity write path exists
- exact-head CI proved no numeric inventory inference

Canonical detail: `docs/migration/INVENTORY_EVIDENCE_PLAN.md`.

### Phase 4L — deterministic reconstruction review decisions

Merged PR #56 as `9d51e7005c8049a2b866c312bf30d03cd5328fb7` after exact-head CI passed all gates.

- deterministic review items cover structural conflicts, missing required fields, localization pairing and variant/duplicate identity blockers
- every review item has an exact evidence checksum; stale decisions are invalid
- evidence selections must reference an actual observation already present on the exact review item
- missing publication values may receive constrained target policy, but remain explicitly `policy_only`
- missing alternate-locale pairing may be marked unavailable without inventing a URL
- configurable/child variant identity cannot be manually fabricated
- duplicate/orphan decisions make review unreconciled
- reviewer, timestamp and rationale are mandatory
- review validation itself is non-executable and performs no migration writes

Canonical detail: `docs/migration/RECONSTRUCTION_REVIEW_DECISIONS.md`.

No real COQUETTE staging or production reconstruction writes were performed while validating Phases 4I–4L.

## Active implementation

### Phase 4M — apply validated review evidence selections

Branch: `phase4/apply-review-evidence-selections`.

Implemented on the branch:

- consumes the exact Phase 4L review plan for current candidates/product plan/decisions
- applies only decisions validated as `decided` + `evidence_selection` + `select_observed_value`
- selected replacement values are read from the exact captured observation, never from free-form reviewer input
- resolved structural conflict is removed only for the selected field
- candidate disposition and normalized product are recomputed from the remaining evidence/blockers
- the full deterministic product import plan is rebuilt after evidence selection
- every applied selection receives an audit record with review/evidence/observation/value checksums, reviewer, timestamp and rationale
- stale or otherwise unreconciled review plans apply zero decisions and return the original candidates/product plan with a global blocker
- publication `policy_only`, localization `unavailable`, and `defer` records are deliberately skipped and never become recovered legacy facts
- configurable variant deferral leaves the product blocked
- price/inventory conflicts remain independent and are not erased by structural review application
- Phase 4M itself exposes `isExecutable: false`; it performs no Medusa/staging/production write
- a resulting ProductImportPlan may become structurally executable after legitimate evidence conflict resolution, but only the existing guarded Phase 4G executor may later consume it

New CI gate:

1. review evidence-selection application contract proving conflict resolution, provenance retention, stale-plan all-or-nothing behavior, policy/localization/defer non-application, configurable fail-closed behavior and price-domain independence.

Canonical detail: `docs/migration/REVIEW_DECISION_APPLICATION.md`.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4L shipped, Phase 4M active.
- **Phase 5 — Merchant back office parity:** Foundation started.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md`.

## Next Phase 4 milestones

1. make Phase 4M exact-head CI fully green and merge it;
2. integrate reviewed/reconciled product plans into capture-ingestion/reconciliation inputs without allowing policy-only/unavailable/deferred records to alter source facts;
3. obtain a useful direct legacy capture from an accepted legitimate operator/browser network;
4. ingest/reconcile the archive and drive candidate/import-plan/URL-universe blockers toward zero without weakening evidence gates;
5. identify an authoritative exact inventory source before designing any numeric inventory execution path;
6. only after backup/restore rehearsal and migration-input reconciliation, consider an explicitly authorized real staging dry-run/write sequence.

## Production boundary

The legacy shop remains production. Phase 4M only derives reviewed reconstruction output and cannot write migration targets. No real COQUETTE staging or production migration writes have been performed in this continuation. `coquetteconcept.gr` must not move until reconstruction reconciliation, COQUETTE-owned media recovery, merchant/customer UAT, payment/courier/fiscal testing, SEO redirect verification, rollback preparation and blueprint cutover gates pass.
