# Recovery baseline status

As of 26 August 2026, the indexed recovery baseline is a **secondary reconciliation layer** for Phase 4.

- Phase 4A preservation tooling is merged into `main`.
- GitHub-hosted HTTP, headless Chrome, and headed Chrome sessions are challenged by the public legacy storefront's Cloudflare configuration; those zero-page runs are explicitly recorded as incomplete.
- `docs/migration/indexed-recovery-baseline.json` preserves independent indexed catalogue signals with source/freshness provenance.
- `docs/migration/INDEXED_RECOVERY.md` defines field-level source precedence and conflict handling.
- `pnpm --filter @coquette/backend indexed-recovery:contract` validates the baseline in CI.
- Successful direct public capture from an accepted operator/browser network remains desirable.
- The authoritative Magento database, `pub/media`, and configuration package tracked in issue #39 remains the preferred migration source and the key input for full Phase 4 reconciliation.

This baseline must not be treated as proof of stock, complete catalogue coverage, or completion of the Phase 4 migration exit gate.
