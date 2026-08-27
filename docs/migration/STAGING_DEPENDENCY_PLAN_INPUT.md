# COQUETTE Phase 4R — Verified Dependency Plan Staging Input

## Purpose

Phase 4R closes the final arbitrary dependency-input path in structural product migration.

The staging product importer no longer accepts a raw JSON array of category, Brand or media mappings. It requires a reconciled Phase 4Q dependency mapping plan that is verified against the same Phase 4N migration bundle already accepted by Phase 4O.

## Required inputs

Structural product staging execution now requires:

```text
COQUETTE_STAGING_MIGRATION_INPUT_BUNDLE=/path/migration-input.json
COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM=<exact Phase 4N bundleChecksum>

COQUETTE_STAGING_DEPENDENCY_MAPPING_PLAN=/path/dependency-plan.json
COQUETTE_STAGING_DEPENDENCY_MAPPING_CHECKSUM=<exact Phase 4Q planChecksum>

COQUETTE_MIGRATION_ALLOWED_MEDIA_HOSTS=<coquette-owned-media-hosts>
```

The historical variable `COQUETTE_STAGING_PRODUCT_DEPENDENCIES` is explicitly rejected.

## Verification sequence

Before a product execution plan is built, the importer:

1. verifies the Phase 4N migration input bundle and its independent checksum pin;
2. rejects any legacy raw dependency input;
3. reads the Phase 4Q dependency plan;
4. rebuilds/verifies that plan against the accepted Phase 4N bundle and current allowed media hosts;
5. requires the exact independent Phase 4Q plan checksum pin;
6. verifies the dependency plan belongs to the same migration input bundle;
7. verifies the Phase 4P capture evidence-package checksum matches;
8. passes only `plan.validatedMappings` to the existing structural execution preflight.

A failure in any step occurs before Medusa product writes are attempted.

## Existing write guards remain

Phase 4R does not loosen the Phase 4G/4O staging protections. Write mode still requires:

- migration target exactly `staging`;
- explicit `COQUETTE_STAGING_WRITE_CONFIRMED` write token;
- exact expected database host;
- exact expected database name;
- executable structural product plan;
- matching pending runtime manifest records;
- allowed COQUETTE serving-media URLs;
- valid category and Brand targets;
- SKU collision/recovery checks;
- Product ↔ Brand verification;
- idempotent product manifest handling.

## CI proof

Phase 4R adds two layers of proof:

- a pure pinned dependency-plan boundary contract rejects missing input, missing pin, wrong checksum, plan tampering, a different migration bundle, legacy raw dependency env input, missing allowed media hosts and legacy-host media policy;
- the clean PostgreSQL product lifecycle creates real CI category/Brand records, constructs a reconciled Phase 4Q plan, pins it, imports the product and verifies the second run remains idempotent.

## Operational consequence

After Phase 4R, the structural staging importer has no supported raw reconstruction/dependency input path. Its migration facts come from the verified Phase 4N bundle and its category/Brand/media targets come from the verified Phase 4Q plan.

This means that once the real Phase 4P capture package is acquired and reconciled, the remaining product staging migration path is machine-gated rather than manually trusted.

## Production boundary

Phase 4R enables a safer real staging migration; it does not authorize production cutover. Production remains the legacy shop until real staging reconstruction, backup/restore rehearsal and the blueprint UAT/payment/courier/fiscal/SEO/rollback gates pass.
