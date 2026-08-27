import { MedusaError } from "@medusajs/framework/utils"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  verifyDependencyMappingReconciliationPlan,
  type DependencyMappingReconciliationPlan,
} from "./dependency-mapping-reconciliation"
import type { MigrationInputReconciliation } from "./migration-input-reconciliation"

export const stagingDependencyPlanEnvironment = {
  plan: "COQUETTE_STAGING_DEPENDENCY_MAPPING_PLAN",
  expectedChecksum: "COQUETTE_STAGING_DEPENDENCY_MAPPING_CHECKSUM",
  allowedMediaHosts: "COQUETTE_MIGRATION_ALLOWED_MEDIA_HOSTS",
} as const

const legacyRawDependencyEnvironment = [
  "COQUETTE_STAGING_PRODUCT_DEPENDENCIES",
] as const

function unexpectedState(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function nonEmpty(value: string | undefined) {
  return value?.trim() || undefined
}

function allowedMediaHosts(env: NodeJS.ProcessEnv) {
  return (env[stagingDependencyPlanEnvironment.allowedMediaHosts] ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

export type VerifiedStagingDependencyInput = {
  plan: DependencyMappingReconciliationPlan
  allowedMediaHosts: string[]
}

export async function readVerifiedStagingDependencyPlan(
  bundle: MigrationInputReconciliation,
  env: NodeJS.ProcessEnv = process.env
): Promise<VerifiedStagingDependencyInput> {
  const legacyInputs = legacyRawDependencyEnvironment.filter((key) =>
    nonEmpty(env[key])
  )
  if (legacyInputs.length > 0) {
    throw unexpectedState(
      `Legacy raw product dependency inputs are no longer supported: ${legacyInputs.join(", ")}. Build and pin a Phase 4Q dependency mapping plan instead.`
    )
  }

  const planPath = nonEmpty(env[stagingDependencyPlanEnvironment.plan])
  const expectedChecksum = nonEmpty(
    env[stagingDependencyPlanEnvironment.expectedChecksum]
  )
  const mediaHosts = allowedMediaHosts(env)

  if (!planPath || !expectedChecksum) {
    throw unexpectedState(
      `${stagingDependencyPlanEnvironment.plan} and ${stagingDependencyPlanEnvironment.expectedChecksum} are required for staging structural product execution`
    )
  }
  if (mediaHosts.length === 0) {
    throw unexpectedState(
      `${stagingDependencyPlanEnvironment.allowedMediaHosts} must contain at least one COQUETTE-controlled serving-media host`
    )
  }

  let plan: DependencyMappingReconciliationPlan
  try {
    plan = JSON.parse(
      await readFile(resolve(planPath), "utf8")
    ) as DependencyMappingReconciliationPlan
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw unexpectedState(
      `Unable to read staging dependency mapping plan ${resolve(planPath)}: ${message}`
    )
  }

  const verification = verifyDependencyMappingReconciliationPlan({
    plan,
    bundle,
    allowedMediaHosts: mediaHosts,
  })
  if (!verification.valid) {
    throw unexpectedState(
      `Staging dependency mapping plan is not verified: ${verification.errors.join(", ")}`
    )
  }
  if (plan.planChecksum !== expectedChecksum) {
    throw unexpectedState(
      `Staging dependency mapping plan checksum mismatch: expected ${expectedChecksum}, received ${plan.planChecksum}`
    )
  }
  if (plan.migrationInputBundleChecksum !== bundle.bundleChecksum) {
    throw unexpectedState(
      `Staging dependency mapping plan belongs to migration bundle ${plan.migrationInputBundleChecksum}, not ${bundle.bundleChecksum}`
    )
  }
  if (
    plan.captureEvidencePackageChecksum !== bundle.captureEvidencePackageChecksum
  ) {
    throw unexpectedState(
      "Staging dependency mapping plan capture evidence package checksum does not match the migration input bundle"
    )
  }

  return {
    plan,
    allowedMediaHosts: mediaHosts,
  }
}
