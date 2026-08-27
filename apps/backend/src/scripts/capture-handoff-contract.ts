import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  createCaptureEvidencePackage,
} from "../migration/capture-evidence-package"
import {
  createCaptureHandoff,
  verifyCaptureHandoffArchive,
} from "../migration/capture-handoff"

const capturedAt = "2026-08-27T08:40:00.000Z"
const productUrl = "https://coquetteconcept.gr/default/phase-4s-handoff.html"
const mediaUrl =
  "https://coquetteconcept.gr/media/catalog/product/phase-4s-handoff.jpg"

async function writeCaptureFixture(root: string) {
  await mkdir(join(root, "pages"), { recursive: true })
  await mkdir(join(root, "media"), { recursive: true })
  const html = `<html><head><link rel="canonical" href="${productUrl}"></head><body><img src="${mediaUrl}"></body></html>`
  const media = Buffer.from("coquette-phase-4s-media")

  await writeFile(
    join(root, "manifest.json"),
    `${JSON.stringify({
      schemaVersion: 2,
      captureId: "phase-4s-handoff-contract",
      source: "https://coquetteconcept.gr",
      evidenceMode: "public_storefront",
      transport: "browser",
      startedAt: capturedAt,
      completedAt: capturedAt,
      complete: true,
      remainingQueue: 0,
      pages: { captured: 1, skipped: 0, errors: 0, products: 1 },
      media: { discovered: 1, captured: 1, skipped: 0, errors: 0 },
    }, null, 2)}\n`,
    "utf8"
  )
  await writeFile(join(root, "robots.txt"), "User-agent: *\nDisallow:\n", "utf8")
  await writeFile(join(root, "pages", "fixture.html"), html, "utf8")
  await writeFile(join(root, "media", "fixture.jpg"), media)
  await writeFile(
    join(root, "pages.jsonl"),
    `${JSON.stringify({
      sourceUrl: productUrl,
      finalUrl: productUrl,
      status: "captured",
      httpStatus: 200,
      capturedAt,
      pageFile: "pages/fixture.html",
      pageType: "product",
    })}\n`,
    "utf8"
  )
  await writeFile(
    join(root, "products.jsonl"),
    `${JSON.stringify({
      sourceUrl: productUrl,
      canonicalUrl: productUrl,
      name: "Phase 4S Handoff Contract",
      sku: "PHASE-4S-1",
    })}\n`,
    "utf8"
  )
  await writeFile(
    join(root, "media.jsonl"),
    `${JSON.stringify({
      sourceUrl: mediaUrl,
      status: "captured",
      httpStatus: 200,
      contentType: "image/jpeg",
      mediaFile: "media/fixture.jpg",
      capturedAt,
    })}\n`,
    "utf8"
  )
  await writeFile(
    join(root, "url-inventory.jsonl"),
    `${JSON.stringify({
      sourceUrl: productUrl,
      finalUrl: productUrl,
      status: "captured",
      httpStatus: 200,
      pageType: "product",
    })}\n`,
    "utf8"
  )
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "coquette-phase-4s-contract-"))
  const captureDir = join(root, "capture")
  const outputDir = join(root, "handoffs")
  const ingestionPath = join(root, "ingestion-report.json")

  try {
    await writeCaptureFixture(captureDir)
    const evidence = await createCaptureEvidencePackage({
      captureDir,
      browserMode: "headed",
      codeRevision: "phase-4s-contract-revision",
      packagedAt: "2026-08-27T08:41:00.000Z",
    })
    await writeFile(
      ingestionPath,
      `${JSON.stringify({
        schemaVersion: 3,
        generatedAt: "2026-08-27T08:42:00.000Z",
        capture: {
          captureId: evidence.captureId,
          source: evidence.source,
          evidencePackage: {
            isValid: true,
            packageChecksum: evidence.packageChecksum,
            provenanceMode: "operator_local_browser",
            transport: "browser",
            browserMode: "headed",
          },
        },
        candidates: { total: 1, ready: 1, needsReview: 0, rejected: 0, records: [] },
      }, null, 2)}\n`,
      "utf8"
    )

    const handoff = await createCaptureHandoff({
      captureDir,
      ingestionReportPath: ingestionPath,
      outputDir,
      generatedAt: "2026-08-27T08:43:00.000Z",
      codeRevision: "phase-4s-contract-revision",
    })
    assert.match(handoff.archiveChecksum, /^[a-f0-9]{64}$/)
    assert.ok(
      handoff.archivePath.endsWith(
        `.handoff.${handoff.archiveChecksum}.tar.gz`
      )
    )
    assert.equal(handoff.manifest.evidencePackageChecksum, evidence.packageChecksum)
    assert.equal(handoff.manifest.captureId, evidence.captureId)

    const verification = await verifyCaptureHandoffArchive(handoff.archivePath)
    assert.equal(verification.valid, true)
    assert.deepEqual(verification.errors, [])
    assert.equal(
      verification.manifest?.evidencePackageChecksum,
      evidence.packageChecksum
    )

    const archive = await readFile(handoff.archivePath)
    const tamperedPath = join(
      outputDir,
      `${evidence.captureId}.handoff.${handoff.archiveChecksum}.tar.gz.tampered`
    )
    const tampered = Buffer.from(archive)
    tampered[Math.max(0, tampered.length - 10)] ^= 0x01
    await writeFile(tamperedPath, tampered)
    const tamperedVerification = await verifyCaptureHandoffArchive(tamperedPath)
    assert.equal(tamperedVerification.valid, false)
    assert.ok(
      tamperedVerification.errors.includes("archive_filename_checksum_missing") ||
        tamperedVerification.errors.includes("archive_invalid_or_truncated")
    )

    const mismatchedIngestionPath = join(root, "mismatched-ingestion.json")
    await writeFile(
      mismatchedIngestionPath,
      `${JSON.stringify({
        capture: {
          captureId: "another-capture",
          evidencePackage: { packageChecksum: evidence.packageChecksum },
        },
      })}\n`,
      "utf8"
    )
    await assert.rejects(
      () =>
        createCaptureHandoff({
          captureDir,
          ingestionReportPath: mismatchedIngestionPath,
          outputDir,
        }),
      /captureId does not match evidence package/
    )

    console.log(
      "COQUETTE Phase 4S single-file verified operator capture handoff contract passed"
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
