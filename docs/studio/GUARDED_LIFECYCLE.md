# Guarded Studio publication lifecycle

This Phase 5 increment gives COQUETTE Studio an explicit publish/unpublish boundary over Medusa 2.19 without inventing archive or scheduling semantics.

## Scope

Supported transitions:

- `draft` → `published`
- `published` → `draft`

Medusa states `proposed` and `rejected` are deliberately outside this Studio workflow and fail closed.

## Customer visibility contract

Medusa Store Product routes require published status and valid sales-channel exposure. COQUETTE Studio therefore treats publication as a reviewed combination of product status and canonical channel visibility.

The canonical channel is the single `default_sales_channel_id` configured on the Medusa store. Studio never guesses or creates a replacement sales channel.

A publish plan:

1. verifies the product originated from the guarded Studio Quick Draft flow;
2. verifies a generated Medusa variant graph exists;
3. verifies every variant has exactly one positive unrestricted base EUR price;
4. blocks publication when any foreign/non-canonical sales channel is attached;
5. records the current product timestamp, channel set and exact base-EUR price fingerprint;
6. produces a deterministic SHA-256 lifecycle hash;
7. attaches the canonical channel only when it is missing;
8. changes the product status to `published`;
9. re-reads and verifies the resulting status/channel invariants.

An unpublish plan changes `published` back to `draft` and preserves the canonical channel link so later re-publication does not need to reconstruct visibility configuration. The Medusa Store API hides the product because draft status fails the customer-facing published filter.

## Review/apply safety

The merchant must review a server-generated plan before applying it. Apply runs under a product-scoped Medusa locking key and rebuilds the plan immediately before mutation. A changed product timestamp, channel set or base-EUR price fingerprint invalidates the reviewed hash.

The browser communicates only with same-origin authenticated COQUETTE Studio proxies. Medusa credentials/tokens are never stored in browser state.

## Explicitly out of scope

This increment does not:

- invent an `archived` Medusa product state (Medusa 2.19 has no such state);
- schedule future publication;
- create or remove arbitrary sales channels;
- alter prices, inventory, reservations, backorders, identifiers, categories or designers;
- infer merchant approval from completion of the New Piece wizard.

Archive policy and scheduled activation remain separate Blueprint milestones.
