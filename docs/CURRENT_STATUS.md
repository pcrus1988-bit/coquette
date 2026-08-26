# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2 / Next.js commerce platform with dedicated source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates are satisfied.

Magento Admin/database/filesystem/API access is no longer available. Phase 4 reconstructs the recoverable legacy shop from the **public storefront**, supported by indexed public evidence and explicit unavailable-data classification. Private Magento-only data is never guessed.

## Shipped to `main`

Through Phase 4E merge `b914d78d1ff3ba3d6cb9b97594f804a1ba22b6c8`:

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

### Phase 4A — direct public capture

- HTTP/browser public-storefront preservation tooling
- raw HTML, URL inventory, product observations and same-host media
- robots/sitemap/pagination handling
- checksums and explicit incomplete/error states
- GitHub-hosted runner tests proving the legacy Cloudflare configuration blocks useful automated capture from that network

### Phase 4B — indexed recovery

- provenance/freshness-preserving indexed catalogue baseline
- catalogue-scale/category/designer/product recovery signals
- explicit secondary-evidence rules and CI contract

### Phase 4C — recovery candidates

- `ready` / `needs_review` / `rejected` intermediate candidates
- field-level evidence authority/conflicts
- indexed/derived evidence cannot set stock
- indexed-only evidence cannot become auto-ready
- no fabricated SKU/source ID/type/status/visibility/categories/options/media

### Phase 4D — capture ingestion and URL universe

- merged PR #47
- validated Phase 4A archive ingestion
- host/evidence/timestamp/archive-path provenance validation
- symlink-aware real-path containment before archived file reads
- direct + indexed URL universe with explicit unresolved/unavailable states
- off-domain URL exclusion
- operator ingestion/reconciliation report and headed-browser runbook
- traversal/symlink filesystem contract in CI

### Phase 4E — public product structure evidence

- merged PR #48
- archive-native PDP reparsing; existing Phase 4A archives gain structure without recapture
- general page media separated from actual product-gallery evidence
- product gallery restricted to Product JSON-LD, same-product OpenGraph evidence and explicit Magento gallery/product-media regions
- gallery media must also exist as successfully captured media before satisfying `mediaSourceIds`
- logo/footer/editorial/related-product media cannot become product gallery automatically
- category relationships recovered from public BreadcrumbList/visible breadcrumbs using legacy URLs as source keys
- explicit select option groups recovered without flattening multi-value options
- explicit Magento configurable-product client evidence may set `type=configurable`; absence never infers `simple`
- public reachability still does not infer private Magento `status` or exact `visibility`
- archive-native end-to-end product-structure contract in CI

Canonical detail: `docs/migration/PRODUCT_STRUCTURE_EVIDENCE.md`.

## Active implementation

### Phase 4F — deterministic product import planning

Branch: `phase4/import-manifest-generation`.

Current implementation:

- introduces a separate import-plan layer before runtime migration state
- every recovery candidate is accounted as `ready`, `blocked`, or `rejected`
- runtime `pending` manifest entries are generated only for fully validated, identity-safe candidates
- semantic source checksum excludes evidence timestamps/provenance so a newer capture alone does not force product re-import
- planning checksum separately tracks evidence/review-state changes
- `/default/` and `/en/` locale markers may be derived only from explicit public routes
- duplicate SKU candidates are blocked until product/localization identity is explicitly resolved, preventing EL/EN duplicate product creation
- duplicate candidate keys and duplicate runtime source keys block execution
- automatic import requires at least one recovered category relationship and captured product-media source
- import-boundary validation rejects foreign-host source/category/media URLs
- configurable parent option flattening and invalid sale pricing remain blocked
- `capture:ingest` report now includes the import plan
- an optional executable runtime manifest file is written only when the **entire** product plan is executable; partial reconstruction cannot masquerade as a complete batch
- dedicated deterministic import-plan contract is wired into CI

Canonical detail: `docs/migration/PRODUCT_IMPORT_PLAN.md`.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4E shipped, Phase 4F active.
- **Phase 5 — Merchant back office parity:** Foundation started.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md` and documented exit gates.

## Next Phase 4 source milestone

After Phase 4F validates and merges:

1. add explicit merchant/reviewer decisions for non-public fields such as publication status/visibility and unresolved product identity;
2. run a useful direct capture from an accepted legitimate operator/browser network;
3. ingest the archive and inspect structure/candidate/import-plan/URL-universe reports;
4. reconcile category, Designer/Brand, localization, option/variant and media mappings;
5. generate an executable idempotent runtime manifest only after the captured product plan is fully clean;
6. proceed to staging import without weakening evidence or reconciliation gates.

## Phase 4 exit boundary

Phase 4 completes only when direct public reconstruction/import is repeatable; every discovered in-scope public URL is reconstructed or explicitly classified; media is COQUETTE-owned; EL/EN and redirect relationships reconcile; reruns are idempotent; and there is zero unexplained critical variance. Unavailable private Magento-only data is documented, never invented.

## Operational follow-ups

- issue #40 — staging backup/non-destructive restore rehearsal
- issue #41 — `main` protection and secret-scanning/push-protection verification
- successful direct legacy capture still requires an accepted operator/browser network because GitHub-hosted runners are challenged by Cloudflare

## Production boundary

The legacy shop remains production. `coquetteconcept.gr` must not move to the replacement until public reconstruction reconciliation, COQUETTE-owned media recovery, merchant/customer UAT, payment/courier/fiscal testing, SEO redirect verification, rollback preparation and roadmap cutover gates pass.
