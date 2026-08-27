# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2 / Next.js commerce platform with dedicated source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates are satisfied.

Magento Admin/database/filesystem/API access is no longer available. Phase 4 reconstructs the recoverable legacy shop from the **public storefront**, supported by indexed public evidence and explicit unavailable-data classification. Private Magento-only data is never guessed.

## Shipped to `main`

Through Phase 4F merge `37fb4779c9780eff02b82ed7d233f92be5363e13`:

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

## Active implementation

### Phase 4G — guarded staging structural product execution

Branch: `phase4/staging-import-execution`.

Implemented on the branch:

- dependency-aware execution plan with `create`, `skip`, `blocked`
- requires Phase 4F executable plan plus matching pending runtime product manifest entries
- category source URLs must map to already-imported Medusa category IDs
- product media source URLs must map to HTTPS URLs on explicitly allowed COQUETTE serving-media hosts
- `coquetteconcept.gr` is forbidden as a serving-media host, preventing legacy hotlinks
- duplicate dependency mappings block the entire execution plan
- simple products only; configurable products remain blocked upstream
- Product ↔ Brand relationship is not silently represented as metadata: any `brandSourceId` remains blocked until the actual module-link execution path exists
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

Canonical detail: `docs/migration/STAGING_PRODUCT_EXECUTION.md`.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4F shipped, Phase 4G active.
- **Phase 5 — Merchant back office parity:** Foundation started.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md` and documented exit gates.

## Next Phase 4 source milestones

1. validate and merge Phase 4G without staging/production side effects outside its clean CI database contract;
2. implement Brand-link execution before any brand-bearing product can be marked structurally imported;
3. create separate deterministic price-list and inventory plans/manifests rather than extending the product manifest beyond its domain;
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

The legacy shop remains production. Phase 4G is **not** a production import or cutover tool. `coquetteconcept.gr` must not move to the replacement until public reconstruction reconciliation, COQUETTE-owned media recovery, merchant/customer UAT, payment/courier/fiscal testing, SEO redirect verification, rollback preparation and roadmap cutover gates pass.
