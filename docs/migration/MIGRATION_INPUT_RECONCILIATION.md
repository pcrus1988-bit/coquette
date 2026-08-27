# COQUETTE Phase 4N — Migration Input Reconciliation

## Purpose

Phase 4N creates the frozen, checksum-bound migration input bundle that sits between public reconstruction/review and staging execution.

It does **not** write Medusa products, prices, inventory, content, customers, orders, or any other commerce state.

The goal is to prevent a stale, unverified, or partially reviewed capture-ingestion report from being mistaken for approved staging migration input.

## Inputs

The reconciler accepts:

1. a Phase 4F capture-ingestion report (`schemaVersion=3`), now enriched by the Phase 4P operator evidence-package verification result;
2. explicit Phase 4L review decisions, if any.

It rebuilds and cross-checks all derived migration domains instead of trusting a copied plan blindly.

## Required staging-readiness conditions

A bundle is `isReadyForStagingExecution=true` only when all of the following are true:

- the capture-ingestion report is schema version 3;
- a non-empty capture ID exists;
- normal capture artifact validation passed;
- the Phase 4P evidence package independently verified from disk;
- an evidence-package checksum is present;
- evidence-package provenance is `operator_local_browser`;
- evidence-package transport is `browser`;
- evidence-package browser mode is `headed` or `headless`;
- the direct capture is explicitly declared complete;
- no capture failure reason remains;
- at least one recovered product candidate exists;
- the ProductImportPlan embedded in the ingestion report exactly matches a deterministic rebuild from those candidates;
- Phase 4L review decisions are valid against current evidence;
- there are zero open review items;
- there are zero deferred review items;
- there are zero invalid review items;
- Phase 4M review application is reconciled;
- the reviewed structural ProductImportPlan is executable;
- the derived PricePlan is reconciled;
- the derived InventoryPlan is reconciled;
- inventory remains deliberately non-executable and has no runtime manifest entries;
- the complete reconstruction URL universe is fully classified with zero unresolved URLs.

Any failure produces explicit `globalBlockers` and the bundle is not staging-ready.

## Phase 4P direct-capture provenance boundary

GitHub/cloud-runner capture attempts remain useful diagnostics, but they cannot satisfy Phase 4N staging readiness.

A direct capture must first pass the Phase 4P operator workflow described in `docs/migration/OPERATOR_DIRECT_CAPTURE.md`. The capture directory is covered by `evidence-package.json`, including SHA-256 checksums for every preserved artifact.

`capture:ingest` re-verifies that package from disk and records the result inside `report.capture.evidencePackage`.

Phase 4N then requires:

```text
isValid = true
provenanceMode = operator_local_browser
transport = browser
browserMode = headed | headless
packageChecksum = present
```

The accepted package checksum is copied to `captureEvidencePackageChecksum` in the frozen Phase 4N bundle and is part of that bundle's semantic checksum.

This means later changing the accepted capture package also changes the Phase 4N bundle and therefore requires a new Phase 4O checksum pin.

## Price and inventory distinction

A missing public price is not invented. It remains a PricePlan `unavailable` record and is reported as a warning when the price domain is otherwise reconciled.

Likewise, missing public inventory information remains `unavailable`. Qualitative stock evidence remains `state_only`.

Neither condition authorizes numeric inference.

Phase 4N therefore distinguishes:

- **reconciled missing evidence**, which can be explicitly accounted for;
- **unresolved/contradictory evidence**, which blocks the bundle.

## Review boundary

Phase 4N consumes the Phase 4M reviewed result.

Only valid `evidence_selection` decisions can alter reconstructed legacy source facts. `policy_only`, `mark_unavailable`, and `defer` records do not become recovered Magento facts.

Additionally, Phase 4N requires all review items to be closed for staging readiness. A deliberate deferral remains visible but prevents staging handoff.

## Integrity checksums

The bundle contains independent checksums for:

- capture identity/input, including the evidence-package verification metadata;
- original candidates;
- source ProductImportPlan;
- review decisions;
- evaluated review plan;
- review application result;
- reviewed ProductImportPlan;
- PricePlan;
- InventoryPlan;
- reconstruction URL universe.

It also contains:

- `captureEvidencePackageChecksum`, copied from the accepted Phase 4P evidence package;
- one deterministic `bundleChecksum` over the staging-relevant bundle payload.

`generatedAt` is intentionally excluded from bundle identity so regenerating identical migration input at a different clock time does not change the checksum.

These checksums are deterministic integrity/staleness controls, not cryptographic signatures or authorization credentials.

## Bundle verification

`verifyMigrationInputReconciliationBundle` recomputes all embedded plan checksums that can be verified from bundle contents and rejects:

- a bundle missing `captureEvidencePackageChecksum`;
- tampered product/price/inventory/review/URL plan contents;
- a changed evidence-package checksum or other bundle payload without a matching bundle checksum;
- any bundle carrying blockers;
- a bundle no longer marked reconciled/ready;
- a non-executable reviewed ProductImportPlan;
- a non-reconciled price or inventory domain;
- any executable inventory plan or inventory runtime manifest;
- unresolved URLs;
- open, deferred, or invalid review items.

Filesystem-level capture-package verification happens during Phase 4P ingestion, before the frozen Phase 4N bundle is created.

## Operator reconciliation CLI

Run:

```bash
COQUETTE_CAPTURE_INGESTION_REPORT=/path/capture-report.json \
COQUETTE_REVIEW_DECISIONS_FILE=/path/review-decisions.json \
COQUETTE_MIGRATION_RECONCILIATION_BUNDLE=/path/reconciliation-bundle.json \
pnpm --filter @coquette/backend migration-input:reconcile
```

`COQUETTE_REVIEW_DECISIONS_FILE` may be omitted when there are no review items.

The command always writes the reconciliation result for auditability. It exits with code `3` when the bundle is not staging-ready.

It never writes a Medusa runtime manifest.

The historical raw `COQUETTE_RUNTIME_IMPORT_MANIFEST` output from `capture:ingest` is retired by Phase 4P.

## Executor boundary after Phase 4O

Phase 4O closes the historical raw-report execution gap.

The guarded structural product and price staging executors require:

```text
COQUETTE_STAGING_MIGRATION_INPUT_BUNDLE=/path/reconciliation-bundle.json
COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM=<exact bundleChecksum>
```

Both executors verify the Phase 4N bundle and its independently pinned checksum before building their execution plan.

The historical variables `COQUETTE_STAGING_PRODUCT_IMPORT_REPORT` and `COQUETTE_STAGING_PRICE_IMPORT_REPORT` are explicitly rejected when present.

Structural product execution consumes only `bundle.productPlan`; pricing execution consumes only `bundle.pricePlan`.

Canonical executor detail: `docs/migration/STAGING_MIGRATION_INPUT.md`.

## Production boundary

Phase 4N is not a production migration or cutover tool. Phase 4P capture provenance and Phase 4O executor hardening do not themselves authorize a real staging migration.

`coquetteconcept.gr` remains the production shop until the full reconstruction, UAT, payment/courier/fiscal, SEO, rollback, backup/restore, and blueprint cutover gates pass.

No real COQUETTE staging or production migration writes are performed by Phase 4N/4O/4P validation.
