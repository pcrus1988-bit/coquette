# Phase 4G/4I — Guarded staging structural product execution

## Purpose

Phase 4G introduced the first migration layer allowed to create reconstructed products in Medusa. Phase 4I extends that structural execution boundary with the real Medusa Product ↔ Brand module link.

The executor remains intentionally limited to **staging** and to the structural product domain already approved by Phase 4F. It does not make an incomplete reconstruction look complete. Before any write, every product and every dependency must pass a fail-closed preflight.

## Scope

The executor can create only explicitly resolved **simple** products.

The structural product write may include:

- title and public description;
- reviewed publication status;
- default sales-channel association;
- default shipping-profile association;
- already-imported category target IDs;
- COQUETTE-owned serving-media URLs;
- one resolved simple variant and its SKU;
- product/variant options where the recovered product-level value is unambiguous;
- migration identity/checksum metadata;
- an explicitly mapped Designer/Brand relationship executed through Medusa's module-link service after the product target exists.

The generated variant uses:

- `manage_inventory: true`;
- `allow_backorder: false`;
- no invented inventory quantity;
- no product/variant prices in this execution phase.

Price-list execution and inventory quantities are separate migration domains and must reconcile independently.

## Required inputs

The operator provides:

1. a Phase 4F capture-ingestion report (`schemaVersion: 3`) containing an executable `importPlan`;
2. dependency mappings for every category/media/brand source reference;
3. an existing product migration manifest, if one exists;
4. an explicit allow-list of COQUETTE serving-media hosts.

Dependency mapping shape:

```json
[
  {
    "entityType": "category",
    "sourceId": "https://coquetteconcept.gr/default/clothing/dresses.html",
    "status": "imported",
    "targetId": "pcat_..."
  },
  {
    "entityType": "media",
    "sourceId": "https://coquetteconcept.gr/media/catalog/product/example.jpg",
    "status": "imported",
    "targetUrl": "https://<coquette-controlled-media-host>/..."
  },
  {
    "entityType": "brand",
    "sourceId": "<recovered-designer-source-id>",
    "status": "imported",
    "targetId": "brand_..."
  }
]
```

`coquetteconcept.gr` is explicitly forbidden as a serving-media host. Legacy images must be copied into COQUETTE-controlled storage first.

## Preflight actions

Every Phase 4F entry becomes one structural execution action:

- `create` — structurally valid, all dependencies resolved, no prior matching target exists;
- `skip` — an earlier manifest already proves the same structural checksum was imported;
- `blocked` — any safety, identity, dependency or update condition is unresolved.

The full plan is executable only when there are zero `blocked` entries.

## Dependency rules

### Categories

Every legacy category source URL must map to an already-imported Medusa category ID.

### Media

Every product media source URL must map to an HTTPS URL on an explicitly allowed COQUETTE serving host.

A downloaded legacy media file is not enough; its serving target must already exist before product creation.

### Designer / Brand

A product carrying a `brandSourceId` must have exactly one imported `brand` dependency mapping with a non-empty Medusa Brand target ID. Missing or duplicate mappings remain blocking conditions.

The Brand target ID is **not** inserted into product metadata and is not treated as proof of a relationship by itself.

In staging write mode, Phase 4I:

1. verifies that the mapped Brand target resolves to exactly one COQUETTE Brand record;
2. queries the product's current `brand.id` through Medusa Query;
3. accepts an already-existing exact Product ↔ Brand link without creating a duplicate;
4. fails closed if the product is linked to a different Brand than the mapped target;
5. creates the missing relationship through Medusa's Link service using the existing Product/Brand module link definition;
6. re-queries and verifies the exact relationship before the product manifest may be marked `imported`.

This relationship step applies to newly created products, SKU/metadata recovery after a manifest gap, and exact-checksum `skip` paths. Therefore a missing relationship can be repaired on retry without duplicating the product.

## Configurable products

Configurable parents remain blocked upstream in Phase 4F. Structural execution supports only explicitly resolved simple products until child variant identities, combinations, prices and inventory relationships have their own reconstruction/import model.

## Retry and crash recovery

Previous product-manifest state is handled as follows:

- `imported` + same checksum + target ID → `skip`, while still verifying/repairing the required Brand link;
- `imported` + changed checksum → blocked until an explicit update path exists;
- `pending` or `error` + same checksum → retry is allowed;
- `pending` or `error` + changed checksum → blocked for review;
- `skipped` → blocked for reconciliation;
- duplicate previous manifest keys → blocked.

Before creation, write mode also queries Medusa by SKU.

If a matching product already exists and its migration metadata contains the same legacy source ID and structural checksum, the executor treats it as a recoverable manifest gap rather than creating a duplicate. Any unrelated or changed SKU collision aborts the migration.

For brand-bearing products, recovery is complete only after the mapped Product ↔ Brand relationship is verified. If product creation succeeded but Brand linking or manifest persistence failed, the next run finds the existing product by SKU + migration metadata, completes/verifies the relationship, and then checkpoints the manifest.

The manifest is written atomically after every recovered or successful product. If product creation or required relationship execution fails, an `error` manifest entry with an incremented attempt count is persisted before the run stops.

## Dry-run

Dry-run is the default mode:

```bash
export COQUETTE_MIGRATION_MODE="dry-run"
export COQUETTE_STAGING_PRODUCT_IMPORT_REPORT="/private/capture-ingestion-report.json"
export COQUETTE_STAGING_PRODUCT_DEPENDENCIES="/private/product-dependencies.json"
export COQUETTE_STAGING_PRODUCT_MANIFEST="/private/product-manifest.json"
export COQUETTE_MIGRATION_ALLOWED_MEDIA_HOSTS="<coquette-media-host>"
pnpm --filter @coquette/backend staging-product-import
```

Dry-run performs the migration preflight and emits create/skip/block information, including the resolved Brand target where applicable, without writing products or module links.

## Staging write guard

Write mode requires **all** of the following:

```bash
export COQUETTE_MIGRATION_MODE="write"
export COQUETTE_MIGRATION_TARGET="staging"
export COQUETTE_MIGRATION_ALLOW_WRITE="COQUETTE_STAGING_WRITE_CONFIRMED"
export COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST="<exact-staging-db-host>"
export COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME="<exact-staging-db-name>"
```

The executor parses the live `DATABASE_URL` and requires the host/database name to exactly equal the expected staging values.

No `production` target value is accepted. The structural executor is not a production cutover tool.

Write mode also requires `COQUETTE_STAGING_PRODUCT_MANIFEST` so every result can be persisted immediately.

## Medusa write path

Product creation uses Medusa's supported `createProductsWorkflow`, one product per workflow execution. This retains Medusa's workflow consistency/rollback behavior while allowing the migration manifest to checkpoint each product independently.

Designer/Brand assignment uses the existing Medusa module link in `src/links/product-brand.ts` and the Link service only after a Product target ID exists. The relationship is then verified through Query before checkpointing.

The executor resolves exactly one COQUETTE store/default sales channel and exactly one default shipping profile. Ambiguous runtime state aborts the import rather than choosing an arbitrary target.

## CI contracts

The structural execution gates now prove:

1. `staging-product-execution:contract` — pure fail-closed preflight, dependency, retry, media-host, Brand-mapping and write-guard behavior. A valid Brand mapping unblocks the product; the relationship is never hidden in the product-create payload or metadata.
2. `staging-product-import:contract` — disposable clean-database Medusa execution. It creates a synthetic Brand and simple Product, executes the actual Product ↔ Brand module link, verifies the exact relation, reruns the same migration, and proves the SKU, product target and relationship remain idempotent.

## Explicit non-goals

The structural executor does not:

- import to production;
- invent inventory quantities;
- create sale/regular prices;
- claim price or inventory reconciliation from a product manifest;
- import configurable parents/children;
- invent or infer a Designer/Brand identity when no mapped target exists;
- treat metadata as a substitute for a real Medusa module relationship;
- auto-merge EL/EN product identity;
- perform a product update when a previously imported structural checksum changes;
- relax any Phase 4 evidence or URL-universe exit gate.
