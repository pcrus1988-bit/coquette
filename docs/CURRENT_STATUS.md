# COQUETTE — Current Delivery Status

**Status date:** 2026-08-27  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2.19 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates pass.

Magento Admin/database/filesystem/API access is unavailable. Phase 4 therefore reconstructs only legitimately recoverable public storefront state, supported by indexed evidence and explicit unavailable-data classification. Private Magento-only values are never guessed.

## Shipped to `main`

Through Phase 4J merge `891e9111331161cd22a9b1b9a1f99b0ae6024b5c`.

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
- relationship repair works for new creation, manifest-gap recovery and same-checksum skip paths
- disposable PostgreSQL CI creates a real synthetic Product ↔ Brand relation and proves rerun idempotency
- Railway artifact and storefront builds passed before merge

### Phase 4J — guarded staging price execution

Merged PR #54 as `891e9111331161cd22a9b1b9a1f99b0ae6024b5c` after exact-head CI passed all gates.

- price-plan entries retain the structural product checksum
- pricing execution requires an imported structural product manifest entry with the exact structural checksum and concrete Medusa product target
- live SKU resolution must return exactly one Medusa variant on that imported product target
- independent price execution actions: `apply`, `skip`, `unavailable`, `blocked`
- same-checksum price imports are live-verified before skip
- changed public price checksums use an explicit deterministic update path while structural identity remains unchanged
- prior pending/error price checkpoints can retry; duplicate/reconciliation states fail closed
- regular EUR price writes through `updateProductVariantsWorkflow`
- recovered lower sale prices use a dedicated active Medusa `sale` price list with no invented dates/rules
- migration sale list is marked `coquette_migration_price_list=legacy-public-sale-v1`
- sale price create/update/removal uses Medusa's supported price-list batch workflow
- only migration-owned sale prices are removed when current public evidence no longer shows the sale
- conflicting active unrestricted foreign sale pricing blocks instead of producing ambiguous calculated prices
- post-write verification reads authoritative Pricing Module records through the variant price-set identity
- source-stable live pricing drift can be repaired and recorded
- disposable PostgreSQL CI proves regular+sale creation, identical rerun, deterministic price update and sale removal
- Railway deployable artifact and storefront build passed before merge

No real COQUETTE staging or production product/price migration writes were performed while validating Phases 4I–4J.

## Active implementation

### Phase 4K — deterministic inventory evidence/accountability

Branch: `phase4/deterministic-inventory-evidence`.

Implemented on the branch:

- inventory is separated from structural product and price domains
- qualitative public stock evidence can be `state_only`, `unavailable` or `blocked`
- inventory evidence checksum contains SKU, stock state and low-stock message only
- price/copy changes do not alter inventory evidence checksum
- stock-state/low-stock changes do alter the inventory evidence checksum
- `in_stock` is never converted to quantity `1`
- `out_of_stock` is never converted to quantity `0`
- low-stock wording is retained without numeric parsing/inference
- missing or explicit unknown public stock becomes an explained `unavailable` outcome
- conflicting direct/indexed stock evidence blocks inventory evidence for review
- structurally blocked products remain blocked in the inventory domain
- Phase 4K deliberately emits `runtimeManifestEntries: []`
- Phase 4K deliberately exposes `isExecutable: false`
- there is no Medusa inventory quantity write path in this phase

A numeric inventory execution phase is forbidden until an authoritative source exposes exact quantities tied to exact variant/location identities.

New CI gate:

1. deterministic inventory evidence contract proving state-only accounting, checksum independence, conflict blocking and absence of any numeric inventory/runtime-manifest inference.

Canonical detail: `docs/migration/INVENTORY_EVIDENCE_PLAN.md`.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4J shipped, Phase 4K active.
- **Phase 5 — Merchant back office parity:** Foundation started.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md`.

## Next Phase 4 milestones

1. make Phase 4K exact-head CI fully green and merge it;
2. add explicit review decisions for unresolved publication/visibility, localization and variant identity;
3. obtain a useful direct legacy capture from an accepted legitimate operator/browser network;
4. ingest/reconcile the archive and drive candidate/import-plan/URL-universe blockers toward zero without weakening evidence gates;
5. identify an authoritative exact inventory source before designing any numeric inventory execution path;
6. only after backup/restore rehearsal and migration-input reconciliation, consider an explicitly authorized real staging dry-run/write sequence.

## Production boundary

The legacy shop remains production. Phase 4K is evidence/accountability only and cannot write inventory. No real COQUETTE staging or production migration writes have been performed in this continuation. `coquetteconcept.gr` must not move until reconstruction reconciliation, COQUETTE-owned media recovery, merchant/customer UAT, payment/courier/fiscal testing, SEO redirect verification, rollback preparation and blueprint cutover gates pass.
