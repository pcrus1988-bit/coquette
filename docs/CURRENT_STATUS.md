# COQUETTE — Current Delivery Status

**Status date:** 2026-08-27  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2.19 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates pass.

Magento Admin/database/filesystem/API access remains unavailable. Phase 4 reconstructs only legitimately recoverable public storefront state and never guesses private Magento-only values.

## Shipped to `main`

Through **Phase 4P** merge `420ea7b3f3920bb5b00a31a370bbf519afbbd3b7`.

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

### Phase 4F–4G — structural plan and guarded product execution

Phase 4G merged as `c9b97033bbad2932d1ee5cd9a49d2a8eefdb351b`.

- deterministic structural ProductImportPlan
- configurable parents remain blocked until child identity/relationships are explicitly reconstructed
- structural checksum excludes price/inventory state
- staging-only write mode with exact DB host/name verification
- COQUETTE-controlled serving-media requirement
- SKU collision protection, manifest recovery and Product↔Brand linking

### Phase 4H–4J — pricing reconstruction and guarded price execution

Phase 4H merged as `fc17896cfe07d9060d05bde1d17a7afae95a80dc`; Phase 4J as `891e9111331161cd22a9b1b9a1f99b0ae6024b5c`.

- independent deterministic price domain
- unavailable public price remains explicit
- regular EUR and sale prices use supported Medusa workflows
- no cents conversion, invented schedule or inventory quantity
- clean PostgreSQL lifecycle proves create/idempotency/update/sale-removal behavior

### Phase 4I — Product ↔ Brand link execution

Merged as `aad7837d26779c333c781f23edd37993f30a80c9`.

- exact mapped Brand required when source product has Brand evidence
- conflicting link fails closed
- relation creation and re-verification use Medusa Link service

### Phase 4K — deterministic inventory evidence

Merged as `f2c0dcd4d852e2750ef8d04ca894bdf7d9a58bfb`.

- qualitative stock evidence never becomes numeric quantity
- `in_stock` is never converted to `1`; `out_of_stock` is never converted to `0`
- low-stock wording is never parsed into an invented count
- no numeric inventory writer exists

### Phase 4L–4M — review decisions and evidence-selection application

Phase 4L merged as `9d51e7005c8049a2b866c312bf30d03cd5328fb7`; Phase 4M as `4ed85681c11468838bc536f7f61f38e51616a906`.

- review decisions bind to exact evidence checksums
- stale or invented evidence selections fail
- only an actually observed value can alter reconstructed source facts
- policy-only/unavailable/deferred decisions never masquerade as recovered Magento facts
- reviewed candidates/ProductImportPlan are rebuilt deterministically with audit checksums

### Phase 4N — checksum-bound migration input reconciliation

Merged PR #58 as `bfcafa9b7e9deb254c62a19ecf987dca9628188d`.

- one frozen migration input bundle for capture/review/product/price/inventory/URL-universe state
- requires complete valid direct capture, closed reviews and fully classified URL universe
- requires executable reviewed structural plan and reconciled price/inventory evidence
- inventory remains non-executable
- deterministic domain checksums plus bundle checksum detect stale/tampered inputs

### Phase 4O — mandatory reconciled staging input

Merged PR #59 as `cb7c7e904b240614920b199dc78ce2f08c08637f` after exact-head CI passed every gate.

- product and price staging executors accept only a verified Phase 4N bundle
- exact independently supplied bundle checksum is mandatory
- historical raw Phase 4F product/price report variables are rejected
- product executor consumes only `bundle.productPlan`
- price executor consumes only `bundle.pricePlan`
- existing DB/write/media/dependency/manifest/Brand/variant/pricing guards remain in force

### Phase 4P — operator direct-capture evidence package

Merged PR #60 as `420ea7b3f3920bb5b00a31a370bbf519afbbd3b7` after exact-head CI run #508 passed the new operator-package gate, all reconstruction/reconciliation gates, both clean-database import lifecycles, Railway artifact and storefront build.

- dedicated `storefront:capture:operator` command locked to `https://coquetteconcept.gr/`
- command refuses CI/GitHub Actions and always uses browser transport
- headed browser by default with extended interactive challenge window
- cross-platform Chrome/Chromium/Edge discovery for Linux, macOS and Windows
- deterministic `evidence-package.json` with sorted file inventory, byte counts and SHA-256 checksums
- package covers manifest, robots, JSONL inventories, every preserved HTML page and captured media file
- symlinks/unsafe paths, missing/unlisted/tampered files fail verification
- no cookie or IP-address data is serialized
- standalone package verification command
- `capture:ingest` re-verifies package bytes and includes package result in capture validation
- Phase 4N now requires validated `operator_local_browser` package provenance and carries its checksum into the frozen bundle
- raw `COQUETTE_RUNTIME_IMPORT_MANIFEST` output from capture ingestion is retired

Canonical detail: `docs/migration/OPERATOR_DIRECT_CAPTURE.md`.

No real COQUETTE staging or production reconstruction writes were performed while validating Phases 4I–4P.

## Active implementation

### Phase 4Q — dependency mapping reconciliation

Branch: `phase4/dependency-mapping-reconciliation`.

Implemented on the branch:

- derives the complete required dependency set exclusively from the verified Phase 4N normalized product plan
- covers category, Brand and product-media source dependencies
- deduplicates shared dependencies while retaining every referencing candidate key
- mapping files cannot add orphan legacy dependencies or suppress required ones
- category/Brand mappings require target IDs and reject target URLs
- media mappings require HTTPS URLs on explicitly allowed COQUETTE-controlled hosts and reject target IDs
- legacy `coquetteconcept.gr` media hotlinks are forbidden
- explicit `missing`, `unavailable`, `error` and `invalid` states remain unreconciled rather than being guessed
- duplicate/orphan mapping keys block reconciliation
- plan binds to both Phase 4N bundle checksum and Phase 4P evidence-package checksum
- deterministic requirements, mapping and plan checksums detect stale/tampered mapping state
- price-only bundle changes require a newly bundle-bound dependency plan while retaining the same requirements checksum when structural dependencies did not change
- operator CLI can emit the complete missing-dependency worklist before mappings exist and exits non-zero until all required dependencies resolve
- Phase 4Q itself is non-writing
- new CI contract is wired before the Phase 4O staging-input/execution gates

Canonical detail: `docs/migration/DEPENDENCY_MAPPING_RECONCILIATION.md`.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4P shipped, Phase 4Q active.
- **Phase 5 — Merchant back office parity:** Foundation started.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md`.

## Next Phase 4 milestones

1. make Phase 4Q exact-head CI fully green and merge it;
2. require the guarded product staging executor to consume a verified, checksum-pinned Phase 4Q dependency plan rather than an arbitrary mappings array;
3. run the one-command direct capture from an accepted local browser session and preserve the resulting evidence package;
4. ingest/reconcile that real archive and reduce candidate/review/URL blockers to zero without weakening evidence gates;
5. create/upload COQUETTE-owned media and reconcile real category/Brand/media mappings;
6. perform backup/restore rehearsal before any explicitly authorized real staging migration sequence;
7. run the guarded staging migration and complete merchant/customer UAT before cutover.

## Fully-working-system boundary

The target is a working staging store and then a controlled cutover, not a permanent dry-run project. The capture package is a provenance/input acquisition step; after that single acquisition the reconstruction, reconciliation, dependency mapping and guarded staging import paths are automated and checksum-bound.

The legacy shop remains production until real reconstructed data is present in COQUETTE staging and the blueprint UAT, payment/courier/fiscal, SEO redirect, rollback and backup/restore gates pass.
