# COQUETTE Phase 4S — One-Command Operator Capture Handoff

## Goal

Phase 4S turns the remaining accepted-network legacy-store acquisition into one operator command and one portable handoff file.

The operator does **not** manually crawl products, build migration JSON, map categories, or edit reconstruction records.

From the repository root:

```bash
pnpm capture:coquette
```

The command runs the existing browser-backed legacy capture, verifies the Phase 4P evidence package, runs capture ingestion, and emits one verified `.tar.gz` handoff.

## Why the command runs locally

`coquetteconcept.gr` may challenge cloud/CI traffic. A real browser on an accepted operator network is therefore the acquisition boundary. Phase 4S refuses CI/GitHub Actions execution deliberately.

This is an input-acquisition action, not a manual migration workflow. Once the handoff exists, downstream reconstruction and staging execution return to machine-gated tooling.

## Browser behavior

The capture reuses the existing COQUETTE browser transport and automatically searches for Chrome, Chromium, or Edge on Windows, macOS, and Linux.

Default mode is headed so a real browser window is available if the legacy storefront presents an interactive challenge.

Optional environment controls already supported by the capture layer include:

```text
COQUETTE_CHROME_PATH
COQUETTE_CAPTURE_BROWSER_MODE=headed|headless
COQUETTE_CAPTURE_CHALLENGE_TIMEOUT_MS
COQUETTE_CAPTURE_MAX_PAGES
```

No browser cookie, IP address, or browser profile is stored in the evidence package.

## One-command pipeline

`pnpm capture:coquette` performs, in order:

1. confirms it is not running in CI/GitHub Actions;
2. creates a unique capture ID;
3. launches the existing browser-backed `coquetteconcept.gr` operator capture;
4. requires the capture to complete successfully;
5. creates and verifies the Phase 4P `evidence-package.json`;
6. runs the existing Phase 4 capture ingestion process;
7. requires the ingestion report to bind to the same valid evidence-package checksum;
8. packages the immutable capture directory, ingestion report, and `handoff.json` into one deterministic-layout gzip-compressed ustar archive;
9. independently verifies the newly-created archive before reporting success.

Default output location:

```text
migration-data/capture-handoffs/
```

## Self-verifying filename

A successful file is named in this form:

```text
<capture-id>.handoff.<full-sha256>.tar.gz
```

The complete SHA-256 of the archive is part of the filename. No sidecar checksum file is required.

The receiving verifier recomputes the archive SHA-256 and requires it to match the filename.

## Embedded handoff manifest

The archive contains:

```text
handoff.json
 ingestion-report.json
capture/
  evidence-package.json
  manifest.json
  pages.jsonl
  products.jsonl
  media.jsonl
  url-inventory.jsonl
  robots.txt
  pages/...
  media/...
  ...other evidence files
```

`handoff.json` pins:

- capture ID;
- legacy source;
- Phase 4P evidence-package checksum;
- capture file/byte totals;
- ingestion report byte count and SHA-256;
- capture code revision when available;
- independent semantic handoff checksum.

## Receiving-side verification

Set the archive path and run:

```bash
COQUETTE_CAPTURE_HANDOFF_FILE=/path/to/file.tar.gz pnpm capture:coquette:verify
```

On PowerShell:

```powershell
$env:COQUETTE_CAPTURE_HANDOFF_FILE="C:\path\to\file.tar.gz"
pnpm capture:coquette:verify
```

The verifier does not merely trust the filename or embedded JSON. It independently checks:

- full archive SHA-256 against the filename;
- archive path safety and duplicate paths;
- `handoff.json` semantic checksum;
- ingestion report SHA-256 and byte count;
- complete capture file/byte totals;
- Phase 4P evidence-package semantic checksum;
- every evidence file SHA-256 and byte count;
- no unlisted capture files;
- evidence totals;
- browser/operator provenance;
- exact `https://coquetteconcept.gr` source boundary;
- complete browser capture manifest;
- matching capture IDs;
- ingestion report binding to the exact evidence-package checksum.

Any mismatch makes the handoff invalid.

## What Phase 4S does not do

Phase 4S does not invent or approve unresolved source facts. It also does not perform a production migration.

After a real handoff is received and verified, the next machine-gated sequence is:

1. Phase 4N migration-input reconciliation;
2. evidence review only where the real capture still leaves source ambiguity;
3. import/create required COQUETTE categories and Brands and copy media into COQUETTE-owned storage;
4. Phase 4Q dependency mapping reconciliation;
5. staging backup/restore rehearsal;
6. Phase 4R guarded real structural + price staging execution;
7. staging verification and UAT;
8. payment/courier/fiscal/SEO/rollback cutover gates.

The legacy storefront remains production until those gates pass.
