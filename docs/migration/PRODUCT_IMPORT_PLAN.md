# Phase 4F — Product import planning

## Purpose

Phase 4F separates **recovered evidence** from **executable migration state**.

A recovery candidate may contain useful public evidence while still being unsafe to import. It must therefore never be forced into the runtime migration manifest merely to make reconciliation counts look complete.

The product import plan accounts for every recovery candidate first, then emits runtime `pending` migration entries only for candidates that satisfy all automatic-import gates.

## Plan states

Each recovery candidate becomes exactly one plan entry:

- `ready` — candidate is recovery-ready, normalized, passes pre-import validation, and has no duplicate identity blockers.
- `blocked` — evidence is retained but one or more required fields, validations, conflicts, or identity rules prevent automatic import.
- `rejected` — the recovery candidate itself is invalid/rejected.

Blocked/rejected records remain visible in the plan and are never silently discarded.

## Automatic import gates

A product may produce a runtime `pending` manifest entry only when all of the following are true:

1. Phase 4 recovery candidate disposition is `ready`.
2. A normalized product exists.
3. Legacy source URL is an absolute public URL on `coquetteconcept.gr`.
4. SKU and name are present.
5. Product type is explicitly resolved and not `unknown`.
6. At least one recovered category source relationship exists.
7. At least one product-media source backed by captured archive evidence exists.
8. Category/media source URLs remain on the legacy COQUETTE host.
9. Configurable parents are not flattened into purchasable option values.
10. Sale price does not exceed regular price.
11. Candidate key is unique.
12. SKU identity is unique within the current import plan.
13. Runtime migration source key is unique.

## EL/EN identity rule

The legacy storefront exposes language routes such as `/default/` and `/en/`.

Phase 4F may derive only those explicit route locales:

- `/default/...` → `el`
- `/en/...` → `en`

However, two otherwise-ready pages sharing the same SKU are **not** automatically imported as separate Medusa products. They are blocked with:

`duplicate_sku_requires_product_identity_resolution`

This deliberately prevents an EL and EN representation of one physical product from becoming duplicate catalogue products before localization identity is explicitly resolved.

## Checksums / idempotency

Two distinct checksums are retained:

### Planning checksum

Includes candidate disposition, selected evidence, conflicts, blockers, missing fields and provenance.

It changes when the evidence/review state changes.

### Semantic source checksum

Hashes only the importable normalized product payload and excludes evidence timestamps/provenance metadata.

A newer capture of the same semantic product therefore does not force a re-import solely because `capturedAt` changed.

The semantic checksum is used by the runtime migration manifest and existing `shouldReimport` logic.

## Runtime manifest output

`pnpm --filter @coquette/backend capture:ingest` includes the full import plan in its report.

Optionally set:

```bash
export COQUETTE_RUNTIME_IMPORT_MANIFEST="/private/path/product-runtime-manifest.json"
```

The command writes that executable runtime manifest **only if the entire product import plan is executable**.

If any product remains blocked/rejected or an identity collision exists, no runtime manifest file is written and the command exits non-zero for that requested operation.

This prevents an operator from accidentally treating a partial reconstruction as a complete migration batch.

## What Phase 4F does not do

Phase 4F does not:

- write products into Medusa;
- guess Magento/private status or visibility;
- create Designer/Brand IDs from labels;
- resolve EL/EN product identity automatically merely from matching SKU;
- invent variants from ambiguous swatch markup;
- upload media into serving storage;
- mark the migration reconciled while blocked candidates remain.

Those steps require later explicit review/mapping/import phases.
