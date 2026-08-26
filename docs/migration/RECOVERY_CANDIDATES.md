# Recovery product candidates

## Purpose

Phase 4 recovery evidence must become useful without becoming falsely authoritative. A **recovery product candidate** is therefore an intermediate object between raw evidence and a normalized Medusa-importable product.

Issue #39 records the active source decision: Magento Admin/database/filesystem/API access is no longer available, so direct public-storefront evidence is the canonical recoverable source. Indexed evidence supports discovery and reconciliation where infrastructure-hosted capture is blocked.

A candidate can be:

- `ready` — sufficient direct, timestamped evidence exists and all required product fields are present with no unresolved conflicts;
- `needs_review` — useful evidence exists, but identity, structure, provenance, or conflicting values still require resolution;
- `rejected` — the candidate has no usable key/evidence and cannot participate in reconciliation.

`ready` means ready for the migration/import layer. It does not bypass later staging reconciliation or publication controls.

## Evidence authority

The resolver understands these evidence classes:

1. `authoritative_magento` — compatibility class only if a legitimate historical Magento snapshot is unexpectedly recovered later;
2. `direct_storefront` — the current canonical recoverable Phase 4 source;
3. `public_search_index` — secondary recovery/reconciliation evidence;
4. `derived` — reconstruction from relationships or surrounding evidence.

No Magento package is currently expected or required. The compatibility class remains so a later legitimate recovery can be compared without redesigning the migration model.

A lower-ranked value never silently replaces a higher-ranked value. If values differ, the stronger value can be selected for the candidate but the disagreement is retained as a conflict and the candidate becomes `needs_review`.

This is intentionally conservative. A newer live storefront observation can prove that an older recovered snapshot changed later, but that chronology must be reviewed rather than flattened into one invented source of truth.

## Required product structure

A product cannot become `ready` without explicit values for:

- source identity;
- SKU;
- name;
- source status;
- source visibility;
- product type;
- category-source relationships, even when explicitly empty;
- option-value structure, even when explicitly empty;
- media-source relationships, even when explicitly empty.

If price evidence is present, currency is also required. `type: unknown` remains review-blocking. At least one direct/authoritative observation must carry a valid timestamp before the candidate can become ready.

## Stock safety

Stock is special. `public_search_index` and `derived` observations are never permitted to set stock automatically. If indexed/derived evidence appears to claim stock, the value is withheld and an `unsafe_field_authority` conflict is emitted.

A search result, category page, designer listing, cached page, or product mention is not inventory proof. Exact stock quantities remain unavailable unless they are actually exposed publicly.

## Indexed baseline behavior

`buildIndexedRecoveryProductCandidates()` converts the product spot checks in `indexed-recovery-baseline.json` into intermediate candidates. It intentionally maps only facts that the indexed record actually carries:

- product name;
- observed regular/sale price;
- EUR currency when the source field itself is explicitly an EUR field;
- source URL and freshness label as provenance.

It does **not** manufacture SKU, Magento source ID, product type, source status, visibility, category membership, media relationships, variant options, or stock.

As a result, the current indexed-only candidates must remain `needs_review`. CI runs both the recovery-candidate contract and the real baseline candidate generator; the generator fails if indexed-only evidence ever becomes `ready` automatically.

## Conflict report semantics

Conflicts retain every contributing observation with authority, URL, timestamp/freshness and value. Current conflict reasons are:

- `same_authority_conflict`
- `cross_authority_conflict`
- `unsafe_field_authority`
- `invalid_value`

Identity and pricing conflicts are critical. Non-critical disagreements still require review before the candidate is considered ready.

## Next integration point

The next active integration point is **successful direct public-storefront capture from an accepted operator/browser network**. Captured product evidence should be attached to matching recovery candidates, filling public SKU, type/options, categories, media, direct stock state and other recoverable fields while surfacing explicit conflicts with older indexed observations.

If a legitimate historical Magento snapshot unexpectedly becomes available later, it can enter through the retained compatibility evidence class and be compared rather than silently replacing newer public evidence.

Only conflict-free, complete candidates proceed to `NormalizedStorefrontProduct`, source-record checksumming, manifest import tracking, and final source/imported/skipped/error reconciliation. Private Magento-only domains that are no longer legitimately recoverable remain explicitly unavailable rather than inferred.
