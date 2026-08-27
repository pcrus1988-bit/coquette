import { sourceChecksum } from "./checksum"
import { manifestKey } from "./manifest"
import type {
  ProductImportPlan,
  ProductImportPlanEntry,
} from "./import-plan"
import type { MigrationSourceKey } from "./types"

export const inventoryPlanStates = ["state_only", "unavailable", "blocked"] as const
export type InventoryPlanState = (typeof inventoryPlanStates)[number]

export type ReconstructedInventoryEvidence = {
  sku: string
  stockState?: "in_stock" | "out_of_stock" | "unknown"
  lowStockMessage?: string
}

export type InventoryPlanEntry = {
  candidateKey: string
  state: InventoryPlanState
  productSourceKey?: MigrationSourceKey
  productSourceChecksum?: string
  sourceKey?: MigrationSourceKey
  sku?: string
  evidenceChecksum?: string
  reconstructedEvidence?: ReconstructedInventoryEvidence
  blockers: string[]
  warnings: string[]
}

export type InventoryPlan = {
  schemaVersion: 1
  entries: InventoryPlanEntry[]
  totals: Record<InventoryPlanState, number>
  duplicateSourceKeys: string[]
  isReconciled: boolean
  isExecutable: false
  runtimeManifestEntries: []
}

const inventoryConflictFields = new Set(["stockState", "lowStockMessage"])

function inventorySourceKey(
  productSourceKey: MigrationSourceKey
): MigrationSourceKey {
  return {
    entityType: "inventory",
    sourceId: productSourceKey.sourceId,
    locale: productSourceKey.locale,
  }
}

function duplicateValues(values: Array<string | undefined>) {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value?.trim()) continue
    const normalized = value.trim()
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort()
}

export function semanticInventoryEvidenceChecksum(
  evidence: ReconstructedInventoryEvidence
) {
  return sourceChecksum({
    sku: evidence.sku,
    stockState: evidence.stockState,
    lowStockMessage: evidence.lowStockMessage,
  })
}

function block(entry: InventoryPlanEntry, reason: string) {
  entry.state = "blocked"
  if (!entry.blockers.includes(reason)) entry.blockers.push(reason)
}

function initialInventoryEntry(
  productEntry: ProductImportPlanEntry
): InventoryPlanEntry {
  const entry: InventoryPlanEntry = {
    candidateKey: productEntry.candidateKey,
    state: "blocked",
    productSourceKey: productEntry.sourceKey,
    productSourceChecksum: productEntry.sourceChecksum,
    sourceKey: productEntry.sourceKey
      ? inventorySourceKey(productEntry.sourceKey)
      : undefined,
    sku: productEntry.sku,
    blockers: [],
    warnings: [],
  }

  if (productEntry.state !== "ready") {
    block(entry, "structural_product_not_ready")
    return entry
  }
  if (!productEntry.sourceKey || productEntry.sourceKey.entityType !== "product") {
    block(entry, "missing_structural_product_source_key")
    return entry
  }
  if (!productEntry.sourceChecksum?.trim() || !productEntry.sku?.trim()) {
    block(entry, "missing_structural_product_identity")
    return entry
  }
  if (!productEntry.normalizedProduct) {
    block(entry, "normalized_product_missing")
    return entry
  }

  const inventoryConflicts = productEntry.conflicts.filter((conflict) =>
    inventoryConflictFields.has(conflict.field)
  )
  if (inventoryConflicts.length > 0) {
    block(entry, "inventory_evidence_conflict_requires_review")
    return entry
  }

  const stockState = productEntry.normalizedProduct.stockState
  const lowStockMessage = productEntry.normalizedProduct.lowStockMessage?.trim()

  if ((!stockState || stockState === "unknown") && !lowStockMessage) {
    entry.state = "unavailable"
    entry.warnings.push(
      stockState === "unknown"
        ? "explicit_stock_state_unknown"
        : "public_inventory_evidence_not_recovered"
    )
    return entry
  }

  const reconstructedEvidence: ReconstructedInventoryEvidence = {
    sku: productEntry.sku.trim(),
    stockState,
    lowStockMessage: lowStockMessage || undefined,
  }
  entry.state = "state_only"
  entry.reconstructedEvidence = reconstructedEvidence
  entry.evidenceChecksum = semanticInventoryEvidenceChecksum(reconstructedEvidence)
  entry.warnings.push("exact_inventory_quantity_not_recovered")
  return entry
}

export function buildInventoryPlan(productPlan: ProductImportPlan): InventoryPlan {
  const entries = productPlan.entries
    .map(initialInventoryEntry)
    .sort((left, right) => left.candidateKey.localeCompare(right.candidateKey))

  const duplicateSourceKeys = duplicateValues(
    entries
      .filter((entry) => entry.state !== "blocked")
      .map((entry) => (entry.sourceKey ? manifestKey(entry.sourceKey) : undefined))
  )
  for (const entry of entries) {
    if (
      entry.sourceKey &&
      duplicateSourceKeys.includes(manifestKey(entry.sourceKey))
    ) {
      block(entry, "duplicate_inventory_source_key")
    }
  }

  const totals = Object.fromEntries(
    inventoryPlanStates.map((state) => [
      state,
      entries.filter((entry) => entry.state === state).length,
    ])
  ) as Record<InventoryPlanState, number>

  return {
    schemaVersion: 1,
    entries,
    totals,
    duplicateSourceKeys,
    isReconciled: totals.blocked === 0 && duplicateSourceKeys.length === 0,
    isExecutable: false,
    runtimeManifestEntries: [],
  }
}
