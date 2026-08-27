# Phase 4M — Applying Validated Review Evidence Selections

## Purpose

Phase 4M applies only the narrow subset of Phase 4L review decisions that represent a reviewer selecting one of the facts already present in captured conflict evidence.

It does **not** apply target publication policy, localization-unavailable records, deferred decisions, stale decisions, or invented identity.

The output is a newly reconstructed candidate set and deterministic product import plan. Phase 4M itself does not write Medusa, staging, or production data.

## Eligible decision

A decision may affect a candidate only when the Phase 4L review plan validates it as:

- state: `decided`
- effect: `evidence_selection`
- action: `select_observed_value`
- exact current review/evidence checksum
- exact selected observation checksum present on that review item

Any other decision remains an audit/review record and does not modify reconstructed legacy facts.

## Application semantics

For an eligible evidence selection:

1. the selected field is replaced with the value from the exact observed evidence choice;
2. the resolved structural conflict for that field is removed;
3. the candidate structural readiness is recomputed;
4. the normalized product is rebuilt only if all remaining structural requirements are satisfied;
5. the full product import plan is rebuilt from the reviewed candidates;
6. product planning and semantic source checksums are therefore recalculated from the resulting facts.

A reviewer does not directly specify the replacement value. The replacement value is read from the selected observation already stored on the validated review item.

## Audit trail

Every applied evidence selection is retained on the reviewed candidate as an audit entry containing:

- review key
- exact evidence checksum
- field
- selected observation checksum
- checksum of the selected value
- reviewer identity
- decision timestamp
- rationale

This provenance is separate from the structural product payload but remains attached to the reviewed reconstruction result.

## Decisions that are deliberately not applied

### Publication policy

`record_target_policy` remains `policy_only`.

It may inform a later COQUETTE publication policy workflow, but it never fills a missing recovered Magento `status` or `visibility` fact and never creates a normalized legacy product by itself.

### Localization unavailable

`mark_unavailable` records that no alternate-locale pairing is currently recoverable. It does not create or modify `alternateLocaleUrl`.

### Deferred identity

`defer` never changes reconstruction facts.

Configurable parent/child structure, missing child SKUs/options/relationships, duplicate product identity and other unresolved identity remain blocked until actual evidence exists.

### Invalid or stale decision plans

If the Phase 4L decision plan is unreconciled for any reason, Phase 4M applies **zero** selections and returns the original candidates/product plan with global blocker `review_decision_plan_not_reconciled`.

There is no partial application of an invalid decision set.

## Domain separation

Price and inventory conflicts remain independent from structural review application.

Phase 4M only removes the exact structural conflict for a validated evidence selection. It does not erase or resolve price/inventory conflicts merely because the structural product becomes ready.

## Execution boundary

Phase 4M intentionally exposes `isExecutable: false`.

The resulting `ProductImportPlan` may itself become executable after legitimate structural conflicts are resolved. That does not mean Phase 4M performs the import. The already guarded Phase 4G staging structural executor remains the only write-capable structural path and retains its own dry-run/write guards, dependencies and manifest reconciliation.

A later integration step may feed a reviewed, reconciled product plan into that guarded executor, but only after explicit input reconciliation and its own CI proof.

## CI contract

`review-application:contract` proves:

- an exact observed-value selection can resolve a structural conflict and produce a ready deterministic product plan;
- the applied decision audit preserves exact review/evidence/observation provenance;
- the resulting product planning identity changes after the evidence conflict is resolved;
- stale decisions apply nothing and leave the original blocked candidate intact;
- publication policy-only decisions are skipped and do not fill missing legacy visibility/status;
- localization-unavailable decisions are skipped and do not invent alternate URLs;
- configurable identity deferral leaves the product blocked;
- price-domain conflicts survive structural review application independently;
- Phase 4M itself remains non-executable and performs no migration writes.
