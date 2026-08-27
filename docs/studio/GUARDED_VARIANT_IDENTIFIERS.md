# COQUETTE Studio — Guarded Variant Identifiers

**Status:** implementation contract for Guided New Piece Step 4 after variant generation  
**Scope:** unpublished COQUETTE Studio product drafts with an existing guarded variant graph

## Purpose

This workflow lets a merchant assign the exact SKU, EAN, UPC and barcode values used for each real Medusa product variant without generating identifiers, guessing them from product text or allowing ordinary draft autosave to change variant identity.

COQUETTE Studio remains a merchant UX over Medusa. Medusa Product Variants remain authoritative.

## Preconditions

Variant identifier management is available only when all of the following are true:

- the product is still `draft`;
- the product originated from the guarded COQUETTE Studio draft flow;
- the guarded Size/Colour variant graph has already been generated;
- at least one current Medusa variant exists.

Every current variant must appear exactly once in a reviewed request. Unknown, missing or duplicate variant rows are rejected.

## Supported fields

Each current variant may explicitly set or clear:

- SKU;
- EAN;
- UPC;
- barcode.

All four fields are optional. A blank field means no value / clear the current value. Studio never synthesizes a fallback code.

## Validation

### EAN

Only valid EAN-8 or EAN-13 values are accepted. They must be numeric and include a correct GTIN check digit.

### UPC

Only valid 12-digit UPC-A values are accepted. They must be numeric and include a correct check digit.

### SKU and barcode

Studio accepts explicit printable text within the bounded identifier length. It does not infer formatting, prefixes or numbering sequences.

### Collision protection

Before a plan can be approved, Studio checks:

1. that the same field value is not assigned to two variants in the current review; and
2. that each non-empty identifier is not already assigned to another Medusa variant.

The final apply operation runs under the catalogue-wide `coquette-studio-variant-identifiers` lock so two concurrent Studio writes cannot safely claim the same identifier through this workflow.

## Review-before-write contract

1. Studio reads the current Medusa variant identifier state.
2. The merchant enters only identifiers they actually know.
3. `/admin/studio/variant-identifiers/plan` validates the complete current variant set, identifier syntax and catalogue collisions.
4. The server builds a current → intended plan for every field and computes a deterministic SHA-256 identifier hash.
5. Studio shows the exact server plan before enabling final confirmation.
6. Immediately before apply, Studio reloads the product and rebuilds the plan.
7. `/admin/studio/variant-identifiers/apply` acquires the catalogue-wide identifier lock and rebuilds the plan again.
8. The write proceeds only when the newly calculated hash still equals the merchant-approved hash.
9. Medusa updates the affected product variants through `updateProductVariantsWorkflow` and Studio re-reads the state to verify all four fields exactly.

The approved hash contains both the current and intended identifier state. Therefore an out-of-band change to a variant identifier invalidates the reviewed plan even if the product-level timestamp did not change.

## Medusa write boundary

This workflow may mutate only these product-variant fields:

- `sku`;
- `ean`;
- `upc`;
- `barcode`.

It must not mutate:

- regular or sale prices;
- inventory quantities;
- inventory location assignments;
- inventory-management flags;
- backorder policy;
- option or variant graph structure;
- product publication status;
- sales-channel visibility;
- categories or designers/brands;
- product content or media.

Those domains remain separate guarded workflows.

## Verification contract

The clean-database execution contract proves:

- initial identifier assignment;
- exact state re-read after write;
- idempotent reapply with zero changes;
- explicit updates and clears;
- invalid EAN rejection;
- catalogue-wide collision rejection;
- product remains a draft;
- `manage_inventory` remains false;
- `allow_backorder` remains false.

## Current limitations

This phase does not generate GS1 identifiers, reserve identifier ranges, print labels, scan physical barcodes, import codes in bulk, or change inventory policy. If a merchant does not know a code, the correct value is blank until authoritative information is available.
