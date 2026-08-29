import { MedusaError } from "@medusajs/framework/utils"
import { sourceChecksum } from "./checksum"
import type { StagingSliceDependencyEvidencePlan } from "./staging-slice-dependency-evidence"
import {
  stagingSliceDependencyEvidencePlanChecksum,
  type StagingSliceDependencyProvisioningManifestEntry,
} from "./staging-slice-dependency-provisioning"

export type StagingSliceDependencyRollbackAction = "delete" | "skip" | "blocked"

export type StagingSliceDependencyRollbackEntry = {
  entityType: "category" | "media" | "brand"
  sourceId: string
  evidenceChecksum: string
  action: StagingSliceDependencyRollbackAction
  blockers: string[]
  targetId?: string
  targetUrl?: string
}

export type StagingSliceDependencyRollbackPlan = {
  schemaVersion: 1
  captureId: string
  sourceDependencyEvidencePlanChecksum: string
  entries: StagingSliceDependencyRollbackEntry[]
  totals: Record<StagingSliceDependencyRollbackAction, number>
  duplicateManifestKeys: string[]
  unknownManifestKeys: string[]
  globalBlockers: string[]
  isExecutable: boolean
  planChecksum: string
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

export function stagingSliceDependencyRollbackPlanChecksum(
  plan: Omit<StagingSliceDependencyRollbackPlan, "planChecksum">
) {
  return sourceChecksum(plan)
}

export function buildStagingSliceDependencyRollbackPlan(input: {
  evidencePlan: StagingSliceDependencyEvidencePlan
  expectedEvidencePlanChecksum?: string
  manifestEntries: StagingSliceDependencyProvisioningManifestEntry[]
  allowedMediaHosts: string[]
}): StagingSliceDependencyRollbackPlan {
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

  const evidenceByKey = new Map(
    input.evidencePlan.entries.map((entry) => [
      dependencyKey(entry.entityType, entry.sourceId),
      entry,
    ])
  )
  const manifestKeys = input.manifestEntries.map((entry) =>
    dependencyKey(entry.entityType, entry.sourceId)
  )
  const duplicateManifestKeys = duplicateValues(manifestKeys)
  if (duplicateManifestKeys.length > 0) {
    globalBlockers.push("duplicate_dependency_manifest_keys")
  }
  const unknownManifestKeys = [...new Set(manifestKeys)]
    .filter((key) => !evidenceByKey.has(key))
    .sort()
  if (unknownManifestKeys.length > 0) {
    globalBlockers.push("manifest_contains_unknown_dependency_keys")
  }

  const allowedMediaHosts = new Set(
    input.allowedMediaHosts.map((host) => host.trim().toLowerCase()).filter(Boolean)
  )
  if (allowedMediaHosts.size === 0) {
    globalBlockers.push("allowed_media_hosts_required")
  }
  if (allowedMediaHosts.has("coquetteconcept.gr")) {
    globalBlockers.push("legacy_host_cannot_be_serving_media_host")
  }

  const manifestByKey = new Map(
    input.manifestEntries.map((entry) => [
      dependencyKey(entry.entityType, entry.sourceId),
      entry,
    ])
  )

  const entries = input.evidencePlan.entries.map((evidence) => {
    const blockers = [...globalBlockers]
    const manifest = manifestByKey.get(
      dependencyKey(evidence.entityType, evidence.sourceId)
    )
    let action: StagingSliceDependencyRollbackAction = "skip"

    if (manifest) {
      if (manifest.evidenceChecksum !== evidence.evidenceChecksum) {
        blockers.push("dependency_evidence_changed_requires_reconciliation")
      }
      if (evidence.entityType === "brand" && manifest.targetId) {
        blockers.push("brand_dependency_rollback_not_supported")
      } else if (evidence.entityType === "category" && manifest.targetId?.trim()) {
        action = "delete"
      } else if (evidence.entityType === "media" && manifest.targetId?.trim()) {
        if (
          !safeHttpsUrlOnAllowedHost(manifest.targetUrl, allowedMediaHosts)
        ) {
          blockers.push("media_target_url_missing_or_not_allowed")
        } else {
          action = "delete"
        }
      } else if (manifest.status === "imported") {
        blockers.push("imported_dependency_target_missing")
      }
    }

    const uniqueBlockers = [...new Set(blockers)].sort()
    if (uniqueBlockers.length > 0) action = "blocked"
    return {
      entityType: evidence.entityType,
      sourceId: evidence.sourceId,
      evidenceChecksum: evidence.evidenceChecksum,
      action,
      blockers: uniqueBlockers,
      targetId: manifest?.targetId,
      targetUrl: manifest?.targetUrl,
    }
  })

  entries.sort((left, right) =>
    dependencyKey(left.entityType, left.sourceId).localeCompare(
      dependencyKey(right.entityType, right.sourceId)
    )
  )
  const totals = Object.fromEntries(
    (["delete", "skip", "blocked"] as const).map((action) => [
      action,
      entries.filter((entry) => entry.action === action).length,
    ])
  ) as Record<StagingSliceDependencyRollbackAction, number>

  const withoutChecksum: Omit<StagingSliceDependencyRollbackPlan, "planChecksum"> = {
    schemaVersion: 1,
    captureId: input.evidencePlan.captureId,
    sourceDependencyEvidencePlanChecksum: input.evidencePlan.planChecksum,
    entries,
    totals,
    duplicateManifestKeys,
    unknownManifestKeys,
    globalBlockers: [...new Set(globalBlockers)].sort(),
    isExecutable:
      totals.blocked === 0 &&
      duplicateManifestKeys.length === 0 &&
      unknownManifestKeys.length === 0 &&
      globalBlockers.length === 0,
  }
  return {
    ...withoutChecksum,
    planChecksum: stagingSliceDependencyRollbackPlanChecksum(withoutChecksum),
  }
}

export function assertExecutableStagingSliceDependencyRollbackPlan(
  plan: StagingSliceDependencyRollbackPlan
) {
  if (!plan.isExecutable || plan.totals.blocked > 0) {
    throw unexpected("Staging dependency rollback plan is blocked")
  }
}
