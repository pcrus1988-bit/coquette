# COQUETTE Phase 4O — Reconciled Staging Migration Input

## Purpose

Phase 4O hardens the staging product and price executors so a raw Phase 4F capture-ingestion report is no longer an accepted execution input.

Both executors now require the same verified Phase 4N reconciliation bundle and an independently supplied expected bundle checksum.

## Required environment

```text
COQUETTE_STAGING_MIGRATION_INPUT_BUNDLE=/path/reconciliation-bundle.json
COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM=<exact Phase 4N bundleChecksum>
```

The product executor additionally requires its existing dependency mapping and, in write mode, product manifest.

The price executor additionally requires the imported product manifest and, in write mode, price manifest.

All existing staging-only database/write guards remain mandatory and unchanged.

## Legacy raw report rejection

The following historical variables are explicitly rejected when present:

```text
COQUETTE_STAGING_PRODUCT_IMPORT_REPORT
COQUETTE_STAGING_PRICE_IMPORT_REPORT
```

A caller cannot combine a valid bundle with a legacy report and rely on precedence rules. The run fails before an execution plan is built.

## Bundle verification

Before product or price preflight, the shared loader:

1. requires bundle path and expected checksum;
2. parses the Phase 4N bundle;
3. runs `assertMigrationInputReconciliationReady`;
4. verifies the bundle's deterministic checksum against the separately pinned expected checksum.

This blocks:

- incomplete/invalid capture input;
- open/deferred/invalid reconstruction review;
- stale/tampered plan contents;
- unresolved URL-universe state;
- non-reconciled product/price/inventory domains;
- an executable numeric inventory domain;
- accidental or deliberate replacement with a different otherwise-valid reconciliation bundle.

## Product executor

`staging-product-import.ts` consumes only:

```text
bundle.productPlan
```

The existing Phase 4G execution checks remain in force:

- dependency mappings;
- COQUETTE-owned serving media;
- duplicate identities;
- SKU collision and manifest-gap recovery;
- Product↔Brand validation/linking;
- dry-run default;
- staging target and exact database host/name write guard;
- atomic product manifest checkpoints.

## Price executor

`staging-price-import.ts` consumes only:

```text
bundle.pricePlan
```

It no longer rebuilds pricing from a raw structural report.

The existing Phase 4J checks remain in force:

- exact imported structural product checksum/target;
- exact variant SKU/product ownership;
- independent price manifest;
- dedicated migration sale list;
- foreign active sale-price protection;
- deterministic regular/sale update and sale removal;
- authoritative Pricing Module post-write verification;
- staging write guard.

## Bundle changes between price runs

A legitimate price-only evidence change produces a new Phase 4N bundle checksum and price checksum while leaving the structural product checksum unchanged.

The operator must update both the bundle file and the pinned `COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM` before the price executor accepts the new migration input.

## CI proof

Phase 4O adds:

- a pure pinned-input contract proving legacy-report rejection, missing-pin rejection, wrong-checksum rejection and tamper detection;
- clean-database structural product lifecycle using a real reconciled bundle;
- clean-database price create/idempotent-update/sale-removal lifecycle using successive reconciled, re-pinned bundles.

## Production boundary

This phase hardens the **input** to staging executors; it does not authorize a real migration run.

No real staging or production reconstruction write is performed by Phase 4O validation. `coquetteconcept.gr` remains production until all blueprint cutover gates pass.
