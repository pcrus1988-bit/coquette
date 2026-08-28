# COQUETTE Documentation

This directory is the source of truth for the COQUETTE blueprint and operating documentation.

## Current execution gate

**Phase 4 real-data catch-up is the current blocking catalogue milestone.** Phase 5 implementation has advanced in parallel, but further catalogue-feature expansion and real-data acceptance must not outrun the missing authoritative legacy capture/import.

See `migration/REAL_DATA_CATCHUP_GATE.md` and GitHub issue #92 before selecting the next implementation milestone.

- `ROADMAP.md` — canonical Blueprint and phase acceptance gates
- `AUDIT.md` — verified architecture/runtime state and drift/recovery evidence
- `CURRENT_STATUS.md` — current implementation/release snapshot
- `migration/REAL_DATA_CATCHUP_GATE.md` — blocking authoritative crawl/import catch-up gate
- `architecture/` — workspace, boundaries, environments and technical architecture
- `integrations/` — payment, AADE/myDATA, courier, email and other external systems
- `operations/` — workspace provisioning, deployment and runbook material

Private migration exports, credentials and customer data must never be stored here.
