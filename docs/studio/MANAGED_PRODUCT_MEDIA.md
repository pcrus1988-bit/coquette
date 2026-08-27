# COQUETTE Studio — Managed Product Media

**Status:** implementation phase 3  
**Date:** 2026-08-27

## Objective

Give the COQUETTE team a refined visual-story workflow for product imagery while preserving the same fail-closed principles used for Guided New Piece.

The product draft may gain, reorder and detach imagery, but this media layer must not become a generic file proxy, a remote-image importer or an accidental publication path.

## User experience

Guided New Piece step 2 now provides:

- click-to-choose image upload
- drag-and-drop image upload
- multiple image selection
- upload progress/status messaging
- visual image grid
- drag-to-reorder
- explicit left/right ordering controls
- explicit cover selection
- safe detach from the draft
- live unpublished product preview using the current cover

The UI contains no field for arbitrary external image URLs.

## Storage flow

### 1. Presign

Studio calls its same-origin gateway:

`POST /api/studio/media-presign`

The gateway forwards only to the dedicated authenticated Medusa route:

`POST /admin/studio/media/presign`

Before issuing a target, Medusa verifies:

- the product id is valid
- the product exists
- `status === "draft"`
- `metadata.coquette_studio_origin === "quick_draft"`
- the current Studio image count is below the configured limit
- the requested MIME type is allow-listed
- the declared size is positive and within the configured limit

The resulting object key is scoped below:

`studio/products/<product-id>/...`

The permission expires after five minutes.

### 2. Direct browser upload

The browser uploads the image directly to the configured Medusa file provider target.

The Studio session JWT is not sent to storage and is never exposed to browser JavaScript. The request uses only the short-lived signed URL and the exact headers signed by the provider.

### 3. Verify and attach

After storage accepts the upload, Studio calls:

`POST /api/studio/media-attach`

Medusa re-loads the product and repeats the draft/provenance guard. It also applies optimistic concurrency using `expected_updated_at`.

The route rejects file keys outside the exact product-scoped Studio prefix.

Before the image becomes product media, the backend verifies the managed public object with a `HEAD` request and confirms:

- the object exists and is publicly readable
- its returned content type is allow-listed
- its returned content length, when supplied by storage, is within the configured boundary
- the product image limit is still respected

Only after those checks does `updateProductsWorkflow` attach the image and optionally set it as the thumbnail.

The product is loaded again after the write to verify that it is still a Studio draft and that the new media relation exists.

## Reordering and cover selection

Studio calls:

`POST /api/studio/media-order`

The backend again verifies the draft and optimistic-concurrency boundary.

The submitted order is compared against the product's currently attached media. Every submitted URL must already be attached to the exact product. Duplicate URLs are rejected and the cover must remain part of the submitted set.

This means the media-order endpoint can:

- change order
- change cover
- detach an existing image

It cannot inject a new external or managed URL.

## Detach versus storage deletion

The Visual Story action is deliberately named **Remove from piece**.

It updates the product's media relations but does not automatically destroy the stored file object. Silent file deletion would make undo/recovery and later asset lifecycle management unnecessarily risky.

A separate managed-media cleanup lifecycle can later delete verified unreferenced Studio objects after retention/recovery rules are defined.

## Limits

- MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`
- maximum file size: 12 MB
- maximum Studio product images: 20
- presigned upload lifetime: 300 seconds

## Explicitly excluded

This phase does not provide:

- arbitrary remote URL import
- legacy Magento image hotlinking
- generic S3 proxying
- public product publication
- sales-channel changes
- price changes
- variant creation
- inventory mutation
- automatic deletion of detached source files

## Next product-experience phase

After managed media is stable, the next guarded layer is **variant generation from the saved choice blueprint**. It will convert the human size/colour plan into a validated Medusa option and variant graph while keeping price, inventory and publication as separate explicit workflows.
