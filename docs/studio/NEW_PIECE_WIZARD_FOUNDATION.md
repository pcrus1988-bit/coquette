# COQUETTE Studio — Guided New Piece foundation

**Status:** implementation phase 2  
**Date:** 2026-08-27

## Objective

Turn the approved Product Experience blueprint into a resumable, autosaving product-creation workspace without opening unsafe commerce mutations too early.

The guided flow is deliberately different from the existing `New Piece` quick shortcut:

- **Quick Draft** remains the fastest way to create only an unpublished product shell.
- **Guided New Piece** is an eight-step editorial workspace that progressively enriches that same safe Medusa draft.

Both flows remain unpublished until a future explicit activation gate.

## Implemented guided steps

1. **Identity**
   - product title
   - optional subtitle
   - optional storefront handle

2. **Visual story**
   - private visual-direction brief
   - explains the managed-media boundary
   - no legacy-image hotlinking or arbitrary external URL ingestion

3. **Story & details**
   - customer-facing description
   - composition
   - fit
   - care
   - country/origin note

4. **Choices**
   - one-size / sizes / colours / size+colour blueprint
   - size values
   - colour values
   - saves only a variant *plan*; does not create variants or inventory yet

5. **Price & availability**
   - explicit safety boundary
   - no price or inventory write is enabled in this phase

6. **Boutique placement**
   - New In intent
   - Featured intent
   - collection/placement note
   - intent is stored on the unpublished draft and does not change sales-channel visibility

7. **Search presence**
   - handle
   - SEO title intent
   - SEO description intent
   - no indexing/publication side effects

8. **Review**
   - editorial review of the accumulated draft
   - explicit unpublished status
   - publish control remains disabled until the guarded activation workflow exists

## Autosave and resume

The wizard persists meaningful changes to the Medusa product draft through a narrow Studio endpoint.

It also lists recent Studio-created drafts, so the team can close the browser and continue later without relying on browser storage.

No product state is stored in `localStorage` or `sessionStorage`.

## Guarded draft update endpoint

`POST /api/studio/product-draft-update`

The endpoint:

- accepts a validated product ID
- retrieves the current Medusa record before every write
- requires `status === "draft"`
- requires the product to have been created through the Studio guarded draft flow
- supports optimistic concurrency through `expected_updated_at`
- rejects stale edits with HTTP 409 instead of silently overwriting another session
- allow-lists descriptive product fields only
- allow-lists a finite set of `coquette_studio_*` metadata keys
- merges metadata instead of replacing unrelated product metadata
- verifies the returned product is still a draft after the write

### Explicitly not accepted

The update endpoint has no input path for:

- `status: published`
- prices
- inventory quantities
- inventory items
- sales channels
- fulfillment
- payment state
- publication timing
- arbitrary Medusa payload forwarding

## Why choice, placement and SEO data initially live as Studio metadata

These steps capture human editorial intent before the corresponding commerce/storefront workflows are activated.

This avoids pretending that a size list is already a valid Medusa variant graph, that a merchandising checkbox already means storefront visibility, or that an SEO title has already been published.

The next guarded phases will convert this saved intent into real commerce structures with separate validation and review gates.

## Next guarded phases

1. managed media upload + cover ordering
2. variant generation from the saved choice blueprint
3. per-variant price assignment
4. inventory assignment and backorder policy
5. collection/category/designer relation application
6. storefront merchandising placement
7. managed SEO application
8. final completeness review
9. explicit publish / schedule workflow

At every step, publication remains a separate consequence-bearing action rather than an autosave side effect.
