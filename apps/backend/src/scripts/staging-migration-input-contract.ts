import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"
import { readVerifiedStagingMigrationInputBundle } from "../migration/staging-migration-input"
import { buildReadyStagingMigrationInputFixture } from "./staging-migration-input-test-fixture"

const sourceUrl =
  "https://coquetteconcept.gr/default/ci-pinned-staging-input-contract.html"
const categorySourceUrl =
  "https://coquetteconcept.gr/default/ci-pinned-staging-category.html"
const mediaSourceUrl =
  "https://coquetteconcept.gr/media/catalog/product/ci-pinned-staging-input.jpg"

function observation(): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt: "2026-08-27T07:10:00.000Z",
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku: "COQ-PINNED-STAGING-1",
      name: "COQUETTE Pinned Staging Input Fixture",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      categorySourceIds: [categorySourceUrl],
      optionValues: { size: "S" },
      mediaSourceIds: [mediaSourceUrl],
      regularPrice: 120,
      currencyCode: "EUR",
    },
  }
}

async function expectRejected(
  env: NodeJS.ProcessEnv,
  messagePattern: RegExp
) {
  await assert.rejects(
    () => readVerifiedStagingMigrationInputBundle(env),
    messagePattern
  )
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "coquette-pinned-staging-input-"))
  const bundlePath = join(root, "bundle.json")
  try {
    const candidate = buildRecoveryProductCandidate("ci-pinned-staging-input", [
      observation(),
    ])
    const bundle = buildReadyStagingMigrationInputFixture({
      candidates: [candidate],
      captureId: "ci-pinned-staging-input",
    })
    await writeFile(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8")

    const validEnv: NodeJS.ProcessEnv = {
      COQUETTE_STAGING_MIGRATION_INPUT_BUNDLE: bundlePath,
      COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM: bundle.bundleChecksum,
    }
    const loaded = await readVerifiedStagingMigrationInputBundle(validEnv)
    assert.equal(loaded.bundleChecksum, bundle.bundleChecksum)
    assert.equal(loaded.isReadyForStagingExecution, true)

    await expectRejected(
      {
        ...validEnv,
        COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM: "wrong-checksum",
      },
      /bundle checksum mismatch/i
    )

    await expectRejected(
      {
        COQUETTE_STAGING_MIGRATION_INPUT_BUNDLE: bundlePath,
      },
      /are required for staging migration execution/i
    )

    await expectRejected(
      {
        COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM: bundle.bundleChecksum,
      },
      /are required for staging migration execution/i
    )

    await expectRejected(
      {
        ...validEnv,
        COQUETTE_STAGING_PRODUCT_IMPORT_REPORT: "/tmp/legacy-product-report.json",
      },
      /legacy raw migration report inputs are no longer supported/i
    )

    await expectRejected(
      {
        ...validEnv,
        COQUETTE_STAGING_PRICE_IMPORT_REPORT: "/tmp/legacy-price-report.json",
      },
      /legacy raw migration report inputs are no longer supported/i
    )

    const tampered = JSON.parse(JSON.stringify(bundle)) as typeof bundle
    assert.ok(tampered.productPlan.entries[0].normalizedProduct)
    tampered.productPlan.entries[0].normalizedProduct!.name =
      "Tampered after reconciliation"
    const tamperedPath = join(root, "tampered-bundle.json")
    await writeFile(
      tamperedPath,
      `${JSON.stringify(tampered, null, 2)}\n`,
      "utf8"
    )
    await expectRejected(
      {
        COQUETTE_STAGING_MIGRATION_INPUT_BUNDLE: tamperedPath,
        COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM: bundle.bundleChecksum,
      },
      /migration input reconciliation bundle is not ready/i
    )

    console.log(
      "COQUETTE Phase 4O pinned staging migration input contract passed with legacy-report rejection and tamper detection"
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
