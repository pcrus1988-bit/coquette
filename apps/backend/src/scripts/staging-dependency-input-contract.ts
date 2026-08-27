import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildDependencyMappingReconciliationPlan,
  type DependencyMappingReconciliationPlan,
} from "../migration/dependency-mapping-reconciliation"
import {
  readVerifiedStagingDependencyPlan,
  stagingDependencyPlanEnvironment,
} from "../migration/staging-dependency-input"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"
import type { MigrationDependencyMapping } from "../migration/staging-product-execution"
import { buildReadyStagingMigrationInputFixture } from "./staging-migration-input-test-fixture"

const sourceUrl = "https://coquetteconcept.gr/default/phase-4r-contract.html"
const categoryUrl = "https://coquetteconcept.gr/default/dresses.html"
const mediaUrl =
  "https://coquetteconcept.gr/media/catalog/product/phase-4r-contract.jpg"
const brandSourceId = "legacy-designer:phase-4r-contract"
const servingHost = "coquette-media.example"

function observation(): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt: "2026-08-27T09:00:00.000Z",
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku: "PHASE-4R-1",
      name: "Phase 4R Contract",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      brandSourceId,
      categorySourceIds: [categoryUrl],
      optionValues: { size: "S" },
      mediaSourceIds: [mediaUrl],
      regularPrice: 199,
      currencyCode: "EUR",
    },
  }
}

const bundle = buildReadyStagingMigrationInputFixture({
  candidates: [
    buildRecoveryProductCandidate("phase-4r-contract", [observation()]),
  ],
  captureId: "phase-4r-contract",
})

const mappings: MigrationDependencyMapping[] = [
  {
    entityType: "category",
    sourceId: categoryUrl,
    status: "imported",
    targetId: "pcat_phase_4r",
  },
  {
    entityType: "brand",
    sourceId: brandSourceId,
    status: "imported",
    targetId: "brand_phase_4r",
  },
  {
    entityType: "media",
    sourceId: mediaUrl,
    status: "imported",
    targetUrl: `https://${servingHost}/catalog/phase-4r-contract.jpg`,
  },
]

const plan = buildDependencyMappingReconciliationPlan({
  bundle,
  mappings,
  allowedMediaHosts: [servingHost],
})
assert.equal(plan.isReconciled, true)

async function expectReject(
  env: NodeJS.ProcessEnv,
  expectedMessage: RegExp
) {
  await assert.rejects(
    () => readVerifiedStagingDependencyPlan(bundle, env),
    expectedMessage
  )
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "coquette-phase-4r-input-"))
  const planPath = join(root, "dependency-plan.json")
  const tamperedPath = join(root, "tampered-plan.json")

  try {
    await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8")

    const validEnv: NodeJS.ProcessEnv = {
      [stagingDependencyPlanEnvironment.plan]: planPath,
      [stagingDependencyPlanEnvironment.expectedChecksum]: plan.planChecksum,
      [stagingDependencyPlanEnvironment.allowedMediaHosts]: servingHost,
    }
    const accepted = await readVerifiedStagingDependencyPlan(bundle, validEnv)
    assert.equal(accepted.plan.planChecksum, plan.planChecksum)
    assert.deepEqual(accepted.plan.validatedMappings, plan.validatedMappings)
    assert.deepEqual(accepted.allowedMediaHosts, [servingHost])

    await expectReject(
      {},
      /COQUETTE_STAGING_DEPENDENCY_MAPPING_PLAN.*COQUETTE_STAGING_DEPENDENCY_MAPPING_CHECKSUM/
    )

    await expectReject(
      {
        ...validEnv,
        [stagingDependencyPlanEnvironment.expectedChecksum]: "0".repeat(64),
      },
      /checksum mismatch/
    )

    await expectReject(
      {
        ...validEnv,
        COQUETTE_STAGING_PRODUCT_DEPENDENCIES: "/tmp/legacy-dependencies.json",
      },
      /Legacy raw product dependency inputs are no longer supported/
    )

    await expectReject(
      {
        ...validEnv,
        [stagingDependencyPlanEnvironment.allowedMediaHosts]: "",
      },
      /must contain at least one COQUETTE-controlled serving-media host/
    )

    const tampered = JSON.parse(
      JSON.stringify(plan)
    ) as DependencyMappingReconciliationPlan
    tampered.validatedMappings[0].targetId = "pcat_tampered"
    await writeFile(tamperedPath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8")
    await expectReject(
      {
        ...validEnv,
        [stagingDependencyPlanEnvironment.plan]: tamperedPath,
      },
      /Staging dependency mapping plan is not verified/
    )

    const changedBundle = buildReadyStagingMigrationInputFixture({
      candidates: [
        buildRecoveryProductCandidate("phase-4r-contract", [
          {
            ...observation(),
            fields: {
              ...observation().fields,
              regularPrice: 209,
            },
          },
        ]),
      ],
      captureId: "phase-4r-contract",
    })
    await assert.rejects(
      () => readVerifiedStagingDependencyPlan(changedBundle, validEnv),
      /Staging dependency mapping plan is not verified/
    )

    await expectReject(
      {
        ...validEnv,
        [stagingDependencyPlanEnvironment.allowedMediaHosts]:
          `${servingHost},coquetteconcept.gr`,
      },
      /Staging dependency mapping plan is not verified/
    )

    console.log(
      "COQUETTE Phase 4R verified dependency-plan staging input boundary passed"
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
