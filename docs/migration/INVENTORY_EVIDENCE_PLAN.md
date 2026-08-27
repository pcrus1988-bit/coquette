# Phase 4K — Deterministic Inventory Evidence Plan

## Purpose

Phase 4K separates publicly recoverable stock evidence from exact Medusa inventory quantities.

The legacy public storefront can sometimes expose qualitative states such as `in_stock`, `out_of_stock`, `unknown`, or a low-stock message. Those observations are useful reconstruction evidence, but they are **not exact physical inventory counts**.

Phase 4K therefore creates an accountable inventory-evidence domain without creating any inventory write path.

## Hard safety rule

No qualitative public stock wording may be converted into a numeric quantity.

Examples that are explicitly forbidden:

- `in_stock` → `1`
- `out_of_stock` → `0`
- `Only a few left` → an arbitrary count such as `2` or `3`
- `Available` → an inferred positive inventory level

A numeric Medusa inventory quantity may only be introduced by a later source that explicitly and legitimately provides the exact quantity for the exact imported variant/location identity.

## Independent domain

Inventory evidence is separate from structural product and price reconstruction.

The inventory evidence checksum contains only:

- SKU
- stock state, when recovered
- low-stock message, when recovered

Changes to copy, media, categories, brands, or price do not change the inventory evidence checksum.

A change from `in_stock` to `out_of_stock`, or a change in low-stock wording, does change the inventory evidence checksum.

## Plan states

Each structural product candidate receives one inventory evidence outcome:

### `state_only`

Public qualitative inventory evidence exists and is internally consistent.

The evidence is retained with an inventory-domain checksum, but it is not executable as inventory quantity.

The entry always records `exact_inventory_quantity_not_recovered`.

### `unavailable`

No usable public inventory evidence was recovered, or the storefront explicitly reports an unknown stock state.

This is an explained non-write outcome, not an error.

### `blocked`

Automatic inventory evidence selection is unsafe. Examples include:

- structural product is not ready
- structural product identity is incomplete
- duplicate inventory source identity
- conflicting stock-state or low-stock observations
- indexed stock evidence conflicts with selected direct evidence

Blocked evidence requires review rather than guessing.

## Runtime manifest boundary

Phase 4K intentionally returns:

- `isExecutable: false`
- `runtimeManifestEntries: []`

There is no inventory quantity importer, no Medusa inventory write workflow, and no quantity checkpoint in this phase.

This is deliberate. A manifest that can be executed must represent a deterministic target value. Current public reconstruction does not have exact quantity values, so generating such a manifest would create false authority.

## Structural dependency

Inventory evidence is only considered for a structurally `ready` product with:

- a concrete product source key
- a structural source checksum
- a concrete SKU
- a normalized product candidate

Qualitative inventory evidence never makes an otherwise blocked product structurally importable.

## Conflict handling

Inventory-domain conflicts are retained independently from structural product readiness.

A product may remain structurally ready while its inventory evidence is blocked for review. This prevents stock ambiguity from suppressing legitimate product reconstruction while also preventing unsafe inventory inference.

## CI contract

`inventory-plan:contract` proves that:

- `in_stock` is retained as qualitative evidence only
- `out_of_stock` remains qualitative evidence and does not become zero quantity
- low-stock text is retained verbatim without numeric inference
- missing/unknown public stock becomes `unavailable`
- price changes do not change the inventory evidence checksum
- copy changes do not change the inventory evidence checksum
- stock-state changes do change the inventory evidence checksum
- conflicting direct observations block inventory evidence
- unsafe indexed stock evidence blocks inventory evidence
- structurally blocked products remain blocked in the inventory domain
- no runtime inventory manifest is generated
- no quantity-shaped field exists in the plan output

## What is required before numeric inventory execution can exist

A later inventory execution phase must not be created until there is an authoritative source for exact quantities tied to the exact Medusa variant and inventory-location identity. Examples could include a merchant-provided stock file/API, an authenticated legacy export, or a deliberate post-migration merchant stock count.

That later phase must have its own independent quantity checksum, manifest, reconciliation, staging-only write guard, idempotency proof, and disposable-database integration test.

Until then, public stock wording remains evidence only.
