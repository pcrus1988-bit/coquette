# COQUETTE Studio — Guarded Variant Generation

**Status:** implemented on feature branch; pending final CI and merge  
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

The generated variants explicitly use `manage_inventory: false` and `allow_backorder: false`. The activation request has no input path for prices, inventory items, stock quantities, sales channels or publication state.

## Choice modes

- `one-size` → one `Size` option with value `One Size`, one variant
- `size` → one `Size` option and one variant per saved size
- `color` → one `Colour` option and one variant per saved colour
- `size-color` → `Size` + `Colour` options and the Cartesian product of the two saved lists

Duplicate and blank values are removed during blueprint normalization. The server is authoritative for the generated plan.

## Explicit activation

Step 4 presents the normalized server plan and variant count. The operator must explicitly choose **Build choices** after a separate review step.

Before reviewing or generating, the browser waits for ordinary New Piece autosave, reloads the current product timestamp, and explicitly re-saves the exact visible Step-4 blueprint once. This prevents an older in-flight autosave from becoming the structural source of truth.

The generation request sends only:

- product id
- optimistic-concurrency timestamp
- the exact blueprint hash returned by the server

It does not resend an editable variant payload.

## Concurrency and idempotency

The backend serializes structural generation per product through Medusa's configured locking module. Inside that lock it reloads the product and re-runs every draft, provenance, stale-write and empty-graph guard before any workflow executes.

A retry after a successful generation is therefore rejected as already generated instead of producing duplicate options or variants.

## After generation

The successful workflow records finite Studio metadata including the generated blueprint hash and generated variant count. Once this marker exists, the descriptive autosave endpoint rejects changes to `choice_mode`, `sizes` or `colors` while still permitting exact no-op saves required by ordinary wizard navigation.

The Step-4 client disables the visible choice controls after generation. Editing an already-generated graph will be a separate guarded rebuild/edit workflow.

## Explicitly excluded

This phase does not:

- assign price amounts
- accept price fields from Studio
- create inventory quantities
- accept inventory-item assignments from Studio
- enable backorders
- publish the product
- add sales channels
- schedule publication
- infer SKU, EAN, barcode or stock values

Medusa's native variant workflow may create the empty pricing scaffolding it requires internally, but no money amount is supplied or inferred by COQUETTE Studio.

## Deployment shape

The Studio source files and the Vercel `public` static copies for the variant extension are kept byte-identical by CI. Both Studio HTML shells must include the dedicated variant CSS and JavaScript assets.

## Next phase

Once the variant graph exists, the next guarded layer can assign explicit per-variant EUR prices. Inventory remains a separate following action.
