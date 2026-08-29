import { MedusaError } from "@medusajs/framework/utils"
import { assertStagingMigrationWriteGuard } from "./staging-product-execution"

export const COQUETTE_STAGING_SUPABASE_PROJECT_REF = "pijetwrxqznxaoacnakr"

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

export function assertDedicatedCoquetteStagingProject(env: NodeJS.ProcessEnv) {
  const base = assertStagingMigrationWriteGuard(env)
  const expectedRef = env.COQUETTE_MIGRATION_EXPECTED_SUPABASE_PROJECT_REF?.trim()
  if (expectedRef !== COQUETTE_STAGING_SUPABASE_PROJECT_REF) {
    throw unexpected(
      `COQUETTE_MIGRATION_EXPECTED_SUPABASE_PROJECT_REF must equal the dedicated COQUETTE project ref ${COQUETTE_STAGING_SUPABASE_PROJECT_REF}`
    )
  }

  const databaseUrl = new URL(env.DATABASE_URL!)
  const username = decodeURIComponent(databaseUrl.username).toLowerCase()
  const host = databaseUrl.hostname.toLowerCase()
  if (!host.includes(expectedRef) && !username.includes(expectedRef)) {
    throw unexpected(
      "DATABASE_URL does not identify the dedicated COQUETTE Supabase project by host or pooler username"
    )
  }

  return {
    ...base,
    supabaseProjectRef: expectedRef,
  }
}
