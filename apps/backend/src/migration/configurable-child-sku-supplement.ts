import { MedusaError } from "@medusajs/framework/utils"
import {
  configurableChildSkuGraphqlQuery,
  parseConfigurableChildSkuGraphqlResponse,
  type ConfigurableChildSkuProbeResult,
} from "../reconstruction/configurable-child-sku-evidence"
import { sourceChecksum } from "./checksum"
import type { RecoveryProductCandidate } from "./recovery-candidates"

export type ConfigurableChildSkuSupplementRecord = {
  candidateKey: string
  parentSku: string
  parentSourceUrl: string
  legacyProductId?: string
  expectedChildIds: string[]
  parentPage?: {
    ok?: boolean
    status?: number
    finalUrl?: string
    contentType?: string
  }
  graphql?: {
    requestUrl?: string
    method?: string
    status?: number
    ok?: boolean
    contentType?: string
    responseChecksum?: string
    response?: unknown
  }
  parsed: ConfigurableChildSkuProbeResult
}

export type ConfigurableChildSkuSupplement = {
  schemaVersion: 1
  generatedAt: string
  captureId?: string
  captureEvidencePackageChecksum: string
  provenance: {
    mode: "operator_local_browser"
    transport: "browser_graphql_get"
    browserMode: "headed" | "headless"
    codeRevision?: string
    source: string
  }
  queryChecksum: string
  parentsSelected: number
  records: ConfigurableChildSkuSupplementRecord[]
  totals: {
    completeParents: number
    incompleteParents: number
    resolvedChildren: number
    unresolvedChildren: number
  }
  evidenceChecksum: string
}

export type ConfigurableChildSkuSupplementVerification = {
  valid: boolean
  errors: string[]
  recomputedEvidenceChecksum: string
  recomputedTotals: ConfigurableChildSkuSupplement["totals"]
}

export type ConfigurableChildSkuSupplementApplication = {
  candidates: RecoveryProductCandidate[]
  evidenceChecksum: string
  completeEvidenceParents: number
  appliedParents: number
  appliedChildren: number
  unresolvedRecords: Array<{
    candidateKey: string
    parentSku: string
    reasons: string[]
  }>
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function normalizedIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right, undefined, { numeric: true })
  )
}

function evidencePayload(value: ConfigurableChildSkuSupplement) {
  const { evidenceChecksum, ...payload } = value
  void evidenceChecksum
  return payload
}

function directGraphqlSource(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      url.hostname === "coquetteconcept.gr" &&
      url.pathname.replace(/\/+$/, "") === "/graphql"
    )
  } catch {
    return false
  }
}

function directParentSource(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      url.hostname === "coquetteconcept.gr" &&
      url.pathname.length > 1
    )
  } catch {
    return false
  }
}

export function verifyConfigurableChildSkuSupplement(input: {
  evidence: ConfigurableChildSkuSupplement
  expectedCaptureId?: string
  expectedEvidencePackageChecksum: string
}): ConfigurableChildSkuSupplementVerification {
  const { evidence } = input
  const errors: string[] = []

  if (evidence.schemaVersion !== 1) errors.push("child_sku_evidence_schema_version_1_required")
  if (!evidence.generatedAt || Number.isNaN(Date.parse(evidence.generatedAt))) {
    errors.push("child_sku_evidence_generated_at_invalid")
  }
  if (
    input.expectedCaptureId &&
    evidence.captureId !== input.expectedCaptureId
  ) {
    errors.push("child_sku_evidence_capture_id_mismatch")
  }
  if (
    evidence.captureEvidencePackageChecksum !==
    input.expectedEvidencePackageChecksum
  ) {
    errors.push("child_sku_evidence_capture_package_checksum_mismatch")
  }
  if (evidence.provenance?.mode !== "operator_local_browser") {
    errors.push("child_sku_evidence_operator_mode_required")
  }
  if (evidence.provenance?.transport !== "browser_graphql_get") {
    errors.push("child_sku_evidence_browser_graphql_transport_required")
  }
  if (
    evidence.provenance?.browserMode !== "headed" &&
    evidence.provenance?.browserMode !== "headless"
  ) {
    errors.push("child_sku_evidence_browser_mode_invalid")
  }
  if (!directGraphqlSource(evidence.provenance?.source ?? "")) {
    errors.push("child_sku_evidence_graphql_source_invalid")
  }
  if (evidence.queryChecksum !== sourceChecksum(configurableChildSkuGraphqlQuery())) {
    errors.push("child_sku_evidence_query_checksum_mismatch")
  }
  if (evidence.parentsSelected !== evidence.records.length) {
    errors.push("child_sku_evidence_parent_count_mismatch")
  }

  const recordKeys = evidence.records.map((record) => record.candidateKey)
  if (new Set(recordKeys).size !== recordKeys.length) {
    errors.push("child_sku_evidence_duplicate_candidate_records")
  }

  let completeParents = 0
  let resolvedChildren = 0
  let unresolvedChildren = 0

  for (const record of evidence.records) {
    if (!record.candidateKey?.trim()) {
      errors.push("child_sku_record_candidate_key_required")
      continue
    }
    if (!record.parentSku?.trim()) {
      errors.push(`child_sku_record_parent_sku_required:${record.candidateKey}`)
    }
    if (!directParentSource(record.parentSourceUrl)) {
      errors.push(`child_sku_record_parent_source_invalid:${record.candidateKey}`)
    }
    if (record.graphql?.method && record.graphql.method !== "GET") {
      errors.push(`child_sku_record_graphql_method_not_get:${record.candidateKey}`)
    }

    const expectedIds = normalizedIds(record.expectedChildIds ?? [])
    if (expectedIds.length === 0) {
      errors.push(`child_sku_record_expected_ids_required:${record.candidateKey}`)
    }

    if (record.graphql?.response !== undefined) {
      const recomputed = parseConfigurableChildSkuGraphqlResponse({
        parentSku: record.parentSku,
        expectedSourceProductIds: expectedIds,
        response: record.graphql.response,
      })
      if (sourceChecksum(recomputed) !== sourceChecksum(record.parsed)) {
        errors.push(`child_sku_record_parsed_response_mismatch:${record.candidateKey}`)
      }
      if (
        record.graphql.responseChecksum &&
        record.graphql.responseChecksum !== sourceChecksum(record.graphql.response)
      ) {
        errors.push(`child_sku_record_response_checksum_mismatch:${record.candidateKey}`)
      }
    } else if (record.parsed.complete) {
      errors.push(`child_sku_record_complete_without_raw_response:${record.candidateKey}`)
    }

    if (record.parsed.parentSku !== record.parentSku.trim()) {
      errors.push(`child_sku_record_parsed_parent_mismatch:${record.candidateKey}`)
    }
    if (record.parsed.complete) completeParents += 1
    resolvedChildren += record.parsed.resolved.length
    unresolvedChildren += record.parsed.unresolvedSourceProductIds.length
  }

  const recomputedTotals = {
    completeParents,
    incompleteParents: evidence.records.length - completeParents,
    resolvedChildren,
    unresolvedChildren,
  }
  if (sourceChecksum(evidence.totals) !== sourceChecksum(recomputedTotals)) {
    errors.push("child_sku_evidence_totals_mismatch")
  }

  const recomputedEvidenceChecksum = sourceChecksum(evidencePayload(evidence))
  if (evidence.evidenceChecksum !== recomputedEvidenceChecksum) {
    errors.push("child_sku_evidence_checksum_mismatch")
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)].sort(),
    recomputedEvidenceChecksum,
    recomputedTotals,
  }
}

export function applyConfigurableChildSkuSupplement(input: {
  candidates: RecoveryProductCandidate[]
  evidence: ConfigurableChildSkuSupplement
  expectedCaptureId?: string
  expectedEvidencePackageChecksum: string
}): ConfigurableChildSkuSupplementApplication {
  const verification = verifyConfigurableChildSkuSupplement({
    evidence: input.evidence,
    expectedCaptureId: input.expectedCaptureId,
    expectedEvidencePackageChecksum: input.expectedEvidencePackageChecksum,
  })
  if (!verification.valid) {
    throw unexpected(
      `Configurable child SKU supplemental evidence is invalid: ${verification.errors.join(", ")}`
    )
  }

  const byCandidateKey = new Map(
    input.candidates.map((candidate) => [candidate.candidateKey, candidate])
  )
  const replacements = new Map<string, RecoveryProductCandidate>()
  const unresolvedRecords: ConfigurableChildSkuSupplementApplication["unresolvedRecords"] = []
  let appliedParents = 0
  let appliedChildren = 0

  for (const record of input.evidence.records) {
    if (!record.parsed.complete) {
      unresolvedRecords.push({
        candidateKey: record.candidateKey,
        parentSku: record.parentSku,
        reasons: record.parsed.issues.length
          ? record.parsed.issues
          : ["supplement_record_incomplete"],
      })
      continue
    }

    const candidate = byCandidateKey.get(record.candidateKey)
    const reasons: string[] = []
    if (!candidate) reasons.push("candidate_not_found")
    if (
      candidate?.selected.sku?.trim().toLowerCase() !==
      record.parentSku.trim().toLowerCase()
    ) {
      reasons.push("parent_sku_mismatch")
    }
    if (candidate?.selected.sourceId?.trim() !== record.parentSourceUrl.trim()) {
      reasons.push("parent_source_url_mismatch")
    }
    if (candidate?.selected.type !== "configurable") {
      reasons.push("candidate_not_configurable")
    }
    if (candidate?.selected.configurableVariantMatrixComplete !== true) {
      reasons.push("archived_configurable_matrix_incomplete")
    }

    const variants = candidate?.selected.configurableVariants ?? []
    const currentIds = normalizedIds(
      variants.map((variant) => variant.sourceProductId)
    )
    const expectedIds = normalizedIds(record.expectedChildIds)
    if (sourceChecksum(currentIds) !== sourceChecksum(expectedIds)) {
      reasons.push("archived_child_id_set_mismatch")
    }

    const resolvedById = new Map(
      record.parsed.resolved.map((entry) => [entry.sourceProductId, entry.sku])
    )
    if (resolvedById.size !== variants.length) {
      reasons.push("resolved_child_count_mismatch")
    }
    for (const variant of variants) {
      const sku = resolvedById.get(variant.sourceProductId)?.trim()
      if (!sku) {
        reasons.push(`resolved_child_sku_missing:${variant.sourceProductId}`)
      } else if (
        variant.sku?.trim() &&
        variant.sku.trim().toLowerCase() !== sku.toLowerCase()
      ) {
        reasons.push(`existing_child_sku_conflict:${variant.sourceProductId}`)
      }
    }

    if (!candidate || reasons.length > 0) {
      unresolvedRecords.push({
        candidateKey: record.candidateKey,
        parentSku: record.parentSku,
        reasons: [...new Set(reasons)].sort(),
      })
      continue
    }

    const enrichedVariants = variants.map((variant) => ({
      ...variant,
      sku: resolvedById.get(variant.sourceProductId)!.trim(),
    }))
    replacements.set(candidate.candidateKey, {
      ...candidate,
      selected: {
        ...candidate.selected,
        configurableVariants: enrichedVariants,
      },
      normalizedProduct: candidate.normalizedProduct
        ? {
            ...candidate.normalizedProduct,
            configurableVariants: enrichedVariants,
          }
        : undefined,
      evidence: [
        ...candidate.evidence,
        {
          sourceUrl: input.evidence.provenance.source,
          capturedAt: input.evidence.generatedAt,
          grade: "direct",
          note: `Supplemental Magento GraphQL child-SKU identity evidence checksum=${input.evidence.evidenceChecksum}; parent=${record.parentSku}`,
        },
      ],
    })
    appliedParents += 1
    appliedChildren += enrichedVariants.length
  }

  return {
    candidates: input.candidates.map(
      (candidate) => replacements.get(candidate.candidateKey) ?? candidate
    ),
    evidenceChecksum: input.evidence.evidenceChecksum,
    completeEvidenceParents: verification.recomputedTotals.completeParents,
    appliedParents,
    appliedChildren,
    unresolvedRecords,
  }
}
