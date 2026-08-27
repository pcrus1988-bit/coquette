import { createHash } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { gunzipSync } from "node:zlib"
import { verifyCaptureHandoffArchive } from "./capture-handoff"
import {
  buildCaptureHandoffIntake,
  readVerifiedCaptureHandoffReport,
  type CaptureHandoffIntake,
} from "./capture-handoff-intake"
import { sourceChecksum } from "./checksum"
import type { CaptureMediaRecord, CapturedProductRecord } from "./capture-ingestion"
import type { DependencyRequirement } from "./dependency-mapping-reconciliation"
import type { ReviewDecision } from "./review-decisions"

export const dependencyProvisioningEvidenceStates = ["ready", "blocked"] as const
export type DependencyProvisioningEvidenceState =
  (typeof dependencyProvisioningEvidenceStates)[number]

type CategoryEvidence = {
  name: string
  productSourceIds: string[]
}

type BrandEvidence = {
  name: string
  productSourceIds: string[]
}

type MediaEvidence = {
  archivePath: string
  mediaFile: string
  contentType: string
  bytes: number
  checksum: string
}

export type DependencyProvisioningEvidenceEntry = DependencyRequirement & {
  state: DependencyProvisioningEvidenceState
  blockers: string[]
  evidenceChecksum: string
  category?: CategoryEvidence
  brand?: BrandEvidence
  media?: MediaEvidence
}

export type DependencyProvisioningEvidencePlan = {
  schemaVersion: 1
  captureId: string
  captureEvidencePackageChecksum: string
  handoffChecksum: string
  intakeChecksum: string
  migrationInputBundleChecksum: string
  entries: DependencyProvisioningEvidenceEntry[]
  totals: Record<DependencyProvisioningEvidenceState, number>
  globalBlockers: string[]
  planChecksum: string
  isReadyForProvisioning: boolean
  isExecutable: false
}

type ProductStructureRecord = {
  categoryReferences?: Array<{ name?: string; url?: string }>
}

type IngestionReportWithStructure = {
  productStructure?: {
    records?: Record<string, ProductStructureRecord>
  }
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function safeRelativePath(value: string) {
  const normalized = value.replace(/\\/g, "/")
  return (
    normalized.length > 0 &&
    !normalized.startsWith("/") &&
    !normalized.split("/").includes("..") &&
    !/^[a-zA-Z]:\//.test(normalized)
  )
}

function parseOctal(value: Buffer) {
  const text = value.toString("ascii").replace(/\0.*$/, "").trim()
  return text ? Number.parseInt(text, 8) : 0
}

function parseTarArchive(buffer: Buffer) {
  const entries = new Map<string, Buffer>()
  let offset = 0

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "")
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "")
    const path = prefix ? `${prefix}/${name}` : name
    if (!safeRelativePath(path)) throw unexpected(`Unsafe path in handoff: ${path}`)
    if (entries.has(path)) throw unexpected(`Duplicate path in handoff: ${path}`)
    const size = parseOctal(header.subarray(124, 136))
    const dataStart = offset + 512
    const dataEnd = dataStart + size
    if (dataEnd > buffer.length) throw unexpected(`Truncated handoff entry: ${path}`)
    entries.set(path, Buffer.from(buffer.subarray(dataStart, dataEnd)))
    offset = dataStart + Math.ceil(size / 512) * 512
  }

  return entries
}

function parseJsonl<T>(value: Buffer | undefined, label: string): T[] {
  if (!value) throw unexpected(`Verified handoff is missing ${label}`)
  return value
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
}

function productSourceIdsForRequirement(
  intake: CaptureHandoffIntake,
  requirement: DependencyRequirement
) {
  return uniqueStrings(
    requirement.candidateKeys.map((candidateKey) =>
      intake.migrationInput.productPlan.entries.find(
        (entry) => entry.candidateKey === candidateKey
      )?.normalizedProduct?.sourceId
    )
  ).sort()
}

function categoryEntry(input: {
  requirement: DependencyRequirement
  intake: CaptureHandoffIntake
  structures: Record<string, ProductStructureRecord>
}): DependencyProvisioningEvidenceEntry {
  const productSourceIds = productSourceIdsForRequirement(
    input.intake,
    input.requirement
  )
  const names = uniqueStrings(
    productSourceIds.flatMap((sourceId) =>
      (input.structures[sourceId]?.categoryReferences ?? [])
        .filter((reference) => reference.url?.trim() === input.requirement.sourceId)
        .map((reference) => reference.name)
    )
  )
  const blockers: string[] = []
  if (productSourceIds.length === 0) blockers.push("category_evidence_product_source_missing")
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
  requirement: DependencyRequirement
  intake: CaptureHandoffIntake
  products: CapturedProductRecord[]
}): DependencyProvisioningEvidenceEntry {
  const productSourceIds = productSourceIdsForRequirement(
    input.intake,
    input.requirement
  )
  const names = uniqueStrings(
    productSourceIds.flatMap((sourceId) =>
      input.products
        .filter((product) => product.sourceUrl?.trim() === sourceId)
        .map((product) => product.brand)
    )
  )
  const blockers: string[] = []
  if (productSourceIds.length === 0) blockers.push("brand_evidence_product_source_missing")
  if (names.length === 0) blockers.push("brand_public_name_missing")
  if (names.length > 1) blockers.push("brand_public_name_conflict")
  const brand = blockers.length === 0 ? { name: names[0], productSourceIds } : undefined
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

function mediaEntry(input: {
  requirement: DependencyRequirement
  mediaRecords: CaptureMediaRecord[]
  archiveEntries: Map<string, Buffer>
}): DependencyProvisioningEvidenceEntry {
  const records = input.mediaRecords.filter(
    (record) => record.sourceUrl?.trim() === input.requirement.sourceId
  )
  const blockers: string[] = []
  if (records.length === 0) blockers.push("captured_media_record_missing")
  if (records.length > 1) blockers.push("captured_media_record_duplicate")

  const record = records.length === 1 ? records[0] : undefined
  if (record?.status !== "captured") blockers.push("required_media_not_captured")
  if (!record?.mediaFile?.trim() || !safeRelativePath(record.mediaFile)) {
    blockers.push("captured_media_file_path_invalid")
  }
  if (!record?.contentType?.toLowerCase().startsWith("image/")) {
    blockers.push("captured_media_content_type_not_image")
  }
  if (!record?.checksum?.match(/^[a-f0-9]{64}$/)) {
    blockers.push("captured_media_checksum_missing_or_invalid")
  }
  if (!Number.isFinite(record?.bytes) || Number(record?.bytes) <= 0) {
    blockers.push("captured_media_byte_count_invalid")
  }

  const archivePath = record?.mediaFile ? `capture/${record.mediaFile}` : undefined
  const bytes = archivePath ? input.archiveEntries.get(archivePath) : undefined
  if (archivePath && !bytes) blockers.push("captured_media_bytes_missing_from_handoff")
  if (bytes && record?.bytes !== bytes.length) blockers.push("captured_media_byte_count_mismatch")
  if (bytes && record?.checksum !== sha256(bytes)) blockers.push("captured_media_checksum_mismatch")

  const media = blockers.length === 0 && record && archivePath && bytes
    ? {
        archivePath,
        mediaFile: record.mediaFile!,
        contentType: record.contentType!,
        bytes: bytes.length,
        checksum: record.checksum!,
      }
    : undefined
  const evidenceChecksum = sourceChecksum({
    requirementChecksum: input.requirement.requirementChecksum,
    sourceUrl: record?.sourceUrl,
    status: record?.status,
    mediaFile: record?.mediaFile,
    contentType: record?.contentType,
    bytes: record?.bytes,
    checksum: record?.checksum,
    blockers,
  })
  return {
    ...input.requirement,
    state: blockers.length ? "blocked" : "ready",
    blockers: [...new Set(blockers)].sort(),
    evidenceChecksum,
    ...(media ? { media } : {}),
  }
}

function planPayload(plan: Omit<DependencyProvisioningEvidencePlan, "planChecksum">) {
  return {
    schemaVersion: plan.schemaVersion,
    captureId: plan.captureId,
    captureEvidencePackageChecksum: plan.captureEvidencePackageChecksum,
    handoffChecksum: plan.handoffChecksum,
    intakeChecksum: plan.intakeChecksum,
    migrationInputBundleChecksum: plan.migrationInputBundleChecksum,
    entries: plan.entries,
    totals: plan.totals,
    globalBlockers: plan.globalBlockers,
    isReadyForProvisioning: plan.isReadyForProvisioning,
    isExecutable: plan.isExecutable,
  }
}

export async function buildDependencyProvisioningEvidencePlan(input: {
  handoffPath: string
  decisions?: ReviewDecision[]
  generatedAt?: string
}): Promise<DependencyProvisioningEvidencePlan> {
  const intake = await buildCaptureHandoffIntake(input)
  if (!intake.isReadyForDependencyProvisioning) {
    throw unexpected(
      `Dependency provisioning evidence requires a staging-ready Phase 4T intake: ${intake.globalBlockers.join(", ")}`
    )
  }

  const verified = await readVerifiedCaptureHandoffReport(input.handoffPath)
  const archiveVerification = await verifyCaptureHandoffArchive(resolve(input.handoffPath))
  if (!archiveVerification.valid) {
    throw unexpected(`Capture handoff verification failed: ${archiveVerification.errors.join(", ")}`)
  }
  const archiveEntries = parseTarArchive(
    gunzipSync(await readFile(resolve(input.handoffPath)))
  )
  const products = parseJsonl<CapturedProductRecord>(
    archiveEntries.get("capture/products.jsonl"),
    "capture/products.jsonl"
  )
  const mediaRecords = parseJsonl<CaptureMediaRecord>(
    archiveEntries.get("capture/media.jsonl"),
    "capture/media.jsonl"
  )
  const reportWithStructure = verified.report as typeof verified.report & IngestionReportWithStructure
  const structures = reportWithStructure.productStructure?.records ?? {}

  const entries = intake.dependencyRequirements
    .map((requirement) => {
      if (requirement.entityType === "category") {
        return categoryEntry({ requirement, intake, structures })
      }
      if (requirement.entityType === "brand") {
        return brandEntry({ requirement, intake, products })
      }
      return mediaEntry({ requirement, mediaRecords, archiveEntries })
    })
    .sort((left, right) =>
      `${left.entityType}:${left.sourceId}`.localeCompare(
        `${right.entityType}:${right.sourceId}`
      )
    )

  const totals = Object.fromEntries(
    dependencyProvisioningEvidenceStates.map((state) => [
      state,
      entries.filter((entry) => entry.state === state).length,
    ])
  ) as Record<DependencyProvisioningEvidenceState, number>
  const globalBlockers = totals.blocked > 0
    ? ["dependency_provisioning_evidence_not_fully_resolved"]
    : []
  const withoutChecksum: Omit<DependencyProvisioningEvidencePlan, "planChecksum"> = {
    schemaVersion: 1,
    captureId: intake.captureId,
    captureEvidencePackageChecksum: intake.captureEvidencePackageChecksum,
    handoffChecksum: intake.handoffChecksum,
    intakeChecksum: intake.intakeChecksum,
    migrationInputBundleChecksum: intake.migrationInput.bundleChecksum,
    entries,
    totals,
    globalBlockers,
    isReadyForProvisioning: entries.length > 0 && totals.blocked === 0,
    isExecutable: false,
  }
  return {
    ...withoutChecksum,
    planChecksum: sourceChecksum(planPayload(withoutChecksum)),
  }
}
