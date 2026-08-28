import { createHash } from "node:crypto"
import { spawn } from "node:child_process"
import {
  access,
  cp,
  mkdir,
  open,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { basename, extname, join, resolve } from "node:path"
import { MedusaError } from "@medusajs/framework/utils"
import {
  CAPTURE_EVIDENCE_PACKAGE_FILE,
  createCaptureEvidencePackage,
  verifyCaptureEvidencePackage,
} from "../migration/capture-evidence-package"
import { createCaptureHandoff } from "../migration/capture-handoff"
import { BrowserTransport } from "../reconstruction/browser-transport"
import {
  checksum,
  extractPageEvidence,
} from "../reconstruction/html-evidence"

const LEGACY_BASE_URL = "https://coquetteconcept.gr/"
const DEFAULT_PART_BYTES = 200 * 1024 * 1024

type PageRecord = {
  sourceUrl: string
  finalUrl?: string
  status: "captured" | "skipped" | "error"
  httpStatus?: number
  contentType?: string
  capturedAt: string
  pageFile?: string
  checksum?: string
  pageType?: string
  title?: string
  canonicalUrl?: string
  discoveredLinks: number
  discoveredMedia: number
  error?: string
}

type MediaRecord = {
  sourceUrl: string
  status: "captured" | "skipped" | "error"
  httpStatus?: number
  contentType?: string
  bytes?: number
  checksum?: string
  mediaFile?: string
  capturedAt: string
  error?: string
}

type CaptureManifest = {
  schemaVersion?: number
  captureId: string
  source: string
  evidenceMode?: string
  transport?: string
  startedAt?: string
  completedAt?: string
  options?: Record<string, unknown>
  robots?: Record<string, unknown>
  discovery?: Record<string, unknown>
  pages?: Record<string, unknown>
  media?: Record<string, unknown>
  complete?: boolean
  remainingQueue?: number
  failureReason?: string
  [key: string]: unknown
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function assertOperatorEnvironment() {
  const truthy = (value?: string) =>
    ["1", "true", "yes", "on"].includes((value ?? "").toLowerCase())
  if (truthy(process.env.CI) || truthy(process.env.GITHUB_ACTIONS)) {
    throw unexpected(
      "Targeted COQUETTE capture repair must run on the accepted local/operator browser network, not CI/GitHub Actions."
    )
  }
}

function safeCaptureSource(value: string) {
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

function normalizePath(value: string) {
  return value.replace(/\\/g, "/")
}

async function readJsonl<T>(path: string): Promise<T[]> {
  const raw = await readFile(path, "utf8")
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

async function writeJsonl(path: string, values: unknown[]) {
  await writeFile(
    path,
    values.map((value) => `${JSON.stringify(value)}\n`).join(""),
    "utf8"
  )
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex")
}

function safeMediaFilename(url: string, contentType?: string | null) {
  const parsed = new URL(url)
  const sourceName = basename(parsed.pathname).replace(/[^a-zA-Z0-9._-]+/g, "-")
  const sourceExtension = extname(sourceName).toLowerCase()
  const byMime: Record<string, string> = {
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
  }
  const extension =
    sourceExtension || byMime[(contentType ?? "").split(";")[0]] || ".bin"
  const stem =
    sourceName
      .slice(0, sourceName.length - sourceExtension.length)
      .slice(0, 80) || "media"
  return `${sha256(url).slice(0, 20)}-${stem}${extension}`
}

async function concurrentMap<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
) {
  const results = new Array<R>(values.length)
  let cursor = 0

  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= values.length) return
      results[index] = await mapper(values[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker())
  )
  return results
}

async function downloadMedia(
  url: string,
  mediaDir: string,
  browserHeaders: Record<string, string>
): Promise<MediaRecord> {
  const capturedAt = new Date().toISOString()
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          browserHeaders["user-agent"] ??
          "COQUETTE-Reconstruction/1.0 (+legacy storefront preservation)",
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        ...(browserHeaders.cookie ? { cookie: browserHeaders.cookie } : {}),
      },
    })

    if (!response.ok) {
      return {
        sourceUrl: url,
        status: "error",
        httpStatus: response.status,
        capturedAt,
        error: `HTTP ${response.status}`,
      }
    }

    const contentType = response.headers.get("content-type")
    if (contentType && !contentType.toLowerCase().startsWith("image/")) {
      return {
        sourceUrl: url,
        status: "skipped",
        httpStatus: response.status,
        contentType,
        capturedAt,
        error: "Non-image response",
      }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const filename = safeMediaFilename(url, contentType)
    const relativePath = join("media", filename)
    await writeFile(join(mediaDir, filename), buffer)
    return {
      sourceUrl: url,
      status: "captured",
      httpStatus: response.status,
      contentType: contentType ?? undefined,
      bytes: buffer.length,
      checksum: sha256(buffer),
      mediaFile: relativePath,
      capturedAt,
    }
  } catch (error) {
    return {
      sourceUrl: url,
      status: "error",
      capturedAt,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function pageRecordFromEvidence(input: {
  sourceUrl: string
  finalUrl: string
  httpStatus: number
  contentType: string
  capturedAt: string
  pageFile: string
  evidence: ReturnType<typeof extractPageEvidence>
}): PageRecord {
  return {
    sourceUrl: input.sourceUrl,
    finalUrl: input.finalUrl,
    status: "captured",
    httpStatus: input.httpStatus,
    contentType: input.contentType,
    capturedAt: input.capturedAt,
    pageFile: input.pageFile,
    checksum: input.evidence.checksum,
    pageType: input.evidence.pageType,
    title: input.evidence.title,
    canonicalUrl: input.evidence.canonicalUrl,
    discoveredLinks: input.evidence.links.length,
    discoveredMedia: input.evidence.media.length,
  }
}

function productRecord(
  finalUrl: string,
  evidence: ReturnType<typeof extractPageEvidence>
) {
  if (evidence.pageType !== "product" || !evidence.product) return undefined
  return {
    sourceUrl: finalUrl,
    checksum: evidence.checksum,
    title: evidence.title,
    canonicalUrl: evidence.canonicalUrl,
    hreflang: evidence.hreflang,
    ...evidence.product,
  }
}

function pnpmExecutable() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm"
}

async function runPnpm(
  repoRoot: string,
  script: string,
  env: NodeJS.ProcessEnv,
  showStdout = false
) {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(
      pnpmExecutable(),
      ["--filter", "@coquette/backend", script],
      {
        cwd: repoRoot,
        env,
        stdio: ["inherit", showStdout ? "inherit" : "ignore", "inherit"],
        shell: process.platform === "win32",
      }
    )
    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (code === 0) return resolvePromise()
      reject(
        unexpected(
          `${script} failed${signal ? ` with signal ${signal}` : ` with exit code ${code ?? "unknown"}`}`
        )
      )
    })
  })
}

async function splitArchive(path: string, partBytes: number) {
  const metadata = await stat(path)
  if (metadata.size <= partBytes) return []

  const input = await open(path, "r")
  const buffer = Buffer.alloc(4 * 1024 * 1024)
  const parts: Array<{ path: string; bytes: number; checksum: string }> = []
  let position = 0
  let partNumber = 1

  try {
    while (position < metadata.size) {
      const partPath = `${path}.part${String(partNumber).padStart(3, "0")}`
      const output = await open(partPath, "w")
      const hash = createHash("sha256")
      let written = 0
      try {
        const wanted = Math.min(partBytes, metadata.size - position)
        while (written < wanted) {
          const length = Math.min(buffer.length, wanted - written)
          const { bytesRead } = await input.read(buffer, 0, length, position)
          if (bytesRead <= 0) break
          await output.write(buffer, 0, bytesRead)
          hash.update(buffer.subarray(0, bytesRead))
          position += bytesRead
          written += bytesRead
        }
      } finally {
        await output.close()
      }
      parts.push({
        path: partPath,
        bytes: written,
        checksum: hash.digest("hex"),
      })
      partNumber += 1
    }
  } finally {
    await input.close()
  }
  return parts
}

async function main() {
  assertOperatorEnvironment()

  const repoRoot = resolve(process.cwd(), "../..")
  const sourceCaptureDirRaw = process.env.COQUETTE_CAPTURE_DIR?.trim()
  if (!sourceCaptureDirRaw) {
    throw unexpected(
      "COQUETTE_CAPTURE_DIR is required and must point to the verified source capture being repaired."
    )
  }
  const sourceCaptureDir = resolve(sourceCaptureDirRaw)
  const sourceManifest = JSON.parse(
    await readFile(join(sourceCaptureDir, "manifest.json"), "utf8")
  ) as CaptureManifest
  if (!sourceManifest.captureId?.trim()) throw unexpected("Source captureId is missing")
  if (!safeCaptureSource(sourceManifest.source)) {
    throw unexpected(`Capture repair is locked to ${LEGACY_BASE_URL}`)
  }
  if (sourceManifest.transport !== "browser" || sourceManifest.complete !== true) {
    throw unexpected("Source capture must be a complete browser capture before targeted repair")
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const repairCaptureId =
    process.env.COQUETTE_CAPTURE_REPAIR_ID?.trim() ||
    `${sourceManifest.captureId}-repair-${timestamp}`
  const migrationRoot = resolve(
    process.env.COQUETTE_MIGRATION_DATA_DIR?.trim() ||
      join(repoRoot, "migration-data")
  )
  const repairDir = resolve(
    process.env.COQUETTE_CAPTURE_REPAIR_DIR?.trim() ||
      join(migrationRoot, "storefront-captures", repairCaptureId)
  )
  if (repairDir === sourceCaptureDir || repairDir.startsWith(`${sourceCaptureDir}/`)) {
    throw unexpected("Repair capture directory must be separate from the verified source capture")
  }
  try {
    await access(repairDir)
    throw unexpected(`Repair capture directory already exists: ${repairDir}`)
  } catch (error) {
    if (error instanceof MedusaError) throw error
  }

  console.log(`COQUETTE targeted capture repair: ${repairCaptureId}`)
  console.log(`Source capture: ${sourceCaptureDir}`)
  console.log(`Repair capture: ${repairDir}`)

  await cp(sourceCaptureDir, repairDir, {
    recursive: true,
    errorOnExist: true,
    filter: (source) => basename(source) !== CAPTURE_EVIDENCE_PACKAGE_FILE,
  })
  await rm(join(repairDir, CAPTURE_EVIDENCE_PACKAGE_FILE), { force: true })

  const pagesPath = join(repairDir, "pages.jsonl")
  const productsPath = join(repairDir, "products.jsonl")
  const mediaPath = join(repairDir, "media.jsonl")
  const urlInventoryPath = join(repairDir, "url-inventory.jsonl")
  const pagesDir = join(repairDir, "pages")
  const mediaDir = join(repairDir, "media")
  await mkdir(pagesDir, { recursive: true })
  await mkdir(mediaDir, { recursive: true })

  const originalPages = await readJsonl<PageRecord>(pagesPath)
  const originalMedia = await readJsonl<MediaRecord>(mediaPath)
  const targetIndexes = originalPages
    .map((record, index) => ({ record, index }))
    .filter(
      ({ record }) =>
        record.status === "skipped" && record.error === "Non-HTML response"
    )
  if (targetIndexes.length === 0) {
    throw unexpected("Source capture contains no Non-HTML response records to repair")
  }

  const browser = await BrowserTransport.launch()
  const repairedPages = [...originalPages]
  const recovered = new Set<number>()
  try {
    for (const { record, index } of targetIndexes) {
      const response = await browser.fetchText(record.sourceUrl)
      const capturedAt = new Date().toISOString()
      if (
        !response.ok ||
        !/html|xhtml/i.test(response.contentType || "text/html") ||
        !/<html\b/i.test(response.text)
      ) {
        repairedPages[index] = {
          ...record,
          finalUrl: response.url || record.finalUrl,
          httpStatus: response.status,
          contentType: response.contentType,
          capturedAt,
          error: response.ok
            ? `Targeted repair still received non-HTML DOM (${response.contentType || "unknown"})`
            : `Targeted repair HTTP ${response.status}`,
        }
        continue
      }

      const finalUrl = response.url || record.sourceUrl
      const evidence = extractPageEvidence(response.text, finalUrl)
      const pageFilename = `${checksum(finalUrl).slice(0, 24)}.html`
      const relativePageFile = join("pages", pageFilename)
      await writeFile(join(pagesDir, pageFilename), response.text, "utf8")
      repairedPages[index] = pageRecordFromEvidence({
        sourceUrl: record.sourceUrl,
        finalUrl,
        httpStatus: response.status,
        contentType: response.contentType || "text/html",
        capturedAt,
        pageFile: relativePageFile,
        evidence,
      })
      recovered.add(index)
    }

    // Reparse every captured HTML page with the repaired Magento extractor and
    // build one product evidence record per final public URL.
    const productsByUrl = new Map<string, Record<string, unknown>>()
    const mediaUrls = new Set<string>()
    for (let index = 0; index < repairedPages.length; index += 1) {
      const record = repairedPages[index]
      if (record.status !== "captured" || !record.pageFile) continue
      const path = join(repairDir, normalizePath(record.pageFile))
      let html: string
      try {
        html = await readFile(path, "utf8")
      } catch {
        continue
      }
      const finalUrl = record.finalUrl || record.sourceUrl
      const evidence = extractPageEvidence(html, finalUrl)
      repairedPages[index] = pageRecordFromEvidence({
        sourceUrl: record.sourceUrl,
        finalUrl,
        httpStatus: record.httpStatus ?? 200,
        contentType: record.contentType ?? "text/html",
        capturedAt: record.capturedAt,
        pageFile: record.pageFile,
        evidence,
      })
      for (const url of evidence.media) mediaUrls.add(url)
      const product = productRecord(finalUrl, evidence)
      if (product && !productsByUrl.has(finalUrl)) productsByUrl.set(finalUrl, product)
    }

    const mediaByUrl = new Map<string, MediaRecord>()
    for (const record of originalMedia) {
      if (record.sourceUrl && !mediaByUrl.has(record.sourceUrl)) {
        mediaByUrl.set(record.sourceUrl, record)
      }
    }

    const browserHeaders = await browser.requestHeaders()
    const mediaToRetry = [...mediaUrls].filter((url) => {
      const existing = mediaByUrl.get(url)
      if (!existing || existing.status !== "captured" || !existing.mediaFile) return true
      return false
    })
    console.log(
      `Targeted pages recovered: ${recovered.size}/${targetIndexes.length}; media retry/new: ${mediaToRetry.length}`
    )
    const mediaResults = await concurrentMap(mediaToRetry, 4, (url) =>
      downloadMedia(url, mediaDir, browserHeaders)
    )
    for (const result of mediaResults) mediaByUrl.set(result.sourceUrl, result)

    const remainingNonHtml = repairedPages.filter(
      (record) =>
        record.status === "skipped" &&
        (record.error === "Non-HTML response" ||
          record.error?.startsWith("Targeted repair still received non-HTML DOM"))
    ).length
    const repairErrors = repairedPages.filter(
      (record) => record.status === "error"
    ).length
    const completedAt = new Date().toISOString()
    const mediaRecords = [...mediaByUrl.values()].sort((left, right) =>
      left.sourceUrl.localeCompare(right.sourceUrl)
    )
    const productRecords = [...productsByUrl.values()].sort((left, right) =>
      String(left.sourceUrl).localeCompare(String(right.sourceUrl))
    )

    await writeJsonl(pagesPath, repairedPages)
    await writeJsonl(productsPath, productRecords)
    await writeJsonl(mediaPath, mediaRecords)
    await writeJsonl(
      urlInventoryPath,
      repairedPages.map((record) => ({
        sourceUrl: record.sourceUrl,
        finalUrl: record.finalUrl,
        status: record.status,
        httpStatus: record.httpStatus,
        pageType: record.pageType,
        checksum: record.checksum,
        error: record.error,
      }))
    )

    const manifest: CaptureManifest = {
      ...sourceManifest,
      captureId: repairCaptureId,
      completedAt,
      discovery: {
        ...(sourceManifest.discovery ?? {}),
        queuedUrls: repairedPages.length,
        visitedUrls: repairedPages.length,
      },
      pages: {
        captured: repairedPages.filter((record) => record.status === "captured").length,
        skipped: repairedPages.filter((record) => record.status === "skipped").length,
        errors: repairErrors,
        products: productRecords.length,
      },
      media: {
        discovered: mediaRecords.length,
        captured: mediaRecords.filter((record) => record.status === "captured").length,
        skipped: mediaRecords.filter((record) => record.status === "skipped").length,
        errors: mediaRecords.filter((record) => record.status === "error").length,
        bytes: mediaRecords.reduce((sum, record) => sum + (record.bytes ?? 0), 0),
      },
      complete: remainingNonHtml === 0 && repairErrors === 0,
      remainingQueue: 0,
      ...(remainingNonHtml > 0 || repairErrors > 0
        ? { failureReason: "targeted_capture_repair_incomplete" }
        : { failureReason: undefined }),
      repair: {
        sourceCaptureId: sourceManifest.captureId,
        repairedAt: completedAt,
        retriedNonHtmlUrls: targetIndexes.length,
        recoveredHtmlUrls: recovered.size,
        remainingNonHtmlUrls: remainingNonHtml,
      },
    }
    if (manifest.failureReason === undefined) delete manifest.failureReason
    await writeFile(
      join(repairDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    )

    if (!manifest.complete) {
      throw unexpected(
        `Targeted repair is incomplete: remainingNonHtml=${remainingNonHtml}, pageErrors=${repairErrors}`
      )
    }
  } finally {
    await browser.close()
  }

  const revision = process.env.COQUETTE_CAPTURE_CODE_REVISION?.trim()
  const evidencePackage = await createCaptureEvidencePackage({
    captureDir: repairDir,
    browserMode: "headed",
    codeRevision: revision,
    operatorLabel: "targeted_capture_repair",
  })
  const evidenceVerification = await verifyCaptureEvidencePackage(repairDir)
  if (!evidenceVerification.isValid) {
    throw unexpected(
      `Repaired capture evidence failed verification: ${evidenceVerification.issues
        .map((issue) => issue.code)
        .join(", ")}`
    )
  }

  const workDir = join(migrationRoot, "capture-handoff-work", repairCaptureId)
  const ingestionReportPath = join(workDir, "ingestion-report.json")
  const handoffDir = resolve(
    process.env.COQUETTE_CAPTURE_HANDOFF_DIR?.trim() ||
      join(migrationRoot, "capture-handoffs")
  )
  await mkdir(workDir, { recursive: true })
  await mkdir(handoffDir, { recursive: true })
  await runPnpm(
    repoRoot,
    "capture:ingest",
    {
      ...process.env,
      COQUETTE_CAPTURE_DIR: repairDir,
      COQUETTE_CAPTURE_INGESTION_REPORT: ingestionReportPath,
    },
    false
  )

  const handoff = await createCaptureHandoff({
    captureDir: repairDir,
    ingestionReportPath,
    outputDir: handoffDir,
    codeRevision: revision,
  })
  const partBytes = Number.parseInt(
    process.env.COQUETTE_CAPTURE_HANDOFF_PART_BYTES ?? String(DEFAULT_PART_BYTES),
    10
  )
  const parts = await splitArchive(
    handoff.archivePath,
    Number.isFinite(partBytes) && partBytes > 0 ? partBytes : DEFAULT_PART_BYTES
  )

  console.log(
    JSON.stringify(
      {
        status: "verified_repaired_handoff_ready",
        captureId: repairCaptureId,
        sourceCaptureId: sourceManifest.captureId,
        repairCaptureDir: repairDir,
        archive: handoff.archivePath,
        archiveChecksum: handoff.archiveChecksum,
        evidencePackageChecksum: evidencePackage.packageChecksum,
        handoffChecksum: handoff.manifest.handoffChecksum,
        splitParts: parts,
        instruction:
          parts.length > 0
            ? "Upload every .partNNN file unchanged. The receiver will concatenate in numeric order and verify the full archive SHA-256 before intake."
            : "Archive is below the split threshold and can be transferred unchanged.",
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
