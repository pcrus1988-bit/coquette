import { spawn } from "node:child_process"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import { MedusaError } from "@medusajs/framework/utils"
import { createCaptureHandoff } from "../migration/capture-handoff"

const execFileAsync = promisify(execFile)

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function assertOperatorEnvironment() {
  const ci = (process.env.CI ?? "").toLowerCase()
  const actions = (process.env.GITHUB_ACTIONS ?? "").toLowerCase()
  if (["1", "true", "yes", "on"].includes(ci) || ["1", "true", "yes", "on"].includes(actions)) {
    throw unexpected(
      "The one-command COQUETTE capture handoff must run on an accepted local/operator browser network, not CI/GitHub Actions."
    )
  }
}

function pnpmExecutable() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm"
}

async function runPnpm(
  repoRoot: string,
  script: string,
  env: NodeJS.ProcessEnv,
  showStdout = true
) {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(
      pnpmExecutable(),
      ["--filter", "@coquette/backend", script],
      {
        cwd: repoRoot,
        env,
        stdio: ["inherit", showStdout ? "inherit" : "ignore", "inherit"],
        shell: false,
      }
    )
    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      reject(
        unexpected(
          `${script} failed${signal ? ` with signal ${signal}` : ` with exit code ${code ?? "unknown"}`}`
        )
      )
    })
  })
}

async function gitRevision(repoRoot: string) {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      timeout: 5_000,
    })
    return stdout.trim() || undefined
  } catch {
    return undefined
  }
}

async function main() {
  assertOperatorEnvironment()

  const repoRoot = resolve(process.cwd(), "../..")
  const captureId =
    process.env.COQUETTE_CAPTURE_ID?.trim() ||
    `coquetteconcept-${new Date().toISOString().replace(/[:.]/g, "-")}`
  const migrationRoot = resolve(
    process.env.COQUETTE_MIGRATION_DATA_DIR?.trim() ||
      join(repoRoot, "migration-data")
  )
  const captureDir = resolve(
    process.env.COQUETTE_CAPTURE_DIR?.trim() ||
      join(migrationRoot, "storefront-captures", captureId)
  )
  const workDir = join(migrationRoot, "capture-handoff-work", captureId)
  const ingestionReportPath = join(workDir, "ingestion-report.json")
  const outputDir = resolve(
    process.env.COQUETTE_CAPTURE_HANDOFF_DIR?.trim() ||
      join(migrationRoot, "capture-handoffs")
  )
  await mkdir(workDir, { recursive: true })
  await mkdir(outputDir, { recursive: true })

  const revision = await gitRevision(repoRoot)
  const commonEnv: NodeJS.ProcessEnv = {
    ...process.env,
    COQUETTE_CAPTURE_ID: captureId,
    COQUETTE_CAPTURE_DIR: captureDir,
    ...(revision ? { COQUETTE_CAPTURE_CODE_REVISION: revision } : {}),
  }

  console.log(`COQUETTE legacy capture: ${captureId}`)
  console.log(`Browser mode: ${commonEnv.COQUETTE_CAPTURE_BROWSER_MODE ?? "headed"}`)
  console.log(`Capture directory: ${captureDir}`)

  await runPnpm(repoRoot, "storefront:capture:operator", commonEnv, true)

  await runPnpm(
    repoRoot,
    "capture:ingest",
    {
      ...commonEnv,
      COQUETTE_CAPTURE_INGESTION_REPORT: ingestionReportPath,
    },
    false
  )

  const handoff = await createCaptureHandoff({
    captureDir,
    ingestionReportPath,
    outputDir,
    codeRevision: revision,
  })

  console.log(
    JSON.stringify(
      {
        status: "verified_handoff_ready",
        captureId,
        archive: handoff.archivePath,
        archiveChecksum: handoff.archiveChecksum,
        evidencePackageChecksum: handoff.manifest.evidencePackageChecksum,
        handoffChecksum: handoff.manifest.handoffChecksum,
        captureFiles: handoff.manifest.capture.files,
        captureBytes: handoff.manifest.capture.bytes,
        instruction:
          "This .tar.gz is the single COQUETTE migration handoff file. Preserve it unchanged; its full SHA-256 is embedded in the filename.",
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
