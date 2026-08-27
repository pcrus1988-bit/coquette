# COQUETTE Studio — production shell

This app is the authenticated production-facing shell for the COQUETTE merchant experience.

## Security boundary

- Login uses Medusa's admin-user email/password route: `POST /auth/user/emailpass`.
- The returned JWT is never exposed to browser JavaScript, localStorage or sessionStorage.
- Vercel serverless functions store it in an `HttpOnly`, `SameSite=Lax`, production `Secure` cookie.
- Every Studio data request goes through a narrow same-origin serverless gateway and is re-authorized against Medusa.
- `/admin/users/me` verifies that the authenticated identity is an actual Medusa admin user.
- Production Studio pages are explicitly `noindex`.
- The native Medusa Admin remains the technical fallback; Studio does not weaken or bypass Medusa permissions.

## Required Vercel environment

`MEDUSA_BACKEND_URL=https://<coquette-staging-medusa-host>`

The Studio Vercel project must use `apps/studio` as its root directory.

## Current live scope

- real Medusa admin authentication and server-side session boundary
- live admin identity
- assistant-first Today dashboard with live catalogue/order counts
- live Boutique product grid/list, search, status filters and pagination
- live Product Studio detail drawer with imagery, variants and pricing when returned by Medusa
- live Orders workspace with search, deterministic smart views and pagination
- live Order Story drawer with client, items, totals, fulfillment/payment state and shipping summary
- adaptive navigation, floating dock, command palette, focus mode and assistant drawer
- approved COQUETTE logo and luxury login

## Guarded New Piece creation

### Quick Draft

The top-level `New Piece` quick action creates one **unpublished Medusa product draft** through `/api/studio/product-drafts`.

The route is deliberately narrow:

- accepts only title, optional description and a trace request id
- resolves an existing shipping profile server-side
- forces `status: "draft"`
- does not accept price, stock, sales-channel visibility, publication state or arbitrary Medusa payload fields
- does not expose a generic admin proxy
- verifies the returned product did not leave draft state

### Guided New Piece

Boutique also exposes an eight-step guided creation workspace.

It can resume Studio-created drafts and autosave descriptive/editorial progress without browser persistence. The guarded update endpoint:

- verifies the product is still a draft before each write
- verifies it originated from the Studio draft flow
- uses optimistic concurrency through `expected_updated_at`
- allow-lists title, subtitle, description, handle and finite `coquette_studio_*` metadata fields
- rejects stale writes instead of silently overwriting another session
- verifies the product remains unpublished after every update

The wizard captures identity, visual story, story/details, choice blueprint, placement intent, search intent and a final review. Price, stock, variant creation, sales-channel visibility and publication remain explicitly locked for their own guarded workflows.

### Managed Visual Story media

Step 2 now supports governed product imagery through the existing COQUETTE file module and S3-compatible storage.

The browser does not upload images through the Studio serverless function and never receives a Medusa bearer token. Instead:

1. Studio asks for a short-lived product-scoped upload permission.
2. The authenticated Medusa backend verifies that the product is a Studio-created unpublished draft.
3. Medusa's configured file provider signs a five-minute upload target for an allow-listed image MIME type.
4. The browser uploads directly to managed storage using the signed headers.
5. Studio asks Medusa to attach the issued file key.
6. Medusa independently verifies that the object is publicly readable, has an allowed content type and does not exceed the configured size boundary before attaching it.

The Visual Story UI supports multiple upload, drag/drop, image ordering, explicit cover selection and safe detach. The ordering route may only rearrange or remove URLs already attached to the exact product; it cannot introduce arbitrary URLs.

Current limits:

- JPEG, PNG, WebP or AVIF
- maximum 12 MB per image
- maximum 20 Studio images per product in this workflow
- five-minute presigned upload lifetime

“Remove from piece” detaches the media relation from the product draft. It deliberately does not silently delete the underlying stored file; storage cleanup remains a separate explicit lifecycle operation.

See:

- `docs/studio/NEW_PIECE_WIZARD_FOUNDATION.md`
- `docs/studio/MANAGED_PRODUCT_MEDIA.md`
