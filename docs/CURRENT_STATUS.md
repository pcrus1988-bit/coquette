# COQUETTE — Current Delivery Status

**Status date:** 2026-08-27  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2 / Next.js commerce platform with dedicated source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates are satisfied.

Magento Admin/database/filesystem/API access is no longer available. Phase 4 reconstructs the recoverable legacy shop from the **public storefront**, supported by indexed public evidence and explicit unavailable-data classification. Private Magento-only data is never guessed.

## Shipped to `main`

Through Phase 4H merge `fc17896cfe07d9060d05bde1d17a7afae95a80dc`.

### Platform / managed infrastructure

- dedicated COQUETTE repository/workspace and environment separation
- Medusa v2.19 backend/Admin + Next.js bilingual storefront
- dedicated Supabase PostgreSQL 17 project and COQUETTE-only storage
- Railway Medusa server + separate worker + Redis-backed Medusa modules
- Vercel storefront connected to Railway Store API
- Greece/EUR region, stock/fulfillment foundation and EL/EN localization
- verified S3 file-provider smoke path
- Supabase Data API roles blocked from direct Medusa commerce-table access
- Node 22.22+ and clean-database CI

### Merchant / commerce foundation

- Designer/Brand and bilingual Website Content modules
- workflow-backed Admin CRUD contracts
- EL/EN catalogue/PDP/Designer/Sale surfaces
- search, sorting and Color/Size/Designer filters
- persistent variant-aware cart and bilingual checkout
- live shipping-option/rate retrieval and authoritative totals
- PayPal backend + browser approval flow
- Klarna backend/callback foundation

### Phase 4A–4E — public reconstruction foundation

- public HTML/media/URL capture tooling with checksums and explicit incomplete states
- indexed recovery baseline with provenance/freshness rules
- provenance-aware recovery candidates and field-level conflicts
- archive containment / symlink / traversal safety
- direct + indexed URL universe with explicit unresolved/unavailable classification
- archive-native PDP reparsing for categories, gallery media, option groups and explicit configurable-product evidence
- generic PDP media separated from importable product gallery media
- no fabricated SKU/source/type/status/visibility/category/media/brand IDs
- GitHub-hosted crawler/browser attempts correctly classified as Cloudflare-challenged and incomplete

### Phase 4F — deterministic product import planning

- merged PR #49
- every candidate becomes `ready`, `blocked`, or `rejected`
- runtime product manifest is generated only for fully validated, identity-safe candidates
- duplicate candidate/SKU/source/runtime keys block execution
- configurable products are blocked until child variant identities and relationships are explicitly reconstructed
- import boundary requires recovered category and captured product-media relationships
- foreign-host source/category/media URLs are rejected
- product semantic checksum is entity-scoped and excludes price, sale-price, currency, stock/low-stock state and evidence timestamps
- price and inventory remain separate migration domains
- optional runtime manifest output is refused when any product remains blocked/rejected
- CI covers identity collisions, configurable blocking and product-vs-price/inventory checksum separation

Canonical details:

- `docs/migration/PRODUCT_STRUCTURE_EVIDENCE.md`
- `docs/migration/PRODUCT_IMPORT_PLAN.md`

### Phase 4G — guarded staging structural product execution

- merged PR #50 as `c9b97033bbad2932d1ee5cd9a49d2a8eefdb351b`
- dependency-aware execution plan with `create`, `skip`, `blocked`
- requires Phase 4F executable plan plus matching pending runtime product manifest entries
- category source URLs must map to already-imported Medusa category IDs
- product media source URLs must map to HTTPS URLs on explicitly allowed COQUETTE serving-media hosts
- `coquetteconcept.gr` is forbidden as a serving-media host, preventing legacy hotlinks
- duplicate dependency mappings block the entire execution plan
- simple products only; configurable products remain blocked upstream
- Phase 4G deliberately blocked any `brandSourceId` until the real Product ↔ Brand module-link execution path existed; Phase 4I is implementing that remaining structural dependency
- prior imported same-checksum products become `skip`
- prior imported changed-checksum products are blocked until an explicit update path exists
- prior `pending`/`error` same-checksum entries may retry; changed-checksum retries block
- product creation payload contains no price and no invented inventory quantity
- simple variant uses `manage_inventory: true` and `allow_backorder: false`; inventory levels remain a later migration domain
- default mode is dry-run
- write mode requires explicit staging-only confirmation plus exact DATABASE_URL host/database-name match
- write mode queries Medusa by SKU before create and recovers a manifest gap only when migration source ID + structural checksum metadata match exactly
- product creation uses Medusa `createProductsWorkflow`, one product per checkpoint
- product manifest is persisted atomically after each success/recovery/error
- clean-database CI contract creates one synthetic structural product and reruns the migration to prove SKU idempotency/no duplication
- exact-head CI for commit `1a51f0c8af26b61be5f359d45ad755c6378b2e47` passed preflight, clean-DB idempotency, migrations, Railway deployable artifact build and storefront build before merge

Canonical detail: `docs/migration/STAGING_PRODUCT_EXECUTION.md`.

### Phase 4H — deterministic public price reconstruction plan

- merged PR #52 as `fc17896cfe07d9060d05bde1d17a7afae95a80dc`
- independent `price` migration plan and manifest domain
- consumes only evidence-gated structurally ready product identities
- structural readiness is now genuinely independent from price/inventory-domain defects: pricing and stock conflicts remain recorded for their own downstream domains but no longer make an otherwise complete structural product non-ready
- explicit regular price + explicit EUR currency required for automatic price planning
- optional sale price must be finite, positive and strictly lower than regular price
- missing public price becomes explicit `unavailable`, never zero or guessed
- sale without regular price, missing currency, zero/negative/non-finite values, non-discounting sale markup and unresolved pricing-evidence conflicts block the price domain
- price semantic checksum includes SKU, currency, regular price and optional sale price only
- structural copy/media/category changes do not alter the price checksum
- price changes do not alter the product structural checksum
- price manifest source keys use `entityType=price` and inherit the legacy product source URL/explicit locale
- Medusa v2.19 major-unit price semantics are preserved; recovered EUR amounts are not multiplied by 100
- no staging/production price write path in Phase 4H
- no sale start/end dates are invented
- exact inventory remains independently blocked where public evidence does not reveal quantities
- the first Phase 4H CI run exposed the previous readiness coupling; it was corrected rather than weakening the contract
- corrected exact head `e8e0e7ecc6369df750a4b8e848f79b470a16644a` passed typecheck, lint, all reconstruction contracts, migrations, Admin CRUD, provider registration, commerce bootstrap, Sale pricing graph, clean-DB structural idempotency, Railway artifact build and storefront build before merge

Canonical detail: `docs/migration/PRICE_RECONSTRUCTION_PLAN.md`.

## Active implementation

### Phase 4I — Product ↔ Brand structural link execution

Branch: `phase4/product-brand-link-execution`.

Implemented on the branch so far:

- a brand-bearing structural product remains blocked unless its recovered `brandSourceId` maps to an imported Brand target ID
- a valid Brand dependency mapping now unblocks structural execution instead of hitting the former `brand_link_execution_not_implemented` sentinel
- the Brand target is not embedded in product metadata or treated as a pseudo relationship
- write mode verifies the mapped Brand target resolves to a real COQUETTE Brand
- the importer queries the existing Product ↔ Brand relationship before writing
- an exact pre-existing link is accepted idempotently
- a conflicting pre-existing Brand link fails closed
- a missing link is created through Medusa's Link service using the existing Product/Brand module link and then re-queried for exact verification
- relationship verification is performed for newly created products, SKU/metadata manifest-gap recovery and same-checksum `skip` paths
- the product manifest is marked `imported` only after the required relationship is verified
- if product creation succeeded but relationship execution/checkpointing failed, a retry can recover the same SKU by exact migration metadata, complete the relationship and checkpoint without duplicating the product
- dry-run remains write-free and exposes the resolved Brand target in its plan output
- existing staging-only database write guards remain unchanged
- preflight contract now proves mapped Brand dependencies unblock execution without leaking the Brand into the product payload
- disposable clean-DB integration contract now creates a synthetic Brand and requires actual Product ↔ Brand link creation plus idempotent rerun
- no real COQUETTE staging or production migration writes have been attempted

Canonical detail: `docs/migration/STAGING_PRODUCT_EXECUTION.md`.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4H shipped, Phase 4I active.
- **Phase 5 — Merchant back office parity:** Foundation started.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md` and documented exit gates.

## Next Phase 4 source milestones

1. validate and merge Phase 4I without any real staging/production migration side effects;
2. add guarded staging price execution that resolves the imported variant, writes the regular EUR price and represents recovered lower sale prices through Medusa's `sale` price-list path with idempotent checkpoints;
3. create a separate deterministic inventory plan/manifest while keeping exact quantities unavailable wherever the public legacy shop does not reveal them;
4. add explicit merchant/reviewer decisions for unresolved publication/visibility, localization and variant identity where public evidence is insufficient;
5. run a useful direct capture from an accepted legitimate operator/browser network;
6. ingest the archive and drive candidate/import-plan/URL-universe blockers toward zero without weakening evidence gates.

## Phase 4 exit boundary

Phase 4 completes only when direct public reconstruction/import is repeatable; every discovered in-scope public URL is reconstructed or explicitly classified; media is COQUETTE-owned; EL/EN and redirect relationships reconcile; product/price/inventory manifests remain independently accountable; reruns are idempotent; and there is zero unexplained critical variance. Unavailable private Magento-only data is documented, never invented.

## Operational follow-ups

- issue #40 — staging backup/non-destructive restore rehearsal
- issue #41 — `main` protection and secret-scanning/push-protection verification
- successful direct legacy capture still requires an accepted operator/browser network because GitHub-hosted runners are challenged by Cloudflare

## Production boundary

The legacy shop remains production. Phase 4I is **not** a production import or cutover tool. No real staging/production structural importer execution has been performed in this continuation, and Phase 4H introduced no pricing writes. `coquetteconcept.gr` must not move to the replacement until public reconstruction reconciliation, COQUETTE-owned media recovery, merchant/customer UAT, payment/courier/fiscal testing, SEO redirect verification, rollback preparation and roadmap cutover gates pass.
