# COQUETTE — Sale Merchandising Contract

**Status:** active architecture contract  
**Last updated:** 2026-08-26

This document defines when COQUETTE may present a product as being on Sale and how the public `/sale` surface is populated. The goal is to keep storefront merchandising aligned with Medusa's calculated pricing rather than inferring discounts from visual differences or raw source records.

## 1. True Sale definition

A storefront price receives Sale treatment only when the currently calculated Medusa variant price identifies its source price list as type `sale`.

The storefront must not infer Sale solely from:

- `original_amount > calculated_amount`
- an `override` price list
- a Magento badge or CSS class
- a product appearing in a raw price-list candidate set
- a historical/scheduled price that is not currently applicable

Sale badge and strike-through rendering use the shared `isMedusaSalePrice` helper.

## 2. Public Sale candidate discovery

The backend discovers candidate products from Medusa Price Lists using the pricing graph:

`Price List → Price → Price Set → Variant → Product`

The public candidate set initially accepts only price lists that:

- have type `sale`
- have status `active`
- have started, when `starts_at` is set
- have not expired, when `ends_at` is set
- have no price-list-level rules (`rules_count === 0`)

Price-list-level rules are excluded from the general Sale page because they can represent customer-group or other restricted eligibility. Such pricing can still apply in its proper customer context elsewhere; it is simply not advertised as a universal public offer.

## 3. Store API applicability check

Candidate membership is not final Sale membership.

The storefront rehydrates candidate product IDs through Medusa's normal Store Product API using the normal pricing context, including COQUETTE's current default country context and requested locale. A product is admitted to the public Sale PLP only when at least one returned variant's **currently calculated price** is actually sourced from a Sale price list.

This second stage protects the public Sale page from:

- region-specific price records that do not apply to the current storefront context
- inactive/non-winning Sale prices
- conditional prices that do not apply to the current request
- stale candidate relationships

## 4. Pagination and ordering

The storefront establishes the applicable public Sale set before applying page offset/limit. This produces an exact Sale product count and truthful pagination.

The current deterministic default order is product title. Search/sort merchandising will be upgraded in Phase 7; disabled sorting controls must not imply functionality before then.

## 5. Variant display behavior

Ordinary category/designer cards continue to display the lowest currently calculated variant price.

A dedicated Sale card instead prefers the lowest variant whose calculated price is a true Sale price. This prevents a cheaper regular variant from causing a Sale product card to display a non-Sale price next to a Sale badge.

The product-detail page uses the same true-Sale semantic helper for strike-through treatment.

## 6. Backend exposure boundary

`/store/sale-candidates` exposes only:

- candidate product IDs
- candidate count
- generation timestamp

It does not expose internal pricing records, rule payloads, database credentials or migration state.

Final prices remain the responsibility of Medusa's Store Product API/calculated-pricing machinery.

## 7. CI contract

`pnpm --filter @coquette/backend sale:contract` executes the same pricing graph used by the runtime candidate endpoint against a clean migrated database.

The normal COQUETTE CI gate runs this after `medusa db:migrate` and before production builds. A broken Medusa graph relation therefore blocks merge.

## 8. Merchant operating rule

Use Medusa **Sale** Price Lists for discounts that should appear as public sale pricing when their conditions apply.

Use **Override** Price Lists for price replacement/segmentation semantics. Override pricing must not automatically receive a Sale badge or strike-through presentation.

Restricted/customer-specific pricing must not be promoted on the general public Sale page unless a future merchandising design explicitly and safely models that audience context.

## 9. Magento migration rule

Magento special-price and promotion data must be mapped deliberately into Medusa pricing semantics during controlled migration. Public Magento HTML, badges or rendered prices are discovery evidence only and are not authoritative enough to determine target Sale membership.

Migration reconciliation must distinguish:

- regular/default price
- true public Sale price
- scheduled Sale window
- customer-group/restricted pricing
- override/replacement pricing
- promotion/coupon behavior that belongs to the Promotion Module rather than a Price List

## 10. Scale boundary

The current storefront foundation prefilters through active public Sale price lists, then rehydrates candidates through the Store Product API to compute the exact applicable Sale set. This prioritizes correctness and is appropriate for the present rebuild foundation.

If catalogue or promotion scale later makes this expensive, optimize with cache/materialized merchandising indexes or a dedicated search/indexing layer while preserving the same eligibility contract. Do not weaken correctness by publishing raw candidate membership directly.
