# COQUETTE — Deterministic Price Reconstruction and Guarded Execution

**Planning phase:** 4H  
**Guarded execution phase:** 4J  
**Scope:** public regular/sale pricing only

## Purpose

Phase 4H reconstructs the recoverable public legacy pricing domain independently from structural product and inventory state. Phase 4J adds the first staging-only Medusa execution path for those deterministic price facts.

No amount, currency, sale state, schedule or inventory quantity may be invented.

## Domain separation

The migration domains remain independent:

- `product`: identity, copy, categories, captured media, options and Designer/Brand relationship;
- `price`: regular price, optional lower sale price and explicit currency;
- `inventory`: public stock evidence and later exact quantities only when legitimately known.

A price-only change does not alter the structural product checksum. A structural copy/media/category change does not alter the price checksum when SKU and recovered price facts are unchanged.

Phase 4J additionally carries the structural product checksum into each price-plan entry. Pricing may execute only when the product manifest proves that the exact structural checksum has already been imported and has a concrete Medusa product target.

## Accepted public price evidence

Automatic price planning requires:

1. structurally `ready` product identity;
2. non-empty SKU and product source key;
3. retained structural product checksum;
4. explicit regular price;
5. explicit `EUR` currency;
6. finite positive regular price;
7. optional sale price that is finite, positive and strictly lower than regular price;
8. no unresolved regular/sale/currency evidence conflicts.

Currency is never inferred from deployment region or store defaults during migration.

## Explicit unavailable state

If no public regular or sale price was recovered, the price entry is `unavailable` with warning `public_price_not_recovered`.

`unavailable` is an accountable non-write state. It is not converted to zero and does not make the structural product invalid.

## Independent price manifest

Every deterministic price entry uses:

- `entityType`: `price`;
- `sourceId`: the corresponding legacy public product source URL;
- explicit locale inherited from the structural product source identity where available.

The semantic price checksum contains only:

- SKU;
- currency code;
- regular price;
- optional sale price.

The runtime price manifest is independent from the structural product manifest. Its `targetId` is the Medusa variant ID after successful price execution.

## Phase 4J execution preflight

Each price entry becomes one action:

- `apply` — deterministic price exists and must be created, repaired or updated;
- `skip` — the prior price manifest proves the same price checksum was imported;
- `unavailable` — no public price was recovered and no write is attempted;
- `blocked` — identity, structural dependency, manifest or evidence requirements are unresolved.

Before an `apply` or `skip` entry is executable, Phase 4J requires:

- an exact pending runtime price-manifest entry for the current price checksum;
- exactly one matching structural `product` manifest entry;
- structural manifest status `imported`;
- non-empty Medusa product target ID;
- structural manifest checksum equal to the structural checksum retained by the price plan;
- no duplicate product or price manifest keys.

This prevents price execution from outrunning a changed or not-yet-imported structural product.

## Changed public prices

Phase 4J is the explicit price-update strategy that Phase 4H intentionally deferred.

A prior imported price manifest with a different price checksum is allowed to become `apply` only when the structural checksum still matches the imported product target. The executor then updates the live Medusa pricing state and checkpoints the new price checksum.

A structural checksum mismatch remains blocking.

## Live SKU/product verification

In write mode, the executor resolves the SKU in Medusa and requires exactly one variant. That variant's `product_id` must equal the target ID recorded by the imported structural product manifest.

A matching SKU on any other product aborts the migration.

## Regular EUR price

The regular price is written through Medusa's supported `updateProductVariantsWorkflow` pricing path using major currency units and lowercase API currency code `eur`.

A recovered public price such as `129.90 EUR` remains `129.90`; it is never multiplied by 100.

The executor verifies that exactly one unrestricted base EUR price exists for the variant after the write and that its amount exactly equals the reconstructed regular price.

## Recovered sale price

Recovered lower sale prices use a dedicated Medusa price list:

- type: `sale`;
- status: `active`;
- no start date;
- no end date;
- no rules;
- migration metadata marker: `coquette_migration_price_list=legacy-public-sale-v1`.

No sale schedule is invented because the public evidence did not recover one.

The dedicated price list is discovered by its metadata marker. More than one matching list is a hard error. If the marked list has been changed to draft, scheduled or rule-bound state, execution fails closed rather than overwriting merchant changes.

Sale price creation/update/removal uses Medusa's supported price-list batch workflow.

If a previously recovered sale disappears from current public evidence while the regular price remains valid, Phase 4J removes only the price belonging to the dedicated COQUETTE migration sale list. It does not delete unrelated merchant price-list entries.

## Foreign active sale protection

If the target variant already has an active unrestricted EUR sale price outside the dedicated migration sale list, Phase 4J aborts that entry. This avoids producing ambiguous calculated pricing during reconstruction.

## Retry and drift recovery

- prior `pending` or `error` price manifest → `apply`;
- prior `imported` + changed price checksum → `apply` using the explicit update strategy;
- prior `imported` + same checksum → `skip`, but live state is still verified;
- prior `skipped` → blocked for reconciliation;
- duplicate price manifest keys → blocked.

If the live price state drifted while the source checksum stayed unchanged, the write executor repairs the exact expected state and records a manifest warning.

If a price write succeeded but manifest persistence failed, a retry re-resolves the same variant/product identity, observes the already-correct live state and then checkpoints the manifest without duplicating prices.

## Staging write guard

Dry-run remains the default.

Write mode reuses the structural migration guard and requires all of:

```bash
export COQUETTE_MIGRATION_MODE="write"
export COQUETTE_MIGRATION_TARGET="staging"
export COQUETTE_MIGRATION_ALLOW_WRITE="COQUETTE_STAGING_WRITE_CONFIRMED"
export COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST="<exact-staging-db-host>"
export COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME="<exact-staging-db-name>"
```

Required price-import files:

```bash
export COQUETTE_STAGING_PRICE_IMPORT_REPORT="/private/capture-ingestion-report.json"
export COQUETTE_STAGING_PRODUCT_MANIFEST="/private/product-manifest.json"
export COQUETTE_STAGING_PRICE_MANIFEST="/private/price-manifest.json"
```

The live `DATABASE_URL` host and database name must exactly match the expected staging values. `production` is not accepted.

## CI contracts

Phase 4J adds two gates:

1. `staging-price-execution:contract` — pure preflight coverage for imported structural dependency, structural checksum freshness, same-checksum skip, changed-price apply, retry states, duplicate manifests and explicit unavailable prices.
2. `staging-price-import:contract` — disposable PostgreSQL integration. It creates a structural product through the guarded product importer, applies regular + sale pricing, reruns idempotently, changes both prices, verifies the structural checksum is unchanged while the price checksum changes, updates pricing in place, then removes the recovered sale while retaining the regular price.

The existing Sale pricing graph contract remains in CI after the price executor is exercised.

## Inventory boundary

Price execution does not set or infer inventory quantities and does not convert public `in_stock` / `out_of_stock` wording into invented stock levels. Inventory remains a separate migration domain.

## Non-goals

Phase 4J does not:

- write to production;
- run automatically against the real COQUETTE staging database;
- invent currency, price, discount, sale dates or price-list rules;
- import exact inventory quantities;
- import unresolved configurable parents/children;
- bypass structural Product ↔ Brand requirements;
- overwrite unrelated merchant sale price lists;
- treat a price manifest as proof of structural or inventory reconciliation.
