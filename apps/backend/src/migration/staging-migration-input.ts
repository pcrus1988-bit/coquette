import { MedusaError } from "@medusajs/framework/utils"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  assertMigrationInputReconciliationReady,
  type MigrationInputReconciliation,
} from "./migration-input-reconciliation"

export const stagingMigrationInputEnvironment = {
  bundle: "COQUETTE_STAGING_MIGRATION_INPUT_BUNDLE",
  expectedChecksum: "COQUETTE_STAGING_MIGRATION_INPUT_CHECKSUM",
} as const

const legacyRawReportEnvironment = [
  "COQUETTE_STAGING_PRODUCT_IMPORT_REPORT",
  "COQUETTE_STAGING_PRICE_IMPORT_REPORT",
] as const

function unexpectedState(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function nonEmpty(value: string | undefined) {
  return value?.trim() || undefined
}

export async function readVerifiedStagingMigrationInputBundle(
  env: NodeJS.ProcessEnv = process.env
): Promise<MigrationInputReconciliation> {
  const legacyInputs = legacyRawReportEnvironment.filter((key) => nonEmpty(env[key]))
  if (legacyInputs.length > 0) {
    throw unexpectedState(
      `Legacy raw migration report inputs are no longer supported: ${legacyInputs.join(", ")}. Build and pin a Phase 4N reconciliation bundle instead.`
    )
  }

  const bundlePath = nonEmpty(env[stagingMigrationInputEnvironment.bundle])
  const expectedChecksum = nonEmpty(
    env[stagingMigrationInputEnvironment.expectedChecksum]
  )
  if (!bundlePath || !expectedChecksum) {
    throw unexpectedState(
      `${stagingMigrationInputEnvironment.bundle} and ${stagingMigrationInputEnvironment.expectedChecksum} are required for staging migration execution`
    )
  }

  let bundle: MigrationInputReconciliation
  try {
    bundle = JSON.parse(
      await readFile(resolve(bundlePath), "utf8")
    ) as MigrationInputReconciliation
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw unexpectedState(
      `Unable to read staging migration reconciliation bundle ${resolve(bundlePath)}: ${message}`
    )
  }

  assertMigrationInputReconciliationReady(bundle)
  if (bundle.bundleChecksum !== expectedChecksum) {
    throw unexpectedState(
      `Staging migration bundle checksum mismatch: expected ${expectedChecksum}, received ${bundle.bundleChecksum}`
    )
  }

  return bundle
}
