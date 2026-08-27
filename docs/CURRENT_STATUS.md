# COQUETTE — Current Delivery Status

**Status date:** 2026-08-27  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2.19 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates pass.

Magento Admin/database/filesystem/API access is unavailable. Phase 4 reconstructs only legitimately recoverable public storefront state, supported by indexed evidence and explicit unavailable-data classification. Private Magento-only values are never guessed.

## Shipped to `main`

Through **Phase 4O** merge `cb7c7e904b240614920b199dc78ce2f08c08637f`.

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

Merged PR #58 as `bfcafa9b7e9deb254c62a19ecf987dca9628188d`.

- creates one canonical reconciliation bundle from capture evidence and review decisions
- deterministically rebuilds/cross-checks the source ProductImportPlan
- includes reviewed product plan plus independent price and inventory plans
- requires valid complete direct capture, closed reviews and fully classified URL universe
- inventory remains deliberately non-executable
- independent domain checksums plus bundle checksum detect stale/tampered inputs
- Phase 4N itself performs no Medusa writes

Canonical detail: `docs/migration/MIGRATION_INPUT_RECONCILIATION.md`.

### Phase 4O — mandatory reconciled staging input

Merged PR #59 as `cb7c7e904b240614920b199dc78ce2f08c08637f` after exact-head CI run #506 passed every gate, including the pinned-input boundary, both clean-database reconciled-bundle import lifecycles, Railway artifact and storefront build.

- product and price staging executors accept only a verified Phase 4N bundle
- an independently supplied exact bundle checksum is mandatory
- historical raw Phase 4F product/price report variables are actively rejected
- product executor consumes only `bundle.productPlan`
- price executor consumes only `bundle.pricePlan`
- a substituted but otherwise-valid bundle fails unless its checksum is deliberately re-pinned
- all Phase 4G/4J database/write/media/dependency/manifest/Brand/variant/pricing safeguards remain in force
- no numeric inventory writer was introduced

Canonical detail: `docs/migration/STAGING_MIGRATION_INPUT.md`.

No real COQUETTE staging or production reconstruction writes were performed while validating Phases 4I–4O.

## Active implementation

### Phase 4P — operator direct-capture evidence package

Branch: `phase4/operator-direct-capture-package`.

Implemented on the branch:

- dedicated `storefront:capture:operator` command locked to `https://coquetteconcept.gr/`
- operator command refuses CI/GitHub Actions and always uses browser transport
- default headed browser capture with 120-second interactive Cloudflare challenge window
- same temporary browser session/cookies reused during capture; temporary profile removed afterward
- common Chrome/Chromium/Edge discovery for Linux, macOS and Windows; explicit `COQUETTE_CHROME_PATH` remains supported
- deterministic `evidence-package.json` containing sorted file inventory, byte counts and SHA-256 checksums
- semantic package checksum excludes packaging timestamp so identical evidence/provenance retains stable identity
- package covers manifest, robots, JSONL inventories, every preserved HTML page and every preserved media file
- symbolic links/unsafe paths are refused
- package does not serialize cookies or IP-address information
- standalone `capture-evidence:verify` command re-verifies copied/archived evidence from disk
- verification fails on missing/unlisted/tampered files, capture/source mismatch, incomplete capture, wrong provenance or package-checksum mismatch
- `capture:ingest` re-verifies the package and merges package failures into `capture.validation`
- ingestion report records package checksum/provenance/browser mode/revision/file totals
- Phase 4N now requires validated `operator_local_browser` package provenance before staging readiness
- accepted evidence-package checksum is carried into the frozen Phase 4N bundle
- historical `COQUETTE_RUNTIME_IMPORT_MANIFEST` output from raw capture ingestion is retired and rejected
- CI fixtures now explicitly satisfy the operator-package gate rather than bypassing it
- new filesystem contract proves deterministic identity, tamper detection, unlisted-file detection, incomplete-capture rejection and absence of cookie/IP serialization

Canonical detail: `docs/migration/OPERATOR_DIRECT_CAPTURE.md`.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4O shipped, Phase 4P active.
- **Phase 5 — Merchant back office parity:** Foundation started.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md`.

## Next Phase 4 milestones

1. make Phase 4P exact-head CI fully green and merge it;
2. run `storefront:capture:operator` from an accepted local/operator browser network and preserve the resulting evidence package checksum;
3. ingest/reconcile the real archive and drive candidate/review/URL blockers toward zero without weakening evidence gates;
4. prepare COQUETTE-owned category/Brand/media dependency mappings from the reconciled real capture;
5. identify an authoritative exact inventory source before designing any numeric inventory execution path;
6. perform backup/restore rehearsal before any explicitly authorized real staging dry-run/write sequence.

## Production boundary

The legacy shop remains production. Phase 4P makes direct-capture provenance auditable but does not authorize a real migration. No real COQUETTE staging or production reconstruction writes have been performed in this continuation. `coquetteconcept.gr` must not move until reconstruction reconciliation, COQUETTE-owned media recovery, merchant/customer UAT, payment/courier/fiscal testing, SEO redirect verification, rollback preparation and blueprint cutover gates pass.
