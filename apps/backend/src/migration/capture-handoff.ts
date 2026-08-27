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
import { gunzipSync, gzipSync } from "node:zlib"
import { MedusaError } from "@medusajs/framework/utils"
import {
  verifyCaptureEvidencePackage,
  type CaptureEvidencePackage,
} from "./capture-evidence-package"
import { sourceChecksum } from "./checksum"

export const CAPTURE_HANDOFF_SCHEMA_VERSION = 1 as const

export type CaptureHandoffManifest = {
  schemaVersion: typeof CAPTURE_HANDOFF_SCHEMA_VERSION
  captureId: string
  source: string
  generatedAt: string
  evidencePackageChecksum: string
  capture: {
    path: "capture"
    files: number
    bytes: number
  }
  ingestionReport: {
    path: "ingestion-report.json"
    bytes: number
    checksum: string
  }
  codeRevision?: string
  handoffChecksum: string
}

export type CaptureHandoffResult = {
  archivePath: string
  archiveChecksum: string
  manifest: CaptureHandoffManifest
}

type TarEntry = {
  path: string
  data: Buffer
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function sha256(value: Buffer | string) {
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

async function inventoryFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = join(current, entry.name)
    const relativePath = relative(root, absolute).split(sep).join("/")
    if (!safeRelativePath(relativePath)) {
      throw unexpected(`Unsafe handoff source path encountered: ${relativePath}`)
    }
    const metadata = await lstat(absolute)
    if (metadata.isSymbolicLink()) {
      throw unexpected(`Capture handoff refuses symbolic links: ${relativePath}`)
    }
    if (metadata.isDirectory()) {
      files.push(...(await inventoryFiles(root, absolute)))
      continue
    }
    if (!metadata.isFile()) {
      throw unexpected(`Capture handoff refuses non-file entry: ${relativePath}`)
    }
    files.push(relativePath)
  }

  return files.sort()
}

function splitTarPath(path: string) {
  const normalized = path.replace(/\\/g, "/")
  if (!safeRelativePath(normalized)) {
    throw unexpected(`Unsafe tar path: ${path}`)
  }
  if (Buffer.byteLength(normalized) <= 100) {
    return { name: normalized, prefix: "" }
  }

  const parts = normalized.split("/")
  for (let index = parts.length - 1; index > 0; index -= 1) {
    const prefix = parts.slice(0, index).join("/")
    const name = parts.slice(index).join("/")
    if (Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155) {
      return { name, prefix }
    }
  }
  throw unexpected(`Capture handoff path is too long for deterministic ustar: ${path}`)
}

function writeString(header: Buffer, offset: number, length: number, value: string) {
  const bytes = Buffer.from(value, "utf8")
  if (bytes.length > length) {
    throw unexpected(`Tar header field exceeds ${length} bytes: ${value}`)
  }
  bytes.copy(header, offset)
}

function writeOctal(header: Buffer, offset: number, length: number, value: number) {
  const encoded = Math.max(0, value).toString(8).padStart(length - 1, "0")
  if (encoded.length > length - 1) {
    throw unexpected(`Tar numeric field is too large: ${value}`)
  }
  writeString(header, offset, length - 1, encoded)
  header[offset + length - 1] = 0
}

function tarHeader(path: string, size: number) {
  const header = Buffer.alloc(512, 0)
  const { name, prefix } = splitTarPath(path)
  writeString(header, 0, 100, name)
  writeOctal(header, 100, 8, 0o644)
  writeOctal(header, 108, 8, 0)
  writeOctal(header, 116, 8, 0)
  writeOctal(header, 124, 12, size)
  writeOctal(header, 136, 12, 0)
  header.fill(0x20, 148, 156)
  header[156] = "0".charCodeAt(0)
  writeString(header, 257, 6, "ustar")
  writeString(header, 263, 2, "00")
  writeString(header, 265, 32, "COQUETTE")
  writeString(header, 297, 32, "COQUETTE")
  if (prefix) writeString(header, 345, 155, prefix)
  const checksum = header.reduce((sum, byte) => sum + byte, 0)
  const checksumText = checksum.toString(8).padStart(6, "0")
  writeString(header, 148, 6, checksumText)
  header[154] = 0
  header[155] = 0x20
  return header
}

function tarArchive(entries: TarEntry[]) {
  const chunks: Buffer[] = []
  const sorted = [...entries].sort((left, right) => left.path.localeCompare(right.path))
  const duplicates = sorted.filter(
    (entry, index) => index > 0 && sorted[index - 1].path === entry.path
  )
  if (duplicates.length > 0) {
    throw unexpected(`Duplicate tar entry path: ${duplicates[0].path}`)
  }

  for (const entry of sorted) {
    chunks.push(tarHeader(entry.path, entry.data.length), entry.data)
    const padding = (512 - (entry.data.length % 512)) % 512
    if (padding) chunks.push(Buffer.alloc(padding, 0))
  }
  chunks.push(Buffer.alloc(1024, 0))
  return Buffer.concat(chunks)
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
    if (!safeRelativePath(path)) throw unexpected(`Unsafe path in handoff archive: ${path}`)
    if (entries.has(path)) throw unexpected(`Duplicate path in handoff archive: ${path}`)
    const size = parseOctal(header.subarray(124, 136))
    const dataStart = offset + 512
    const dataEnd = dataStart + size
    if (dataEnd > buffer.length) throw unexpected(`Truncated handoff archive entry: ${path}`)
    entries.set(path, Buffer.from(buffer.subarray(dataStart, dataEnd)))
    offset = dataStart + Math.ceil(size / 512) * 512
  }

  return entries
}

function handoffPayload(value: Omit<CaptureHandoffManifest, "handoffChecksum">) {
  return {
    schemaVersion: value.schemaVersion,
    captureId: value.captureId,
    source: value.source,
    evidencePackageChecksum: value.evidencePackageChecksum,
    capture: value.capture,
    ingestionReport: value.ingestionReport,
    ...(value.codeRevision ? { codeRevision: value.codeRevision } : {}),
  }
}

function archiveChecksumFromFilename(path: string) {
  const match = path.replace(/\\/g, "/").match(/\.handoff\.([a-f0-9]{64})\.tar\.gz$/)
  return match?.[1]
}

export async function createCaptureHandoff(input: {
  captureDir: string
  ingestionReportPath: string
  outputDir: string
  generatedAt?: string
  codeRevision?: string
}): Promise<CaptureHandoffResult> {
  const captureDir = resolve(input.captureDir)
  const ingestionReportPath = resolve(input.ingestionReportPath)
  const outputDir = resolve(input.outputDir)
  const evidenceVerification = await verifyCaptureEvidencePackage(captureDir)
  if (!evidenceVerification.isValid || !evidenceVerification.package) {
    throw unexpected(
      `Capture evidence package is not valid: ${evidenceVerification.issues
        .map((issue) => issue.code)
        .join(", ")}`
    )
  }
  const evidencePackage: CaptureEvidencePackage = evidenceVerification.package
  const capturePaths = await inventoryFiles(captureDir)
  const captureEntries: TarEntry[] = []
  let captureBytes = 0
  for (const path of capturePaths) {
    const data = await readFile(join(captureDir, path))
    captureBytes += data.length
    captureEntries.push({ path: `capture/${path}`, data })
  }

  const ingestionReport = await readFile(ingestionReportPath)
  let ingestionJson: Record<string, unknown>
  try {
    ingestionJson = JSON.parse(ingestionReport.toString("utf8")) as Record<string, unknown>
  } catch {
    throw unexpected("Capture ingestion report must be valid JSON")
  }
  const reportCapture = ingestionJson.capture as Record<string, unknown> | undefined
  if (reportCapture?.captureId !== evidencePackage.captureId) {
    throw unexpected("Capture ingestion report captureId does not match evidence package")
  }
  const reportEvidence = reportCapture?.evidencePackage as Record<string, unknown> | undefined
  if (reportEvidence?.packageChecksum !== evidencePackage.packageChecksum) {
    throw unexpected(
      "Capture ingestion report evidence package checksum does not match capture package"
    )
  }

  const withoutChecksum: Omit<CaptureHandoffManifest, "handoffChecksum"> = {
    schemaVersion: CAPTURE_HANDOFF_SCHEMA_VERSION,
    captureId: evidencePackage.captureId,
    source: evidencePackage.source,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    evidencePackageChecksum: evidencePackage.packageChecksum,
    capture: {
      path: "capture",
      files: capturePaths.length,
      bytes: captureBytes,
    },
    ingestionReport: {
      path: "ingestion-report.json",
      bytes: ingestionReport.length,
      checksum: sha256(ingestionReport),
    },
    ...(input.codeRevision?.trim() ? { codeRevision: input.codeRevision.trim() } : {}),
  }
  const manifest: CaptureHandoffManifest = {
    ...withoutChecksum,
    handoffChecksum: sourceChecksum(handoffPayload(withoutChecksum)),
  }
  const manifestData = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  const archive = gzipSync(
    tarArchive([
      ...captureEntries,
      { path: "ingestion-report.json", data: ingestionReport },
      { path: "handoff.json", data: manifestData },
    ]),
    { level: 9 }
  )
  const archiveChecksum = sha256(archive)
  await mkdir(outputDir, { recursive: true })
  const temporary = join(outputDir, `${evidencePackage.captureId}.handoff.tmp.tar.gz`)
  const archivePath = join(
    outputDir,
    `${evidencePackage.captureId}.handoff.${archiveChecksum}.tar.gz`
  )
  await writeFile(temporary, archive)
  await rename(temporary, archivePath)

  const verification = await verifyCaptureHandoffArchive(archivePath)
  if (!verification.valid) {
    throw unexpected(`Newly-created capture handoff failed verification: ${verification.errors.join(", ")}`)
  }

  return { archivePath, archiveChecksum, manifest }
}

export async function verifyCaptureHandoffArchive(path: string) {
  const resolved = resolve(path)
  const errors: string[] = []
  const archive = await readFile(resolved)
  const actualArchiveChecksum = sha256(archive)
  const expectedArchiveChecksum = archiveChecksumFromFilename(resolved)
  if (!expectedArchiveChecksum) {
    errors.push("archive_filename_checksum_missing")
  } else if (expectedArchiveChecksum !== actualArchiveChecksum) {
    errors.push("archive_filename_checksum_mismatch")
  }

  let entries = new Map<string, Buffer>()
  try {
    entries = parseTarArchive(gunzipSync(archive))
  } catch {
    errors.push("archive_invalid_or_truncated")
    return { valid: false, archiveChecksum: actualArchiveChecksum, errors }
  }

  const manifestRaw = entries.get("handoff.json")
  const ingestionReport = entries.get("ingestion-report.json")
  if (!manifestRaw) errors.push("handoff_manifest_missing")
  if (!ingestionReport) errors.push("ingestion_report_missing")

  let manifest: CaptureHandoffManifest | undefined
  if (manifestRaw) {
    try {
      manifest = JSON.parse(manifestRaw.toString("utf8")) as CaptureHandoffManifest
    } catch {
      errors.push("handoff_manifest_invalid_json")
    }
  }

  if (manifest) {
    if (manifest.schemaVersion !== CAPTURE_HANDOFF_SCHEMA_VERSION) {
      errors.push("handoff_schema_version_invalid")
    }
    const { handoffChecksum, ...withoutChecksum } = manifest
    if (handoffChecksum !== sourceChecksum(handoffPayload(withoutChecksum))) {
      errors.push("handoff_manifest_checksum_mismatch")
    }
    if (
      ingestionReport &&
      (manifest.ingestionReport.bytes !== ingestionReport.length ||
        manifest.ingestionReport.checksum !== sha256(ingestionReport))
    ) {
      errors.push("ingestion_report_checksum_mismatch")
    }

    const captureEntries = [...entries.entries()].filter(([entryPath]) =>
      entryPath.startsWith("capture/")
    )
    if (captureEntries.length !== manifest.capture.files) {
      errors.push("capture_file_count_mismatch")
    }
    const captureBytes = captureEntries.reduce((sum, [, data]) => sum + data.length, 0)
    if (captureBytes !== manifest.capture.bytes) {
      errors.push("capture_byte_count_mismatch")
    }

    const evidenceRaw = entries.get("capture/evidence-package.json")
    if (!evidenceRaw) {
      errors.push("capture_evidence_package_missing")
    } else {
      try {
        const evidence = JSON.parse(evidenceRaw.toString("utf8")) as CaptureEvidencePackage
        if (evidence.captureId !== manifest.captureId) {
          errors.push("capture_id_mismatch")
        }
        if (evidence.packageChecksum !== manifest.evidencePackageChecksum) {
          errors.push("evidence_package_checksum_mismatch")
        }
      } catch {
        errors.push("capture_evidence_package_invalid_json")
      }
    }
  }

  return {
    valid: errors.length === 0,
    archiveChecksum: actualArchiveChecksum,
    errors,
    manifest,
  }
}
