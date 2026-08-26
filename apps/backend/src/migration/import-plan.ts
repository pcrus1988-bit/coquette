import { sourceChecksum } from "./checksum"
import {
  createPendingManifestEntry,
  findDuplicateManifestKeys,
  manifestKey,
} from "./manifest"
import type {
  RecoveryCandidateConflict,
  RecoveryProductCandidate,
} from "./recovery-candidates"
import type {
  MigrationManifestEntry,
  MigrationSourceKey,
  NormalizedStorefrontProduct,
} from "./types"
import {
  validateNormalizedProduct,
  type ValidationIssue,
} from "./validation"

export const productImportPlanStates = ["ready", "blocked", "rejected"] as const
export type ProductImportPlanState = (typeof productImportPlanStates)[number]

export type ProductImportPlanEntry = {
  candidateKey: string
  state: ProductImportPlanState
  sourceKey?: MigrationSourceKey
  planningChecksum: string
  sourceChecksum?: string
  sourceUpdatedAt?: string
  sku?: string
  normalizedProduct?: NormalizedStorefrontProduct
  missingRequiredFields: string[]
  blockers: string[]
  conflicts: RecoveryCandidateConflict[]
  validationIssues: ValidationIssue[]
  warnings: string[]
  errors: string[]
}

export type ProductImportPlan = {
  schemaVersion: 1
  entries: ProductImportPlanEntry[]
  totals: Record<ProductImportPlanState, number>
  runtimeManifestEntries: MigrationManifestEntry[]
  duplicateCandidateKeys: string[]
  duplicateSourceKeys: string[]
  duplicateRuntimeManifestKeys: string[]
  duplicateSkus: string[]
  isExecutable: boolean
}

export function explicitLegacyLocale(sourceId: string): "el" | "en" | undefined {
  try {
    const path = new URL(sourceId).pathname.toLowerCase()
    if (path === "/en" || path.startsWith("/en/")) return "en"
    if (path === "/default" || path.startsWith("/default/")) return "el"
    return undefined
  } catch {
    return undefined
  }
}

function semanticProductPayload(product: NormalizedStorefrontProduct) {
  const { evidence, capturedAt, ...payload } = product
  void evidence
  void capturedAt
  return payload
}

export function semanticProductChecksum(product: NormalizedStorefrontProduct) {
  return sourceChecksum(semanticProductPayload(product))
}

function planningChecksum(candidate: RecoveryProductCandidate) {
  return sourceChecksum({
    candidateKey: candidate.candidateKey,
    disposition: candidate.disposition,
    selected: candidate.selected,
    missingRequiredFields: candidate.missingRequiredFields,
    blockers: candidate.blockers,
    conflicts: candidate.conflicts,
    evidence: candidate.evidence,
  })
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

function initialEntry(candidate: RecoveryProductCandidate): ProductImportPlanEntry {
  const normalizedProduct = candidate.normalizedProduct
  const sourceId = normalizedProduct?.sourceId ?? candidate.selected.sourceId
  const sourceKey = sourceId
    ? {
        entityType: "product" as const,
        sourceId,
        locale: explicitLegacyLocale(sourceId),
      }
    : undefined
  const validationIssues = normalizedProduct
    ? validateNormalizedProduct(normalizedProduct)
    : []
  const errors = validationIssues.map(
    (issue) => `${issue.field}: ${issue.message}`
  )

  let state: ProductImportPlanState = "blocked"
  if (candidate.disposition === "rejected") state = "rejected"
  else if (
    candidate.disposition === "ready" &&
    normalizedProduct &&
    validationIssues.length === 0
  ) {
    state = "ready"
  }

  return {
    candidateKey: candidate.candidateKey,
    state,
    sourceKey,
    planningChecksum: planningChecksum(candidate),
    sourceChecksum: normalizedProduct
      ? semanticProductChecksum(normalizedProduct)
      : undefined,
    sourceUpdatedAt: normalizedProduct?.capturedAt,
    sku: normalizedProduct?.sku ?? candidate.selected.sku,
    normalizedProduct,
    missingRequiredFields: [...candidate.missingRequiredFields],
    blockers: [...candidate.blockers],
    conflicts: [...candidate.conflicts],
    validationIssues,
    warnings: [],
    errors,
  }
}

function blockEntry(entry: ProductImportPlanEntry, reason: string) {
  if (entry.state === "rejected") return
  entry.state = "blocked"
  if (!entry.blockers.includes(reason)) entry.blockers.push(reason)
}

export function buildProductImportPlan(
  candidates: RecoveryProductCandidate[]
): ProductImportPlan {
  const duplicateCandidateKeys = duplicateValues(
    candidates.map((candidate) => candidate.candidateKey)
  )
  const entries = candidates
    .map(initialEntry)
    .sort((left, right) => left.candidateKey.localeCompare(right.candidateKey))

  for (const entry of entries) {
    if (duplicateCandidateKeys.includes(entry.candidateKey)) {
      blockEntry(entry, "duplicate_candidate_key")
    }
  }

  const duplicateSkus = duplicateValues(
    entries
      .filter((entry) => entry.state !== "rejected")
      .map((entry) => entry.sku)
  )
  for (const entry of entries) {
    if (entry.sku && duplicateSkus.includes(entry.sku)) {
      blockEntry(entry, "duplicate_sku_requires_product_identity_resolution")
    }
  }

  const duplicateSourceKeys = duplicateValues(
    entries
      .filter((entry) => entry.state !== "rejected")
      .map((entry) => (entry.sourceKey ? manifestKey(entry.sourceKey) : undefined))
  )
  for (const entry of entries) {
    if (
      entry.sourceKey &&
      duplicateSourceKeys.includes(manifestKey(entry.sourceKey))
    ) {
      blockEntry(entry, "duplicate_source_key_requires_evidence_resolution")
    }
  }

  const provisionalRuntimeEntries = entries.flatMap((entry) => {
    if (
      entry.state !== "ready" ||
      !entry.sourceKey ||
      !entry.sourceChecksum
    ) {
      return []
    }
    return [
      createPendingManifestEntry(
        entry.sourceKey,
        entry.sourceChecksum,
        entry.sourceUpdatedAt
      ),
    ]
  })
  const duplicateRuntimeManifestKeys = findDuplicateManifestKeys(
    provisionalRuntimeEntries
  )

  if (duplicateRuntimeManifestKeys.length > 0) {
    for (const entry of entries) {
      if (
        entry.sourceKey &&
        duplicateRuntimeManifestKeys.includes(manifestKey(entry.sourceKey))
      ) {
        blockEntry(entry, "duplicate_runtime_manifest_key")
      }
    }
  }

  const runtimeManifestEntries = entries.flatMap((entry) => {
    if (
      entry.state !== "ready" ||
      !entry.sourceKey ||
      !entry.sourceChecksum
    ) {
      return []
    }
    return [
      createPendingManifestEntry(
        entry.sourceKey,
        entry.sourceChecksum,
        entry.sourceUpdatedAt
      ),
    ]
  })

  const totals = Object.fromEntries(
    productImportPlanStates.map((state) => [
      state,
      entries.filter((entry) => entry.state === state).length,
    ])
  ) as Record<ProductImportPlanState, number>

  return {
    schemaVersion: 1,
    entries,
    totals,
    runtimeManifestEntries,
    duplicateCandidateKeys,
    duplicateSourceKeys,
    duplicateRuntimeManifestKeys,
    duplicateSkus,
    isExecutable:
      entries.length > 0 &&
      totals.blocked === 0 &&
      totals.rejected === 0 &&
      duplicateCandidateKeys.length === 0 &&
      duplicateSourceKeys.length === 0 &&
      duplicateRuntimeManifestKeys.length === 0 &&
      duplicateSkus.length === 0,
  }
}
