import { sourceChecksum } from "./checksum"
import type {
  NormalizedStorefrontProduct,
  ReconstructionEvidence,
} from "./types"

export const recoveryEvidenceAuthorities = [
  "authoritative_magento",
  "direct_storefront",
  "public_search_index",
  "derived",
] as const

export type RecoveryEvidenceAuthority =
  (typeof recoveryEvidenceAuthorities)[number]

export type RecoveryCandidateDisposition =
  | "ready"
  | "needs_review"
  | "rejected"

export type RecoveryConflictSeverity = "review" | "critical"

export type RecoveryConflictReason =
  | "same_authority_conflict"
  | "cross_authority_conflict"
  | "unsafe_field_authority"
  | "invalid_value"

export type RecoveryProductFields = Partial<
  Pick<
    NormalizedStorefrontProduct,
    | "sourceId"
    | "canonicalUrl"
    | "alternateLocaleUrl"
    | "sku"
    | "name"
    | "status"
    | "visibility"
    | "type"
    | "urlKey"
    | "description"
    | "shortDescription"
    | "brandSourceId"
    | "categorySourceIds"
    | "optionValues"
    | "mediaSourceIds"
    | "configurableVariants"
    | "configurableVariantMatrixComplete"
    | "stockState"
    | "lowStockMessage"
    | "regularPrice"
    | "salePrice"
    | "currencyCode"
  >
>

export type RecoveryProductObservation = {
  authority: RecoveryEvidenceAuthority
  sourceUrl: string
  observedAt?: string
  freshnessLabel?: string
  note?: string
  fields: RecoveryProductFields
}

export type RecoveryConflictObservation = {
  authority: RecoveryEvidenceAuthority
  sourceUrl: string
  observedAt?: string
  freshnessLabel?: string
  value: unknown
}

export type RecoveryCandidateConflict = {
  field: string
  severity: RecoveryConflictSeverity
  reason: RecoveryConflictReason
  observations: RecoveryConflictObservation[]
  message: string
}

export type RecoveryProductCandidate = {
  candidateKey: string
  disposition: RecoveryCandidateDisposition
  selected: RecoveryProductFields
  normalizedProduct?: NormalizedStorefrontProduct
  evidence: ReconstructionEvidence[]
  missingRequiredFields: string[]
  blockers: string[]
  conflicts: RecoveryCandidateConflict[]
}

const authorityRank: Record<RecoveryEvidenceAuthority, number> = {
  authoritative_magento: 4,
  direct_storefront: 3,
  public_search_index: 2,
  derived: 1,
}

const candidateFields = [
  "sourceId",
  "canonicalUrl",
  "alternateLocaleUrl",
  "sku",
  "name",
  "status",
  "visibility",
  "type",
  "urlKey",
  "description",
  "shortDescription",
  "brandSourceId",
  "categorySourceIds",
  "optionValues",
  "mediaSourceIds",
  "configurableVariants",
  "configurableVariantMatrixComplete",
  "stockState",
  "lowStockMessage",
  "regularPrice",
  "salePrice",
  "currencyCode",
] as const satisfies readonly (keyof RecoveryProductFields)[]

const requiredFields = [
  "sourceId",
  "sku",
  "name",
  "status",
  "visibility",
  "type",
  "categorySourceIds",
  "optionValues",
  "mediaSourceIds",
] as const satisfies readonly (keyof RecoveryProductFields)[]

const criticalConflictFields = new Set<keyof RecoveryProductFields>([
  "sourceId",
  "sku",
  "type",
  "configurableVariants",
  "configurableVariantMatrixComplete",
  "regularPrice",
  "salePrice",
  "currencyCode",
])

const nonStructuralRecoveryFields = new Set<keyof RecoveryProductFields>([
  "regularPrice",
  "salePrice",
  "currencyCode",
  "stockState",
  "lowStockMessage",
])

function timestamp(value?: string) {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function hasUsableValue(value: unknown) {
  if (value === undefined || value === null) return false
  if (typeof value === "string") return value.trim().length > 0
  return true
}

function fieldValue(
  observation: RecoveryProductObservation,
  field: keyof RecoveryProductFields
) {
  return (observation.fields as Record<string, unknown>)[field]
}

function evidenceGrade(
  authority: RecoveryEvidenceAuthority
): ReconstructionEvidence["grade"] {
  if (authority === "authoritative_magento" || authority === "direct_storefront") {
    return "direct"
  }
  if (authority === "public_search_index") return "derived"
  return "inferred"
}

function selectedCapturedAt(observations: RecoveryProductObservation[]) {
  const dated = observations
    .map((observation) => observation.observedAt)
    .filter((value): value is string => Boolean(value) && timestamp(value) > 0)
    .sort((left, right) => timestamp(right) - timestamp(left))
  return dated[0]
}

function conflictObservation(
  observation: RecoveryProductObservation,
  field: keyof RecoveryProductFields
): RecoveryConflictObservation {
  return {
    authority: observation.authority,
    sourceUrl: observation.sourceUrl,
    observedAt: observation.observedAt,
    freshnessLabel: observation.freshnessLabel,
    value: fieldValue(observation, field),
  }
}

function buildEvidence(
  observations: RecoveryProductObservation[]
): ReconstructionEvidence[] {
  return observations.map((observation) => ({
    sourceUrl: observation.sourceUrl,
    capturedAt: observation.observedAt ?? "unknown",
    grade: evidenceGrade(observation.authority),
    note: [
      `recovery authority=${observation.authority}`,
      observation.freshnessLabel
        ? `freshness=${observation.freshnessLabel}`
        : undefined,
      observation.note,
    ]
      .filter(Boolean)
      .join("; "),
  }))
}

function isStructuralConflict(conflict: RecoveryCandidateConflict) {
  return !nonStructuralRecoveryFields.has(
    conflict.field as keyof RecoveryProductFields
  )
}

export function buildRecoveryProductCandidate(
  candidateKey: string,
  observations: RecoveryProductObservation[]
): RecoveryProductCandidate {
  if (!candidateKey.trim() || observations.length === 0) {
    return {
      candidateKey,
      disposition: "rejected",
      selected: {},
      evidence: buildEvidence(observations),
      missingRequiredFields: [],
      blockers: [
        !candidateKey.trim() ? "candidate_key_required" : "observation_required",
      ],
      conflicts: [],
    }
  }

  const ordered = [...observations].sort((left, right) => {
    const authorityDifference =
      authorityRank[right.authority] - authorityRank[left.authority]
    if (authorityDifference !== 0) return authorityDifference
    return timestamp(right.observedAt) - timestamp(left.observedAt)
  })

  const selectedRecord: Record<string, unknown> = {}
  const conflicts: RecoveryCandidateConflict[] = []

  for (const field of candidateFields) {
    const relevant = ordered.filter((observation) =>
      hasUsableValue(fieldValue(observation, field))
    )
    if (relevant.length === 0) continue

    const highestRank = Math.max(
      ...relevant.map((observation) => authorityRank[observation.authority])
    )
    const highestAuthorityObservations = relevant.filter(
      (observation) => authorityRank[observation.authority] === highestRank
    )
    const selectedObservation = highestAuthorityObservations[0]
    const selectedValue = fieldValue(selectedObservation, field)

    if (
      field === "stockState" &&
      authorityRank[selectedObservation.authority] <
        authorityRank.direct_storefront
    ) {
      conflicts.push({
        field,
        severity: "critical",
        reason: "unsafe_field_authority",
        observations: relevant.map((observation) =>
          conflictObservation(observation, field)
        ),
        message:
          "Stock state cannot be accepted automatically from indexed or derived evidence.",
      })
      continue
    }

    selectedRecord[field] = selectedValue

    const distinct = new Map<string, RecoveryProductObservation[]>()
    for (const observation of relevant) {
      const digest = sourceChecksum(fieldValue(observation, field))
      const grouped = distinct.get(digest) ?? []
      grouped.push(observation)
      distinct.set(digest, grouped)
    }

    if (distinct.size <= 1) continue

    const highestAuthorityDistinct = new Set(
      highestAuthorityObservations.map((observation) =>
        sourceChecksum(fieldValue(observation, field))
      )
    )
    const sameAuthorityConflict = highestAuthorityDistinct.size > 1

    conflicts.push({
      field,
      severity: criticalConflictFields.has(field) ? "critical" : "review",
      reason: sameAuthorityConflict
        ? "same_authority_conflict"
        : "cross_authority_conflict",
      observations: relevant.map((observation) =>
        conflictObservation(observation, field)
      ),
      message: sameAuthorityConflict
        ? `Multiple equally authoritative observations disagree on ${field}.`
        : `Evidence sources disagree on ${field}; the stronger source is selected but review is required.`,
    })
  }

  const selected = selectedRecord as RecoveryProductFields
  const missingRequiredFields = requiredFields
    .filter((field) => !hasUsableValue(selected[field]))
    .map(String)

  const blockers: string[] = []
  const strongObservations = observations.filter(
    (observation) =>
      authorityRank[observation.authority] >= authorityRank.direct_storefront
  )
  if (strongObservations.length === 0) {
    blockers.push("direct_or_authoritative_evidence_required")
  } else if (!strongObservations.some((observation) => timestamp(observation.observedAt) > 0)) {
    blockers.push("timestamped_direct_or_authoritative_evidence_required")
  }

  if (selected.type === "unknown") blockers.push("product_type_requires_mapping")

  if (
    selected.regularPrice !== undefined &&
    selected.salePrice !== undefined &&
    selected.salePrice > selected.regularPrice
  ) {
    conflicts.push({
      field: "salePrice",
      severity: "critical",
      reason: "invalid_value",
      observations: ordered
        .filter((observation) =>
          hasUsableValue(fieldValue(observation, "salePrice"))
        )
        .map((observation) => conflictObservation(observation, "salePrice")),
      message: "Sale price cannot exceed regular price without manual review.",
    })
  }

  const structuralConflicts = conflicts.filter(isStructuralConflict)
  const disposition: RecoveryCandidateDisposition =
    missingRequiredFields.length > 0 ||
    blockers.length > 0 ||
    structuralConflicts.length > 0
      ? "needs_review"
      : "ready"

  const evidence = buildEvidence(observations)
  const capturedAt = selectedCapturedAt(observations)

  const normalizedProduct =
    disposition === "ready"
      ? ({
          ...selected,
          evidence,
          capturedAt,
        } as NormalizedStorefrontProduct)
      : undefined

  return {
    candidateKey,
    disposition,
    selected,
    normalizedProduct,
    evidence,
    missingRequiredFields,
    blockers,
    conflicts,
  }
}
