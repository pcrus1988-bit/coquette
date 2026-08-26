# COQUETTE — Current Delivery Status

**Status date:** 2026-08-26  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2 / Next.js commerce platform with dedicated source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates are satisfied.

Magento Admin/database/filesystem/API access is no longer available. Phase 4 therefore reconstructs the recoverable legacy shop from the **public storefront**, supported by indexed public evidence and explicit unavailable-data classification. Private Magento-only data is never guessed.

## Shipped to `main`

Through Phase 4C merge `5d1f08d6816f1a197ccc430fbd0e90b25ff0cf6d`:

### Platform / managed infrastructure

- dedicated COQUETTE repository/workspace and environment separation
- pnpm/Turbo monorepo
- Medusa v2.19 backend + Medusa Admin
- Next.js bilingual storefront
- dedicated Supabase PostgreSQL 17 project and COQUETTE-only storage buckets
- Medusa S3 file provider with verified upload/read smoke path
- Railway long-running Medusa server and separate worker
- Redis-backed Medusa cache/event/workflow/locking modules
- Vercel storefront connected to the Railway Store API
- Greece/EUR region, stock/fulfillment foundation and EL/EN localization
- Supabase Data API roles blocked from direct access to Medusa commerce tables
- Node 22.22+ runtime and full clean-database CI

### Domain / merchant foundation

- first-class Designer/Brand module and product links
- bilingual Website Content module
- workflow-backed Admin CRUD for Designers and Website Content
- clean-database Admin CRUD contract
- structured content/SEO fields

### Storefront / commerce

- EL/EN catalogue routes and PDPs
- Clothing/Accessories PLPs
- Designer directory/PLPs
- Sale merchandising using Medusa price-list semantics
- search, sorting and Color/Size/Designer filters
- persistent variant-aware cart
- bilingual checkout with validated addresses/region/country
- live shipping-option discovery and calculated rates
- authoritative cart totals
- provider-agnostic payment-session foundation
- PayPal backend/browser approval flow
- Klarna backend provider, signed authorization callback and workflow hardening

### Phase 4A — direct public capture tooling

- HTTP/browser capture of public HTML, product evidence, URL inventory and same-host media
- robots/sitemap/pagination handling
- raw page/media preservation plus checksums
- explicit incomplete/failure states
- parser contract in CI
- GitHub-hosted HTTP/headless/headed Chrome experiments proved CI-runner traffic remains challenged by legacy Cloudflare; zero-page runs are correctly rejected as incomplete

### Phase 4B — indexed recovery baseline

- catalogue scale, category/designer seeds and product observations with freshness/provenance
- explicit `public_search_index` / `derived` status
- field-level evidence hierarchy and unavailable-data policy
- CI validation of baseline safety

### Phase 4C — provenance-aware recovery candidates

- merged PR #46
- `ready` / `needs_review` / `rejected` intermediate product candidates
- field-level conflict retention
- indexed/derived evidence cannot set stock automatically
- direct evidence must be timestamped before readiness
- indexed evidence never fabricates SKU/source ID/type/status/visibility/categories/options/media/stock
- current indexed baseline is required by CI to yield zero auto-ready products
- refreshed recovery docs aligned with issue #39

## Active implementation

### Phase 4D — capture ingestion and public URL universe

Active branch: `phase4/capture-ingestion-url-classification`.

Implemented on the branch:

- reads Phase 4A `manifest.json`, `products.jsonl`, `pages.jsonl`, `media.jsonl` and archived raw pages
- validates source host, evidence mode, timestamps and safe archive paths before ingestion
- rejects foreign-host records and archive path traversal
- re-parses archived raw HTML to reconstruct page→media relationships, including for older archives that only stored global media records
- converts direct public product observations into Phase 4C recovery candidates without inventing missing product structure
- merges direct page inventory with indexed recovery URLs
- URL states: `captured`, `skipped`, `error`, `indexed_only`, `unavailable`
- `error` and `indexed_only` remain unresolved until recovered or explicitly classified unavailable with a documented reason
- manual unavailable classification cannot downgrade successfully captured or intentionally skipped URLs
- operator ingestion report command emits candidate and URL-universe reconciliation in one artifact
- operator-network runbook documents legitimate headed-browser capture without challenge bypass techniques
- new capture-ingestion/URL-universe contract is wired into CI

Next after Phase 4D: run a useful direct capture from an accepted operator/browser network, ingest the archive, shrink the unresolved URL universe, then proceed into normalized source records/import manifests and staging reconstruction.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public storefront audit continues during reconstruction.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4C shipped, Phase 4D active.
- **Phase 5 — Merchant back office parity:** Foundation started.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md` and their documented exit gates.

## Phase 4 exit boundary

Phase 4 completes only when:

- direct public reconstruction/import is repeatable;
- every discovered in-scope public URL is reconstructed or explicitly classified with a reason;
- product/content/media conflicts have no unexplained critical variance;
- recovered media is stored in COQUETTE-controlled storage rather than hotlinked;
- Greek/English relationships and legacy redirects reconcile;
- reruns are idempotent;
- unavailable private Magento-only data is documented rather than invented.

## Operational follow-ups

These do not revert the completed Phase 3 technical gate:

- issue #40 — prove staging backup and non-destructive restore
- issue #41 — protect `main` and verify repository secret scanning/push protection
- `main` remains unprotected by GitHub branch-protection/ruleset enforcement
- successful direct legacy capture still needs an accepted operator/browser network because GitHub-hosted runners are challenged by Cloudflare

## Payment staging gates

Before Live payment activation:

- dedicated COQUETTE PayPal Sandbox credentials/webhook and approval/cancel/failure/capture/void/refund/webhook E2E
- dedicated Klarna Playground credentials, Greece/EUR eligibility verification, storefront authorization and accepted/pending/rejected/callback/capture/cancel/refund E2E

No Live payment credential or production payment action is part of the current Phase 4 work.

## Production boundary

The legacy shop remains production. `coquetteconcept.gr` must not move to the replacement until public reconstruction reconciliation, COQUETTE-owned media recovery, merchant/customer UAT, payment/courier/fiscal testing, SEO redirect verification, rollback preparation and the roadmap cutover gates are satisfied.
