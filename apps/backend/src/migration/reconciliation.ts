import { findDuplicateManifestKeys } from "./manifest"
import type {
  ReconciliationInput,
  ReconciliationResult,
} from "./types"

export function reconcileMigration(
  input: ReconciliationInput
): ReconciliationResult {
  const relevant = input.manifestEntries.filter(
    (entry) => entry.entityType === input.entityType
  )

  const imported = relevant.filter((entry) => entry.status === "imported").length
  const skipped = relevant.filter((entry) => entry.status === "skipped").length
  const errors = relevant.filter((entry) => entry.status === "error").length
  const pending = relevant.filter((entry) => entry.status === "pending").length
  const duplicateSourceKeys = findDuplicateManifestKeys(relevant)

  const accountedFor = imported + skipped + errors + pending
  const unexplainedVariance = input.expectedSourceCount - accountedFor

  return {
    entityType: input.entityType,
    expectedSourceCount: input.expectedSourceCount,
    manifestCount: relevant.length,
    imported,
    skipped,
    errors,
    pending,
    duplicateSourceKeys,
    unexplainedVariance,
    isReconciled:
      unexplainedVariance === 0 &&
      duplicateSourceKeys.length === 0 &&
      errors === 0 &&
      pending === 0,
  }
}
