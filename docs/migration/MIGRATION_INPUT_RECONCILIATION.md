# COQUETTE Phase 4N — Migration Input Reconciliation

## Purpose

Phase 4N creates the frozen, checksum-bound migration input bundle that must sit between public reconstruction/review and any future staging execution handoff.

It does **not** write Medusa products, prices, inventory, content, customers, orders, or any other commerce state.

The goal is to prevent a stale or partially reviewed Phase 4F ingestion report from being mistaken for approved staging migration input.

## Inputs

The reconciler accepts:

1. a Phase 4F capture-ingestion report (`schemaVersion=3`);
2. explicit Phase 4L review decisions, if any.

It rebuilds and cross-checks all derived migration domains instead of trusting a copied plan blindly.

## Required staging-readiness conditions

A bundle is `isReadyForStagingExecution=true` only when all of the following are true:

- the capture-ingestion report is schema version 3;
- a non-empty capture ID exists;
- capture artifact validation passed;
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

- capture identity/input;
- original candidates;
- source ProductImportPlan;
- review decisions;
- evaluated review plan;
- review application result;
- reviewed ProductImportPlan;
- PricePlan;
- InventoryPlan;
- reconstruction URL universe.

It also contains one deterministic `bundleChecksum` over the staging-relevant bundle payload.

`generatedAt` is intentionally excluded from the bundle identity so regenerating identical migration input at a different clock time does not change the checksum.

These are deterministic integrity/staleness checks, not cryptographic signatures or authorization credentials.

## Bundle verification

`verifyMigrationInputReconciliationBundle` recomputes all embedded plan checksums that can be verified from bundle contents and rejects:

- tampered product/price/inventory/review/URL plan contents;
- a changed bundle payload without a matching bundle checksum;
- any bundle carrying blockers;
- a bundle no longer marked reconciled/ready;
- a non-executable reviewed ProductImportPlan;
- a non-reconciled price or inventory domain;
- any executable inventory plan or inventory runtime manifest;
- unresolved URLs;
- open, deferred, or invalid review items.

## Operator CLI

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

## Current executor boundary

Phase 4N establishes the canonical bundle and verifier.

The existing Phase 4G/4J staging executors still have their historical Phase 4F report interfaces at the moment Phase 4N is introduced. The next execution-hardening step must replace those raw-report interfaces with the verified Phase 4N bundle before any real staging migration write is authorized.

Therefore **no real staging write should be run from a raw Phase 4F report**.

## Production boundary

Phase 4N is not a production migration or cutover tool.

`coquetteconcept.gr` remains the production shop until the full reconstruction, UAT, payment/courier/fiscal, SEO, rollback, backup/restore, and blueprint cutover gates pass.

No real COQUETTE staging or production migration writes are performed by this phase.
