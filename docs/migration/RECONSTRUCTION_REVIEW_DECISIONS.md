# Phase 4L — Reconstruction Review Decisions

## Purpose

Phase 4L adds a deterministic, auditable review layer for reconstruction cases that cannot be accepted automatically.

The review system is not a manual override escape hatch. It is designed to preserve the distinction between:

1. facts actually observed in legacy evidence;
2. explicit target-store policy chosen because a legacy fact is unavailable;
3. unresolved identity/evidence that must remain deferred.

No review decision writes products, prices, inventory, or production data in this phase.

## Evidence-bound decisions

Every review item has an `evidenceChecksum` derived from the exact candidate evidence and issue payload.

A decision is valid only when it targets that exact checksum. If the source evidence changes, the prior decision becomes stale and is rejected rather than silently re-applied.

This protects the migration from old human decisions being applied to a materially different reconstruction candidate.

## Review domains

### Publication / visibility

Conflicting recovered `status` or `visibility` values may be resolved only by selecting one of the values actually present in the review evidence.

When a required publication field is entirely unavailable, an operator may record a **target policy** (`enabled`/`disabled`, or one of the supported visibility values). That record is explicitly `policy_only`:

- it does not claim the legacy value was recovered;
- it does not create a normalized legacy product;
- it does not automatically unblock structural recovery.

### Localization

If an alternate-locale URL cannot be recovered, the reviewer may explicitly mark the pairing unavailable or defer it.

A localization decision cannot invent an alternate product URL.

If conflicting alternate-locale URLs are observed, a selection must refer to one of the actual observed choices for the exact evidence checksum.

### Variant identity

Unknown product type, duplicate SKU/source identities, and configurable parent/child reconstruction remain fail-closed.

In particular, a review decision cannot turn a configurable product into a simple product, create child SKUs, invent option combinations, or fabricate variant relationships.

Those items may be deferred until adequate evidence exists.

### Other structural evidence

Structural conflicts can be reviewed through evidence selection only when the selected observation already exists in the captured conflict evidence.

Missing core identity/category/media facts remain deferred; review cannot fabricate them.

## Allowed actions

### `select_observed_value`

Allowed only for an evidence conflict. The decision must include `selectedObservationChecksum`, and that checksum must match one of the exact observation choices on the review item.

Effect: `evidence_selection`.

### `record_target_policy`

Allowed only for missing publication/status policy fields.

Supported target values are intentionally constrained:

- status: `enabled`, `disabled`
- visibility: `catalog_search`, `catalog`, `search`, `not_visible`

Effect: `policy_only`.

A policy-only decision is not reconstructed source evidence.

### `mark_unavailable`

Allowed only for unresolved alternate-locale pairing.

Effect: `unavailable`.

### `defer`

Records that the item has been deliberately reviewed but cannot yet be resolved safely.

Effect: `deferred`.

## Audit requirements

Every decision requires:

- exact review key
- exact evidence checksum
- reviewer identity (`decidedBy`)
- valid decision timestamp
- non-empty rationale
- action-specific data when required

Duplicate decision keys, duplicate review keys, orphan decisions, stale evidence, invalid actions, invented observation selections, and invalid publication policies make the review plan unreconciled.

## Execution boundary

Phase 4L deliberately exposes `isExecutable: false`.

The phase validates and accounts for review decisions but does not yet apply evidence selections back into structural import candidates. This separation is intentional: decision validation is established first, then a later phase can apply only the safe `evidence_selection` subset while preserving all source/policy provenance.

Publication policy-only records, localization unavailable records, and deferred variant identity do not become legacy facts.

## CI contract

`review-decisions:contract` proves:

- structural conflict review items are deterministic;
- only an actually observed value can be selected;
- stale evidence checksums invalidate decisions;
- invented observation checksums are rejected;
- missing publication data may receive a constrained policy-only decision without unblocking legacy reconstruction;
- invalid publication policy values are rejected;
- missing alternate-locale pairing can be explicitly recorded unavailable without inventing a URL;
- configurable variant structure cannot be manually converted into another product type;
- duplicate and orphan decisions make the plan unreconciled;
- the review layer itself has no execution/write path.

## Next application phase

A subsequent phase may consume validated `evidence_selection` decisions and rebuild candidates deterministically. That application must:

1. retain the original evidence and decision audit trail;
2. include the decision/evidence checksum in planning identity;
3. refuse stale decisions;
4. never treat `policy_only`, `unavailable`, or `deferred` records as recovered legacy evidence;
5. keep configurable child identity blocked until explicit child evidence exists;
6. pass its own exact-head CI before any staging migration input is changed.
