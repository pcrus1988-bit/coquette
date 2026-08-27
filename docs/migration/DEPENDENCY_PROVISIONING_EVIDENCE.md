# COQUETTE Phase 4U — Dependency Provisioning Evidence

## Purpose

Phase 4U converts a staging-ready Phase 4T handoff intake into an auditable, non-writing evidence plan for the category, Brand and media targets that must exist before the Phase 4Q mapping plan can be completed.

It does **not** create targets yet. Its job is to prove that every target can be created from explicit public capture evidence rather than guessed identity.

## Command

```bash
COQUETTE_CAPTURE_HANDOFF_FILE=/path/to/handoff.tar.gz \
COQUETTE_REVIEW_DECISIONS_FILE=/path/to/review-decisions.json \
COQUETTE_DEPENDENCY_PROVISIONING_EVIDENCE=/path/to/dependency-evidence.json \
  pnpm capture:coquette:dependencies
```

The review decisions variable is optional when no Phase 4L/4M decisions are required.

## Evidence rules

### Category

A category dependency is ready only when the verified ingestion report contains one unambiguous non-empty public breadcrumb/category name for the exact required category URL, associated with the product(s) that require it.

No category name or handle is derived from a URL slug.

### Brand / Designer

A Brand dependency is ready only when the verified raw `products.jsonl` contains one unambiguous non-empty observed Brand name for the product source URLs that reference that exact Brand dependency.

The Phase 4U plan does not parse or reinterpret the dependency source ID as a Brand name.

### Media

A media dependency is ready only when:

- the exact source URL has one captured media record;
- status is `captured`;
- content type is an image;
- byte count is positive;
- the captured media checksum is SHA-256;
- the referenced media file exists inside the verified Phase 4S archive;
- embedded bytes exactly match both declared byte count and checksum.

The plan records the verified archive path and bytes/checksum identity. It does not create a legacy hotlink or a target URL.

## Fail-closed behavior

Missing or conflicting category/Brand identity and missing/invalid media evidence produce a `blocked` entry. If any entry is blocked, the plan is not ready for provisioning.

Phase 4U requires a staging-ready Phase 4T intake before it will plan dependency provisioning. This prevents provisioning against source facts that may still change through legitimate evidence review.

## Checksums

The plan checksum binds:

- Phase 4P evidence-package checksum;
- Phase 4S handoff checksum;
- Phase 4T intake checksum;
- Phase 4N migration bundle checksum;
- every Phase 4Q dependency requirement;
- every resolved category/Brand identity;
- every media path, byte count and checksum;
- blockers and readiness state.

Generation timestamps are not part of the provisioning evidence identity.

## Write boundary

`isExecutable` is always `false` in Phase 4U.

The next milestone may use a fully-ready, independently checksum-pinned Phase 4U plan as the only source for a guarded **staging** dependency provisioner that:

- creates/reuses exact category targets;
- creates/reuses exact Brand targets;
- uploads the exact captured image bytes to COQUETTE-owned storage;
- verifies the resulting targets;
- emits Phase 4Q mappings.

Production remains out of scope.
