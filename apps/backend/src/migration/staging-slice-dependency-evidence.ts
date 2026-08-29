import { createHash } from "node:crypto"
import { lstat, readFile, realpath } from "node:fs/promises"
import { isAbsolute, join, relative, resolve, sep } from "node:path"
import { MedusaError } from "@medusajs/framework/utils"
import type { CaptureEvidencePackage } from "./capture-evidence-package"
import { sourceChecksum } from "./checksum"
import type { ProductImportPlan } from "./import-plan"
import type { RecoveryProductCandidate } from "./recovery-candidates"
import {
  buildStagingTargetPolicyApplication,
  stagingTargetPolicyBundleChecksum,
  type StagingTargetPolicyApplication,
  type StagingTargetPolicyBundlePayload,
} from "./staging-target-policy"
import type { MigrationDependencyEntityType } from "./staging-product-execution"

export type StagingTargetPolicyBundle = StagingTargetPolicyBundlePayload & {
  bundleChecksum: string
}

export type StagingSliceDependencyRequirement = {
  entityType: MigrationDependencyEntityType
  sourceId: string
  candidateKeys: string[]
  requirementChecksum: string
}

type CategoryEvidence = {
  name: string
  productSourceIds: string[]
}

type BrandEvidence = {
  name: string
  productSourceIds: string[]
}

type MediaEvidence = {
  mediaFile: string
  contentType: string
  bytes: number
  checksum: string
}

export type StagingSliceDependencyEvidenceEntry =
  StagingSliceDependencyRequirement & {
    state: "ready" | "blocked"
    blockers: string[]
    evidenceChecksum: string
    category?: CategoryEvidence
    brand?: BrandEvidence
    media?: MediaEvidence
  }

export type StagingSliceDependencyEvidencePlan = {
  schemaVersion: 1
  captureId: string
  captureEvidencePackageChecksum: string
  sourceIngestionReportChecksum: string
  stagingTargetPolicyBundleChecksum: string
  requirementsChecksum: string
  entries: StagingSliceDependencyEvidenceEntry[]
  totals: { ready: number; blocked: number }
  globalBlockers: string[]
  planChecksum: string
  isReadyForProvisioning: boolean
  isExecutable: false
}

type ProductStructureRecord = {
  categoryReferences?: Array<{ name?: string; url?: string }>
}

export type StagingSliceSourceIngestionReport = {
  schemaVersion?: number
  capture?: {
    captureId?: string
    evidencePackage?: {
      isValid?: boolean
      packageChecksum?: string
      provenanceMode?: string
      transport?: string
      browserMode?: string
    }
  }
  candidates?: { records?: RecoveryProductCandidate[] }
  productStructure?: { records?: Record<string, ProductStructureRecord> }
}

export type StagingSliceMediaRecord = {
  sourceUrl?: string
  status?: "captured" | "skipped" | "error"
  contentType?: string
  bytes?: number
  checksum?: string
  mediaFile?: string
}

export type StagingSliceProductRecord = {
  sourceUrl?: string
  brand?: string
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function normalizedRelativePath(value: string | undefined) {
  return value?.replace(/\\/g, "/").trim() || undefined
}

function safeRelativePath(value: string | undefined) {
  const normalized = normalizedRelativePath(value)
  if (!normalized) return false
  return (
    !normalized.startsWith("/") &&
    !normalized.split("/").includes("..") &&
    !/^[a-zA-Z]:\//.test(normalized)
  )
}

function normalizedUrl(value: string | undefined) {
  if (!value?.trim()) return undefined
  try {
    const url = new URL(value.trim())
    url.hash = ""
    url.pathname = url.pathname.replace(/\/+$/, "") || "/"
    return url.toString()
  } catch {
    return undefined
  }
}

function sameUrl(left: string | undefined, right: string | undefined) {
  const normalizedLeft = normalizedUrl(left)
  const normalizedRight = normalizedUrl(right)
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}

function uniqueStrings(values: Array<string | undefined>) {
  return [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ]
}

function dependencyKey(entityType: MigrationDependencyEntityType, sourceId: string) {
  return `${entityType}:${encodeURIComponent(sourceId)}`
}

export function buildStagingSliceDependencyRequirements(
  productPlan: ProductImportPlan
): StagingSliceDependencyRequirement[] {
  const requirements = new Map<
    string,
    {
      entityType: MigrationDependencyEntityType
      sourceId: string
      candidateKeys: Set<string>
    }
  >()

  const push = (
    entityType: MigrationDependencyEntityType,
    sourceId: string,
    candidateKey: string
  ) => {
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

  for (const entry of productPlan.entries) {
    if (entry.state !== "ready" || !entry.normalizedProduct) continue
    const product = entry.normalizedProduct
    product.categorySourceIds.forEach((sourceId) =>
      push("category", sourceId, entry.candidateKey)
    )
    product.mediaSourceIds.forEach((sourceId) =>
      push("media", sourceId, entry.candidateKey)
    )
    if (product.brandSourceId) {
      push("brand", product.brandSourceId, entry.candidateKey)
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

function productEvidenceSourceIdsForRequirement(
  productPlan: ProductImportPlan,
  requirement: StagingSliceDependencyRequirement
) {
  return uniqueStrings(
    requirement.candidateKeys.flatMap((candidateKey) => {
      const product = productPlan.entries.find(
        (entry) => entry.candidateKey === candidateKey
      )?.normalizedProduct
      if (!product) return []
      return [product.sourceId, ...product.evidence.map((entry) => entry.sourceUrl)]
    })
  ).sort()
}

function categoryEntry(input: {
  requirement: StagingSliceDependencyRequirement
  productPlan: ProductImportPlan
  structures: Record<string, ProductStructureRecord>
}): StagingSliceDependencyEvidenceEntry {
  const productSourceIds = productEvidenceSourceIdsForRequirement(
    input.productPlan,
    input.requirement
  )
  const names = uniqueStrings(
    productSourceIds.flatMap((sourceId) =>
      (input.structures[sourceId]?.categoryReferences ?? [])
        .filter((reference) => sameUrl(reference.url, input.requirement.sourceId))
        .map((reference) => reference.name)
    )
  )
  const blockers: string[] = []
  if (productSourceIds.length === 0) {
    blockers.push("category_evidence_product_source_missing")
  }
  if (names.length === 0) blockers.push("category_public_name_missing")
  if (names.length > 1) blockers.push("category_public_name_conflict")
  const category = blockers.length === 0
    ? { name: names[0], productSourceIds }
    : undefined
  const evidenceChecksum = sourceChecksum({
    requirementChecksum: input.requirement.requirementChecksum,
    productSourceIds,
    names,
    blockers,
  })
  return {
    ...input.requirement,
    state: blockers.length ? "blocked" : "ready",
    blockers,
    evidenceChecksum,
    ...(category ? { category } : {}),
  }
}

function brandEntry(input: {
  requirement: StagingSliceDependencyRequirement
  productPlan: ProductImportPlan
  products: StagingSliceProductRecord[]
}): StagingSliceDependencyEvidenceEntry {
  const productSourceIds = productEvidenceSourceIdsForRequirement(
    input.productPlan,
    input.requirement
  )
  const names = uniqueStrings(
    productSourceIds.flatMap((sourceId) =>
      input.products
        .filter((product) => sameUrl(product.sourceUrl, sourceId))
        .map((product) => product.brand)
    )
  )
  const blockers: string[] = []
  if (productSourceIds.length === 0) {
    blockers.push("brand_evidence_product_source_missing")
  }
  if (names.length === 0) blockers.push("brand_public_name_missing")
  if (names.length > 1) blockers.push("brand_public_name_conflict")
  const brand = blockers.length === 0
    ? { name: names[0], productSourceIds }
    : undefined
  const evidenceChecksum = sourceChecksum({
    requirementChecksum: input.requirement.requirementChecksum,
    productSourceIds,
    names,
    blockers,
  })
  return {
    ...input.requirement,
    state: blockers.length ? "blocked" : "ready",
    blockers,
    evidenceChecksum,
    ...(brand ? { brand } : {}),
  }
}

async function containedCaptureFile(captureDir: string, relativePath: string) {
  const normalized = normalizedRelativePath(relativePath)
  if (!normalized || !safeRelativePath(normalized)) return undefined
  try {
    const root = await realpath(resolve(captureDir))
    const candidate = await realpath(join(root, normalized))
    const relation = relative(root, candidate)
    if (
      relation === ".." ||
      relation.startsWith(`..${sep}`) ||
      isAbsolute(relation)
    ) {
      return undefined
    }
    const metadata = await lstat(candidate)
    if (!metadata.isFile() || metadata.isSymbolicLink()) return undefined
    return candidate
  } catch {
    return undefined
  }
}

function detectedImageContentType(value: Buffer) {
  if (
    value.length >= 8 &&
    value.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return "image/png"
  }
  if (
    value.length >= 3 &&
    value[0] === 0xff &&
    value[1] === 0xd8 &&
    value[2] === 0xff
  ) {
    return "image/jpeg"
  }
  const prefix = value.subarray(0, 12).toString("ascii")
  if (prefix.startsWith("GIF87a") || prefix.startsWith("GIF89a")) {
    return "image/gif"
  }
  if (
    value.length >= 12 &&
    value.subarray(0, 4).toString("ascii") === "RIFF" &&
    value.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp"
  }
  if (
    value.length >= 12 &&
    value.subarray(4, 8).toString("ascii") === "ftyp" &&
    ["avif", "avis"].some((brand) =>
      value.subarray(8, Math.min(value.length, 64)).includes(Buffer.from(brand))
    )
  ) {
    return "image/avif"
  }
  const text = value.subarray(0, Math.min(value.length, 4096)).toString("utf8")
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(text.replace(/^\uFEFF/, ""))) {
    return "image/svg+xml"
  }
  return undefined
}

function normalizedImageContentType(value: string | undefined) {
  const contentType = value?.split(";", 1)[0].trim().toLowerCase()
  return contentType?.startsWith("image/") ? contentType : undefined
}

async function mediaEntry(input: {
  requirement: StagingSliceDependencyRequirement
  captureDir: string
  mediaRecords: StagingSliceMediaRecord[]
  evidenceFiles: Map<string, { bytes: number; checksum: string }>
}): Promise<StagingSliceDependencyEvidenceEntry> {
  const records = input.mediaRecords.filter((record) =>
    sameUrl(record.sourceUrl, input.requirement.sourceId)
  )
  const blockers: string[] = []
  if (records.length === 0) blockers.push("captured_media_record_missing")
  if (records.length > 1) blockers.push("captured_media_record_duplicate")

  const record = records.length === 1 ? records[0] : undefined
  if (record?.status !== "captured") blockers.push("required_media_not_captured")
  const mediaFile = normalizedRelativePath(record?.mediaFile)
  if (!mediaFile || !safeRelativePath(mediaFile)) {
    blockers.push("captured_media_file_path_invalid")
  }
  if (
    record?.contentType?.trim() &&
    !record.contentType.toLowerCase().startsWith("image/")
  ) {
    blockers.push("captured_media_content_type_not_image")
  }
  if (!record?.checksum?.match(/^[a-f0-9]{64}$/)) {
    blockers.push("captured_media_checksum_missing_or_invalid")
  }
  if (!Number.isFinite(record?.bytes) || Number(record?.bytes) <= 0) {
    blockers.push("captured_media_byte_count_invalid")
  }

  const evidenceFile = mediaFile ? input.evidenceFiles.get(mediaFile) : undefined
  if (!evidenceFile) blockers.push("media_file_missing_from_evidence_package_inventory")
  if (evidenceFile && record?.bytes !== evidenceFile.bytes) {
    blockers.push("media_evidence_package_byte_count_mismatch")
  }
  if (evidenceFile && record?.checksum !== evidenceFile.checksum) {
    blockers.push("media_evidence_package_checksum_mismatch")
  }

  const absolute = mediaFile
    ? await containedCaptureFile(input.captureDir, mediaFile)
    : undefined
  if (!absolute) blockers.push("captured_media_bytes_missing_or_unsafe")

  let actualBytes: Buffer | undefined
  if (absolute) actualBytes = await readFile(absolute)
  if (actualBytes && record?.bytes !== actualBytes.length) {
    blockers.push("captured_media_actual_byte_count_mismatch")
  }
  const actualChecksum = actualBytes ? sha256(actualBytes) : undefined
  if (actualChecksum && record?.checksum !== actualChecksum) {
    blockers.push("captured_media_actual_checksum_mismatch")
  }

  const detectedContentType = actualBytes
    ? detectedImageContentType(actualBytes)
    : undefined
  const declaredContentType = normalizedImageContentType(record?.contentType)
  if (actualBytes && !detectedContentType) {
    blockers.push("captured_media_bytes_not_recognized_image")
  }
  if (
    declaredContentType &&
    detectedContentType &&
    declaredContentType !== detectedContentType
  ) {
    blockers.push("captured_media_content_type_signature_mismatch")
  }
  const resolvedContentType = declaredContentType ?? detectedContentType
  if (!resolvedContentType) blockers.push("captured_media_content_type_unresolved")

  const uniqueBlockers = [...new Set(blockers)].sort()
  const media =
    uniqueBlockers.length === 0 &&
    mediaFile &&
    resolvedContentType &&
    record?.bytes &&
    record.checksum
      ? {
          mediaFile,
          contentType: resolvedContentType,
          bytes: record.bytes,
          checksum: record.checksum,
        }
      : undefined
  const evidenceChecksum = sourceChecksum({
    requirementChecksum: input.requirement.requirementChecksum,
    sourceUrl: record?.sourceUrl,
    status: record?.status,
    mediaFile,
    declaredContentType: record?.contentType,
    detectedContentType,
    resolvedContentType,
    bytes: record?.bytes,
    checksum: record?.checksum,
    evidenceFile,
    actualBytes: actualBytes?.length,
    actualChecksum,
    blockers: uniqueBlockers,
  })

  return {
    ...input.requirement,
    state: uniqueBlockers.length ? "blocked" : "ready",
    blockers: uniqueBlockers,
    evidenceChecksum,
    ...(media ? { media } : {}),
  }
}

function policyPayload(bundle: StagingTargetPolicyBundle) {
  const { bundleChecksum, ...payload } = bundle
  void bundleChecksum
  return payload
}

function evidencePackagePayload(value: CaptureEvidencePackage) {
  return {
    schemaVersion: value.schemaVersion,
    captureId: value.captureId,
    source: value.source,
    provenance: value.provenance,
    files: value.files,
    totals: value.totals,
  }
}

function planPayload(
  plan: Omit<StagingSliceDependencyEvidencePlan, "planChecksum">
) {
  const { planChecksum: _unused, ...neverHasChecksum } = plan as typeof plan & {
    planChecksum?: string
  }
  void _unused
  return neverHasChecksum
}

function sameApplication(
  left: StagingTargetPolicyApplication,
  right: StagingTargetPolicyApplication
) {
  return sourceChecksum(left) === sourceChecksum(right)
}

export async function buildStagingSliceDependencyEvidencePlan(input: {
  captureDir: string
  report: StagingSliceSourceIngestionReport
  policyBundle: StagingTargetPolicyBundle
  evidencePackage: CaptureEvidencePackage
  mediaRecords: StagingSliceMediaRecord[]
  products: StagingSliceProductRecord[]
  expectedEvidencePackageChecksum?: string
}): Promise<StagingSliceDependencyEvidencePlan> {
  const globalBlockers: string[] = []
  const reportChecksum = sourceChecksum(input.report)
  const reportEvidenceChecksum =
    input.report.capture?.evidencePackage?.packageChecksum?.trim()

  if (input.report.schemaVersion !== 3) {
    globalBlockers.push("capture_ingestion_schema_version_3_required")
  }
  if (input.report.capture?.evidencePackage?.isValid !== true) {
    globalBlockers.push("capture_ingestion_evidence_package_must_be_valid")
  }
  if (
    input.report.capture?.evidencePackage?.provenanceMode !==
    "operator_local_browser"
  ) {
    globalBlockers.push("operator_local_browser_provenance_required")
  }
  if (input.report.capture?.evidencePackage?.transport !== "browser") {
    globalBlockers.push("operator_browser_transport_required")
  }
  if (!input.policyBundle.application?.isExecutable) {
    globalBlockers.push("staging_target_policy_application_not_executable")
  }
  if (!input.policyBundle.application?.productPlan?.isExecutable) {
    globalBlockers.push("staging_target_product_plan_not_executable")
  }
  if (input.policyBundle.sourceIngestionReportChecksum !== reportChecksum) {
    globalBlockers.push("staging_target_policy_source_report_checksum_mismatch")
  }
  if (
    input.policyBundle.bundleChecksum !==
    stagingTargetPolicyBundleChecksum(policyPayload(input.policyBundle))
  ) {
    globalBlockers.push("staging_target_policy_bundle_checksum_mismatch")
  }
  if (input.policyBundle.captureId !== input.report.capture?.captureId) {
    globalBlockers.push("staging_target_policy_capture_id_mismatch")
  }
  if (input.policyBundle.evidencePackageChecksum !== reportEvidenceChecksum) {
    globalBlockers.push("staging_target_policy_evidence_package_checksum_mismatch")
  }
  if (input.evidencePackage.packageChecksum !== reportEvidenceChecksum) {
    globalBlockers.push("capture_evidence_package_file_checksum_binding_mismatch")
  }
  if (
    input.evidencePackage.packageChecksum !==
    sourceChecksum(evidencePackagePayload(input.evidencePackage))
  ) {
    globalBlockers.push("capture_evidence_package_semantic_checksum_mismatch")
  }
  if (input.evidencePackage.captureId !== input.report.capture?.captureId) {
    globalBlockers.push("capture_evidence_package_capture_id_mismatch")
  }
  if (
    input.expectedEvidencePackageChecksum &&
    input.expectedEvidencePackageChecksum !== reportEvidenceChecksum
  ) {
    globalBlockers.push("expected_evidence_package_checksum_mismatch")
  }

  const reportCandidates = input.report.candidates?.records ?? []
  const rebuiltApplication = buildStagingTargetPolicyApplication(reportCandidates)
  if (!sameApplication(rebuiltApplication, input.policyBundle.application)) {
    globalBlockers.push("staging_target_policy_application_source_mismatch")
  }

  const productPlan = input.policyBundle.application.productPlan
  const requirements =
    globalBlockers.length === 0
      ? buildStagingSliceDependencyRequirements(productPlan)
      : []
  const structures = input.report.productStructure?.records ?? {}
  const evidenceFiles = new Map(
    (input.evidencePackage.files ?? []).map((entry) => [
      normalizedRelativePath(entry.path) ?? entry.path,
      { bytes: entry.bytes, checksum: entry.checksum },
    ])
  )

  const entries: StagingSliceDependencyEvidenceEntry[] = []
  for (const requirement of requirements) {
    if (requirement.entityType === "category") {
      entries.push(categoryEntry({ requirement, productPlan, structures }))
    } else if (requirement.entityType === "brand") {
      entries.push(
        brandEntry({ requirement, productPlan, products: input.products })
      )
    } else {
      entries.push(
        await mediaEntry({
          requirement,
          captureDir: input.captureDir,
          mediaRecords: input.mediaRecords,
          evidenceFiles,
        })
      )
    }
  }
  entries.sort((left, right) =>
    dependencyKey(left.entityType, left.sourceId).localeCompare(
      dependencyKey(right.entityType, right.sourceId)
    )
  )

  const totals = {
    ready: entries.filter((entry) => entry.state === "ready").length,
    blocked: entries.filter((entry) => entry.state === "blocked").length,
  }
  if (totals.blocked > 0) {
    globalBlockers.push("staging_slice_dependency_evidence_not_fully_resolved")
  }
  if (entries.length === 0) {
    globalBlockers.push("staging_slice_dependency_requirements_required")
  }

  const withoutChecksum: Omit<
    StagingSliceDependencyEvidencePlan,
    "planChecksum"
  > = {
    schemaVersion: 1,
    captureId: input.report.capture?.captureId ?? "",
    captureEvidencePackageChecksum: reportEvidenceChecksum ?? "",
    sourceIngestionReportChecksum: reportChecksum,
    stagingTargetPolicyBundleChecksum: input.policyBundle.bundleChecksum,
    requirementsChecksum: sourceChecksum(requirements),
    entries,
    totals,
    globalBlockers: [...new Set(globalBlockers)].sort(),
    isReadyForProvisioning:
      entries.length > 0 && totals.blocked === 0 && globalBlockers.length === 0,
    isExecutable: false,
  }

  return {
    ...withoutChecksum,
    planChecksum: sourceChecksum(planPayload(withoutChecksum)),
  }
}
