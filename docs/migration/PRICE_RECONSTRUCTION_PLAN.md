# COQUETTE — Deterministic Price Reconstruction Plan

**Phase:** 4H  
**Scope:** public regular/sale pricing only  
**Execution:** planning and manifest generation only in this phase

## Purpose

Phase 4H reconstructs the public legacy product pricing domain without extending the structural `product` manifest and without inventing any amount, currency, sale state, schedule or inventory quantity.

The price plan consumes the already evidence-gated Phase 4F structural product plan. Pricing can only become `ready` when the corresponding product identity is structurally ready. This prevents price execution from outrunning SKU/product identity.

## Domain separation

The following remain independent migration concerns:

- `product`: product identity, copy, categories, captured media, option structure
- `price`: regular price, optional lower sale/special price, explicit currency
- `inventory`: public stock state and later exact quantities only when legitimately known

A change to price must not alter the structural product checksum. A structural copy/media/category change must not alter the price checksum when SKU and recovered price facts are unchanged.

### Recovery boundary

Public recovery keeps price and inventory observations attached to the candidate for provenance, but domain-specific defects no longer decide structural product readiness.

In particular:

- missing price currency does not make a structurally complete product incomplete;
- conflicting regular/sale/currency observations remain recorded but do not block structural product reconstruction;
- invalid sale-vs-regular relationships remain recorded but are adjudicated by the price plan;
- unsafe indexed stock evidence remains recorded and excluded from selected stock state, but does not block an otherwise structurally complete product.

The downstream price plan explicitly inspects retained pricing conflicts and fails closed with `price_evidence_conflict_requires_review`. Inventory will receive the same independent-accountability treatment in its own migration plan. This means domain separation applies to readiness and execution—not only to checksums.

## Accepted public price evidence

A price entry may be planned automatically only when:

1. the structural product plan entry is `ready`;
2. the product has a non-empty SKU and stable product source key;
3. an explicit regular price is recovered;
4. the explicit currency is `EUR`;
5. the regular price is finite and strictly positive;
6. an optional sale price is finite, strictly positive and strictly lower than the regular price;
7. no unresolved pricing-evidence conflict remains for regular price, sale price or currency.

No currency is inferred from deployment region or shop defaults during migration.

## Explicit unavailable state

If neither a regular price nor a sale price was recovered from public evidence, the entry is classified as `unavailable` with warning `public_price_not_recovered`.

`unavailable` is an accountable outcome, not a guessed zero price and not a structural product failure. It produces no runtime price-manifest entry.

A price plan can therefore be reconciled while containing explicitly unavailable prices, but it is executable only when at least one deterministic `ready` price exists and no blockers remain.

## Blockers

The plan fails closed for conditions including:

- structural product not ready;
- missing structural product source key or SKU identity;
- sale price present without a regular price;
- missing/unsupported currency;
- zero, negative or non-finite regular/sale price;
- sale price equal to or above the regular price;
- unresolved regular/sale/currency evidence conflicts;
- duplicate price SKU/source/runtime-manifest identity.

Ambiguous sale markup is reviewed rather than silently normalized.

## Manifest semantics

Every deterministic price entry receives an independent migration source key:

- `entityType`: `price`
- `sourceId`: the corresponding legacy public product source URL
- `locale`: inherited from the structural product source key when explicitly recoverable

The semantic price checksum includes only:

- SKU
- currency code
- regular price
- optional sale price

It excludes capture timestamps, evidence notes, product copy, product media, categories and inventory state.

## Monetary units

Medusa v2.19 price amounts use major currency units. A recovered public price such as `129.90 EUR` remains `129.90` for Medusa pricing; Phase 4H must not multiply it by 100.

Currency is normalized for source reconstruction as `EUR`. Any later Medusa execution adapter may convert the code to the Medusa API's lowercase `eur` representation without changing the recovered monetary value.

## Sale price-list boundary

Phase 4H records deterministic regular/sale facts but does **not** yet write them to Medusa.

A later staging execution phase must:

- resolve the imported Medusa variant corresponding to the migration SKU/source identity;
- write the regular EUR price to that variant's price set;
- represent a recovered lower sale price through an explicit Medusa `sale` price-list path;
- remain idempotent on rerun;
- refuse changed-checksum updates until an explicit update strategy exists;
- avoid inventing sale start/end dates that were not recovered from public evidence.

The existing COQUETTE Sale storefront must continue to rely on Medusa's authoritative calculated/original pricing graph, not on client-side discount arithmetic.

## Inventory boundary

Price planning does not set stock quantities and does not convert public `in_stock` / `out_of_stock` wording into invented inventory numbers. Exact inventory remains a separate manifest/execution domain.

## CI contract

`price-plan:contract` proves at minimum:

- regular-price planning;
- valid lower sale-price planning;
- independent `price` manifest identity;
- price checksum stability across structural-only changes;
- checksum change when price changes;
- explicit `unavailable` behavior when public price is missing;
- structural readiness remains intact for missing/invalid price-only data;
- rejection of sale-without-regular, missing currency, zero price and non-discounting sale values in the price domain;
- retained pricing-evidence conflicts block price planning rather than structural product planning;
- blocking when structural product identity is not ready.

## Non-goals

Phase 4H does not:

- write to COQUETTE staging or production;
- create/update Medusa price sets or price lists;
- invent tax-inclusive/exclusive semantics not already established by the commerce configuration;
- create sale schedules;
- import inventory quantities;
- unblock configurable parents whose child variants are unresolved;
- bypass Product ↔ Brand structural relationship requirements.
