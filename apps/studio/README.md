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

## First guarded write path

The `New Piece` quick action can now create one **unpublished Medusa product draft** through `/api/studio/product-drafts`.

The route is deliberately narrow:

- accepts only title, optional description and a trace request id
- resolves an existing shipping profile server-side
- forces `status: "draft"`
- does not accept price, stock, sales-channel visibility, publication state or arbitrary Medusa payload fields
- does not expose a generic admin proxy
- verifies the returned product did not leave draft state

This is the safe shortcut defined in the Product Experience blueprint. Full variants, media, pricing, inventory, merchandising and publish/schedule actions remain separate guarded phases.
