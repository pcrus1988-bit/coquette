# COQUETTE Studio — Custom Merchant Frontend Architecture

**Status:** Owner-approved direction / foundation design  
**Date:** 2026-08-26  
**Branch:** `feature/coquette-studio-foundation`

## Decision

COQUETTE will have a fully custom merchant frontend, **COQUETTE Studio**, built as an independent web application on top of the Medusa commerce backend.

The merchant-facing users should not need to interact with native Medusa Admin during normal operation. Native Medusa Admin remains available only as a restricted technical fallback and diagnostic surface for super-admin/engineering use.

This decision supersedes the earlier assumption that the primary merchant experience would be delivered mainly through Medusa Admin extensions.

## Product principle

COQUETTE Studio is not a technical management center. It is a private digital atelier for a premium designer-fashion startup: calm, elegant, feminine, editorial, decisive and highly intuitive.

The core product metaphor is:

> **Personal assistant + luxury studio + commerce control surface.**

The interface should answer what happened, what matters and what to do next before it exposes raw tables or configuration.

## Runtime boundaries

```text
Customer
  -> COQUETTE Storefront (Vercel)
  -> Medusa Store API (Railway)

Merchant
  -> COQUETTE Studio (separate Vercel project)
  -> Medusa Admin API + COQUETTE custom admin endpoints (Railway)
  -> COQUETTE modules/services

Technical super-admin only
  -> Native Medusa Admin
```

## Repository and deployment model

The Studio lives in the existing COQUETTE monorepo, but it is deployed as a separate Vercel project with its own root directory and environment variables.

Target structure:

```text
apps/
  backend/          # Medusa backend + native Medusa Admin
  storefront/       # public customer storefront
  studio/           # production COQUETTE Studio application
  studio-prototype/ # temporary design prototype while foundation is approved
```

The first design pass is isolated on `feature/coquette-studio-foundation`. The public storefront remains untouched.

## Environment isolation

### Studio Preview

- Vercel preview deployment
- staging Medusa base URL
- staging data only
- no production payment, AADE or courier actions
- safe demo/preview data may be used for visual design

### Studio Production

- dedicated Studio Vercel project/domain
- production Medusa base URL
- authenticated merchant users only
- production integrations only after their respective launch gates pass

Recommended eventual hostname: `studio.coquetteconcept.gr` or `admin.coquetteconcept.gr`. The final hostname is an owner decision and is not required for the design foundation.

## Experience principles

1. **Assistant-first** — surface changes, priorities and next actions before raw data.
2. **Progressive disclosure** — show only what is needed now; advanced controls remain available without overwhelming the user.
3. **Guided workflows** — creating products, campaigns, returns, content and other entities should use interactive step-by-step flows instead of long technical forms.
4. **Editorial luxury** — typography, spacing, imagery and motion must reflect a high-value designer-fashion brand.
5. **Human language** — labels should describe business intent, not backend terminology.
6. **Image-first merchandising** — product and collection work should feel closer to curating a boutique than maintaining database rows.
7. **Calm operations** — operational problems are visible and actionable without turning the whole interface into an alarm panel.
8. **Keyboard and touch friendly** — fast on desktop and comfortable on tablet/mobile for lightweight tasks.
9. **Accessible premium** — elegance must not reduce contrast, focus visibility, keyboard navigation or readable sizing.
10. **Extension-ready** — new modules can register navigation, widgets, actions, permissions and guided flows without redesigning the shell.

## Extension contract

Every future Studio extension should be able to register one or more of the following:

- navigation group/item
- route/page
- dashboard widget
- assistant/event card
- global command-palette action
- guided-flow definition
- settings panel
- permission scope
- notification/event subscription

The shell owns common layout, navigation, permissions, notifications, command palette, dialog behavior, design tokens and route-level error/loading states.

## Authentication direction

The production Studio must authenticate against the Medusa admin/user boundary or a COQUETTE-owned backend session facade; credentials are never handled directly by the browser against PostgreSQL/Supabase.

Initial design prototypes must not expose production data and may use non-authenticated static demo content. Real authentication is a separate implementation gate before any production-like merchant data is exposed.

## Native Medusa Admin policy

Native Medusa Admin remains:

- restricted to technical/super-admin use
- intentionally absent from the normal merchant workflow
- useful for diagnostics and emergency fallback
- not linked from the merchant-facing Studio navigation

## Design asset policy

The COQUETTE wordmark is the primary sign-in identity. The login quotation attribution may use a **handwritten-style typographic treatment reading `Coco Chanel`**, but should not attempt to reproduce or imply an authenticated facsimile of Coco Chanel's actual signature.

## Foundation exit gate

This Studio foundation is ready to move from concept to production implementation when:

- information architecture is approved
- login and `Today` dashboard experience is approved
- design tokens and visual direction are approved
- extension registration model is accepted
- staging authentication approach is selected
- Studio Vercel project is created and connected to the staging backend
- frozen-lockfile CI covers the production `apps/studio` package before merge to `main`
