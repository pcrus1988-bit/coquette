# COQUETTE Phase 4P — Operator Direct Capture

## Purpose

Phase 4P turns the legacy public-storefront capture into an operational, auditable handoff that can be run from a legitimate local/operator browser network when cloud runners are challenged by Cloudflare.

It does not bypass Cloudflare, authentication, robots rules, or any private Magento surface. It captures only the public storefront already available to the operator's ordinary browser.

No production or staging commerce writes are performed by this phase.

## Why a local operator capture is required

GitHub-hosted/browser-cloud capture attempts have been correctly classified as Cloudflare-challenged. Those attempts must not be promoted into migration evidence simply because a script ran.

Phase 4P therefore distinguishes:

- generic reconstruction capture tooling, which may run anywhere and may remain incomplete;
- an accepted **operator local browser** capture, which is the only direct-capture provenance allowed to become Phase 4N staging-ready evidence.

The operator command refuses CI and GitHub Actions.

## Operator command

From the COQUETTE repository on a local workstation with Chrome, Chromium, or Microsoft Edge installed:

```bash
pnpm install --frozen-lockfile
pnpm --filter @coquette/backend storefront:capture:operator
```

Defaults:

- source locked to `https://coquetteconcept.gr/`;
- browser mode `headed`;
- browser transport always enabled;
- robots rules respected;
- media download enabled;
- maximum 5,000 pages;
- 175 ms crawl delay;
- four concurrent media downloads;
- up to 120 seconds for an interactive Cloudflare challenge to clear.

The headed browser remains visible. If the public site presents an ordinary browser challenge, the operator may complete that challenge in the opened browser window. The same browser session and its temporary cookies are then reused for the rest of the capture.

The temporary browser profile is deleted when capture closes.

## Supported local browsers

Automatic discovery covers common locations for:

- Linux Chrome/Chromium/Edge;
- macOS Chrome/Chromium/Edge;
- Windows Chrome/Edge.

An explicit executable may always be supplied:

```bash
COQUETTE_CHROME_PATH="/path/to/chrome" \
pnpm --filter @coquette/backend storefront:capture:operator
```

## Optional operator settings

```bash
COQUETTE_CAPTURE_BROWSER_MODE=headed
COQUETTE_CAPTURE_ID=coquetteconcept-operator-2026-08-27
COQUETTE_CAPTURE_DIR=/absolute/path/to/capture
COQUETTE_CAPTURE_OPERATOR_LABEL=workstation-a
COQUETTE_CAPTURE_MAX_PAGES=5000
COQUETTE_CAPTURE_DELAY_MS=175
COQUETTE_CAPTURE_MEDIA_CONCURRENCY=4
COQUETTE_CAPTURE_DOWNLOAD_MEDIA=true
COQUETTE_CAPTURE_RESPECT_ROBOTS=true
```

`COQUETTE_CAPTURE_BROWSER_MODE=headless` is allowed on an accepted local network, but `headed` is recommended because it allows the operator to see and complete an ordinary public browser challenge if one appears.

## Evidence package

After crawling finishes, the operator command writes `evidence-package.json` inside the capture directory.

The package contains:

- capture ID and source;
- `operator_local_browser` provenance;
- browser transport/mode;
- source-code revision when available;
- an optional operator label;
- a sorted inventory of every capture file except the package file itself;
- byte count and SHA-256 checksum for every file;
- deterministic total counts/bytes;
- one semantic package checksum.

The package deliberately does **not** serialize browser cookies or IP-address information.

`packagedAt` is retained for audit history but excluded from package identity. Repackaging identical evidence with identical provenance therefore produces the same package checksum.

## Files covered

At minimum, a valid package must cover:

- `manifest.json`;
- `robots.txt`;
- `pages.jsonl`;
- `products.jsonl`;
- `media.jsonl`;
- `url-inventory.jsonl`;
- every preserved page under `pages/`;
- every preserved media object under `media/`.

Symbolic links and unsafe archive paths are refused.

Any file added, removed, resized, or changed after packaging invalidates verification until the package is deliberately regenerated.

## Verify an archive later

```bash
COQUETTE_CAPTURE_DIR=/absolute/path/to/capture \
pnpm --filter @coquette/backend capture-evidence:verify
```

Verification fails closed when:

- `evidence-package.json` is missing or malformed;
- the package is not schema version 1;
- source/capture ID disagree with `manifest.json`;
- provenance is not `operator_local_browser` + browser transport;
- the capture is incomplete or retains a failure reason;
- a required root artifact is not listed;
- a listed file is missing;
- an unlisted file exists;
- file bytes/checksum no longer match;
- package totals are inconsistent;
- the semantic package checksum no longer matches.

## Ingestion

After a valid operator capture:

```bash
COQUETTE_CAPTURE_DIR=/absolute/path/to/capture \
COQUETTE_CAPTURE_INGESTION_REPORT=/absolute/path/to/capture-ingestion-report.json \
pnpm --filter @coquette/backend capture:ingest
```

Ingestion re-verifies the evidence package from disk and merges all package failures into `capture.validation`.

The ingestion report records:

- evidence-package validity;
- package checksum;
- provenance mode;
- browser transport/mode;
- code revision when available;
- packaged file/byte totals.

The historical `COQUETTE_RUNTIME_IMPORT_MANIFEST` output is retired. Capture ingestion cannot produce an execution manifest directly.

## Reconciliation boundary

Phase 4N now requires all of these before staging readiness:

1. normal capture validation passes;
2. direct capture is declared complete;
3. no capture failure reason remains;
4. evidence package verification passed;
5. package checksum is present;
6. provenance is `operator_local_browser`;
7. transport is `browser`;
8. browser mode is `headed` or `headless`;
9. all existing Phase 4N review/product/price/inventory/URL-universe gates pass.

The accepted evidence-package checksum is copied into the frozen Phase 4N bundle and therefore becomes part of the checksum-pinned Phase 4O staging handoff.

## Cloudflare safety rule

A challenge is never interpreted as storefront HTML.

If challenge content remains after the configured wait window, the page is recorded as an error. If no public HTML pages are captured, the capture is explicitly marked incomplete with `zero_public_html_pages_captured`.

A cloud-runner failure must stay a failure. Phase 4P does not contain challenge-bypass logic.

## Production boundary

The legacy shop remains production. A successful operator capture only supplies reconstruction evidence. It does not authorize a staging write or cutover.

Real staging migration still requires Phase 4N reconciliation, the Phase 4O pinned bundle, COQUETTE-owned dependency/media mappings, staging database/write guards, backup/restore rehearsal, UAT, payment/courier/fiscal testing, SEO/redirect verification, and the remaining blueprint cutover gates.
