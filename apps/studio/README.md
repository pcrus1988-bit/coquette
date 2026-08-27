# COQUETTE Studio — production shell

This app is the authenticated production-facing shell for the COQUETTE merchant experience.

## Security boundary

- Login uses Medusa's admin-user email/password route: `POST /auth/user/emailpass`.
- The returned JWT is never exposed to browser JavaScript or localStorage.
- Vercel serverless functions store it in an `HttpOnly`, `SameSite=Lax`, production `Secure` cookie.
- Every Studio data request goes through a narrow same-origin serverless gateway and is re-authorized against Medusa.
- `/admin/users/me` verifies that the authenticated identity is an actual Medusa admin user.
- Production Studio pages are explicitly `noindex`.
- The native Medusa Admin remains the technical fallback; this shell does not weaken or bypass Medusa permissions.

## Required Vercel environment

`MEDUSA_BACKEND_URL=https://<coquette-staging-medusa-host>`

The Studio Vercel project must use `apps/studio` as its root directory.

## Current live scope

- real Medusa admin authentication
- server-side session boundary
- live admin identity
- live product count
- live order count and five most recent orders
- assistant-first Today dashboard
- adaptive navigation, floating dock, command palette, focus mode, assistant drawer
- approved COQUETTE logo and luxury login

Product/order mutations are intentionally not enabled by this shell yet. They will be added as explicit, guarded workflows rather than a generic admin proxy.
