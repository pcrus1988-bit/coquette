# COQUETTE — Current Delivery Status

**Status date:** 2026-08-27  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2.19 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates pass.

Magento Admin/database/filesystem/API access is unavailable. Phase 4 reconstructs only legitimately recoverable public storefront state, supported by indexed evidence and explicit unavailable-data classification. Private Magento-only values are never guessed.

## Shipped to `main`

Through **Phase 4N** merge `bfcafa9b7e9deb254c62a19ecf987dca9628188d`.

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

### Phase 4F–4G — structural plan and guarded product execution

Phase 4G merged as `c9b97033bbad2932d1ee5cd9a49d2a8eefdb351b`.

- candidates become `ready`, `blocked` or `rejected`
- structural checksum excludes price and inventory state
- configurable parents stay blocked until child identity/relationships are explicitly reconstructed
- category/media dependencies and duplicate identity gates fail closed
- product execution is dry-run by default and staging-only in write mode
- exact database host/name verification, COQUETTE-owned serving media, SKU collision protection, manifest recovery and Product↔Brand linking remain enforced

Canonical detail: `docs/migration/PRODUCT_IMPORT_PLAN.md` and `docs/migration/STAGING_PRODUCT_EXECUTION.md`.

### Phase 4H–4J — pricing reconstruction and guarded price execution

Phase 4H merged as `fc17896cfe07d9060d05bde1d17a7afae95a80dc`.  
Phase 4J merged as `891e9111331161cd22a9b1b9a1f99b0ae6024b5c`.

- independent price checksum/manifest domain
- missing public price becomes explicit `unavailable`
- regular EUR and recovered sale prices use supported Medusa workflows
- no cents conversion, sale schedule or inventory quantity invented
- changed-price update, sale removal, live drift repair and foreign-sale protection are deterministic
- clean PostgreSQL CI proves the pricing lifecycle

Canonical detail: `docs/migration/PRICE_RECONSTRUCTION_PLAN.md`.

### Phase 4I — Product ↔ Brand link execution

Merged as `aad7837d26779c333c781f23edd37993f30a80c9`.

- mapped Brand target required for brand-bearing products
- exact existing relation accepted idempotently
- conflicting relation fails closed
- relation is created and re-verified through Medusa Link service

### Phase 4K — deterministic inventory evidence/accountability

Merged as `f2c0dcd4d852e2750ef8d04ca894bdf7d9a58bfb`.

- qualitative public stock evidence is independent from numeric inventory
- `in_stock` never becomes `1`; `out_of_stock` never becomes `0`
- low-stock wording is never parsed into a guessed count
- missing/unknown evidence is explicitly unavailable
- no runtime inventory manifest or quantity writer exists

Canonical detail: `docs/migration/INVENTORY_EVIDENCE_PLAN.md`.

### Phase 4L — deterministic reconstruction review decisions

Merged as `9d51e7005c8049a2b866c312bf30d03cd5328fb7`.

- every review item is bound to an exact evidence checksum
- stale decisions are invalid
- evidence selection can only choose an actually observed value
- publication target policy remains `policy_only`
- localization can be marked unavailable without inventing URLs
- configurable/child variant identity cannot be fabricated
- duplicate/orphan decisions fail reconciliation

Canonical detail: `docs/migration/RECONSTRUCTION_REVIEW_DECISIONS.md`.

### Phase 4M — apply validated evidence selections

Merged as `4ed85681c11468838bc536f7f61f38e51616a906`.

- only validated `evidence_selection` decisions alter reconstructed source facts
- selected replacement comes from the exact captured observation
- candidate normalization/ProductImportPlan are rebuilt deterministically
- audit retains review/evidence/observation/value checksums and reviewer metadata
- stale/unreconciled plans apply zero changes
- policy-only, unavailable and deferred decisions never become recovered source facts

Canonical detail: `docs/migration/REVIEW_DECISION_APPLICATION.md`.

### Phase 4N — checksum-bound migration input reconciliation

Merged PR #58 as `bfcafa9b7e9deb254c62a19ecf987dca9628188d` after corrected exact-head CI passed every gate, including Railway artifact and storefront build.

- creates one canonical reconciliation bundle from Phase 4F capture evidence and Phase 4L decisions
- deterministically rebuilds and cross-checks the source ProductImportPlan
- includes Phase 4M reviewed product plan plus independent price and inventory plans
- requires valid explicitly complete direct capture
- requires zero open/deferred/invalid review items
- requires a fully classified URL universe with zero unresolved URLs
- requires executable reviewed structural product plan and reconciled pricing/inventory evidence
- inventory remains deliberately non-executable with zero runtime manifest entries
- missing public price/inventory may be explicitly unavailable but is never invented
- independent domain checksums plus deterministic bundle checksum detect stale/tampered inputs
- operator CLI emits an auditable bundle and non-zero status when staging readiness is not achieved
- Phase 4N itself performs no Medusa writes

Canonical detail: `docs/migration/MIGRATION_INPUT_RECONCILIATION.md`.

No real COQUETTE staging or production reconstruction writes were performed while validating Phases 4I–4N.

## Active implementation

### Phase 4O — mandatory reconciled staging input

Branch: `phase4/require-reconciled-staging-input`.

Implemented on the branch:

- shared staging input loader requires `COQUETTE_STAGING_MIGRATION_INPUT_BUNDLE`
- requires independent `COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM` pin
- verifies the full Phase 4N bundle before product/price preflight
- rejects historical `COQUETTE_STAGING_PRODUCT_IMPORT_REPORT` and `COQUETTE_STAGING_PRICE_IMPORT_REPORT` whenever present
- structural product executor consumes only `bundle.productPlan`
- price executor consumes only `bundle.pricePlan`; it no longer rebuilds pricing from a raw structural report
- all Phase 4G staging database/write/media/dependency/manifest/Brand guards remain in force
- all Phase 4J structural-product/variant/price-list/pricing-verification guards remain in force
- product and price executor logs include the accepted bundle checksum
- price-only evidence changes require a new reconciled bundle and matching updated checksum pin while retaining stable structural checksum
- clean-database product lifecycle contract now uses a ready Phase 4N bundle
- clean-database price create/idempotent-update/sale-removal lifecycle uses successive ready and re-pinned Phase 4N bundles
- pure staging-input contract rejects missing bundle/checksum, wrong checksum, tampered bundle and either legacy raw-report env variable
- no numeric inventory writer is introduced
- no real staging/production migration write is performed during validation

Canonical detail: `docs/migration/STAGING_MIGRATION_INPUT.md`.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4N shipped, Phase 4O active.
- **Phase 5 — Merchant back office parity:** Foundation started.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md`.

## Next Phase 4 milestones

1. make Phase 4O exact-head CI fully green and merge it;
2. obtain a complete useful direct legacy capture from an accepted legitimate operator/browser network;
3. ingest/reconcile the real archive and drive candidate/review/URL blockers toward zero without weakening evidence gates;
4. prepare dependency/media mapping from the reconciled real capture;
5. identify an authoritative exact inventory source before designing any numeric inventory execution path;
6. perform backup/restore rehearsal before any explicitly authorized real staging dry-run/write sequence.

## Production boundary

The legacy shop remains production. Phase 4O hardens migration input but does not authorize a real migration. No real COQUETTE staging or production reconstruction writes have been performed in this continuation. `coquetteconcept.gr` must not move until reconstruction reconciliation, COQUETTE-owned media recovery, merchant/customer UAT, payment/courier/fiscal testing, SEO redirect verification, rollback preparation and blueprint cutover gates pass.
