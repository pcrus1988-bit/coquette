# COQUETTE Phase 4 Real-Data Catch-Up Gate

**Status:** BLOCKING CATALOGUE ACCEPTANCE  
**Verified:** 2026-08-28  
**Tracking:** GitHub issue #92  
**Applies before:** further Phase 5 catalogue feature expansion and real-data UAT

## Why this gate exists

Phase 4's technical reconstruction machinery advanced substantially while Phase 5 Studio implementation continued in parallel. That parallel work is valid engineering work, but it must not be interpreted as completion of the Phase 4 migration exit gate.

As of 2026-08-28, no authoritative real legacy catalogue has been written into COQUETTE staging.

This document converts that condition into an explicit execution gate.

## Verified staging state

Direct inspection of the dedicated COQUETTE PostgreSQL database on 2026-08-28 found:

| Entity | Rows |
| --- | ---: |
| products | 0 |
| product variants | 0 |
| brands / designers | 0 |
| product categories | 0 |
| prices | 0 |

Dedicated Supabase Storage inspection found:

- private `coquette-imports`: **0 objects**;
- public `coquette-media`: **1 object**, not a reconstructed legacy catalogue.

These are execution facts, not inferred status from documentation.

## Acquisition attempts and blocker proof

### GitHub-hosted capture

The existing Phase 4A preservation workflow attempted public capture using HTTP, headless Chrome and headed Chrome/Xvfb. The public legacy storefront's Cloudflare configuration challenged those environments. The zero-page results are explicitly classified as incomplete and cannot satisfy the Phase 4 exit gate.

### Independent COQUETTE Supabase Edge probe — 2026-08-28

A separate authenticated COQUETTE Edge-network probe was executed to test whether a different project-owned network could reach the public source without repeating the GitHub-runner limitation.

Observed target response:

- target: `https://coquetteconcept.gr/`;
- HTTP status: **403**;
- HTML title: **`Just a moment...`**;
- Cloudflare challenge detected: **true**.

Therefore plain server-side capture from both tested execution networks is currently blocked by the same public anti-bot boundary.

The probe did not attempt to bypass CAPTCHA, Cloudflare challenge logic, authentication or any private Magento surface.

## Indexed evidence is not the missing crawl

Public search/index retrieval remains useful as a secondary reconciliation source. It exposes catalogue signals, designers/categories and some recent product detail evidence.

It is **not** accepted as a substitute for the authoritative capture because it cannot prove complete catalogue coverage, raw page checksums, full media galleries, complete configurable relationships or current per-page state.

Do not import derived/indexed observations merely to create non-zero Medusa rows.

## Accepted acquisition path

The next accepted source is an **operator-browser capture from a normal browser/network that can legitimately reach the public storefront**.

Use the already-shipped operator capture/handoff chain. Raw capture output and media remain outside public Git.

From a locked repository checkout, the relevant commands are available through the backend package:

```bash
pnpm --filter @coquette/backend storefront:capture:operator
pnpm --filter @coquette/backend storefront:capture:handoff
pnpm --filter @coquette/backend capture-handoff:verify
```

Receiver-side processing then continues with the existing verified intake/reconciliation/dependency/import tools.

## Required catch-up sequence

1. Acquire the authoritative operator-browser capture.
2. Verify the capture and produce the checksum-bound handoff.
3. Run verified handoff intake.
4. Resolve only evidence-backed capture/reconstruction blockers.
5. Provision exact required categories and Brands/Designers.
6. Copy accepted captured media into COQUETTE-controlled storage while retaining source/checksum mappings.
7. Build and reconcile the real dependency mapping plan.
8. Complete backup/restore rehearsal before the first real legacy staging write.
9. Run guarded structural product import.
10. Run guarded price import.
11. Reconcile products, variants, categories, designers, media, prices and legacy URLs.
12. Rerun the migration and verify idempotency/no duplicate SKU creation.
13. Resume Phase 5 catalogue expansion and merchant UAT against the real reconstructed catalogue.

## Execution hold

Until steps 1–12 reach an accepted real-data staging state:

### Allowed

- work required to acquire, verify, reconcile or import the real legacy data;
- migration/import bug fixes;
- security and release-alignment fixes;
- backup/restore work required by the real-data gate;
- fixes necessary to make already-built Studio workflows operate correctly with the imported catalogue.

### Held

- new Phase 5 catalogue feature expansion that is not required for the real-data migration;
- declaring Phase 4 complete;
- real-data Phase 6/7 acceptance based only on synthetic fixtures;
- manually recreating legacy products merely to bypass the migration pipeline.

## Acceptance criteria

This gate can be closed only when all applicable conditions are evidenced:

- accepted authoritative capture with complete queue or every residual explicitly classified;
- raw HTML/evidence and captured media preserved in controlled private migration storage;
- real staging product/variant/category/designer/price counts are non-zero and reconciled;
- accepted media is owned by COQUETTE rather than hotlinked from Magento;
- no invented SKU, price, exact hidden inventory quantity, tax/fiscal fact or configurable relationship;
- dependency mappings are evidence-backed;
- backup/restore rehearsal completed before real staging write;
- structural and price imports complete through guarded Medusa workflows;
- import rerun is idempotent;
- unexplained critical variance is zero;
- Phase 5 merchant UAT proceeds using the reconstructed real catalogue.

Production cutover remains governed by the full Blueprint and is not authorized merely by closing this catch-up gate.
