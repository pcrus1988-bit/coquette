# COQUETTE Studio — Live Boutique & Order Story

**Status:** Implemented production-facing foundation  
**Date:** 2026-08-27

## Purpose

This phase moves COQUETTE Studio beyond dashboard counts into live day-to-day merchant work while preserving the approved luxury/editorial interaction model.

The implementation deliberately separates:

1. rich read experiences that can safely expose real commerce state; and
2. narrow write workflows whose consequences are explicit and constrained.

There is still no generic browser-accessible Medusa admin proxy.

## Live Boutique

The Boutique workspace now reads real Medusa products through a same-origin authenticated Studio endpoint.

It provides:

- editorial product cards with real media when available
- grid and compact-list modes
- server-side search
- published/draft filters
- bounded pagination
- live product count
- product detail drawer
- variants, SKU/barcode and prices when present in the returned Medusa graph
- collection/handle/update context without exposing raw entity management as the primary experience

The product detail drawer remains read-only. Publishing, price mutation and inventory mutation are intentionally absent from this surface.

## Guarded New Piece quick draft

The first Studio commerce write is a deliberately minimal quick-draft route.

It can create only an unpublished Medusa product draft with:

- title
- optional description
- server-generated/validated trace request id metadata
- an existing store shipping profile resolved server-side

The client cannot send or override:

- publication status
- prices
- inventory quantities
- sales-channel visibility
- arbitrary Medusa product fields

The server forces `status: draft` and checks the returned product did not leave draft state.

This implements the Product Experience blueprint's safe shortcut without pretending the full eight-step New Piece wizard is complete.

## Live Orders and Order Story

Orders now have their own live workspace rather than reusing the five-order Today summary.

The workspace provides:

- bounded pagination
- server-side search
- deterministic smart views for attention, paid and shipped states
- human-language payment and fulfillment labels
- a clickable Order Story detail drawer

Order Story exposes:

- client identity available on the authorized order
- line items and quantities
- totals
- shipping address summary
- payment state
- fulfillment state
- actual order-created timestamp

The timeline does not invent event times that are not present in the source record. Current payment and fulfillment states are explicitly described as current states without synthetic timestamps.

## Security and data-integrity rules

- JWT remains server-side in the Studio HttpOnly cookie boundary.
- Dynamic merchant data is HTML-escaped before being rendered into the static Studio shell.
- IDs sent to detail endpoints are syntax validated before being interpolated into Medusa paths.
- Pagination and text-query inputs are bounded.
- Product write input is allow-listed instead of forwarded.
- No write route accepts `published` as client input.
- No price, inventory or fulfillment mutation is included in this phase.

## Next implementation phase

The next Studio phase should build on these live foundations rather than create new placeholders:

1. full New Piece guided wizard with autosaved draft progression
2. media upload/cover ordering through the existing COQUETTE storage path
3. explicit variant construction for size/color
4. guarded price assignment
5. guarded inventory assignment
6. merchandising placement
7. SEO/search presence
8. explicit review + publish/schedule gate
9. Client Book live customer profiles and purchase history
10. order preparation/fulfillment actions with audit-friendly confirmations
