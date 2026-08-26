# COQUETTE Studio — Foundation Prototype

This folder is a **static design prototype** for the first approved Studio workstream:

1. full merchant information architecture
2. luxury login + assistant-first `Today` dashboard

It intentionally contains **no live Medusa authentication and no production merchant data**. The login form only demonstrates the entry interaction and routes to the static dashboard preview.

## Why static first

The repository uses a frozen pnpm lockfile. The production `apps/studio` Next.js package should be introduced only after the experience foundation is approved so its package/lockfile/CI changes are deliberate and reproducible.

This prototype can be deployed as a separate Vercel project with root directory:

```text
apps/studio-prototype
```

The included `vercel.json` marks all routes `noindex`.

## Routes

- `/` — login prototype
- `/today` — personal-assistant dashboard prototype

## Production follow-up

After visual/interaction approval:

- create `apps/studio` as the production Next.js application
- add/update the pnpm lockfile using the frozen dependency baseline
- add Studio lint/build checks to CI
- wire staging authentication to Medusa/custom admin endpoints
- replace all demo dashboard data with normalized Studio events and attention items
- deploy as a dedicated Vercel project

Native Medusa Admin remains a technical fallback and is not part of this merchant-facing prototype.
