import { createHash } from "node:crypto"
import { once } from "node:events"
import { createReadStream, createWriteStream } from "node:fs"
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises"
import { join, relative, resolve, sep } from "node:path"
import { finished } from "node:stream/promises"
import type { Writable } from "node:stream"
import { createGunzip, createGzip } from "node:zlib"
import { MedusaError } from "@medusajs/framework/utils"
import {
  verifyCaptureEvidencePackage,
  type CaptureEvidencePackage,
} from "./capture-evidence-package"
import { sourceChecksum } from "./checksum"

export const STREAMING_CAPTURE_HANDOFF_SCHEMA_VERSION = 1 as const

type CaptureHandoffManifest = {
  schemaVersion: typeof STREAMING_CAPTURE_HANDOFF_SCHEMA_VERSION
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

type FileInventoryEntry = {
  path: string
  bytes: number
}

type StreamedEntrySummary = {
  bytes: number
  checksum: string
}

type VerificationProgress = (message: string) => void

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

function validLegacySource(value: string | undefined) {
  if (!value) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      url.hostname === "coquetteconcept.gr" &&
      (url.pathname === "/" || url.pathname === "") &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
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

function evidencePayload(evidence: CaptureEvidencePackage) {
  return {
    schemaVersion: evidence.schemaVersion,
    captureId: evidence.captureId,
    source: evidence.source,
    provenance: evidence.provenance,
    files: evidence.files,
    totals: evidence.totals,
  }
}

function archiveChecksumFromFilename(path: string) {
  const match = path
    .replace(/\\/g, "/")
    .match(/\.handoff\.([a-f0-9]{64})\.tar\.gz$/)
  return match?.[1]
}

async function inventoryFiles(
  root: string,
  current = root
): Promise<FileInventoryEntry[]> {
  const entries = await readdir(current, { withFileTypes: true })
  const files: FileInventoryEntry[] = []

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
    files.push({ path: relativePath, bytes: metadata.size })
  }

  return files.sort((left, right) => left.path.localeCompare(right.path))
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
  writeString(header, 148, 6, checksum.toString(8).padStart(6, "0"))
  header[154] = 0
  header[155] = 0x20
  return header
}

function parseOctal(value: Buffer) {
  const text = value.toString("ascii").replace(/\0.*$/, "").trim()
  return text ? Number.parseInt(text, 8) : 0
}

async function writeChunk(stream: Writable, chunk: Buffer) {
  if (!stream.write(chunk)) await once(stream, "drain")
}

async function writeBufferEntry(stream: Writable, path: string, data: Buffer) {
  await writeChunk(stream, tarHeader(path, data.length))
  if (data.length) await writeChunk(stream, data)
  const padding = (512 - (data.length % 512)) % 512
  if (padding) await writeChunk(stream, Buffer.alloc(padding, 0))
}

async function writeFileEntry(
  stream: Writable,
  tarPath: string,
  sourcePath: string,
  bytes: number
) {
  await writeChunk(stream, tarHeader(tarPath, bytes))
  let streamed = 0
  for await (const rawChunk of createReadStream(sourcePath)) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk)
    streamed += chunk.length
    await writeChunk(stream, chunk)
  }
  if (streamed !== bytes) {
    throw unexpected(
      `Capture file changed while streaming handoff: ${sourcePath} (${streamed} != ${bytes})`
    )
  }
  const padding = (512 - (bytes % 512)) % 512
  if (padding) await writeChunk(stream, Buffer.alloc(padding, 0))
}

async function hashFile(path: string) {
  const hash = createHash("sha256")
  for await (const rawChunk of createReadStream(path)) {
    hash.update(Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk))
  }
  return hash.digest("hex")
}

export async function createStreamingCaptureHandoff(input: {
  captureDir: string
  ingestionReportPath: string
  outputDir: string
  generatedAt?: string
  codeRevision?: string
  progress?: VerificationProgress
}) {
  const captureDir = resolve(input.captureDir)
  const ingestionReportPath = resolve(input.ingestionReportPath)
  const outputDir = resolve(input.outputDir)
  const progress = input.progress ?? (() => undefined)

  const evidenceVerification = await verifyCaptureEvidencePackage(captureDir)
  if (!evidenceVerification.isValid || !evidenceVerification.package) {
    throw unexpected(
      `Capture evidence package is not valid: ${evidenceVerification.issues
        .map((issue) => issue.code)
        .join(", ")}`
    )
  }
  const evidencePackage = evidenceVerification.package
  const captureFiles = await inventoryFiles(captureDir)
  const captureBytes = captureFiles.reduce((sum, file) => sum + file.bytes, 0)

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
  if (
    reportEvidence?.isValid !== true ||
    reportEvidence?.packageChecksum !== evidencePackage.packageChecksum
  ) {
    throw unexpected(
      "Capture ingestion report is not bound to a valid matching capture evidence package"
    )
  }

  const withoutChecksum: Omit<CaptureHandoffManifest, "handoffChecksum"> = {
    schemaVersion: STREAMING_CAPTURE_HANDOFF_SCHEMA_VERSION,
    captureId: evidencePackage.captureId,
    source: evidencePackage.source,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    evidencePackageChecksum: evidencePackage.packageChecksum,
    capture: {
      path: "capture",
      files: captureFiles.length,
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

  await mkdir(outputDir, { recursive: true })
  const temporary = join(outputDir, `${evidencePackage.captureId}.handoff.streaming.tmp.tar.gz`)
  await rm(temporary, { force: true })
  const output = createWriteStream(temporary, { flags: "w" })
  const gzip = createGzip({ level: 9 })
  const archiveHash = createHash("sha256")
  gzip.on("data", (chunk: Buffer) => archiveHash.update(chunk))
  gzip.pipe(output)

  progress(
    `Streaming handoff: ${captureFiles.length} capture files, ${(captureBytes / 1024 / 1024).toFixed(1)} MiB before compression`
  )

  let writtenBytes = 0
  for (let index = 0; index < captureFiles.length; index += 1) {
    const file = captureFiles[index]
    await writeFileEntry(
      gzip,
      `capture/${file.path}`,
      join(captureDir, file.path),
      file.bytes
    )
    writtenBytes += file.bytes
    if (
      index + 1 === captureFiles.length ||
      (index + 1) % 500 === 0
    ) {
      progress(
        `Streaming handoff files: ${index + 1}/${captureFiles.length}; ${(writtenBytes / 1024 / 1024).toFixed(1)} MiB read`
      )
    }
  }

  await writeBufferEntry(gzip, "handoff.json", manifestData)
  await writeBufferEntry(gzip, "ingestion-report.json", ingestionReport)
  await writeChunk(gzip, Buffer.alloc(1024, 0))
  gzip.end()
  await Promise.all([finished(gzip), finished(output)])

  const archiveChecksum = archiveHash.digest("hex")
  const archivePath = join(
    outputDir,
    `${evidencePackage.captureId}.handoff.${archiveChecksum}.tar.gz`
  )
  await rm(archivePath, { force: true })
  await rename(temporary, archivePath)

  progress("Streaming handoff archive written; verifying without full-buffer decompression")
  const verification = await verifyStreamingCaptureHandoffArchive(archivePath, {
    progress,
  })
  if (!verification.valid) {
    throw unexpected(
      `Newly-created streaming capture handoff failed verification: ${verification.errors.join(", ")}`
    )
  }

  return { archivePath, archiveChecksum, manifest }
}

export async function verifyStreamingCaptureHandoffArchive(
  path: string,
  options: { progress?: VerificationProgress } = {}
) {
  const resolved = resolve(path)
  const progress = options.progress ?? (() => undefined)
  const errors: string[] = []

  const actualArchiveChecksum = await hashFile(resolved)
  const expectedArchiveChecksum = archiveChecksumFromFilename(resolved)
  if (!expectedArchiveChecksum) {
    errors.push("archive_filename_checksum_missing")
  } else if (expectedArchiveChecksum !== actualArchiveChecksum) {
    errors.push("archive_filename_checksum_mismatch")
  }

  const captureEntries = new Map<string, StreamedEntrySummary>()
  const seenTarPaths = new Set<string>()
  let captureBytes = 0
  let captureFiles = 0
  let parsedEntries = 0
  let sawEnd = false
  let pending = Buffer.alloc(0)

  const special = new Map<string, Buffer[]>()
  const specialPaths = new Set([
    "handoff.json",
    "ingestion-report.json",
    "capture/evidence-package.json",
    "capture/manifest.json",
  ])

  let current:
    | {
        path: string
        size: number
        remaining: number
        padding: number
        hash: ReturnType<typeof createHash>
        chunks?: Buffer[]
      }
    | undefined

  function finalizeCurrent() {
    if (!current) return
    const summary = {
      bytes: current.size,
      checksum: current.hash.digest("hex"),
    }
    if (current.path.startsWith("capture/")) {
      const relativePath = current.path.slice("capture/".length)
      captureEntries.set(relativePath, summary)
      captureFiles += 1
      captureBytes += current.size
    }
    if (current.chunks) special.set(current.path, current.chunks)
  }

  try {
    const gunzip = createGunzip()
    createReadStream(resolved).pipe(gunzip)

    for await (const rawChunk of gunzip) {
      if (sawEnd) continue
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk)
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk

      while (pending.length > 0 && !sawEnd) {
        if (!current) {
          if (pending.length < 512) break
          const header = pending.subarray(0, 512)
          pending = pending.subarray(512)
          if (header.every((byte) => byte === 0)) {
            sawEnd = true
            break
          }

          const name = header
            .subarray(0, 100)
            .toString("utf8")
            .replace(/\0.*$/, "")
          const prefix = header
            .subarray(345, 500)
            .toString("utf8")
            .replace(/\0.*$/, "")
          const entryPath = prefix ? `${prefix}/${name}` : name
          if (!safeRelativePath(entryPath)) {
            errors.push(`archive_unsafe_path:${entryPath}`)
          }
          if (seenTarPaths.has(entryPath)) {
            errors.push(`archive_duplicate_path:${entryPath}`)
          }
          seenTarPaths.add(entryPath)

          const size = parseOctal(header.subarray(124, 136))
          if (!Number.isFinite(size) || size < 0) {
            errors.push(`archive_invalid_size:${entryPath}`)
            sawEnd = true
            break
          }
          current = {
            path: entryPath,
            size,
            remaining: size,
            padding: (512 - (size % 512)) % 512,
            hash: createHash("sha256"),
            ...(specialPaths.has(entryPath) ? { chunks: [] } : {}),
          }
          parsedEntries += 1
          if (size === 0) finalizeCurrent()
        }

        if (!current) continue
        if (current.remaining > 0) {
          const take = Math.min(current.remaining, pending.length)
          if (take === 0) break
          const data = pending.subarray(0, take)
          pending = pending.subarray(take)
          current.hash.update(data)
          current.chunks?.push(Buffer.from(data))
          current.remaining -= take
          if (current.remaining > 0) break
          finalizeCurrent()
        }

        if (current.padding > 0) {
          const take = Math.min(current.padding, pending.length)
          if (take === 0) break
          pending = pending.subarray(take)
          current.padding -= take
          if (current.padding > 0) break
        }

        if (current.remaining === 0 && current.padding === 0) {
          current = undefined
          if (parsedEntries % 1000 === 0) {
            progress(`Streaming handoff verification entries: ${parsedEntries}`)
          }
        }
      }
    }
  } catch (error) {
    errors.push(
      `archive_invalid_or_truncated:${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (!sawEnd) errors.push("archive_end_marker_missing")
  if (current && (current.remaining > 0 || current.padding > 0)) {
    errors.push("archive_truncated_entry")
  }

  const handoffRaw = special.get("handoff.json")
    ? Buffer.concat(special.get("handoff.json")!)
    : undefined
  const ingestionReport = special.get("ingestion-report.json")
    ? Buffer.concat(special.get("ingestion-report.json")!)
    : undefined
  const evidenceRaw = special.get("capture/evidence-package.json")
    ? Buffer.concat(special.get("capture/evidence-package.json")!)
    : undefined
  const captureManifestRaw = special.get("capture/manifest.json")
    ? Buffer.concat(special.get("capture/manifest.json")!)
    : undefined

  if (!handoffRaw) errors.push("handoff_manifest_missing")
  if (!ingestionReport) errors.push("ingestion_report_missing")
  if (!evidenceRaw) errors.push("capture_evidence_package_missing")
  if (!captureManifestRaw) errors.push("capture_manifest_missing")

  let manifest: CaptureHandoffManifest | undefined
  if (handoffRaw) {
    try {
      manifest = JSON.parse(handoffRaw.toString("utf8")) as CaptureHandoffManifest
    } catch {
      errors.push("handoff_manifest_invalid_json")
    }
  }

  let evidence: CaptureEvidencePackage | undefined
  if (evidenceRaw) {
    try {
      evidence = JSON.parse(evidenceRaw.toString("utf8")) as CaptureEvidencePackage
    } catch {
      errors.push("capture_evidence_package_invalid_json")
    }
  }

  if (manifest) {
    if (manifest.schemaVersion !== STREAMING_CAPTURE_HANDOFF_SCHEMA_VERSION) {
      errors.push("handoff_schema_version_invalid")
    }
    if (!validLegacySource(manifest.source)) errors.push("handoff_source_invalid")
    const { handoffChecksum, ...withoutChecksum } = manifest
    if (handoffChecksum !== sourceChecksum(handoffPayload(withoutChecksum))) {
      errors.push("handoff_manifest_checksum_mismatch")
    }
    if (manifest.capture.files !== captureFiles) {
      errors.push("capture_file_count_mismatch")
    }
    if (manifest.capture.bytes !== captureBytes) {
      errors.push("capture_byte_count_mismatch")
    }
    if (
      ingestionReport &&
      (manifest.ingestionReport.bytes !== ingestionReport.length ||
        manifest.ingestionReport.checksum !== sha256(ingestionReport))
    ) {
      errors.push("ingestion_report_checksum_mismatch")
    }
  }

  if (evidence) {
    if (evidence.schemaVersion !== 1) errors.push("capture_evidence_schema_invalid")
    if (!validLegacySource(evidence.source)) errors.push("capture_source_invalid")
    if (manifest && evidence.captureId !== manifest.captureId) {
      errors.push("capture_id_mismatch")
    }
    if (manifest && evidence.source !== manifest.source) {
      errors.push("capture_source_mismatch")
    }
    if (manifest && evidence.packageChecksum !== manifest.evidencePackageChecksum) {
      errors.push("evidence_package_checksum_mismatch")
    }
    if (
      evidence.provenance?.mode !== "operator_local_browser" ||
      evidence.provenance?.transport !== "browser" ||
      !["headed", "headless"].includes(evidence.provenance?.browserMode)
    ) {
      errors.push("capture_provenance_invalid")
    }

    const files = Array.isArray(evidence.files) ? evidence.files : []
    const listedPaths = files.map((file) => file.path)
    if (
      listedPaths.some((entry) => !safeRelativePath(entry)) ||
      new Set(listedPaths).size !== listedPaths.length
    ) {
      errors.push("capture_evidence_file_inventory_invalid")
    }
    const sortedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path))
    if (JSON.stringify(sortedFiles) !== JSON.stringify(files)) {
      errors.push("capture_evidence_file_inventory_not_sorted")
    }

    const listedSet = new Set(listedPaths)
    for (const file of files) {
      const embedded = captureEntries.get(file.path)
      if (!embedded) {
        errors.push(`capture_evidence_file_missing:${file.path}`)
        continue
      }
      if (embedded.bytes !== file.bytes) {
        errors.push(`capture_evidence_file_size_mismatch:${file.path}`)
      }
      if (embedded.checksum !== file.checksum) {
        errors.push(`capture_evidence_file_checksum_mismatch:${file.path}`)
      }
    }
    for (const embeddedPath of captureEntries.keys()) {
      if (embeddedPath === "evidence-package.json") continue
      if (!listedSet.has(embeddedPath)) {
        errors.push(`capture_evidence_unlisted_file:${embeddedPath}`)
      }
    }

    const totalBytes = files.reduce((sum, file) => sum + Number(file.bytes || 0), 0)
    if (evidence.totals?.files !== files.length || evidence.totals?.bytes !== totalBytes) {
      errors.push("capture_evidence_totals_mismatch")
    }
    if (evidence.packageChecksum !== sourceChecksum(evidencePayload(evidence))) {
      errors.push("capture_evidence_semantic_checksum_mismatch")
    }
  }

  if (captureManifestRaw && evidence) {
    try {
      const captureManifest = JSON.parse(captureManifestRaw.toString("utf8")) as {
        captureId?: string
        source?: string
        transport?: string
        complete?: boolean
        failureReason?: string
      }
      if (captureManifest.captureId !== evidence.captureId) {
        errors.push("capture_manifest_id_mismatch")
      }
      if (captureManifest.source !== evidence.source) {
        errors.push("capture_manifest_source_mismatch")
      }
      if (captureManifest.transport !== "browser") {
        errors.push("capture_manifest_transport_invalid")
      }
      if (captureManifest.complete !== true) {
        errors.push("capture_manifest_not_complete")
      }
      if (captureManifest.failureReason?.trim()) {
        errors.push("capture_manifest_failure_reason_present")
      }
    } catch {
      errors.push("capture_manifest_invalid_json")
    }
  }

  if (ingestionReport && evidence) {
    try {
      const report = JSON.parse(ingestionReport.toString("utf8")) as Record<string, unknown>
      const reportCapture = report.capture as Record<string, unknown> | undefined
      if (reportCapture?.captureId !== evidence.captureId) {
        errors.push("ingestion_report_capture_id_mismatch")
      }
      const reportEvidence = reportCapture?.evidencePackage as
        | Record<string, unknown>
        | undefined
      if (
        reportEvidence?.isValid !== true ||
        reportEvidence?.packageChecksum !== evidence.packageChecksum
      ) {
        errors.push("ingestion_report_evidence_binding_invalid")
      }
    } catch {
      errors.push("ingestion_report_invalid_json")
    }
  }

  progress(
    `Streaming handoff verification complete: ${captureFiles} capture files, ${(captureBytes / 1024 / 1024).toFixed(1)} MiB`
  )

  return {
    valid: errors.length === 0,
    archiveChecksum: actualArchiveChecksum,
    errors,
    manifest,
  }
}
