# COQUETTE Phase 4T — Verified Handoff Reconciliation Intake

## Purpose

Phase 4T removes the remaining manual receiver-side extraction and JSON handling after the Phase 4S operator capture.

A single verified `.tar.gz` handoff becomes the only mandatory intake input. The receiver verifies the handoff, reads its embedded ingestion report, rebuilds the checksum-bound Phase 4N migration input bundle and emits the exact next worklist without writing to Medusa.

## Command

From the repository root:

```bash
COQUETTE_CAPTURE_HANDOFF_FILE=/path/to/<capture-id>.handoff.<sha256>.tar.gz \
  pnpm capture:coquette:intake
```

No extraction step is required.

Optional evidence-review decisions may be supplied on later reruns:

```bash
COQUETTE_CAPTURE_HANDOFF_FILE=/path/to/handoff.tar.gz \
COQUETTE_REVIEW_DECISIONS_FILE=/path/to/review-decisions.json \
  pnpm capture:coquette:intake
```

The decisions file does not become a free-form override path. Existing Phase 4L/4M rules still require exact evidence checksums and permit only supported evidence-selection/policy/unavailable/defer actions.

## Intake sequence

The command:

1. verifies the complete Phase 4S archive, including its filename SHA-256;
2. verifies the embedded Phase 4P evidence package and every covered byte;
3. reads `ingestion-report.json` directly from the verified archive;
4. requires the report capture ID and evidence-package checksum to match the handoff manifest;
5. rebuilds the Phase 4N migration input reconciliation bundle;
6. verifies the resulting Phase 4N bundle checksum/domain checksums;
7. emits unresolved review and URL blockers when the bundle is not staging-ready;
8. emits deterministic category/Brand/media dependency requirements only when the Phase 4N bundle is staging-ready;
9. writes no commerce data and performs no staging/production migration.

## Output

By default, output is written under:

```text
migration-data/handoff-intake/<capture-id>/
```

Files:

- `migration-input.json` — exact Phase 4N bundle;
- `review-worklist.json` — open/deferred/invalid evidence review items;
- `dependency-requirements.json` — empty until Phase 4N is ready, then the exact Phase 4Q dependency source requirements;
- `intake.json` — compact checksummed intake summary.

`COQUETTE_HANDOFF_INTAKE_DIR` may be used to choose another output directory.

## Fail-closed behavior

Dependency requirements are not emitted from a bundle that still has reconstruction review or URL-classification blockers. This matters because a later evidence selection may legitimately change structural facts such as category, Brand, media, type or variant identity.

The intake therefore never asks an operator to provision dependencies for unstable source facts.

## Determinism

The intake checksum binds:

- handoff archive checksum;
- Phase 4S handoff semantic checksum;
- Phase 4P evidence-package checksum;
- Phase 4N migration bundle checksum;
- dependency requirements;
- unresolved review worklist;
- unresolved URL count;
- global blockers.

Changing only generation timestamps does not change the frozen migration input or intake identity.

## Relationship to the real staging migration

Phase 4T is still non-writing. Once the real handoff is received and the Phase 4N bundle is ready:

1. provision/import the required COQUETTE category and Brand targets;
2. upload legacy media bytes to COQUETTE-owned storage;
3. create the Phase 4Q dependency mappings and reconciled plan;
4. rehearse backup/restore;
5. run the existing Phase 4R guarded staging product import;
6. run the guarded staging price import;
7. verify staging/UAT before any production cutover.

No numeric inventory quantity is inferred by this process.
