import { sourceChecksum } from "./checksum"
import { buildProductImportPlan, type ProductImportPlan } from "./import-plan"
import type {
  RecoveryCandidateConflict,
  RecoveryProductCandidate,
} from "./recovery-candidates"
import type {
  NormalizedStorefrontProduct,
  StagingTargetPublicationPolicy,
} from "./types"

export const stagingTargetPublicationPolicy: StagingTargetPublicationPolicy = {
  schemaVersion: 1,
  provenance: "migration_target_policy",
  target: "staging",
  status: "disabled",
  visibility: "not_visible",
  medusaStatus: "draft",
  rationale:
    "Phase 4 real-data imports are quarantined as draft/not-visible until catalogue acceptance and UAT explicitly promote them.",
}

export type StagingTargetPolicyQuarantine = {
  candidateKey: string
  sku?: string
  reasons: string[]
}

export type StagingTargetPolicyApplication = {
  schemaVersion: 1
  sourceCandidatesChecksum: string
  policyChecksum: string
  policy: StagingTargetPublicationPolicy
  sourceCandidateCount: number
  eligibleCandidateCount: number
  quarantinedCandidateCount: number
  quarantined: StagingTargetPolicyQuarantine[]
  productPlan: ProductImportPlan
  isExecutable: boolean
}

const publicationFields = new Set(["status", "visibility"])
const nonStructuralConflictFields = new Set([
  "status",
  "visibility",
  "regularPrice",
  "salePrice",
  "currencyCode",
  "stockState",
  "lowStockMessage",
])

function validTimestamp(value: string) {
  return value !== "unknown" && Number.isFinite(Date.parse(value))
}

function capturedAt(candidate: RecoveryProductCandidate) {
  return candidate.evidence
    .map((entry) => entry.capturedAt)
    .filter(validTimestamp)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0]
}

function structuralMissingFields(candidate: RecoveryProductCandidate) {
  return candidate.missingRequiredFields.filter(
    (field) => !publicationFields.has(field)
  )
}

function structuralConflicts(candidate: RecoveryProductCandidate) {
  return candidate.conflicts.filter(
    (conflict) => !nonStructuralConflictFields.has(conflict.field)
  )
}

function quarantineReasons(candidate: RecoveryProductCandidate) {
  const reasons: string[] = []
  if (candidate.disposition === "rejected") reasons.push("rejected_recovery_candidate")
  if (candidate.selected.type !== "simple") {
    reasons.push(`non_simple_product:${candidate.selected.type ?? "missing"}`)
  }
  for (const field of structuralMissingFields(candidate)) {
    reasons.push(`missing_structural_field:${field}`)
  }
  for (const blocker of candidate.blockers) {
    reasons.push(`source_blocker:${blocker}`)
  }
  for (const conflict of structuralConflicts(candidate)) {
    reasons.push(`structural_conflict:${conflict.field}`)
  }
  return [...new Set(reasons)].sort()
}

function targetNormalizedProduct(
  candidate: RecoveryProductCandidate
): NormalizedStorefrontProduct {
  return {
    ...(candidate.selected as Omit<
      NormalizedStorefrontProduct,
      "status" | "visibility" | "evidence" | "capturedAt" | "targetPublicationPolicy"
    >),
    status: stagingTargetPublicationPolicy.status,
    visibility: stagingTargetPublicationPolicy.visibility,
    targetPublicationPolicy: stagingTargetPublicationPolicy,
    evidence: candidate.evidence,
    capturedAt: capturedAt(candidate),
  }
}

function stagedCandidate(candidate: RecoveryProductCandidate): RecoveryProductCandidate {
  return {
    ...candidate,
    disposition: "ready",
    normalizedProduct: targetNormalizedProduct(candidate),
    missingRequiredFields: structuralMissingFields(candidate),
    conflicts: candidate.conflicts.filter((conflict) =>
      publicationFields.has(conflict.field) ? false : true
    ),
  }
}

function duplicateValues(values: Array<string | undefined>) {
  const counts = new Map<string, number>()
  for (const value of values) {
    const normalized = value?.trim()
    if (!normalized) continue
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort()
}

function quarantine(
  target: StagingTargetPolicyQuarantine[],
  candidate: RecoveryProductCandidate,
  reasons: string[]
) {
  target.push({
    candidateKey: candidate.candidateKey,
    sku: candidate.selected.sku,
    reasons: [...new Set(reasons)].sort(),
  })
}

export function buildStagingTargetPolicyApplication(
  candidates: RecoveryProductCandidate[]
): StagingTargetPolicyApplication {
  const quarantined: StagingTargetPolicyQuarantine[] = []
  const duplicateCandidateKeys = new Set(
    duplicateValues(candidates.map((candidate) => candidate.candidateKey))
  )
  const structurallyEligible: RecoveryProductCandidate[] = []

  for (const candidate of candidates) {
    const reasons = quarantineReasons(candidate)
    if (duplicateCandidateKeys.has(candidate.candidateKey)) {
      reasons.push("duplicate_candidate_key")
    }
    if (reasons.length > 0) {
      quarantine(quarantined, candidate, reasons)
      continue
    }
    structurallyEligible.push(stagedCandidate(candidate))
  }

  const provisionalPlan = buildProductImportPlan(structurallyEligible)
  const candidateByKey = new Map(
    structurallyEligible.map((candidate) => [candidate.candidateKey, candidate])
  )
  const finalCandidates: RecoveryProductCandidate[] = []

  for (const entry of provisionalPlan.entries) {
    const candidate = candidateByKey.get(entry.candidateKey)
    if (!candidate) continue
    if (entry.state === "ready") {
      finalCandidates.push(candidate)
      continue
    }
    quarantine(quarantined, candidate, [
      ...entry.blockers.map((value) => `plan_blocker:${value}`),
      ...entry.errors.map((value) => `plan_error:${value}`),
    ])
  }

  const productPlan = buildProductImportPlan(finalCandidates)
  const normalizedQuarantine = quarantined
    .sort((left, right) => left.candidateKey.localeCompare(right.candidateKey))

  return {
    schemaVersion: 1,
    sourceCandidatesChecksum: sourceChecksum(candidates),
    policyChecksum: sourceChecksum(stagingTargetPublicationPolicy),
    policy: stagingTargetPublicationPolicy,
    sourceCandidateCount: candidates.length,
    eligibleCandidateCount: finalCandidates.length,
    quarantinedCandidateCount: normalizedQuarantine.length,
    quarantined: normalizedQuarantine,
    productPlan,
    isExecutable: finalCandidates.length > 0 && productPlan.isExecutable,
  }
}
