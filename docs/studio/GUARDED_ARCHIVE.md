# COQUETTE Studio — Guarded Archive Policy

Status: Phase 4V implementation contract.

## Purpose

Archive is a COQUETTE catalogue policy layered over canonical Medusa commerce state. It is deliberately **not** represented by inventing a new Medusa product status and it is deliberately **not** deletion.

The owner-facing intent is simple: a piece can leave active work without losing the structured catalogue data required to bring it back later.

## Canonical state

Medusa remains canonical for products, variants, pricing, inventory, media relationships and product publication status.

COQUETTE records archive policy in product metadata:

- `coquette_studio_archived = "true" | "false"`
- `coquette_studio_archive_version = "1"`
- `coquette_studio_archive_previous_status = "draft" | "published"`

An archived product must always be a Medusa `draft`. An archived product found in `published` status is treated as a safety invariant violation and archive actions fail closed.

## Archive transition

Archive is allowed only for a COQUETTE Studio product that is not already archived.

The reviewed archive plan binds:

- product id;
- exact `updated_at` optimistic-concurrency value;
- current Medusa status;
- current archive marker;
- prior-status marker;
- exact attached sales-channel ids;
- intended final state;
- preservation promises.

Applying archive always writes Medusa status `draft` and archive marker `true`. If the product was published, the archive action therefore explicitly unpublishes it. Existing sales-channel relationships are retained but cannot make a draft customer-visible.

No product, variant, price, inventory record, media relation or placement relation is deleted by the archive workflow.

## Restore transition

Restore is allowed only for an archived Studio product satisfying the invariant `status = draft`.

Applying restore:

- keeps Medusa status `draft`;
- writes archive marker `false`;
- retains the recorded pre-archive status as audit context;
- retains all commerce relationships.

**Restore never republishes.** A product that was published before archive returns as an editable draft and requires a separate guarded lifecycle review before it can become published again.

## Concurrency and confirmation

Archive and restore use the same safety grammar as other high-impact Studio catalogue actions:

1. read canonical server state;
2. generate an exact review plan;
3. hash the reviewed plan with SHA-256;
4. require explicit owner confirmation;
5. acquire a per-product Medusa lock;
6. regenerate and verify the plan immediately before mutation;
7. apply the Medusa workflow;
8. reload canonical state and verify the invariant.

Stale timestamps and stale review hashes return HTTP 409 and require a fresh review.

## Mutation boundary while archived

Archived products remain visible in the Boutique catalogue and exact product drawer, but they are removed from the resumable New Piece draft list.

The Studio draft update proxy refuses edits to archived products. In addition, a Medusa route middleware rejects write requests for archived products across the guarded Studio catalogue mutation families:

- managed media;
- variants;
- variant identifiers;
- pricing;
- inventory;
- category/designer placement;
- publication lifecycle.

The dedicated `/admin/studio/archive/**` routes are intentionally outside that middleware so a product can always be restored through the reviewed archive policy.

## Explicit non-goals

Phase 4V does not:

- delete products;
- invent a Medusa archive status;
- detach sales channels as a hidden side effect;
- restore directly to `published`;
- schedule archive or publication;
- modify pricing, stock, variants, media or taxonomy;
- make imported legacy catalogue records Studio-owned without explicit provenance.

Permanent deletion, if ever introduced, must be a separate destructive workflow with its own retention, dependency and confirmation policy.
