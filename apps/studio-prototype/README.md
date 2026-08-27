# COQUETTE Studio — Interactive Experience Prototype

This folder is the **static interactive experience prototype** for the owner-approved COQUETTE Studio merchant frontend.

Current prototype scope:

1. full merchant information architecture
2. luxury login
3. assistant-first `Today` dashboard
4. global command palette / quick-create path
5. image-first Boutique product workspace
6. guided, autosaved `New Piece` onboarding flow

It intentionally contains **no live Medusa authentication and no production merchant data**. Actions demonstrate interaction and information architecture only.

## Why static first

The repository uses a frozen pnpm lockfile. The production `apps/studio` Next.js package should be introduced only after the experience foundation is approved so its package/lockfile/CI changes are deliberate and reproducible.

This prototype can be deployed as a separate Vercel project with root directory:

```text
apps/studio-prototype
```

The included `vercel.json` marks all routes `noindex`.

## Routes

- `/` — luxury login
- `/today` — personal-assistant dashboard
- `/products` — image-first Boutique product workspace
- `/products/new` — guided New Piece onboarding

The command palette is available from authenticated prototype screens via the visible search control or `⌘/Ctrl + K`.

## Product prototype behavior

`/products/new` demonstrates:

- progressive-disclosure steps
- local autosave/resume behavior
- live product-card preview
- optional media selection preview state
- plain-language choice/variant creation
- price and stock step
- boutique placement
- SEO/search preview
- final boutique-style review

The final `Publish piece` action is deliberately non-destructive and does **not** call Medusa.

## Production follow-up

After visual/interaction approval:

- create `apps/studio` as the production Next.js application
- add/update the pnpm lockfile using the frozen dependency baseline
- add Studio lint/build checks to CI
- wire staging authentication to Medusa/custom admin endpoints
- replace demo dashboard data with normalized Studio events and attention items
- map New Piece steps to Medusa product/variant/pricing/inventory workflows
- deploy as a dedicated Vercel project

Native Medusa Admin remains a restricted technical fallback and is not part of the merchant-facing experience.
