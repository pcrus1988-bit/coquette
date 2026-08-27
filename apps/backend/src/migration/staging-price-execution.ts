import { sourceChecksum } from "./checksum"
import { manifestKey } from "./manifest"
import type {
  PricePlan,
  PricePlanEntry,
  ReconstructedPrice,
} from "./price-plan"
import type {
  MigrationManifestEntry,
  MigrationSourceKey,
} from "./types"

export const stagingPriceExecutionActions = [
  "apply",
  "skip",
  "unavailable",
  "blocked",
] as const
export type StagingPriceExecutionAction =
  (typeof stagingPriceExecutionActions)[number]

export type StagingPriceExecutionEntry = {
  candidateKey: string
  action: StagingPriceExecutionAction
  sourceKey?: MigrationSourceKey
  sourceChecksum?: string
  productSourceKey?: MigrationSourceKey
  productSourceChecksum?: string
  productTargetId?: string
  sku?: string
  reconstructedPrice?: ReconstructedPrice
  previousPriceManifestEntry?: MigrationManifestEntry
  executionChecksum: string
  blockers: string[]
  warnings: string[]
}

export type StagingPriceExecutionPlan = {
  schemaVersion: 1
  sourcePricePlanSchemaVersion: number
  entries: StagingPriceExecutionEntry[]
  totals: Record<StagingPriceExecutionAction, number>
  duplicateProductManifestKeys: string[]
  duplicatePriceManifestKeys: string[]
  globalBlockers: string[]
  isExecutable: boolean
}

export type BuildStagingPriceExecutionPlanInput = {
  pricePlan: PricePlan
  productManifestEntries: MigrationManifestEntry[]
  previousPriceManifestEntries?: MigrationManifestEntry[]
}

function duplicateValues(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort()
}

function manifestIndex(
  entries: MigrationManifestEntry[],
  entityType: "product" | "price"
) {
  const relevant = entries.filter((entry) => entry.entityType === entityType)
  const byKey = new Map<string, MigrationManifestEntry[]>()
  for (const entry of relevant) {
    const key = manifestKey(entry)
    const grouped = byKey.get(key) ?? []
    grouped.push(entry)
    byKey.set(key, grouped)
  }
  return byKey
}

function matchingRuntimePriceManifestEntry(
  pricePlan: PricePlan,
  entry: PricePlanEntry
) {
  if (!entry.sourceKey || !entry.sourceChecksum) return undefined
  return pricePlan.runtimeManifestEntries.find(
    (manifestEntry) =>
      manifestEntry.entityType === "price" &&
      manifestKey(manifestEntry) === manifestKey(entry.sourceKey!) &&
      manifestEntry.sourceChecksum === entry.sourceChecksum &&
      manifestEntry.status === "pending"
  )
}

function buildEntry(
  pricePlan: PricePlan,
  entry: PricePlanEntry,
  productManifest: Map<string, MigrationManifestEntry[]>,
  priceManifest: Map<string, MigrationManifestEntry[]>,
  globalBlockers: string[]
): StagingPriceExecutionEntry {
  const blockers = [...globalBlockers]
  const warnings = [...entry.warnings]
  let productTargetId: string | undefined
  let previousPriceManifestEntry: MigrationManifestEntry | undefined

  if (entry.state === "unavailable") {
    const executionChecksum = sourceChecksum({
      candidateKey: entry.candidateKey,
      action: "unavailable",
      warnings,
    })
    return {
      candidateKey: entry.candidateKey,
      action: "unavailable",
      sourceKey: entry.sourceKey,
      sourceChecksum: entry.sourceChecksum,
      productSourceKey: entry.productSourceKey,
      productSourceChecksum: entry.productSourceChecksum,
      sku: entry.sku,
      executionChecksum,
      blockers: [],
      warnings,
    }
  }

  if (entry.state !== "ready") {
    blockers.push("price_plan_entry_not_ready")
  }
  if (!entry.sourceKey || entry.sourceKey.entityType !== "price") {
    blockers.push("price_source_key_missing_or_invalid")
  }
  if (!entry.sourceChecksum?.trim()) {
    blockers.push("price_source_checksum_missing")
  }
  if (!entry.productSourceKey || entry.productSourceKey.entityType !== "product") {
    blockers.push("product_source_key_missing_or_invalid")
  }
  if (!entry.productSourceChecksum?.trim()) {
    blockers.push("product_source_checksum_missing")
  }
  if (!entry.sku?.trim()) {
    blockers.push("price_sku_missing")
  }
  if (!entry.reconstructedPrice) {
    blockers.push("reconstructed_price_missing")
  }
  if (!matchingRuntimePriceManifestEntry(pricePlan, entry)) {
    blockers.push("matching_pending_runtime_price_manifest_entry_missing")
  }

  if (entry.productSourceKey) {
    const productMatches =
      productManifest.get(manifestKey(entry.productSourceKey)) ?? []
    if (productMatches.length !== 1) {
      blockers.push(
        productMatches.length === 0
          ? "imported_product_manifest_entry_missing"
          : "duplicate_imported_product_manifest_entries"
      )
    } else {
      const productEntry = productMatches[0]
      if (productEntry.status !== "imported") {
        blockers.push(`product_manifest_not_imported:${productEntry.status}`)
      }
      if (!productEntry.targetId?.trim()) {
        blockers.push("imported_product_manifest_missing_target_id")
      }
      if (productEntry.sourceChecksum !== entry.productSourceChecksum) {
        blockers.push("structural_product_checksum_not_current")
      }
      if (
        productEntry.status === "imported" &&
        productEntry.targetId?.trim() &&
        productEntry.sourceChecksum === entry.productSourceChecksum
      ) {
        productTargetId = productEntry.targetId.trim()
      }
    }
  }

  if (entry.sourceKey) {
    const previous = priceManifest.get(manifestKey(entry.sourceKey)) ?? []
    if (previous.length > 1) {
      blockers.push("duplicate_previous_price_manifest_entries")
    } else if (previous.length === 1) {
      previousPriceManifestEntry = previous[0]
      if (previous[0].status === "skipped") {
        blockers.push("previous_price_manifest_requires_reconciliation:skipped")
      }
    }
  }

  const uniqueBlockers = [...new Set(blockers)].sort()
  let action: StagingPriceExecutionAction = "apply"
  if (uniqueBlockers.length > 0) {
    action = "blocked"
  } else if (
    previousPriceManifestEntry?.status === "imported" &&
    previousPriceManifestEntry.sourceChecksum === entry.sourceChecksum
  ) {
    action = "skip"
  }

  const executionChecksum = sourceChecksum({
    candidateKey: entry.candidateKey,
    sourceKey: entry.sourceKey,
    sourceChecksum: entry.sourceChecksum,
    productSourceKey: entry.productSourceKey,
    productSourceChecksum: entry.productSourceChecksum,
    productTargetId,
    sku: entry.sku,
    reconstructedPrice: entry.reconstructedPrice,
    previousPriceManifestStatus: previousPriceManifestEntry?.status,
    previousPriceManifestChecksum: previousPriceManifestEntry?.sourceChecksum,
    action,
    blockers: uniqueBlockers,
  })

  return {
    candidateKey: entry.candidateKey,
    action,
    sourceKey: entry.sourceKey,
    sourceChecksum: entry.sourceChecksum,
    productSourceKey: entry.productSourceKey,
    productSourceChecksum: entry.productSourceChecksum,
    productTargetId,
    sku: entry.sku,
    reconstructedPrice: entry.reconstructedPrice,
    previousPriceManifestEntry,
    executionChecksum,
    blockers: uniqueBlockers,
    warnings,
  }
}

export function buildStagingPriceExecutionPlan(
  input: BuildStagingPriceExecutionPlanInput
): StagingPriceExecutionPlan {
  const globalBlockers: string[] = []
  if (input.pricePlan.schemaVersion !== 1) {
    globalBlockers.push("unsupported_price_plan_schema")
  }
  if (!input.pricePlan.isReconciled) {
    globalBlockers.push("price_plan_not_reconciled")
  }

  const productKeys = input.productManifestEntries
    .filter((entry) => entry.entityType === "product")
    .map(manifestKey)
  const priceKeys = (input.previousPriceManifestEntries ?? [])
    .filter((entry) => entry.entityType === "price")
    .map(manifestKey)
  const duplicateProductManifestKeys = duplicateValues(productKeys)
  const duplicatePriceManifestKeys = duplicateValues(priceKeys)

  if (duplicateProductManifestKeys.length > 0) {
    globalBlockers.push("duplicate_product_manifest_keys")
  }
  if (duplicatePriceManifestKeys.length > 0) {
    globalBlockers.push("duplicate_price_manifest_keys")
  }

  const productManifest = manifestIndex(input.productManifestEntries, "product")
  const priceManifest = manifestIndex(
    input.previousPriceManifestEntries ?? [],
    "price"
  )
  const entries = input.pricePlan.entries.map((entry) =>
    buildEntry(
      input.pricePlan,
      entry,
      productManifest,
      priceManifest,
      globalBlockers
    )
  )

  const totals = Object.fromEntries(
    stagingPriceExecutionActions.map((action) => [
      action,
      entries.filter((entry) => entry.action === action).length,
    ])
  ) as Record<StagingPriceExecutionAction, number>

  return {
    schemaVersion: 1,
    sourcePricePlanSchemaVersion: input.pricePlan.schemaVersion,
    entries,
    totals,
    duplicateProductManifestKeys,
    duplicatePriceManifestKeys,
    globalBlockers: [...new Set(globalBlockers)].sort(),
    isExecutable:
      entries.length > 0 &&
      totals.blocked === 0 &&
      duplicateProductManifestKeys.length === 0 &&
      duplicatePriceManifestKeys.length === 0 &&
      globalBlockers.length === 0,
  }
}
