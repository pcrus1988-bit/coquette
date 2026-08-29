import { MedusaError } from "@medusajs/framework/utils"
import { basename, extname } from "node:path"
import { sourceChecksum } from "./checksum"
import type {
  StagingSliceDependencyEvidenceEntry,
  StagingSliceDependencyEvidencePlan,
} from "./staging-slice-dependency-evidence"
import type { MigrationDependencyMapping } from "./staging-product-execution"

export type StagingSliceDependencyProvisioningStatus =
  | "imported"
  | "error"

export type StagingSliceDependencyProvisioningManifestEntry = {
  entityType: "category" | "media" | "brand"
  sourceId: string
  evidenceChecksum: string
  status: StagingSliceDependencyProvisioningStatus
  targetId?: string
  targetUrl?: string
  attempts: number
  firstImportedAt?: string
  lastAttemptAt: string
  error?: string
}

export type StagingSliceDependencyProvisioningAction =
  | "create"
  | "skip"
  | "blocked"

export type StagingSliceDependencyProvisioningEntry = {
  entityType: "category" | "media" | "brand"
  sourceId: string
  evidenceChecksum: string
  action: StagingSliceDependencyProvisioningAction
  blockers: string[]
  previous?: StagingSliceDependencyProvisioningManifestEntry
  evidence: StagingSliceDependencyEvidenceEntry
  executionChecksum: string
}

export type StagingSliceDependencyProvisioningPlan = {
  schemaVersion: 1
  captureId: string
  sourceDependencyEvidencePlanChecksum: string
  entries: StagingSliceDependencyProvisioningEntry[]
  totals: Record<StagingSliceDependencyProvisioningAction, number>
  duplicateManifestKeys: string[]
  globalBlockers: string[]
  isExecutable: boolean
  planChecksum: string
}

export type StagingSliceProvisionedDependencyMappingBundle = {
  schemaVersion: 1
  captureId: string
  sourceDependencyEvidencePlanChecksum: string
  provisioningPlanChecksum: string
  mappings: MigrationDependencyMapping[]
  bundleChecksum: string
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function dependencyKey(entityType: string, sourceId: string) {
  return `${entityType}:${encodeURIComponent(sourceId)}`
}

function duplicateValues(values: string[]) {
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort()
}

function safeHttpsUrlOnAllowedHost(value: string | undefined, allowedHosts: Set<string>) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return undefined
    if (!allowedHosts.has(url.hostname.toLowerCase())) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

export function stagingSliceDependencyEvidencePlanChecksum(
  plan: StagingSliceDependencyEvidencePlan
) {
  const { planChecksum: _checksum, ...payload } = plan
  void _checksum
  return sourceChecksum(payload)
}

export function stagingSliceDependencyProvisioningPlanChecksum(
  plan: Omit<StagingSliceDependencyProvisioningPlan, "planChecksum">
) {
  return sourceChecksum(plan)
}

function previousManifestIndex(
  entries: StagingSliceDependencyProvisioningManifestEntry[]
) {
  const byKey = new Map<string, StagingSliceDependencyProvisioningManifestEntry[]>()
  for (const entry of entries) {
    const key = dependencyKey(entry.entityType, entry.sourceId)
    const group = byKey.get(key) ?? []
    group.push(entry)
    byKey.set(key, group)
  }
  return byKey
}

export function buildStagingSliceDependencyProvisioningPlan(input: {
  evidencePlan: StagingSliceDependencyEvidencePlan
  expectedEvidencePlanChecksum?: string
  previousManifestEntries?: StagingSliceDependencyProvisioningManifestEntry[]
  allowedMediaHosts: string[]
}): StagingSliceDependencyProvisioningPlan {
  const globalBlockers: string[] = []
  const actualEvidencePlanChecksum = stagingSliceDependencyEvidencePlanChecksum(
    input.evidencePlan
  )

  if (input.evidencePlan.schemaVersion !== 1) {
    globalBlockers.push("unsupported_dependency_evidence_plan_schema")
  }
  if (input.evidencePlan.planChecksum !== actualEvidencePlanChecksum) {
    globalBlockers.push("dependency_evidence_plan_checksum_invalid")
  }
  if (
    input.expectedEvidencePlanChecksum &&
    input.expectedEvidencePlanChecksum !== input.evidencePlan.planChecksum
  ) {
    globalBlockers.push("dependency_evidence_plan_checksum_not_expected")
  }
  if (!input.evidencePlan.isReadyForProvisioning) {
    globalBlockers.push("dependency_evidence_plan_not_ready")
  }
  if (input.evidencePlan.totals.blocked !== 0) {
    globalBlockers.push("dependency_evidence_plan_contains_blocked_entries")
  }
  if (input.evidencePlan.globalBlockers.length > 0) {
    globalBlockers.push("dependency_evidence_plan_contains_global_blockers")
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

  const previous = input.previousManifestEntries ?? []
  const duplicateManifestKeys = duplicateValues(
    previous.map((entry) => dependencyKey(entry.entityType, entry.sourceId))
  )
  if (duplicateManifestKeys.length > 0) {
    globalBlockers.push("duplicate_dependency_manifest_keys")
  }
  const priorIndex = previousManifestIndex(previous)

  const entries = input.evidencePlan.entries.map((evidence) => {
    const blockers = [...globalBlockers]
    if (evidence.state !== "ready") blockers.push("dependency_evidence_entry_not_ready")
    if (evidence.entityType === "category" && !evidence.category?.name?.trim()) {
      blockers.push("category_name_missing")
    }
    if (evidence.entityType === "media") {
      if (!evidence.media?.mediaFile?.trim()) blockers.push("media_file_missing")
      if (!evidence.media?.contentType?.toLowerCase().startsWith("image/")) {
        blockers.push("media_content_type_not_image")
      }
      if (!evidence.media?.checksum?.match(/^[a-f0-9]{64}$/)) {
        blockers.push("media_checksum_invalid")
      }
    }
    if (evidence.entityType === "brand" && !evidence.brand?.name?.trim()) {
      blockers.push("brand_name_missing")
    }

    const matches = priorIndex.get(dependencyKey(evidence.entityType, evidence.sourceId)) ?? []
    if (matches.length > 1) blockers.push("duplicate_previous_manifest_entries")
    const previousEntry = matches.length === 1 ? matches[0] : undefined
    let action: StagingSliceDependencyProvisioningAction = "create"

    if (previousEntry) {
      if (previousEntry.evidenceChecksum !== evidence.evidenceChecksum) {
        blockers.push("dependency_evidence_changed_requires_reconciliation")
      } else if (previousEntry.status === "imported") {
        if (evidence.entityType === "media") {
          const target = safeHttpsUrlOnAllowedHost(
            previousEntry.targetUrl,
            allowedMediaHosts
          )
          if (!target) blockers.push("imported_media_target_url_missing_or_not_allowed")
        } else if (!previousEntry.targetId?.trim()) {
          blockers.push("imported_dependency_target_id_missing")
        }
        if (blockers.length === 0) action = "skip"
      }
      // Prior errors with unchanged evidence are retried as create actions.
    }

    if (blockers.length > 0) action = "blocked"
    const uniqueBlockers = [...new Set(blockers)].sort()
    const executionChecksum = sourceChecksum({
      entityType: evidence.entityType,
      sourceId: evidence.sourceId,
      evidenceChecksum: evidence.evidenceChecksum,
      action,
      previousStatus: previousEntry?.status,
      previousTargetId: previousEntry?.targetId,
      previousTargetUrl: previousEntry?.targetUrl,
      blockers: uniqueBlockers,
    })

    return {
      entityType: evidence.entityType,
      sourceId: evidence.sourceId,
      evidenceChecksum: evidence.evidenceChecksum,
      action,
      blockers: uniqueBlockers,
      previous: previousEntry,
      evidence,
      executionChecksum,
    }
  })

  entries.sort((left, right) =>
    dependencyKey(left.entityType, left.sourceId).localeCompare(
      dependencyKey(right.entityType, right.sourceId)
    )
  )
  const totals = Object.fromEntries(
    (["create", "skip", "blocked"] as const).map((action) => [
      action,
      entries.filter((entry) => entry.action === action).length,
    ])
  ) as Record<StagingSliceDependencyProvisioningAction, number>

  const withoutChecksum: Omit<StagingSliceDependencyProvisioningPlan, "planChecksum"> = {
    schemaVersion: 1,
    captureId: input.evidencePlan.captureId,
    sourceDependencyEvidencePlanChecksum: input.evidencePlan.planChecksum,
    entries,
    totals,
    duplicateManifestKeys,
    globalBlockers: [...new Set(globalBlockers)].sort(),
    isExecutable:
      entries.length > 0 &&
      totals.blocked === 0 &&
      duplicateManifestKeys.length === 0 &&
      globalBlockers.length === 0,
  }

  return {
    ...withoutChecksum,
    planChecksum: stagingSliceDependencyProvisioningPlanChecksum(withoutChecksum),
  }
}

export function deterministicMigrationCategoryHandle(name: string, sourceId: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "category"
  return `legacy-${slug}-${sourceChecksum(sourceId).slice(0, 10)}`
}

export function deterministicMigrationMediaFilename(mediaFile: string, checksum: string) {
  const portablePath = mediaFile.replace(/\\/g, "/")
  const original = basename(portablePath).replace(/[^a-zA-Z0-9._-]+/g, "-")
  const extension = extname(original).toLowerCase()
  const stem = (extension ? original.slice(0, -extension.length) : original).slice(0, 48) || "image"
  return `phase4-${checksum.slice(0, 20)}-${stem}${extension}`
}

export function buildProvisionedDependencyMappingBundle(input: {
  evidencePlan: StagingSliceDependencyEvidencePlan
  provisioningPlan: StagingSliceDependencyProvisioningPlan
  manifestEntries: StagingSliceDependencyProvisioningManifestEntry[]
}): StagingSliceProvisionedDependencyMappingBundle {
  if (!input.provisioningPlan.isExecutable) {
    throw unexpected("Cannot build dependency mappings from a blocked provisioning plan")
  }
  const manifest = previousManifestIndex(input.manifestEntries)
  const mappings: MigrationDependencyMapping[] = []

  for (const evidence of input.evidencePlan.entries) {
    const matches = manifest.get(dependencyKey(evidence.entityType, evidence.sourceId)) ?? []
    if (matches.length !== 1) {
      throw unexpected(`Expected exactly one provisioning manifest entry for ${evidence.entityType}:${evidence.sourceId}`)
    }
    const entry = matches[0]
    if (entry.status !== "imported" || entry.evidenceChecksum !== evidence.evidenceChecksum) {
      throw unexpected(`Provisioning manifest is not imported against current evidence for ${evidence.entityType}:${evidence.sourceId}`)
    }
    if (evidence.entityType === "media") {
      if (!entry.targetUrl?.trim()) throw unexpected(`Media mapping is missing target URL for ${evidence.sourceId}`)
      mappings.push({
        entityType: "media",
        sourceId: evidence.sourceId,
        status: "imported",
        targetUrl: entry.targetUrl,
      })
    } else {
      if (!entry.targetId?.trim()) throw unexpected(`${evidence.entityType} mapping is missing target ID for ${evidence.sourceId}`)
      mappings.push({
        entityType: evidence.entityType,
        sourceId: evidence.sourceId,
        status: "imported",
        targetId: entry.targetId,
      })
    }
  }

  mappings.sort((left, right) =>
    dependencyKey(left.entityType, left.sourceId).localeCompare(
      dependencyKey(right.entityType, right.sourceId)
    )
  )
  const payload = {
    schemaVersion: 1 as const,
    captureId: input.evidencePlan.captureId,
    sourceDependencyEvidencePlanChecksum: input.evidencePlan.planChecksum,
    provisioningPlanChecksum: input.provisioningPlan.planChecksum,
    mappings,
  }
  return { ...payload, bundleChecksum: sourceChecksum(payload) }
}
