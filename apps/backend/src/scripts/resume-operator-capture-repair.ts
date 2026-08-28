import { createHash } from "node:crypto"
import { spawn } from "node:child_process"
import {
  access,
  mkdir,
  open,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path"
import { MedusaError } from "@medusajs/framework/utils"
import {
  CAPTURE_EVIDENCE_PACKAGE_FILE,
  createCaptureEvidencePackage,
  verifyCaptureEvidencePackage,
} from "../migration/capture-evidence-package"
import { createCaptureHandoff } from "../migration/capture-handoff"
import { BrowserTransport } from "../reconstruction/browser-transport"
import { checksum, extractPageEvidence } from "../reconstruction/html-evidence"

const LEGACY_BASE_URL = "https://coquetteconcept.gr/"
const DEFAULT_PART_BYTES = 200 * 1024 * 1024
const DEFAULT_MEDIA_TIMEOUT_MS = 30_000

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

function truthy(value?: string) {
  return ["1", "true", "yes", "on"].includes((value ?? "").toLowerCase())
}

function assertOperatorEnvironment() {
  if (truthy(process.env.CI) || truthy(process.env.GITHUB_ACTIONS)) {
    throw unexpected(
      "COQUETTE capture repair resume must run on the accepted local/operator browser network, not CI/GitHub Actions."
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

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
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

async function reusablePageRecord(record: PageRecord, repairDir: string) {
  const candidates = [...new Set([record.finalUrl, record.sourceUrl].filter(Boolean))] as string[]
  for (const finalUrl of candidates) {
    const pageFilename = `${checksum(finalUrl).slice(0, 24)}.html`
    const relativePageFile = join("pages", pageFilename)
    const path = join(repairDir, relativePageFile)
    if (!(await exists(path))) continue
    try {
      const html = await readFile(path, "utf8")
      if (!/<html\b/i.test(html)) continue
      const evidence = extractPageEvidence(html, finalUrl)
      return pageRecordFromEvidence({
        sourceUrl: record.sourceUrl,
        finalUrl,
        httpStatus: record.httpStatus ?? 200,
        contentType: "text/html",
        capturedAt: new Date().toISOString(),
        pageFile: relativePageFile,
        evidence,
      })
    } catch {
      // Fall through to a browser retry for this one URL.
    }
  }
  return undefined
}

async function reusableMediaRecord(url: string, mediaDir: string) {
  const filename = safeMediaFilename(url)
  const path = join(mediaDir, filename)
  if (!(await exists(path))) return undefined
  try {
    const buffer = await readFile(path)
    return {
      sourceUrl: url,
      status: "captured" as const,
      bytes: buffer.length,
      checksum: sha256(buffer),
      mediaFile: join("media", filename),
      capturedAt: new Date().toISOString(),
    }
  } catch {
    return undefined
  }
}

async function downloadMedia(
  url: string,
  mediaDir: string,
  browserHeaders: Record<string, string>,
  timeoutMs: number
): Promise<MediaRecord> {
  const capturedAt = new Date().toISOString()
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
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
    await writeFile(join(mediaDir, filename), buffer)
    return {
      sourceUrl: url,
      status: "captured",
      httpStatus: response.status,
      contentType: contentType ?? undefined,
      bytes: buffer.length,
      checksum: sha256(buffer),
      mediaFile: join("media", filename),
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

async function concurrentMapWithProgress<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
  label: string
) {
  const results = new Array<R>(values.length)
  let cursor = 0
  let completed = 0

  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= values.length) return
      results[index] = await mapper(values[index])
      completed += 1
      if (completed === values.length || completed % 100 === 0) {
        console.log(`${label}: ${completed}/${values.length}`)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker())
  )
  return results
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

async function writeCheckpoint(input: {
  repairDir: string
  sourceManifest: CaptureManifest
  repairCaptureId: string
  repairedPages: PageRecord[]
  productRecords: Record<string, unknown>[]
  mediaRecords?: MediaRecord[]
  unresolved: PageRecord[]
}) {
  const pagesPath = join(input.repairDir, "pages.jsonl")
  const productsPath = join(input.repairDir, "products.jsonl")
  const mediaPath = join(input.repairDir, "media.jsonl")
  const urlInventoryPath = join(input.repairDir, "url-inventory.jsonl")
  const completedAt = new Date().toISOString()

  await writeJsonl(pagesPath, input.repairedPages)
  await writeJsonl(productsPath, input.productRecords)
  if (input.mediaRecords) await writeJsonl(mediaPath, input.mediaRecords)
  await writeJsonl(
    urlInventoryPath,
    input.repairedPages.map((record) => ({
      sourceUrl: record.sourceUrl,
      finalUrl: record.finalUrl,
      status: record.status,
      httpStatus: record.httpStatus,
      pageType: record.pageType,
      checksum: record.checksum,
      error: record.error,
    }))
  )

  const mediaRecords = input.mediaRecords ?? (await readJsonl<MediaRecord>(mediaPath))
  const manifest: CaptureManifest = {
    ...input.sourceManifest,
    captureId: input.repairCaptureId,
    completedAt,
    discovery: {
      ...(input.sourceManifest.discovery ?? {}),
      queuedUrls: input.repairedPages.length,
      visitedUrls: input.repairedPages.length,
    },
    pages: {
      captured: input.repairedPages.filter((record) => record.status === "captured").length,
      skipped: input.repairedPages.filter((record) => record.status === "skipped").length,
      errors: input.repairedPages.filter((record) => record.status === "error").length,
      products: input.productRecords.length,
    },
    media: {
      discovered: mediaRecords.length,
      captured: mediaRecords.filter((record) => record.status === "captured").length,
      skipped: mediaRecords.filter((record) => record.status === "skipped").length,
      errors: mediaRecords.filter((record) => record.status === "error").length,
      bytes: mediaRecords.reduce((sum, record) => sum + (record.bytes ?? 0), 0),
    },
    complete: input.unresolved.length === 0,
    remainingQueue: 0,
    ...(input.unresolved.length
      ? { failureReason: "targeted_capture_repair_incomplete" }
      : { failureReason: undefined }),
    repair: {
      sourceCaptureId: input.sourceManifest.captureId,
      resumedAt: completedAt,
      remainingRetryFailures: input.unresolved.length,
    },
  }
  if (manifest.failureReason === undefined) delete manifest.failureReason
  await writeFile(
    join(input.repairDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  )
  return manifest
}

async function main() {
  assertOperatorEnvironment()

  const repoRoot = resolve(process.cwd(), "../..")
  const sourceCaptureDirRaw = process.env.COQUETTE_CAPTURE_DIR?.trim()
  const repairDirRaw = process.env.COQUETTE_CAPTURE_REPAIR_DIR?.trim()
  if (!sourceCaptureDirRaw || !repairDirRaw) {
    throw unexpected(
      "COQUETTE_CAPTURE_DIR and COQUETTE_CAPTURE_REPAIR_DIR are both required for resume."
    )
  }

  const sourceCaptureDir = resolve(sourceCaptureDirRaw)
  const repairDir = resolve(repairDirRaw)
  if (!(await exists(repairDir))) {
    throw unexpected(`Repair capture directory does not exist: ${repairDir}`)
  }
  const repairRelativeToSource = relative(sourceCaptureDir, repairDir)
  if (
    repairRelativeToSource === "" ||
    (!repairRelativeToSource.startsWith("..") && !isAbsolute(repairRelativeToSource))
  ) {
    throw unexpected("Repair capture directory must be separate from the verified source capture")
  }

  const sourceManifest = JSON.parse(
    await readFile(join(sourceCaptureDir, "manifest.json"), "utf8")
  ) as CaptureManifest
  if (!sourceManifest.captureId?.trim()) throw unexpected("Source captureId is missing")
  if (!safeCaptureSource(sourceManifest.source)) {
    throw unexpected(`Capture repair resume is locked to ${LEGACY_BASE_URL}`)
  }
  if (sourceManifest.transport !== "browser" || sourceManifest.complete !== true) {
    throw unexpected("Source capture must be a complete browser capture")
  }

  const repairCaptureId = basename(repairDir)
  const sourcePages = await readJsonl<PageRecord>(join(sourceCaptureDir, "pages.jsonl"))
  const sourceMedia = await readJsonl<MediaRecord>(join(sourceCaptureDir, "media.jsonl"))
  const targetIndexes = sourcePages
    .map((record, index) => ({ record, index }))
    .filter(
      ({ record }) =>
        record.status === "skipped" && record.error === "Non-HTML response"
    )
  if (!targetIndexes.length) throw unexpected("Source capture has no targeted retry records")

  console.log(`COQUETTE targeted capture repair resume: ${repairCaptureId}`)
  console.log(`Source capture: ${sourceCaptureDir}`)
  console.log(`Repair capture: ${repairDir}`)

  const repairedPages = [...sourcePages]
  let reusedPages = 0
  const browserRetryIndexes: Array<{ record: PageRecord; index: number }> = []
  for (const target of targetIndexes) {
    const reusable = await reusablePageRecord(target.record, repairDir)
    if (reusable) {
      repairedPages[target.index] = reusable
      reusedPages += 1
    } else {
      browserRetryIndexes.push(target)
    }
  }
  console.log(
    `Recovered-page checkpoint reuse: ${reusedPages}/${targetIndexes.length}; browser retries needed: ${browserRetryIndexes.length}`
  )

  const browser = await BrowserTransport.launch()
  try {
    for (let retryIndex = 0; retryIndex < browserRetryIndexes.length; retryIndex += 1) {
      const { record, index } = browserRetryIndexes[retryIndex]
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
      } else {
        const finalUrl = response.url || record.sourceUrl
        const evidence = extractPageEvidence(response.text, finalUrl)
        const pageFilename = `${checksum(finalUrl).slice(0, 24)}.html`
        const relativePageFile = join("pages", pageFilename)
        await writeFile(join(repairDir, relativePageFile), response.text, "utf8")
        repairedPages[index] = pageRecordFromEvidence({
          sourceUrl: record.sourceUrl,
          finalUrl,
          httpStatus: response.status,
          contentType: response.contentType || "text/html",
          capturedAt,
          pageFile: relativePageFile,
          evidence,
        })
      }
      console.log(`Browser retry: ${retryIndex + 1}/${browserRetryIndexes.length}`)
    }

    const productsByUrl = new Map<string, Record<string, unknown>>()
    const mediaUrls = new Set<string>()
    for (let index = 0; index < repairedPages.length; index += 1) {
      const record = repairedPages[index]
      if (record.status !== "captured" || !record.pageFile) continue
      const path = join(repairDir, record.pageFile)
      if (!(await exists(path))) continue
      try {
        const html = await readFile(path, "utf8")
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
      } catch {
        // Existing evidence stays visible in the page record.
      }
    }

    const productRecords = [...productsByUrl.values()].sort((left, right) =>
      String(left.sourceUrl).localeCompare(String(right.sourceUrl))
    )
    const unresolved = targetIndexes
      .map(({ index }) => repairedPages[index])
      .filter((record) => record.status !== "captured")

    await writeCheckpoint({
      repairDir,
      sourceManifest,
      repairCaptureId,
      repairedPages,
      productRecords,
      unresolved,
    })

    if (unresolved.length) {
      console.log(
        JSON.stringify(
          {
            status: "targeted_repair_residual_requires_classification",
            captureId: repairCaptureId,
            unresolved: unresolved.map((record) => ({
              sourceUrl: record.sourceUrl,
              finalUrl: record.finalUrl,
              httpStatus: record.httpStatus,
              contentType: record.contentType,
              error: record.error,
            })),
            instruction:
              "Do not discard the repair. Classify the residual URL from direct evidence before continuing media/handoff generation.",
          },
          null,
          2
        )
      )
      throw unexpected(`Targeted repair has ${unresolved.length} unresolved URL(s)`)
    }

    const mediaDir = join(repairDir, "media")
    await mkdir(mediaDir, { recursive: true })
    const mediaByUrl = new Map<string, MediaRecord>()
    for (const record of sourceMedia) {
      if (record.sourceUrl && !mediaByUrl.has(record.sourceUrl)) {
        mediaByUrl.set(record.sourceUrl, record)
      }
    }

    const pending: string[] = []
    let reusedMedia = 0
    for (const url of mediaUrls) {
      const existing = mediaByUrl.get(url)
      if (
        existing?.status === "captured" &&
        existing.mediaFile &&
        (await exists(join(repairDir, existing.mediaFile)))
      ) {
        continue
      }
      const reusable = await reusableMediaRecord(url, mediaDir)
      if (reusable) {
        mediaByUrl.set(url, reusable)
        reusedMedia += 1
      } else {
        pending.push(url)
      }
    }

    console.log(
      `Media resume: already tracked=${mediaUrls.size - pending.length - reusedMedia}; recovered from interrupted run=${reusedMedia}; network pending=${pending.length}`
    )

    const browserHeaders = await browser.requestHeaders()
    const timeoutMs = Number.parseInt(
      process.env.COQUETTE_MEDIA_FETCH_TIMEOUT_MS ?? String(DEFAULT_MEDIA_TIMEOUT_MS),
      10
    )
    const mediaResults = await concurrentMapWithProgress(
      pending,
      4,
      (url) =>
        downloadMedia(
          url,
          mediaDir,
          browserHeaders,
          Number.isFinite(timeoutMs) && timeoutMs > 0
            ? timeoutMs
            : DEFAULT_MEDIA_TIMEOUT_MS
        ),
      "Media downloads"
    )
    for (const result of mediaResults) mediaByUrl.set(result.sourceUrl, result)

    const mediaRecords = [...mediaByUrl.values()].sort((left, right) =>
      left.sourceUrl.localeCompare(right.sourceUrl)
    )
    const manifest = await writeCheckpoint({
      repairDir,
      sourceManifest,
      repairCaptureId,
      repairedPages,
      productRecords,
      mediaRecords,
      unresolved: [],
    })
    if (!manifest.complete) throw unexpected("Repaired manifest unexpectedly incomplete")
  } finally {
    await browser.close()
  }

  await rm(join(repairDir, CAPTURE_EVIDENCE_PACKAGE_FILE), { force: true })
  const revision = process.env.COQUETTE_CAPTURE_CODE_REVISION?.trim()
  const evidencePackage = await createCaptureEvidencePackage({
    captureDir: repairDir,
    browserMode: "headed",
    codeRevision: revision,
    operatorLabel: "targeted_capture_repair_resume",
  })
  const evidenceVerification = await verifyCaptureEvidencePackage(repairDir)
  if (!evidenceVerification.isValid) {
    throw unexpected(
      `Repaired capture evidence failed verification: ${evidenceVerification.issues
        .map((issue) => issue.code)
        .join(", ")}`
    )
  }

  const migrationRoot = resolve(
    process.env.COQUETTE_MIGRATION_DATA_DIR?.trim() ||
      join(repoRoot, "migration-data")
  )
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
