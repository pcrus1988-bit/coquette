import { MedusaError } from "@medusajs/framework/utils"
import { createHash } from "node:crypto"
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { sourceChecksum } from "./checksum"
import { COQUETTE_LEGACY_HOST } from "./capture-ingestion"

export const CAPTURE_EVIDENCE_PACKAGE_FILE = "evidence-package.json"

const REQUIRED_CAPTURE_FILES = [
  "manifest.json",
  "pages.jsonl",
  "products.jsonl",
  "media.jsonl",
  "url-inventory.jsonl",
  "robots.txt",
] as const

export type CaptureEvidenceFile = {
  path: string
  bytes: number
  checksum: string
}

export type CaptureEvidencePackage = {
  schemaVersion: 1
  captureId: string
  source: string
  packagedAt: string
  provenance: {
    mode: "operator_local_browser"
    transport: "browser"
    browserMode: "headed" | "headless"
    codeRevision?: string
    operatorLabel?: string
  }
  files: CaptureEvidenceFile[]
  totals: {
    files: number
    bytes: number
  }
  packageChecksum: string
}

export type CaptureEvidencePackageIssue = {
  severity: "critical" | "review"
  code: string
  message: string
  path?: string
}

export type CaptureEvidencePackageVerification = {
  isValid: boolean
  critical: number
  review: number
  issues: CaptureEvidencePackageIssue[]
  package?: CaptureEvidencePackage
  recomputedPackageChecksum?: string
}

type RawCaptureManifest = {
  captureId?: string
  source?: string
  transport?: string
  complete?: boolean
  failureReason?: string
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function fileChecksum(value: Buffer) {
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

function packagePayload(
  value: Omit<CaptureEvidencePackage, "packageChecksum">
) {
  return {
    schemaVersion: value.schemaVersion,
    captureId: value.captureId,
    source: value.source,
    provenance: value.provenance,
    files: value.files,
    totals: value.totals,
  }
}

async function atomicWriteJson(path: string, value: unknown) {
  const target = resolve(path)
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  await rename(temporary, target)
}

async function inventoryPaths(
  root: string,
  current = root
): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true })
  const paths: string[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = join(current, entry.name)
    const relativePath = relative(root, absolute).split(sep).join("/")

    if (relativePath === CAPTURE_EVIDENCE_PACKAGE_FILE) continue
    if (!safeRelativePath(relativePath)) {
      throw unexpected(`Unsafe capture evidence path encountered: ${relativePath}`)
    }

    const metadata = await lstat(absolute)
    if (metadata.isSymbolicLink()) {
      throw unexpected(
        `Capture evidence package refuses symbolic links: ${relativePath}`
      )
    }
    if (metadata.isDirectory()) {
      paths.push(...(await inventoryPaths(root, absolute)))
      continue
    }
    if (!metadata.isFile()) {
      throw unexpected(
        `Capture evidence package refuses non-file entry: ${relativePath}`
      )
    }
    paths.push(relativePath)
  }

  return paths.sort()
}

async function fileInventory(root: string) {
  const paths = await inventoryPaths(root)
  const files: CaptureEvidenceFile[] = []

  for (const path of paths) {
    const buffer = await readFile(join(root, path))
    files.push({
      path,
      bytes: buffer.length,
      checksum: fileChecksum(buffer),
    })
  }

  return files
}

function validLegacySource(value: string | undefined, expectedHost: string) {
  if (!value) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      url.hostname === expectedHost &&
      (url.pathname === "/" || url.pathname === "")
    )
  } catch {
    return false
  }
}

async function readRawManifest(root: string) {
  return JSON.parse(
    await readFile(join(root, "manifest.json"), "utf8")
  ) as RawCaptureManifest
}

export async function createCaptureEvidencePackage(input: {
  captureDir: string
  browserMode: "headed" | "headless"
  codeRevision?: string
  operatorLabel?: string
  packagedAt?: string
}): Promise<CaptureEvidencePackage> {
  const root = resolve(input.captureDir)
  const manifest = await readRawManifest(root)
  if (!manifest.captureId?.trim()) {
    throw unexpected("Operator capture manifest requires a captureId before packaging")
  }
  if (!validLegacySource(manifest.source, COQUETTE_LEGACY_HOST)) {
    throw unexpected(
      `Operator capture package must originate from https://${COQUETTE_LEGACY_HOST}/`
    )
  }
  if (manifest.transport !== "browser") {
    throw unexpected("Operator capture package requires browser transport evidence")
  }

  const files = await fileInventory(root)
  for (const required of REQUIRED_CAPTURE_FILES) {
    if (!files.some((entry) => entry.path === required)) {
      throw unexpected(`Operator capture package is missing required file ${required}`)
    }
  }

  const withoutChecksum: Omit<CaptureEvidencePackage, "packageChecksum"> = {
    schemaVersion: 1,
    captureId: manifest.captureId,
    source: manifest.source!,
    packagedAt: input.packagedAt ?? new Date().toISOString(),
    provenance: {
      mode: "operator_local_browser",
      transport: "browser",
      browserMode: input.browserMode,
      ...(input.codeRevision?.trim()
        ? { codeRevision: input.codeRevision.trim() }
        : {}),
      ...(input.operatorLabel?.trim()
        ? { operatorLabel: input.operatorLabel.trim() }
        : {}),
    },
    files,
    totals: {
      files: files.length,
      bytes: files.reduce((sum, entry) => sum + entry.bytes, 0),
    },
  }

  const evidencePackage: CaptureEvidencePackage = {
    ...withoutChecksum,
    packageChecksum: sourceChecksum(packagePayload(withoutChecksum)),
  }
  await atomicWriteJson(
    join(root, CAPTURE_EVIDENCE_PACKAGE_FILE),
    evidencePackage
  )
  return evidencePackage
}

function addIssue(
  issues: CaptureEvidencePackageIssue[],
  code: string,
  message: string,
  path?: string,
  severity: CaptureEvidencePackageIssue["severity"] = "critical"
) {
  issues.push({ severity, code, message, ...(path ? { path } : {}) })
}

export async function verifyCaptureEvidencePackage(
  captureDir: string,
  expectedHost = COQUETTE_LEGACY_HOST
): Promise<CaptureEvidencePackageVerification> {
  const root = resolve(captureDir)
  const issues: CaptureEvidencePackageIssue[] = []
  let evidencePackage: CaptureEvidencePackage | undefined

  try {
    evidencePackage = JSON.parse(
      await readFile(join(root, CAPTURE_EVIDENCE_PACKAGE_FILE), "utf8")
    ) as CaptureEvidencePackage
  } catch {
    addIssue(
      issues,
      "capture_evidence_package_missing_or_invalid_json",
      `Capture directory must contain valid ${CAPTURE_EVIDENCE_PACKAGE_FILE}.`
    )
  }

  if (!evidencePackage) {
    return {
      isValid: false,
      critical: issues.length,
      review: 0,
      issues,
    }
  }

  if (evidencePackage.schemaVersion !== 1) {
    addIssue(
      issues,
      "capture_evidence_package_schema_version_1_required",
      "Capture evidence package schemaVersion must be 1."
    )
  }
  if (!evidencePackage.captureId?.trim()) {
    addIssue(issues, "capture_evidence_package_capture_id_required", "Capture evidence package requires captureId.")
  }
  if (!validLegacySource(evidencePackage.source, expectedHost)) {
    addIssue(
      issues,
      "capture_evidence_package_invalid_source",
      `Capture evidence package source must be https://${expectedHost}/.`
    )
  }
  if (evidencePackage.provenance?.mode !== "operator_local_browser") {
    addIssue(
      issues,
      "capture_evidence_package_operator_mode_required",
      "Capture evidence package must originate from operator_local_browser mode."
    )
  }
  if (evidencePackage.provenance?.transport !== "browser") {
    addIssue(
      issues,
      "capture_evidence_package_browser_transport_required",
      "Capture evidence package must use browser transport."
    )
  }
  if (
    evidencePackage.provenance?.browserMode !== "headed" &&
    evidencePackage.provenance?.browserMode !== "headless"
  ) {
    addIssue(
      issues,
      "capture_evidence_package_browser_mode_invalid",
      "Capture evidence package browserMode must be headed or headless."
    )
  }

  let rawManifest: RawCaptureManifest | undefined
  try {
    rawManifest = await readRawManifest(root)
    if (rawManifest.captureId !== evidencePackage.captureId) {
      addIssue(
        issues,
        "capture_evidence_package_manifest_capture_id_mismatch",
        "Capture evidence package captureId does not match manifest.json."
      )
    }
    if (rawManifest.source !== evidencePackage.source) {
      addIssue(
        issues,
        "capture_evidence_package_manifest_source_mismatch",
        "Capture evidence package source does not match manifest.json."
      )
    }
    if (rawManifest.transport !== "browser") {
      addIssue(
        issues,
        "capture_evidence_package_manifest_browser_transport_required",
        "Capture manifest itself must record browser transport."
      )
    }
    if (rawManifest.complete !== true) {
      addIssue(
        issues,
        "capture_evidence_package_capture_not_complete",
        "Operator capture must be complete before it can become migration evidence."
      )
    }
    if (rawManifest.failureReason?.trim()) {
      addIssue(
        issues,
        "capture_evidence_package_capture_failure_reason_present",
        "Operator capture manifest still contains a failureReason."
      )
    }
  } catch {
    addIssue(
      issues,
      "capture_evidence_package_manifest_missing_or_invalid",
      "Capture evidence package requires a valid manifest.json."
    )
  }

  const listedFiles = Array.isArray(evidencePackage.files)
    ? evidencePackage.files
    : []
  const listedPaths = listedFiles.map((entry) => entry.path)
  const duplicatePaths = listedPaths.filter(
    (path, index) => listedPaths.indexOf(path) !== index
  )
  if (duplicatePaths.length > 0) {
    addIssue(
      issues,
      "capture_evidence_package_duplicate_file_paths",
      `Capture evidence package has duplicate file path(s): ${[
        ...new Set(duplicatePaths),
      ].join(", ")}`
    )
  }
  for (const entry of listedFiles) {
    if (!safeRelativePath(entry.path)) {
      addIssue(
        issues,
        "capture_evidence_package_unsafe_file_path",
        "Capture evidence package contains an unsafe file path.",
        entry.path
      )
    }
  }
  for (const required of REQUIRED_CAPTURE_FILES) {
    if (!listedPaths.includes(required)) {
      addIssue(
        issues,
        "capture_evidence_package_required_file_not_listed",
        `Capture evidence package does not list required file ${required}.`,
        required
      )
    }
  }

  let currentFiles: CaptureEvidenceFile[] = []
  try {
    currentFiles = await fileInventory(root)
  } catch (error) {
    addIssue(
      issues,
      "capture_evidence_package_inventory_failed",
      error instanceof Error ? error.message : String(error)
    )
  }

  const currentByPath = new Map(currentFiles.map((entry) => [entry.path, entry]))
  const listedByPath = new Map(listedFiles.map((entry) => [entry.path, entry]))

  for (const current of currentFiles) {
    if (!listedByPath.has(current.path)) {
      addIssue(
        issues,
        "capture_evidence_package_unlisted_file",
        "Capture directory contains a file not covered by the evidence package.",
        current.path
      )
    }
  }
  for (const listed of listedFiles) {
    const current = currentByPath.get(listed.path)
    if (!current) {
      addIssue(
        issues,
        "capture_evidence_package_listed_file_missing",
        "Evidence package lists a file that is missing from the capture directory.",
        listed.path
      )
      continue
    }
    if (current.bytes !== listed.bytes) {
      addIssue(
        issues,
        "capture_evidence_package_file_size_mismatch",
        "Captured evidence file byte count no longer matches the package.",
        listed.path
      )
    }
    if (current.checksum !== listed.checksum) {
      addIssue(
        issues,
        "capture_evidence_package_file_checksum_mismatch",
        "Captured evidence file checksum no longer matches the package.",
        listed.path
      )
    }
  }

  const sortedListedFiles = [...listedFiles].sort((left, right) =>
    left.path.localeCompare(right.path)
  )
  if (JSON.stringify(sortedListedFiles) !== JSON.stringify(listedFiles)) {
    addIssue(
      issues,
      "capture_evidence_package_files_not_sorted",
      "Capture evidence package file inventory must be sorted deterministically."
    )
  }

  const expectedTotals = {
    files: listedFiles.length,
    bytes: listedFiles.reduce((sum, entry) => sum + Number(entry.bytes || 0), 0),
  }
  if (
    evidencePackage.totals?.files !== expectedTotals.files ||
    evidencePackage.totals?.bytes !== expectedTotals.bytes
  ) {
    addIssue(
      issues,
      "capture_evidence_package_totals_mismatch",
      "Capture evidence package totals do not match its file inventory."
    )
  }

  const { packageChecksum: _packageChecksum, ...withoutChecksum } = evidencePackage
  void _packageChecksum
  const recomputedPackageChecksum = sourceChecksum(
    packagePayload(withoutChecksum)
  )
  if (evidencePackage.packageChecksum !== recomputedPackageChecksum) {
    addIssue(
      issues,
      "capture_evidence_package_checksum_mismatch",
      "Capture evidence package checksum does not match its semantic payload."
    )
  }

  const critical = issues.filter((issue) => issue.severity === "critical").length
  const review = issues.filter((issue) => issue.severity === "review").length
  return {
    isValid: critical === 0,
    critical,
    review,
    issues,
    package: evidencePackage,
    recomputedPackageChecksum,
  }
}
