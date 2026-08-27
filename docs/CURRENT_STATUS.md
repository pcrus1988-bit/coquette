# COQUETTE — Current Delivery Status

**Status date:** 2026-08-27  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2.19 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates pass.

Magento Admin/database/filesystem/API access is unavailable. Phase 4 therefore reconstructs only legitimately recoverable public storefront state, supported by indexed evidence and explicit unavailable-data classification. Private Magento-only values are never guessed.

## Shipped to `main`

Through Phase 4I merge `aad7837d26779c333c781f23edd37993f30a80c9`.

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

No real COQUETTE staging or production migration writes were performed while validating Phase 4I.

## Active implementation

### Phase 4J — guarded staging price execution

Branch: `phase4/guarded-staging-price-execution`.

Implemented on the branch:

- price-plan entries now retain the structural product checksum
- pricing execution requires an imported structural product manifest entry with the exact same structural checksum and concrete Medusa product target
- live SKU resolution must return exactly one Medusa variant whose `product_id` equals that imported product target
- independent price execution actions: `apply`, `skip`, `unavailable`, `blocked`
- same-checksum imported price manifest becomes `skip` but live pricing is still verified
- changed public price checksum becomes `apply` through an explicit update strategy when structural identity remains current
- prior pending/error price states can retry; prior skipped state blocks for reconciliation
- duplicate product/price manifest identities block execution
- explicit unavailable public prices remain non-write outcomes
- regular EUR price is written through `updateProductVariantsWorkflow`
- recovered sale prices use a dedicated active Medusa `sale` price list with no invented start/end dates or rules
- migration sale list is identified by metadata marker `coquette_migration_price_list=legacy-public-sale-v1`
- a duplicated or merchant-altered migration sale list fails closed
- sale prices are created/updated/removed through Medusa's supported price-list batch workflow
- only the dedicated migration sale price is removed when public evidence no longer shows a sale
- active unrestricted foreign sale pricing on a migration target blocks execution to avoid ambiguous calculated pricing
- live regular/sale price state is re-queried and verified before the independent price manifest is checkpointed
- source-checksum-stable live pricing drift can be repaired and recorded with a manifest warning
- write mode reuses the existing staging-only exact database guard
- no inventory quantities are touched
- no real staging/production price import has been executed

New CI gates:

1. pure guarded price-execution preflight contract;
2. disposable PostgreSQL price lifecycle contract that first creates the structural product through the guarded product importer, then proves regular+sale price creation, same-input idempotency, changed-price update and sale removal while the structural checksum remains unchanged.

Canonical detail: `docs/migration/PRICE_RECONSTRUCTION_PLAN.md`.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4I shipped, Phase 4J active.
- **Phase 5 — Merchant back office parity:** Foundation started.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md`.

## Next Phase 4 milestones

1. make Phase 4J exact-head CI fully green and merge it;
2. create a separate deterministic inventory plan/manifest without inventing quantities where public evidence reveals only stock state;
3. add explicit review decisions for unresolved publication/visibility, localization and variant identity;
4. obtain a useful direct legacy capture from an accepted legitimate operator/browser network;
5. ingest/reconcile the archive and drive candidate/import-plan/URL-universe blockers toward zero without weakening evidence gates;
6. only after backup/restore rehearsal and migration-input reconciliation, consider an explicitly authorized real staging dry-run/write sequence.

## Production boundary

The legacy shop remains production. Phase 4J is not a production cutover tool. No real COQUETTE staging or production price writes have been performed in this continuation. `coquetteconcept.gr` must not move until reconstruction reconciliation, COQUETTE-owned media recovery, merchant/customer UAT, payment/courier/fiscal testing, SEO redirect verification, rollback preparation and blueprint cutover gates pass.
