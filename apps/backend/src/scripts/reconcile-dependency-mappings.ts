import { MedusaError } from "@medusajs/framework/utils"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import {
  buildDependencyMappingReconciliationPlan,
  type DependencyMappingReconciliationPlan,
} from "../migration/dependency-mapping-reconciliation"
import {
  verifyMigrationInputReconciliationBundle,
  type MigrationInputReconciliation,
} from "../migration/migration-input-reconciliation"
import type { MigrationDependencyMapping } from "../migration/staging-product-execution"

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T
}

async function atomicWriteJson(path: string, value: unknown) {
  const target = resolve(path)
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  await rename(temporary, target)
}

function allowedMediaHosts() {
  return (process.env.COQUETTE_MIGRATION_ALLOWED_MEDIA_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

async function optionalMappings(path?: string) {
  if (!path?.trim()) return []
  const value = await readJson<unknown>(path)
  if (!Array.isArray(value)) {
    throw unexpected("COQUETTE_DEPENDENCY_MAPPINGS_FILE must contain a JSON array")
  }
  return value as MigrationDependencyMapping[]
}

async function main() {
  const bundlePath = process.env.COQUETTE_MIGRATION_RECONCILIATION_BUNDLE?.trim()
  const expectedBundleChecksum =
    process.env.COQUETTE_MIGRATION_RECONCILIATION_CHECKSUM?.trim()
  const outputPath = process.env.COQUETTE_DEPENDENCY_MAPPING_PLAN?.trim()
  if (!bundlePath || !expectedBundleChecksum || !outputPath) {
    throw unexpected(
      "COQUETTE_MIGRATION_RECONCILIATION_BUNDLE, COQUETTE_MIGRATION_RECONCILIATION_CHECKSUM and COQUETTE_DEPENDENCY_MAPPING_PLAN are required"
    )
  }

  const bundle = await readJson<MigrationInputReconciliation>(bundlePath)
  const verification = verifyMigrationInputReconciliationBundle(bundle)
  if (!verification.valid) {
    throw unexpected(
      `Migration reconciliation bundle is invalid: ${verification.errors.join(", ")}`
    )
  }
  if (bundle.bundleChecksum !== expectedBundleChecksum) {
    throw unexpected(
      `Migration reconciliation bundle checksum mismatch: expected ${expectedBundleChecksum}, received ${bundle.bundleChecksum}`
    )
  }

  const mappings = await optionalMappings(
    process.env.COQUETTE_DEPENDENCY_MAPPINGS_FILE
  )
  const plan: DependencyMappingReconciliationPlan =
    buildDependencyMappingReconciliationPlan({
      bundle,
      mappings,
      allowedMediaHosts: allowedMediaHosts(),
    })

  await atomicWriteJson(outputPath, plan)
  console.log(
    JSON.stringify(
      {
        migrationInputBundleChecksum: plan.migrationInputBundleChecksum,
        captureEvidencePackageChecksum: plan.captureEvidencePackageChecksum,
        planChecksum: plan.planChecksum,
        requirementsChecksum: plan.requirementsChecksum,
        isReconciled: plan.isReconciled,
        totals: plan.totals,
        duplicateMappingKeys: plan.duplicateMappingKeys,
        orphanMappingKeys: plan.orphanMappingKeys,
        globalBlockers: plan.globalBlockers,
        unresolved: plan.entries
          .filter((entry) => entry.state !== "resolved")
          .map((entry) => ({
            entityType: entry.entityType,
            sourceId: entry.sourceId,
            candidateKeys: entry.candidateKeys,
            state: entry.state,
            blockers: entry.blockers,
          })),
      },
      null,
      2
    )
  )

  if (!plan.isReconciled) process.exitCode = 3
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
