# Recovery baseline status

As of 26 August 2026, the indexed recovery baseline is a **secondary reconciliation layer** for Phase 4.

- Phase 4A preservation tooling is merged into `main`.
- GitHub-hosted HTTP, headless Chrome, and headed Chrome sessions are challenged by the public legacy storefront's Cloudflare configuration; those zero-page runs are explicitly recorded as incomplete.
- Issue #39 records the current source decision: Magento Admin/database/filesystem/API access is no longer available, so the public storefront is the canonical recoverable legacy source.
- `docs/migration/indexed-recovery-baseline.json` preserves independent indexed catalogue signals with source/freshness provenance.
- `docs/migration/INDEXED_RECOVERY.md` defines field-level source precedence, unavailable-data rules and conflict handling.
- `pnpm --filter @coquette/backend indexed-recovery:contract` validates the baseline in CI.
- Successful direct public capture from an accepted operator/browser network remains the primary preservation goal.
- Indexed recovery evidence supports discovery and reconciliation when Cloudflare blocks infrastructure-hosted capture, but it must not be treated as proof of stock or complete coverage.
- Private Magento-only data that is no longer legitimately recoverable is explicitly classified as unavailable rather than guessed.

This baseline does not by itself complete the Phase 4 migration exit gate. Completion requires repeatable public-source reconstruction/import, COQUETTE-owned recovered media, Greek/English and redirect reconciliation, idempotent reruns, and zero unexplained critical variance across the discovered public URL universe.
