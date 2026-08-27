# COQUETTE Studio — Guarded Pricing

**Status:** implementation contract for Guided New Piece Step 5  
**Scope:** unpublished COQUETTE Studio product drafts only

## Purpose

Step 5 turns explicit merchant-entered EUR prices into Medusa pricing without allowing descriptive autosave, browser-side state, or an inferred default to change what a customer pays.

COQUETTE Studio remains a merchant UX over Medusa. Medusa Pricing remains authoritative.

## Preconditions

Pricing is available only when all of the following are true:

- the product is still `draft`;
- the product originated from the guarded COQUETTE Studio draft flow;
- the guarded Size/Colour variant graph has already been generated;
- every variant has a Medusa price set;
- no conflicting conditional EUR base pricing is present;
- no active unrestricted EUR sale price exists outside the COQUETTE Studio-owned sale list.

If any precondition fails, Studio blocks the write instead of replacing or merging unknown pricing automatically.

## Merchant modes

### Same price for every choice

The merchant enters one regular EUR price and, optionally, one lower sale price. The reviewed values are expanded explicitly across every current variant.

### Price choices separately

Every current variant receives one explicit regular EUR row and an optional lower sale price. Missing, duplicate or unknown variant rows are rejected.

## Amount rules

- EUR only in this phase;
- the amount must be entered explicitly;
- maximum two decimal places;
- no zero or negative selling price;
- sale price, when present, must be lower than regular price;
- no amount is inferred from another product, text, metadata, migration evidence, or prior UI state.

## Review-before-write contract

1. Studio reads current Medusa pricing state.
2. The merchant enters the intended price state.
3. `/admin/studio/pricing/plan` builds a server-authoritative plan.
4. The plan records current → intended values and a deterministic SHA-256 pricing hash.
5. Studio shows that exact plan before enabling the final apply confirmation.
6. Immediately before apply, Studio reloads the product and rebuilds the plan.
7. `/admin/studio/pricing/apply` acquires the pricing lock and accepts only the reviewed hash.
8. The backend writes the requested pricing and then re-reads/verifies the resulting Medusa state.

A changed draft or changed live pricing state invalidates the review and requires a fresh plan.

## Medusa write boundary

Regular EUR prices use Medusa's product-variant pricing workflow.

Sale prices use a dedicated active, unrestricted COQUETTE Studio sale price list identified by Studio-owned metadata. This list is separate from the legacy-reconstruction migration sale list.

Studio pricing must not mutate:

- product publication status;
- sales-channel visibility;
- SKU or barcode;
- inventory quantities;
- inventory location assignments;
- inventory-management flags;
- backorder policy;
- options or variants;
- category/designer placement.

Those domains remain separate guarded workflows.

## Existing expert pricing

Studio deliberately fails closed when it encounters pricing it does not own or safely understand, including conditional/quantity-based EUR base prices and active unrestricted sale prices from another price list.

The correct response is reconciliation through an explicit expert workflow, not silent replacement.

## Current limitation

This phase supports regular prices and an optional immediately active sale price. Scheduled sale dates, eligibility rules, customer-group pricing, quantity pricing, multi-currency pricing and inventory availability are not inferred or exposed here. They require their own guarded merchant workflows.
