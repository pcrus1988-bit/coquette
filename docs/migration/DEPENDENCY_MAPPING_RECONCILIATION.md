# COQUETTE Phase 4Q — Dependency Mapping Reconciliation

## Purpose

Phase 4Q turns the verified Phase 4N migration bundle into an explicit dependency-requirement set for categories, Brands and product media.

It does not create Medusa categories, Brands or media objects and it does not write products. Its job is to prove that every structural dependency referenced by the reviewed product plan has one exact, auditable target mapping before staging product execution is allowed to consume it.

## Source of truth

Dependency requirements are derived only from `bundle.productPlan.entries[*].normalizedProduct` in a verified Phase 4N bundle.

For every ready normalized product Phase 4Q reads:

- `categorySourceIds`
- `brandSourceId`
- `mediaSourceIds`

No dependency can be added by a mapping file if it is not required by the verified bundle. No required dependency can disappear simply because a mapping file omits it.

Shared dependencies are deduplicated while retaining the complete sorted set of candidate keys that reference them.

## Mapping format

The mapping input uses the existing `MigrationDependencyMapping` shape.

### Category

```json
{
  "entityType": "category",
  "sourceId": "https://coquetteconcept.gr/default/dresses.html",
  "status": "imported",
  "targetId": "pcat_..."
}
```

Category mappings must use a Medusa target ID. `targetUrl` is not accepted.

### Brand

```json
{
  "entityType": "brand",
  "sourceId": "legacy-designer:example",
  "status": "imported",
  "targetId": "brand_..."
}
```

Brand mappings must use a Brand target ID. `targetUrl` is not accepted.

### Media

```json
{
  "entityType": "media",
  "sourceId": "https://coquetteconcept.gr/media/catalog/product/example.jpg",
  "status": "imported",
  "targetUrl": "https://<coquette-owned-media-host>/catalog/example.jpg"
}
```

Media mappings must use HTTPS URLs on one of the explicitly allowed COQUETTE serving-media hosts. A Medusa target ID is not accepted for media mapping.

`coquetteconcept.gr` is never accepted as a serving-media host. Legacy image hotlinking is therefore impossible through a reconciled Phase 4Q plan.

## States

Each required dependency becomes exactly one of:

- `resolved`
- `missing`
- `unavailable`
- `error`
- `invalid`

`unavailable` and `error` are explicit accounting states, not successful mappings. They keep the plan unreconciled.

## Fail-closed rules

The plan is not reconciled when any of the following is true:

- Phase 4N bundle verification fails;
- the Phase 4P capture evidence-package checksum is absent;
- no allowed media host is supplied;
- `coquetteconcept.gr` is listed as an allowed media host;
- duplicate mapping keys exist;
- a mapping refers to a legacy dependency not required by the bundle;
- any required dependency is missing, unavailable, error or invalid;
- a category/Brand mapping does not provide a target ID;
- a category/Brand mapping provides a target URL;
- a media mapping provides a target ID;
- a media target is not HTTPS or is outside the allowed COQUETTE media hosts.

## Checksums

The plan records:

- `migrationInputBundleChecksum`
- `captureEvidencePackageChecksum`
- `requirementsChecksum`
- per-requirement checksum
- per-mapping checksum
- deterministic `planChecksum`

Because the plan is bound to the complete Phase 4N bundle checksum, even a price-only reconstruction change requires generation of a new dependency plan. If the structural dependency set is unchanged, `requirementsChecksum` remains stable, while the new plan is still explicitly bound to the new migration input bundle.

## CLI

Generate or re-evaluate a mapping plan with:

```bash
COQUETTE_MIGRATION_RECONCILIATION_BUNDLE=/path/reconciliation-bundle.json \
COQUETTE_MIGRATION_RECONCILIATION_CHECKSUM=<exact-bundle-checksum> \
COQUETTE_DEPENDENCY_MAPPINGS_FILE=/path/dependency-mappings.json \
COQUETTE_MIGRATION_ALLOWED_MEDIA_HOSTS=<coquette-media-host-1>,<coquette-media-host-2> \
COQUETTE_DEPENDENCY_MAPPING_PLAN=/path/dependency-plan.json \
pnpm --filter @coquette/backend dependency-mapping:reconcile
```

`COQUETTE_DEPENDENCY_MAPPINGS_FILE` may be omitted to generate the complete missing-dependency worklist.

The command always writes the plan for auditability. It exits with status `3` until every required dependency is reconciled.

## Execution boundary

Phase 4Q itself is non-writing and always reports `isExecutable: false`.

The historical Phase 4G product executor can already validate category/Brand/media dependencies, but before any real staging migration the executor handoff must consume only a verified Phase 4Q plan rather than an arbitrary raw mappings array. That integration is the next technical hardening step.

## Production boundary

No dependency mapping produced by Phase 4Q authorizes production migration or cutover. The legacy shop remains production until the blueprint UAT, payment/courier/fiscal, SEO, rollback and backup/restore gates pass.
