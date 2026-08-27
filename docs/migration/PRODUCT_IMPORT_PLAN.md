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
6. A configurable parent is blocked until child variant identity, option combinations, prices and inventory can be reconstructed explicitly.
7. At least one recovered category source relationship exists.
8. At least one product-media source backed by captured archive evidence exists.
9. Category/media source URLs remain on the legacy COQUETTE host.
10. Configurable parents are not flattened into purchasable option values.
11. Sale price does not exceed regular price.
12. Candidate key is unique.
13. SKU identity is unique within the current import plan.
14. Legacy product source key is unique within the current import plan.
15. Runtime migration source key is unique.

## EL/EN identity rule

The legacy storefront exposes language routes such as `/default/` and `/en/`.

Phase 4F may derive only those explicit route locales:

- `/default/...` → `el`
- `/en/...` → `en`

However, two otherwise-ready pages sharing the same SKU are **not** automatically imported as separate Medusa products. They are blocked with:

`duplicate_sku_requires_product_identity_resolution`

This deliberately prevents an EL and EN representation of one physical product from becoming duplicate catalogue products before localization identity is explicitly resolved.

Two different candidate records that point to the same legacy product source key are also blocked. Source identity must be resolved rather than allowing two plan records to compete for the same runtime mapping.

## Entity-specific checksums / idempotency

Two distinct checksums are retained:

### Planning checksum

Includes candidate disposition, selected evidence, conflicts, blockers, missing fields and provenance.

It changes when the evidence/review state changes, including when price or stock observations change.

### Product semantic source checksum

The runtime `product` manifest checksum represents only the **structural product domain** that the product import executor is allowed to apply.

It includes product/source identity, canonical/localization references, SKU/name/status/visibility/type, descriptions, categories, options, media relationships and related structural product fields.

It deliberately excludes:

- `stockState`
- `lowStockMessage`
- `regularPrice`
- `salePrice`
- `currencyCode`
- evidence timestamps/provenance metadata

Price and inventory are separate migration domains and will receive their own manifests/execution gates. A newer capture, price change or stock-state change therefore does not falsely imply that the structural Medusa product entity itself needs re-import. The planning checksum still changes so the new evidence remains visible for later price/inventory processing.

The product semantic checksum is used by the runtime product migration manifest and existing `shouldReimport` logic.

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
- claim that product-manifest completion also means price or inventory completion;
- guess Magento/private status or visibility;
- create Designer/Brand IDs from labels;
- resolve EL/EN product identity automatically merely from matching SKU;
- invent configurable child variants from ambiguous swatch markup;
- upload media into serving storage;
- mark the migration reconciled while blocked candidates remain.

Those steps require later explicit review/mapping/import phases.
