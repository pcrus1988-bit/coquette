import { createHash } from "node:crypto"
import { spawn } from "node:child_process"
import {
  mkdir,
  open,
  readFile,
  stat,
} from "node:fs/promises"
import { basename, join, resolve } from "node:path"
import { MedusaError } from "@medusajs/framework/utils"
import {
  CAPTURE_EVIDENCE_PACKAGE_FILE,
  createCaptureEvidencePackage,
  type CaptureEvidencePackage,
} from "../migration/capture-evidence-package"
import { createStreamingCaptureHandoff } from "../migration/streaming-capture-handoff"

const DEFAULT_PART_BYTES = 200 * 1024 * 1024

type CaptureManifest = {
  captureId?: string
  source?: string
  transport?: string
  complete?: boolean
  remainingQueue?: number
  failureReason?: string
  pages?: {
    captured?: number
    skipped?: number
    errors?: number
    products?: number
  }
  repair?: {
    remainingRetryFailures?: number
  }
}

type IngestionReport = {
  capture?: {
    captureId?: string
    evidencePackage?: {
      isValid?: boolean
      packageChecksum?: string
    }
    validation?: {
      isValid?: boolean
      critical?: number
      review?: number
    }
  }
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
      "COQUETTE repaired capture finalization must run on the operator machine, not CI/GitHub Actions."
    )
  }
}

function safeCaptureSource(value?: string) {
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

async function readExistingEvidencePackage(path: string) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as CaptureEvidencePackage
    return parsed
  } catch {
    return undefined
  }
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
      console.log(
        `Handoff split: part${String(partNumber).padStart(3, "0")} ${(written / 1024 / 1024).toFixed(1)} MiB`
      )
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
  const repairDirRaw = process.env.COQUETTE_CAPTURE_REPAIR_DIR?.trim()
  if (!repairDirRaw) {
    throw unexpected(
      "COQUETTE_CAPTURE_REPAIR_DIR is required and must point to the completed repaired capture."
    )
  }
  const repairDir = resolve(repairDirRaw)
  const manifest = JSON.parse(
    await readFile(join(repairDir, "manifest.json"), "utf8")
  ) as CaptureManifest

  if (!manifest.captureId?.trim()) throw unexpected("Repaired captureId is missing")
  if (!safeCaptureSource(manifest.source)) {
    throw unexpected("Repaired capture source must be https://coquetteconcept.gr/")
  }
  if (manifest.transport !== "browser") {
    throw unexpected("Repaired capture must retain browser transport provenance")
  }
  if (manifest.complete !== true || manifest.remainingQueue !== 0) {
    throw unexpected("Repaired capture is not complete or still has a remaining queue")
  }
  if (manifest.failureReason?.trim()) {
    throw unexpected(`Repaired capture still has failureReason=${manifest.failureReason}`)
  }
  if ((manifest.repair?.remainingRetryFailures ?? 0) !== 0) {
    throw unexpected("Repaired capture still has unresolved targeted retry failures")
  }
  if ((manifest.pages?.skipped ?? 0) !== 0 || (manifest.pages?.errors ?? 0) !== 0) {
    throw unexpected("Repaired capture still has skipped/error page records")
  }

  const migrationRoot = resolve(
    process.env.COQUETTE_MIGRATION_DATA_DIR?.trim() ||
      join(repoRoot, "migration-data")
  )
  const workDir = join(migrationRoot, "capture-handoff-work", manifest.captureId)
  const ingestionReportPath = join(workDir, "ingestion-report.json")
  const handoffDir = resolve(
    process.env.COQUETTE_CAPTURE_HANDOFF_DIR?.trim() ||
      join(migrationRoot, "capture-handoffs")
  )
  await mkdir(workDir, { recursive: true })
  await mkdir(handoffDir, { recursive: true })

  console.log(`COQUETTE repaired capture finalize-only: ${manifest.captureId}`)
  console.log(`Repair capture: ${repairDir}`)
  console.log(
    `Pages: captured=${manifest.pages?.captured ?? "unknown"}; products=${manifest.pages?.products ?? "unknown"}`
  )

  const revision = process.env.COQUETTE_CAPTURE_CODE_REVISION?.trim()
  const evidencePath = join(repairDir, CAPTURE_EVIDENCE_PACKAGE_FILE)
  let evidencePackage = await readExistingEvidencePackage(evidencePath)

  if (evidencePackage) {
    console.log(
      `Reusing existing evidence package ${evidencePackage.packageChecksum}; capture:ingest will revalidate every bound file before handoff creation.`
    )
  } else {
    console.log("No reusable evidence package found; generating it from the final repaired capture state...")
    evidencePackage = await createCaptureEvidencePackage({
      captureDir: repairDir,
      browserMode: "headed",
      codeRevision: revision,
      operatorLabel: "targeted_capture_repair_finalize",
    })
    console.log(
      `Evidence package generated: ${evidencePackage.packageChecksum}; files=${evidencePackage.totals.files}; bytes=${evidencePackage.totals.bytes}`
    )
  }

  console.log("Validating capture + evidence and regenerating the bound ingestion report...")
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

  const ingestionReport = JSON.parse(
    await readFile(ingestionReportPath, "utf8")
  ) as IngestionReport
  if (ingestionReport.capture?.captureId !== manifest.captureId) {
    throw unexpected("Regenerated ingestion report captureId does not match repaired capture")
  }
  if (
    ingestionReport.capture?.evidencePackage?.isValid !== true ||
    ingestionReport.capture.evidencePackage.packageChecksum !== evidencePackage.packageChecksum
  ) {
    throw unexpected(
      "Regenerated ingestion report is not bound to the existing valid evidence package"
    )
  }
  if (ingestionReport.capture?.validation?.isValid !== true) {
    throw unexpected(
      `Regenerated ingestion report still contains critical validation issues (${ingestionReport.capture?.validation?.critical ?? "unknown"})`
    )
  }
  console.log(
    `Ingestion report ready: ${ingestionReportPath}; critical=${ingestionReport.capture.validation.critical ?? 0}; review=${ingestionReport.capture.validation.review ?? 0}`
  )

  console.log("Building large handoff with streaming tar/gzip (bounded memory)...")
  const handoff = await createStreamingCaptureHandoff({
    captureDir: repairDir,
    ingestionReportPath,
    outputDir: handoffDir,
    codeRevision: revision,
    progress: (message) => console.log(message),
  })

  const partBytes = Number.parseInt(
    process.env.COQUETTE_CAPTURE_HANDOFF_PART_BYTES ?? String(DEFAULT_PART_BYTES),
    10
  )
  const resolvedPartBytes =
    Number.isFinite(partBytes) && partBytes > 0 ? partBytes : DEFAULT_PART_BYTES
  console.log(
    `Streaming handoff verified. Splitting at ${(resolvedPartBytes / 1024 / 1024).toFixed(0)} MiB if required...`
  )
  const parts = await splitArchive(handoff.archivePath, resolvedPartBytes)

  console.log(
    JSON.stringify(
      {
        status: "verified_repaired_handoff_ready",
        captureId: manifest.captureId,
        repairCaptureDir: repairDir,
        archive: handoff.archivePath,
        archiveChecksum: handoff.archiveChecksum,
        evidencePackageChecksum: evidencePackage.packageChecksum,
        handoffChecksum: handoff.manifest.handoffChecksum,
        archiveBytes: (await stat(handoff.archivePath)).size,
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
