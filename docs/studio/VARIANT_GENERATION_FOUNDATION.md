# COQUETTE Studio — Guarded Variant Generation

**Status:** implementation foundation  
**Date:** 2026-08-27

## Objective

Convert the human size/colour blueprint saved by Guided New Piece into a real Medusa option and variant graph without coupling that structural action to pricing, stock, sales-channel visibility or publication.

This is an explicit structural action, not an autosave side effect.

## Safety model

Variant generation is allowed only when all of the following remain true:

- the product is still a Medusa `draft`
- it originated through the guarded COQUETTE Studio draft flow
- the submitted `expected_updated_at` still matches the product
- the saved choice blueprint is valid and non-empty for its selected mode
- the caller confirms the exact server-computed blueprint hash
- no options or variants already exist on the product
- the generated matrix stays within the Studio variant-count limit

The workflow explicitly uses `manage_inventory: false` and `allow_backorder: false` and never accepts prices, inventory items, stock quantities, sales channels or publication state.

## Choice modes

- `one-size` → one `Size` option with value `One Size`, one variant
- `size` → one `Size` option and one variant per saved size
- `color` → one `Colour` option and one variant per saved colour
- `size-color` → `Size` + `Colour` options and the Cartesian product of the two saved lists

Duplicate and blank values are removed during blueprint normalization. The server is authoritative for the generated plan.

## Explicit activation

Step 4 presents the normalized server plan and variant count. The user must explicitly choose **Build choices**.

The client sends only:

- product id
- optimistic-concurrency timestamp
- the exact blueprint hash returned by the server

It does not resend an editable variant payload.

## After generation

The successful workflow records finite Studio metadata including the generated blueprint hash and generated variant count. Once this marker exists, the descriptive autosave endpoint rejects further changes to `choice_mode`, `sizes` or `colors` so the human blueprint cannot silently diverge from the real Medusa graph.

Editing an already-generated graph will be a separate guarded rebuild/edit workflow.

## Explicitly excluded

This phase does not:

- assign prices or monetary amounts
- create inventory quantities
- create inventory-item assignments from Studio input
- enable backorders
- publish the product
- add sales channels
- schedule publication
- infer SKU, EAN, barcode or stock values

## Next phase

Once the variant graph exists, the next guarded layer can assign explicit per-variant EUR prices. Inventory remains a separate following action.
