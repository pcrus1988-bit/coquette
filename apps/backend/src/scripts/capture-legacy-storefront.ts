import { writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { captureStorefront } from "../reconstruction/capture-storefront"

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

async function main() {
  const captureId =
    process.env.COQUETTE_CAPTURE_ID ??
    `coquetteconcept-${new Date().toISOString().replace(/[:.]/g, "-")}`

  const outputDir = resolve(
    process.env.COQUETTE_CAPTURE_DIR ??
      `migration-data/storefront-captures/${captureId}`
  )

  const manifest = await captureStorefront({
    baseUrl:
      process.env.COQUETTE_CAPTURE_BASE_URL ?? "https://coquetteconcept.gr/",
    outputDir,
    captureId,
    maxPages: integerEnv("COQUETTE_CAPTURE_MAX_PAGES", 5000),
    delayMs: integerEnv("COQUETTE_CAPTURE_DELAY_MS", 125),
    downloadMedia: booleanEnv("COQUETTE_CAPTURE_DOWNLOAD_MEDIA", true),
    mediaConcurrency: integerEnv("COQUETTE_CAPTURE_MEDIA_CONCURRENCY", 6),
    respectRobots: booleanEnv("COQUETTE_CAPTURE_RESPECT_ROBOTS", true),
    browser: booleanEnv("COQUETTE_CAPTURE_BROWSER", true),
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

  console.log(JSON.stringify({ outputDir, manifest: finalManifest }, null, 2))

  if (!finalManifest.complete) {
    process.exitCode = 2
  }

  if (zeroPageCapture) {
    console.error("Capture completed without preserving any public HTML pages")
    process.exitCode = 3
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
