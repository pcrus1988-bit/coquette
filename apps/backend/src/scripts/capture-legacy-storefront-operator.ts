import { MedusaError } from "@medusajs/framework/utils"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import {
  createCaptureEvidencePackage,
  verifyCaptureEvidencePackage,
} from "../migration/capture-evidence-package"
import { captureStorefront } from "../reconstruction/capture-storefront"

const execFileAsync = promisify(execFile)
const LEGACY_BASE_URL = "https://coquetteconcept.gr/"

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function integerEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function booleanEnv(name: string, fallback: boolean) {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  return !["0", "false", "no", "off"].includes(raw.toLowerCase())
}

function browserMode() {
  const value = process.env.COQUETTE_CAPTURE_BROWSER_MODE?.trim() || "headed"
  if (value !== "headed" && value !== "headless") {
    throw unexpected(
      "COQUETTE_CAPTURE_BROWSER_MODE must be either 'headed' or 'headless'"
    )
  }
  return value
}

function assertOperatorEnvironment() {
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    throw unexpected(
      "Operator direct capture refuses CI/GitHub Actions. Run it from an accepted local/operator browser network."
    )
  }

  const configured = process.env.COQUETTE_CAPTURE_BASE_URL ?? LEGACY_BASE_URL
  let url: URL
  try {
    url = new URL(configured)
  } catch {
    throw unexpected("COQUETTE_CAPTURE_BASE_URL must be a valid HTTPS URL")
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "coquetteconcept.gr" ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw unexpected(
      `Operator direct capture is locked to ${LEGACY_BASE_URL}; received ${configured}`
    )
  }
}

async function gitRevision() {
  if (process.env.COQUETTE_CAPTURE_CODE_REVISION?.trim()) {
    return process.env.COQUETTE_CAPTURE_CODE_REVISION.trim()
  }
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      timeout: 5_000,
    })
    const revision = stdout.trim()
    return revision || undefined
  } catch {
    return undefined
  }
}

async function main() {
  assertOperatorEnvironment()
  const mode = browserMode()

  process.env.COQUETTE_CAPTURE_CHALLENGE_TIMEOUT_MS ??= "120000"
  process.env.COQUETTE_CAPTURE_BROWSER_MODE = mode

  const captureId =
    process.env.COQUETTE_CAPTURE_ID ??
    `coquetteconcept-operator-${new Date().toISOString().replace(/[:.]/g, "-")}`
  const outputDir = resolve(
    process.env.COQUETTE_CAPTURE_DIR ??
      `migration-data/storefront-captures/${captureId}`
  )

  const manifest = await captureStorefront({
    baseUrl: LEGACY_BASE_URL,
    outputDir,
    captureId,
    maxPages: integerEnv("COQUETTE_CAPTURE_MAX_PAGES", 5000),
    delayMs: integerEnv("COQUETTE_CAPTURE_DELAY_MS", 175),
    downloadMedia: booleanEnv("COQUETTE_CAPTURE_DOWNLOAD_MEDIA", true),
    mediaConcurrency: integerEnv("COQUETTE_CAPTURE_MEDIA_CONCURRENCY", 4),
    respectRobots: booleanEnv("COQUETTE_CAPTURE_RESPECT_ROBOTS", true),
    browser: true,
  })

  const zeroPageCapture = manifest.pages.captured === 0
  const finalManifest = zeroPageCapture
    ? {
        ...manifest,
        complete: false,
        failureReason: "zero_public_html_pages_captured",
      }
    : manifest

  if (zeroPageCapture) {
    await writeFile(
      join(outputDir, "manifest.json"),
      `${JSON.stringify(finalManifest, null, 2)}\n`,
      "utf8"
    )
  }

  const evidencePackage = await createCaptureEvidencePackage({
    captureDir: outputDir,
    browserMode: mode,
    codeRevision: await gitRevision(),
    operatorLabel: process.env.COQUETTE_CAPTURE_OPERATOR_LABEL,
  })
  const verification = await verifyCaptureEvidencePackage(outputDir)

  console.log(
    JSON.stringify(
      {
        outputDir,
        captureId,
        captureComplete: finalManifest.complete,
        pagesCaptured: finalManifest.pages.captured,
        pageErrors: finalManifest.pages.errors,
        productsCaptured: finalManifest.pages.products,
        mediaCaptured: finalManifest.media.captured,
        evidencePackageChecksum: evidencePackage.packageChecksum,
        evidencePackageValid: verification.isValid,
        evidencePackageIssues: verification.issues,
        next: `COQUETTE_CAPTURE_DIR=${outputDir} pnpm --filter @coquette/backend capture:ingest`,
      },
      null,
      2
    )
  )

  if (!finalManifest.complete) process.exitCode = 2
  if (zeroPageCapture) process.exitCode = 3
  if (!verification.isValid) process.exitCode = 4
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
