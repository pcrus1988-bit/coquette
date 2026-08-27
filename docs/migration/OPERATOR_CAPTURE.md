# Operator-network legacy capture

## Why this exists

GitHub-hosted HTTP, headless Chrome and headed Chrome runs are challenged by the legacy storefront's Cloudflare configuration. The Phase 4A capture tooling remains useful, but a successful preservation run should therefore be executed from a legitimate operator/browser network that the public shop accepts.

This runbook does **not** bypass Cloudflare. In headed mode the normal Chrome window is visible. If the legacy site presents a standard browser challenge, the authorized operator may complete it normally while the capture process waits. The same browser session and cookies are then reused by the crawler and media downloader for the remainder of that run.

## Safety boundary

- Capture only public `coquetteconcept.gr` storefront evidence.
- Keep `COQUETTE_CAPTURE_RESPECT_ROBOTS=true` unless a documented legal/owner decision explicitly changes the policy.
- Customer account, checkout, wishlist, sales, newsletter, REST, GraphQL and search-action paths are excluded by the crawler.
- Do not enter customer/admin/payment credentials into the capture browser.
- Browser cookies are used only in-memory for the active run and are not written to the capture JSONL/manifest files.
- Do not commit `migration-data/`, capture archives, cookies or private source artifacts to Git.

## Prerequisites

Use the current COQUETTE repository revision with Node 22.22+ and pnpm 10.11.1. Chrome/Chromium must be installed. Run from a workstation/network that can normally browse the legacy shop.

Install dependencies once:

```bash
pnpm install --frozen-lockfile
```

## Run the direct public capture

Choose an immutable capture ID. The recommended format contains an ISO-like date/time and operator/network label.

```bash
export COQUETTE_CAPTURE_BASE_URL="https://coquetteconcept.gr/"
export COQUETTE_CAPTURE_ID="operator-2026-08-26T2100-greece"
export COQUETTE_CAPTURE_DIR="$PWD/migration-data/storefront-captures/$COQUETTE_CAPTURE_ID"
export COQUETTE_CAPTURE_MAX_PAGES="5000"
export COQUETTE_CAPTURE_DELAY_MS="125"
export COQUETTE_CAPTURE_DOWNLOAD_MEDIA="true"
export COQUETTE_CAPTURE_MEDIA_CONCURRENCY="6"
export COQUETTE_CAPTURE_RESPECT_ROBOTS="true"
export COQUETTE_CAPTURE_BROWSER="true"
export COQUETTE_CAPTURE_BROWSER_MODE="headed"
export COQUETTE_CAPTURE_CHALLENGE_TIMEOUT_MS="120000"

pnpm --filter @coquette/backend storefront:capture
```

If Chrome displays a normal Cloudflare/browser verification page, complete it in the visible browser before the timeout. Do not use CAPTCHA-solving services, stealth plugins, proxy rotation, challenge-bypass scripts or copied third-party clearance cookies.

The capture process writes:

- `manifest.json`
- `robots.txt`
- `pages.jsonl`
- `products.jsonl`
- `media.jsonl`
- `url-inventory.jsonl`
- raw `pages/*.html`
- downloaded `media/*`

A run with zero captured HTML pages is intentionally marked incomplete and exits non-zero.

## Ingest and reconcile the archive

After a useful capture, run the Phase 4D ingestion report:

```bash
export COQUETTE_CAPTURE_DIR="$PWD/migration-data/storefront-captures/operator-2026-08-26T2100-greece"
export COQUETTE_CAPTURE_INGESTION_REPORT="$PWD/migration-data/storefront-captures/operator-2026-08-26T2100-greece/ingestion-report.json"

pnpm --filter @coquette/backend capture:ingest
```

The ingestion step:

1. validates manifest host/evidence mode/timestamps;
2. rejects foreign-host source records and unsafe archive paths;
3. re-reads archived HTML to rebuild page→media relationships, including captures created before Phase 4D;
4. converts public product evidence into provenance-aware recovery candidates;
5. merges direct page records with the indexed recovery baseline;
6. reports captured/skipped/error/indexed-only/unavailable URLs;
7. reports unresolved URLs and product fields rather than guessing them.

## Document genuinely unavailable URLs

An `error` or `indexed_only` URL remains unresolved until it is successfully recovered or explicitly classified as unavailable with a reason. Manual unavailable classifications are supplied as a JSON array outside Git when appropriate:

```json
[
  {
    "url": "https://coquetteconcept.gr/default/example-old-url.html",
    "note": "Historically indexed URL; repeated direct attempts returned a permanent not-found response on 2026-08-26."
  }
]
```

Then run:

```bash
export COQUETTE_UNAVAILABLE_URLS_FILE="/private/path/unavailable-urls.json"
pnpm --filter @coquette/backend capture:ingest
```

Manual classification cannot downgrade a successfully captured or intentionally skipped URL. It can close an otherwise unresolved `error` or `indexed_only` item only when the reason is documented.

## Preservation / private storage

After validation, archive the complete capture directory and retain an archive SHA-256 checksum. Store the archive in COQUETTE-controlled private storage such as the dedicated `coquette-imports` bucket. Do not place it in the public repository.

Recovered storefront media will later be copied to COQUETTE-controlled serving storage; migration must never rely on hotlinks to the legacy Magento host.

## Acceptance signal for the next stage

A useful direct archive is not automatically a completed migration. It should provide enough captured pages/products/media to materially reduce the indexed-only universe. Phase 4 proceeds only when every discovered in-scope public URL is either reconstructed or explicitly classified, product candidate conflicts are resolved, recovered media is COQUETTE-owned, EL/EN relationships and redirects reconcile, and the import is repeatable/idempotent with zero unexplained critical variance.
