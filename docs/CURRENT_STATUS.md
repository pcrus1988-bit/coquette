# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2 / Next.js commerce platform with dedicated source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates are satisfied.

Magento Admin/database/filesystem/API access is no longer available. Phase 4 reconstructs the recoverable legacy shop from the **public storefront**, supported by indexed public evidence and explicit unavailable-data classification. Private Magento-only data is never guessed.

## Shipped to `main`

Through Phase 4D merge `095c7913c7731fc595d07d9d677605be3b3f96bc`:

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
- reads validated Phase 4A capture archives
- host/evidence/timestamp/archive-path provenance validation
- symlink-aware real-path containment before every archived file read
- direct captured products feed Phase 4C candidates
- archived HTML reparsing reconstructs page→media relationships
- direct + indexed URL universe with `captured`, `skipped`, `error`, `indexed_only`, `unavailable`
- `error` / `indexed_only` remain unresolved until recovered or explicitly documented unavailable
- off-domain direct/indexed/manual URLs excluded
- `capture:ingest` reconciliation report
- actual filesystem traversal/symlink rejection contract in CI
- operator headed-browser capture runbook without challenge-bypass techniques

## Active implementation

### Phase 4E — public product structure evidence

Branch: `phase4/product-structure-evidence`.

Current implementation:

- reparses preserved raw PDP HTML during ingestion, so existing Phase 4A archives gain the new evidence without recapture
- separates general page media from product-gallery evidence
- product gallery accepts Product JSON-LD images, product-path OpenGraph image and explicit Magento gallery-region media only
- gallery URLs must also exist as successfully captured media before satisfying `mediaSourceIds`
- related-product, logo, footer and generic page media do not satisfy product gallery
- recovers category relationships from public BreadcrumbList/visible breadcrumbs using legacy category URLs as source keys
- recovers explicit `<select>` option groups; singleton values may map to product-level option values while multi-value groups remain structural evidence
- explicit Magento configurable-product client signals may set `type=configurable`
- absence of configurable signals does not infer `simple`
- public reachability still does not infer Magento `status` or exact `visibility`
- visible brand/designer names do not become fabricated source IDs
- ingestion report adds structure-coverage counts
- dedicated product-structure contract is wired into CI

Canonical detail: `docs/migration/PRODUCT_STRUCTURE_EVIDENCE.md`.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4D shipped, Phase 4E active.
- **Phase 5 — Merchant back office parity:** Foundation started.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md` and documented exit gates.

## Next Phase 4 source milestone

After Phase 4E validates and merges:

1. run a useful direct capture from an accepted legitimate operator/browser network;
2. ingest the archive and inspect structure/candidate/URL-universe reports;
3. reconcile categories, designers/brands, options/variants and media ownership;
4. create idempotent staging import mappings only from conflict-free/review-approved evidence;
5. drive unresolved URLs and unexplained critical variance to zero within the captured public universe.

## Phase 4 exit boundary

Phase 4 completes only when direct public reconstruction/import is repeatable; every discovered in-scope public URL is reconstructed or explicitly classified; media is COQUETTE-owned; EL/EN and redirect relationships reconcile; reruns are idempotent; and there is zero unexplained critical variance. Unavailable private Magento-only data is documented, never invented.

## Operational follow-ups

- issue #40 — staging backup/non-destructive restore rehearsal
- issue #41 — `main` protection and secret-scanning/push-protection verification
- successful direct legacy capture still requires an accepted operator/browser network because GitHub-hosted runners are challenged by Cloudflare

## Production boundary

The legacy shop remains production. `coquetteconcept.gr` must not move to the replacement until public reconstruction reconciliation, COQUETTE-owned media recovery, merchant/customer UAT, payment/courier/fiscal testing, SEO redirect verification, rollback preparation and roadmap cutover gates pass.
