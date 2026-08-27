# COQUETTE — Current Delivery Status

**Status date:** 2026-08-27  
**Canonical blueprint:** `docs/ROADMAP.md`

## Current baseline

COQUETTE is an isolated Medusa v2.19 / Next.js commerce platform with dedicated GitHub source, Supabase PostgreSQL/storage, Railway backend/worker/Redis runtime and Vercel storefront. The legacy `coquetteconcept.gr` shop remains production until reconstruction, UAT and cutover gates pass.

Magento Admin/database/filesystem/API access remains unavailable. Phase 4 reconstructs only legitimately recoverable public storefront state and never guesses private Magento-only values.

## Shipped to `main`

Through **Phase 4S** merge `c68ceddf93a6752ac5f1c23299550c4edb5af298`.

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

Merged PR #59 as `cb7c7e904b240614920b199dc78ce2f08c08637f`.

- product and price staging executors accept only a verified Phase 4N bundle
- exact independently supplied bundle checksum is mandatory
- historical raw product/price report variables are rejected
- existing DB/write/media/dependency/manifest/Brand/variant/pricing guards remain in force

### Phase 4P — operator direct-capture evidence package

Merged PR #60 as `420ea7b3f3920bb5b00a31a370bbf519afbbd3b7`.

- operator capture is locked to `https://coquetteconcept.gr/`
- CI/GitHub Actions are refused; browser transport is mandatory
- headed browser is default with challenge window
- cross-platform Chrome/Chromium/Edge discovery
- deterministic `evidence-package.json` covers all preserved HTML/media and JSONL inventories
- symlink/unsafe/missing/unlisted/tampered files fail verification
- no cookies or IP-address data are serialized
- Phase 4N requires validated `operator_local_browser` provenance and exact package checksum

Canonical detail: `docs/migration/OPERATOR_DIRECT_CAPTURE.md`.

### Phase 4Q — deterministic dependency mapping reconciliation

Merged PR #61 as `e2d6e9c941932ebda28274c12b3400699bb92afd`.

- required category, Brand and media dependencies derive exclusively from the verified Phase 4N normalized product plan
- shared dependencies are deduplicated while retaining every referencing candidate
- duplicate/orphan mapping keys block reconciliation
- category/Brand require target IDs; media requires HTTPS on explicitly allowed COQUETTE-controlled hosts
- `coquetteconcept.gr` media hotlinks are forbidden
- missing/unavailable/error/invalid dependency states remain explicit
- plan binds to both Phase 4N bundle checksum and Phase 4P evidence checksum

Canonical detail: `docs/migration/DEPENDENCY_MAPPING_RECONCILIATION.md`.

### Phase 4R — verified dependency plan staging input

Merged PR #66 as `8c7652186043b0ab4897986818f9e2b7c2085a5c` after the full current-main CI suite passed.

- structural staging import no longer accepts arbitrary raw dependency arrays
- exact Phase 4Q plan path and checksum pin are mandatory
- plan is reverified against the accepted Phase 4N bundle and allowed COQUETTE media hosts
- Product and price disposable-PostgreSQL write lifecycles passed
- Railway deployable artifact and storefront build passed

Canonical detail: `docs/migration/STAGING_DEPENDENCY_PLAN_INPUT.md`.

### Phase 4S — one-command verified operator capture handoff

Merged PR #67 as `c68ceddf93a6752ac5f1c23299550c4edb5af298` after exact-head CI passed all reconstruction, database lifecycle, Railway and storefront gates.

- root command `pnpm capture:coquette`
- browser capture → Phase 4P verification → ingestion → portable handoff packaging
- output is one `<capture-id>.handoff.<full-sha256>.tar.gz`
- archive filename contains the complete SHA-256
- receiver verifies the archive checksum, semantic handoff checksum, all embedded Phase 4P files/checksums, capture provenance/completeness and ingestion↔evidence binding
- no staging or production commerce writes occur during capture/handoff creation

Canonical detail: `docs/migration/OPERATOR_CAPTURE_HANDOFF.md`.

No real COQUETTE staging or production reconstruction write has yet been performed from legacy catalogue data.

## Active implementation

### Phase 4T — verified handoff reconciliation intake

Branch: `phase4/handoff-reconciliation-intake`.

Implemented on the branch:

- one handoff file is the only mandatory receiver-side input
- no manual archive extraction is required
- handoff is fully reverified before its embedded ingestion report can be consumed
- embedded capture ID and Phase 4P evidence checksum must match the handoff manifest
- Phase 4N migration input bundle is rebuilt directly from the verified embedded ingestion report
- generated Phase 4N bundle is independently reverified
- unresolved review/URL state becomes an explicit deterministic worklist
- category/Brand/media dependency requirements are emitted only after the Phase 4N bundle is staging-ready
- intake checksum binds archive, handoff, Phase 4P package, Phase 4N bundle, worklists and blockers
- changing generation timestamps does not change frozen intake identity
- Phase 4T is non-writing

Root command:

```bash
COQUETTE_CAPTURE_HANDOFF_FILE=/path/to/handoff.tar.gz pnpm capture:coquette:intake
```

Canonical detail: `docs/migration/HANDOFF_RECONCILIATION_INTAKE.md`.

## Runtime acquisition observation

The current execution container has Chromium installed, but its direct runtime network currently cannot resolve `coquetteconcept.gr`; a direct browser-backed Phase 4P acquisition therefore cannot be honestly produced from that container. The public storefront remains reachable through web retrieval, but web retrieval is not treated as `operator_local_browser` provenance.

The real capture therefore remains the single external acquisition boundary. After that handoff exists, receiver-side reconstruction/reconciliation is automated and checksum-bound.

## Phase status

- **Phase 0 — Workspace/isolation:** Complete.
- **Phase 1 — Audit/architecture:** Complete; public audit remains continuous.
- **Phase 2 — Executable foundation:** Complete.
- **Phase 3 — Domain model/managed infrastructure:** Technical exit gate complete.
- **Phase 4 — Public legacy storefront reconstruction:** Active; Phase 4A–4S shipped, Phase 4T active.
- **Phase 5 — Merchant back office parity:** Material implementation underway through COQUETTE Studio work.
- **Phase 6 — Storefront parity:** Materially advanced.
- **Phase 7 — Search/discovery/merchandising:** Substantially implemented ahead of sequence.
- **Phase 8/9 — Customer/cart/checkout/payments:** Foundations materially implemented; final staging E2E remains.
- **Phases 10–18:** Governed by `docs/ROADMAP.md`.

## Next Phase 4 milestones

1. make Phase 4T exact-head CI fully green and merge it;
2. acquire the real Phase 4S handoff from a browser/network that can reach `coquetteconcept.gr` with required provenance;
3. run Phase 4T intake and resolve only evidence-backed review/URL blockers until Phase 4N is staging-ready;
4. create/import the exact required COQUETTE category and Brand targets and upload captured media bytes to COQUETTE-owned storage;
5. build/reconcile the real Phase 4Q mapping plan;
6. perform backup/restore rehearsal before any real staging legacy-data write;
7. run Phase 4R guarded product import and guarded price import against staging;
8. complete merchant/customer/payment/courier/fiscal/SEO/rollback UAT before cutover.

## Fully-working-system boundary

The target is a working staging store and then a controlled cutover, not a permanent dry-run project. The external capture is now one acquisition action; after that, handoff verification, reconstruction, review reconciliation, dependency planning and guarded staging import are automated and auditable.

The legacy shop remains production until real reconstructed data is present in COQUETTE staging and the blueprint UAT, payment/courier/fiscal, SEO redirect, rollback and backup/restore gates pass.
