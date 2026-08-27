import { MedusaError } from "@medusajs/framework/utils"
import { sourceChecksum } from "./checksum"
import {
  verifyMigrationInputReconciliationBundle,
  type MigrationInputReconciliation,
} from "./migration-input-reconciliation"
import type {
  MigrationDependencyEntityType,
  MigrationDependencyMapping,
} from "./staging-product-execution"

export const dependencyMappingStates = [
  "resolved",
  "missing",
  "unavailable",
  "error",
  "invalid",
] as const

export type DependencyMappingState = (typeof dependencyMappingStates)[number]

export type DependencyRequirement = {
  entityType: MigrationDependencyEntityType
  sourceId: string
  candidateKeys: string[]
  requirementChecksum: string
}

export type DependencyMappingReconciliationEntry = DependencyRequirement & {
  state: DependencyMappingState
  mapping?: MigrationDependencyMapping
  mappingChecksum?: string
  blockers: string[]
}

export type DependencyMappingReconciliationPlan = {
  schemaVersion: 1
  migrationInputBundleChecksum: string
  captureEvidencePackageChecksum: string
  requirementsChecksum: string
  entries: DependencyMappingReconciliationEntry[]
  totals: Record<DependencyMappingState, number>
  duplicateMappingKeys: string[]
  orphanMappingKeys: string[]
  globalBlockers: string[]
  validatedMappings: MigrationDependencyMapping[]
  planChecksum: string
  isReconciled: boolean
  isExecutable: false
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function dependencyKey(entityType: MigrationDependencyEntityType, sourceId: string) {
  return `${entityType}:${encodeURIComponent(sourceId)}`
}

function duplicateValues(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort()
}

function pushRequirement(
  requirements: Map<string, { entityType: MigrationDependencyEntityType; sourceId: string; candidateKeys: Set<string> }>,
  entityType: MigrationDependencyEntityType,
  sourceId: string,
  candidateKey: string
) {
  const normalized = sourceId.trim()
  if (!normalized) return
  const key = dependencyKey(entityType, normalized)
  const existing = requirements.get(key) ?? {
    entityType,
    sourceId: normalized,
    candidateKeys: new Set<string>(),
  }
  existing.candidateKeys.add(candidateKey)
  requirements.set(key, existing)
}

export function buildDependencyRequirements(
  bundle: MigrationInputReconciliation
): DependencyRequirement[] {
  const verification = verifyMigrationInputReconciliationBundle(bundle)
  if (!verification.valid) {
    throw unexpected(
      `Dependency requirements need a verified Phase 4N bundle: ${verification.errors.join(", ")}`
    )
  }

  const requirements = new Map<
    string,
    {
      entityType: MigrationDependencyEntityType
      sourceId: string
      candidateKeys: Set<string>
    }
  >()

  for (const entry of bundle.productPlan.entries) {
    if (entry.state !== "ready" || !entry.normalizedProduct) continue
    const product = entry.normalizedProduct
    for (const sourceId of product.categorySourceIds) {
      pushRequirement(requirements, "category", sourceId, entry.candidateKey)
    }
    for (const sourceId of product.mediaSourceIds) {
      pushRequirement(requirements, "media", sourceId, entry.candidateKey)
    }
    if (product.brandSourceId) {
      pushRequirement(
        requirements,
        "brand",
        product.brandSourceId,
        entry.candidateKey
      )
    }
  }

  return [...requirements.values()]
    .map((requirement) => {
      const candidateKeys = [...requirement.candidateKeys].sort()
      return {
        entityType: requirement.entityType,
        sourceId: requirement.sourceId,
        candidateKeys,
        requirementChecksum: sourceChecksum({
          entityType: requirement.entityType,
          sourceId: requirement.sourceId,
          candidateKeys,
        }),
      }
    })
    .sort((left, right) =>
      dependencyKey(left.entityType, left.sourceId).localeCompare(
        dependencyKey(right.entityType, right.sourceId)
      )
    )
}

function safeMediaTarget(
  value: string | undefined,
  allowedMediaHosts: Set<string>
) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return undefined
    if (!allowedMediaHosts.has(url.hostname.toLowerCase())) return undefined
    if (url.hostname.toLowerCase() === "coquetteconcept.gr") return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

function evaluateMapping(
  requirement: DependencyRequirement,
  mapping: MigrationDependencyMapping | undefined,
  allowedMediaHosts: Set<string>
): DependencyMappingReconciliationEntry {
  const blockers: string[] = []

  if (!mapping) {
    return { ...requirement, state: "missing", blockers: ["dependency_mapping_missing"] }
  }

  if (mapping.entityType !== requirement.entityType) {
    blockers.push("dependency_entity_type_mismatch")
  }
  if (mapping.sourceId.trim() !== requirement.sourceId) {
    blockers.push("dependency_source_id_mismatch")
  }

  if (mapping.status === "unavailable") {
    return {
      ...requirement,
      state: blockers.length ? "invalid" : "unavailable",
      mapping,
      mappingChecksum: sourceChecksum(mapping),
      blockers: blockers.length ? [...new Set(blockers)].sort() : ["dependency_explicitly_unavailable"],
    }
  }
  if (mapping.status === "error") {
    return {
      ...requirement,
      state: blockers.length ? "invalid" : "error",
      mapping,
      mappingChecksum: sourceChecksum(mapping),
      blockers: blockers.length ? [...new Set(blockers)].sort() : ["dependency_mapping_error"],
    }
  }
  if (mapping.status !== "imported") {
    blockers.push("unsupported_dependency_mapping_status")
  }

  if (requirement.entityType === "media") {
    if (mapping.targetId?.trim()) {
      blockers.push("media_mapping_must_not_use_target_id")
    }
    if (!safeMediaTarget(mapping.targetUrl, allowedMediaHosts)) {
      blockers.push("media_target_url_missing_or_not_allowed")
    }
  } else {
    if (mapping.targetUrl?.trim()) {
      blockers.push(`${requirement.entityType}_mapping_must_not_use_target_url`)
    }
    if (!mapping.targetId?.trim()) {
      blockers.push(`${requirement.entityType}_target_id_required`)
    }
  }

  return {
    ...requirement,
    state: blockers.length ? "invalid" : "resolved",
    mapping,
    mappingChecksum: sourceChecksum(mapping),
    blockers: [...new Set(blockers)].sort(),
  }
}

function planPayload(
  plan: Omit<DependencyMappingReconciliationPlan, "planChecksum">
) {
  return {
    schemaVersion: plan.schemaVersion,
    migrationInputBundleChecksum: plan.migrationInputBundleChecksum,
    captureEvidencePackageChecksum: plan.captureEvidencePackageChecksum,
    requirementsChecksum: plan.requirementsChecksum,
    entries: plan.entries,
    totals: plan.totals,
    duplicateMappingKeys: plan.duplicateMappingKeys,
    orphanMappingKeys: plan.orphanMappingKeys,
    globalBlockers: plan.globalBlockers,
    validatedMappings: plan.validatedMappings,
    isReconciled: plan.isReconciled,
    isExecutable: plan.isExecutable,
  }
}

export function buildDependencyMappingReconciliationPlan(input: {
  bundle: MigrationInputReconciliation
  mappings?: MigrationDependencyMapping[]
  allowedMediaHosts: string[]
}): DependencyMappingReconciliationPlan {
  const verification = verifyMigrationInputReconciliationBundle(input.bundle)
  const globalBlockers: string[] = []
  if (!verification.valid) {
    globalBlockers.push("migration_input_bundle_not_verified")
  }
  if (!input.bundle.captureEvidencePackageChecksum?.trim()) {
    globalBlockers.push("capture_evidence_package_checksum_required")
  }

  const allowedMediaHosts = new Set(
    input.allowedMediaHosts
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  )
  if (allowedMediaHosts.size === 0) {
    globalBlockers.push("allowed_media_hosts_required")
  }
  if (allowedMediaHosts.has("coquetteconcept.gr")) {
    globalBlockers.push("legacy_host_cannot_be_serving_media_host")
  }

  const requirements = verification.valid
    ? buildDependencyRequirements(input.bundle)
    : []
  const mappings = input.mappings ?? []
  const mappingKeys = mappings.map((mapping) =>
    dependencyKey(mapping.entityType, mapping.sourceId.trim())
  )
  const duplicateMappingKeys = duplicateValues(mappingKeys)
  if (duplicateMappingKeys.length > 0) {
    globalBlockers.push("duplicate_dependency_mapping_keys")
  }

  const requirementKeys = new Set(
    requirements.map((requirement) =>
      dependencyKey(requirement.entityType, requirement.sourceId)
    )
  )
  const orphanMappingKeys = [
    ...new Set(mappingKeys.filter((key) => !requirementKeys.has(key))),
  ].sort()
  if (orphanMappingKeys.length > 0) {
    globalBlockers.push("orphan_dependency_mappings_present")
  }

  const mappingByKey = new Map<string, MigrationDependencyMapping>()
  for (const mapping of mappings) {
    const key = dependencyKey(mapping.entityType, mapping.sourceId.trim())
    if (!mappingByKey.has(key)) mappingByKey.set(key, mapping)
  }

  const entries = requirements.map((requirement) =>
    evaluateMapping(
      requirement,
      mappingByKey.get(dependencyKey(requirement.entityType, requirement.sourceId)),
      allowedMediaHosts
    )
  )

  const totals = Object.fromEntries(
    dependencyMappingStates.map((state) => [
      state,
      entries.filter((entry) => entry.state === state).length,
    ])
  ) as Record<DependencyMappingState, number>

  const validatedMappings = entries
    .filter(
      (entry): entry is DependencyMappingReconciliationEntry & {
        mapping: MigrationDependencyMapping
      } => entry.state === "resolved" && Boolean(entry.mapping)
    )
    .map((entry) => entry.mapping)
    .sort((left, right) =>
      dependencyKey(left.entityType, left.sourceId).localeCompare(
        dependencyKey(right.entityType, right.sourceId)
      )
    )

  const isReconciled =
    verification.valid &&
    requirements.length > 0 &&
    globalBlockers.length === 0 &&
    duplicateMappingKeys.length === 0 &&
    orphanMappingKeys.length === 0 &&
    totals.resolved === entries.length

  const withoutChecksum: Omit<DependencyMappingReconciliationPlan, "planChecksum"> = {
    schemaVersion: 1,
    migrationInputBundleChecksum: input.bundle.bundleChecksum,
    captureEvidencePackageChecksum:
      input.bundle.captureEvidencePackageChecksum ?? "",
    requirementsChecksum: sourceChecksum(requirements),
    entries,
    totals,
    duplicateMappingKeys,
    orphanMappingKeys,
    globalBlockers: [...new Set(globalBlockers)].sort(),
    validatedMappings,
    isReconciled,
    isExecutable: false,
  }

  return {
    ...withoutChecksum,
    planChecksum: sourceChecksum(planPayload(withoutChecksum)),
  }
}

export function verifyDependencyMappingReconciliationPlan(input: {
  plan: DependencyMappingReconciliationPlan
  bundle: MigrationInputReconciliation
  allowedMediaHosts: string[]
}) {
  const errors: string[] = []
  const rebuilt = buildDependencyMappingReconciliationPlan({
    bundle: input.bundle,
    mappings: input.plan.validatedMappings,
    allowedMediaHosts: input.allowedMediaHosts,
  })

  if (input.plan.schemaVersion !== 1) errors.push("dependency_mapping_plan_schema_version_1_required")
  if (input.plan.migrationInputBundleChecksum !== input.bundle.bundleChecksum) {
    errors.push("dependency_mapping_plan_bundle_checksum_mismatch")
  }
  if (
    input.plan.captureEvidencePackageChecksum !==
    input.bundle.captureEvidencePackageChecksum
  ) {
    errors.push("dependency_mapping_plan_capture_package_checksum_mismatch")
  }
  if (input.plan.requirementsChecksum !== rebuilt.requirementsChecksum) {
    errors.push("dependency_mapping_requirements_checksum_mismatch")
  }
  if (input.plan.planChecksum !== sourceChecksum(planPayload({
    schemaVersion: input.plan.schemaVersion,
    migrationInputBundleChecksum: input.plan.migrationInputBundleChecksum,
    captureEvidencePackageChecksum: input.plan.captureEvidencePackageChecksum,
    requirementsChecksum: input.plan.requirementsChecksum,
    entries: input.plan.entries,
    totals: input.plan.totals,
    duplicateMappingKeys: input.plan.duplicateMappingKeys,
    orphanMappingKeys: input.plan.orphanMappingKeys,
    globalBlockers: input.plan.globalBlockers,
    validatedMappings: input.plan.validatedMappings,
    isReconciled: input.plan.isReconciled,
    isExecutable: input.plan.isExecutable,
  }))) {
    errors.push("dependency_mapping_plan_checksum_mismatch")
  }
  if (!input.plan.isReconciled) errors.push("dependency_mapping_plan_not_reconciled")
  if (input.plan.isExecutable !== false) errors.push("dependency_mapping_plan_must_be_non_writing")
  if (sourceChecksum(input.plan.entries) !== sourceChecksum(rebuilt.entries)) {
    errors.push("dependency_mapping_plan_entries_do_not_match_bundle_and_mappings")
  }
  if (
    sourceChecksum(input.plan.validatedMappings) !==
    sourceChecksum(rebuilt.validatedMappings)
  ) {
    errors.push("dependency_mapping_validated_mappings_mismatch")
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)].sort(),
    recomputedPlanChecksum: sourceChecksum(planPayload({
      schemaVersion: input.plan.schemaVersion,
      migrationInputBundleChecksum: input.plan.migrationInputBundleChecksum,
      captureEvidencePackageChecksum: input.plan.captureEvidencePackageChecksum,
      requirementsChecksum: input.plan.requirementsChecksum,
      entries: input.plan.entries,
      totals: input.plan.totals,
      duplicateMappingKeys: input.plan.duplicateMappingKeys,
      orphanMappingKeys: input.plan.orphanMappingKeys,
      globalBlockers: input.plan.globalBlockers,
      validatedMappings: input.plan.validatedMappings,
      isReconciled: input.plan.isReconciled,
      isExecutable: input.plan.isExecutable,
    })),
  }
}
