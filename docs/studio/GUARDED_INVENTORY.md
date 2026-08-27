# COQUETTE Studio Guarded Inventory

## Purpose

This milestone implements the Phase 5 inventory quantity and stock-location boundary for Guided New Piece without weakening the project's fail-closed commerce rules.

COQUETTE Studio may edit explicit whole-unit stock for an unpublished Studio draft only after the variant graph exists. It never guesses stock from text, prior products, legacy evidence, pricing, identifiers, or storefront state.

## Fixed stock-location policy

The guarded Studio flow recognizes one location only:

- `COQUETTE Greece`
- it must already be the Medusa store's configured default stock location;
- Studio does not create, rename, select, or infer stock locations;
- any inventory level at another location blocks the Studio inventory editor.

The canonical staging bootstrap is responsible for provisioning and configuring this location.

## Read → review → apply

Inventory uses the same deliberate boundary as guarded pricing and variant identifiers.

1. **Read state** — load the exact Studio draft, variants, inventory links, location levels, stocked quantity, reserved quantity, and incoming quantity.
2. **Review plan** — require exactly one explicit quantity row for every current variant and build a deterministic SHA-256 plan.
3. **Apply** — acquire a per-product lock, rebuild the plan from live state, require the same hash, execute the write workflow, then re-read and verify invariants.

The hash binds the reviewed product timestamp, location, variant ids, inventory item and level ids, current quantities, reservation/incoming state, intended quantities, and planned action.

## Supported actions

A reviewed variant can have one of four actions:

- `setup_tracking` — an older Studio variant is still untracked; create one Medusa inventory item, create one level at `COQUETTE Greece`, link it to the variant with required quantity `1`, and enable inventory management;
- `create_level` — a valid inventory item exists but its `COQUETTE Greece` level is missing;
- `update` — update only the reviewed stocked quantity on the existing level;
- `unchanged` — no inventory write is required.

`allow_backorder` remains `false` throughout this workflow.

## Explicit safety blocks

Studio refuses the write rather than guessing when it finds:

- a non-Studio product or a published product;
- a draft whose generated variant graph is missing;
- multiple inventory items linked to one variant (kit/composite inventory);
- a `required_quantity` other than `1`;
- inventory levels outside `COQUETTE Greece`;
- duplicate levels at the managed location;
- a variant that says inventory is managed but has no inventory item;
- an inventory link while `manage_inventory` is disabled;
- an existing backorder policy;
- malformed, fractional, negative, excessive, missing, or duplicate quantity rows;
- an intended stocked quantity below the current reserved quantity;
- a stale draft timestamp or stale inventory-plan hash.

## Reservations and incoming stock

Reserved and incoming quantities are read and displayed to the operator but are not editable by this milestone.

A stock quantity may not be saved below existing reservations. Studio never rewrites reservations to make a requested quantity fit. Incoming stock is also left untouched.

## Intentionally out of scope

This milestone does not:

- publish or archive products;
- assign sales channels;
- change prices or sale-price rules;
- change SKU, EAN, UPC, or barcode identifiers;
- enable backorders;
- create additional stock locations;
- support multi-location allocation or inventory kits;
- alter reservations or incoming quantities.

Those concerns remain separate reviewed milestones under the Blueprint.

## Runtime contract

`apps/backend/src/scripts/studio-inventory-contract.ts` validates the real Medusa behavior on a clean PostgreSQL database after the canonical commerce bootstrap. It covers:

- conversion of legacy untracked Studio variants to tracked inventory;
- creation of exactly one inventory level at the configured `COQUETTE Greece` location;
- explicit quantity persistence;
- idempotent re-application;
- a later quantity update without duplicating inventory items/levels;
- stale-plan rejection;
- draft preservation;
- `manage_inventory = true` and `allow_backorder = false` invariants.

The dedicated `COQUETTE Studio Inventory CI` workflow also enforces source/public asset parity and static boundaries against publication, pricing, identifiers, sales-channel writes, and browser-held Medusa credentials.
