import { randomBytes } from "node:crypto"
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { MedusaError } from "@medusajs/framework/utils"
import {
  createCaptureEvidencePackage,
  verifyCaptureEvidencePackage,
} from "../migration/capture-evidence-package"
import {
  createStreamingCaptureHandoff,
  verifyStreamingCaptureHandoffArchive,
} from "../migration/streaming-capture-handoff"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
  }
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "coquette-streaming-handoff-"))
  try {
    const captureDir = join(root, "capture")
    const workDir = join(root, "work")
    const outputDir = join(root, "handoffs")
    await mkdir(join(captureDir, "media"), { recursive: true })
    await mkdir(workDir, { recursive: true })

    const captureId = "streaming-handoff-contract"
    await writeFile(
      join(captureDir, "manifest.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          captureId,
          source: "https://coquetteconcept.gr/",
          evidenceMode: "operator_local_browser",
          transport: "browser",
          complete: true,
          remainingQueue: 0,
          pages: { captured: 1, skipped: 0, errors: 0, products: 1 },
          media: { discovered: 1, captured: 1, skipped: 0, errors: 0 },
        },
        null,
        2
      )}\n`,
      "utf8"
    )
    await writeFile(
      join(captureDir, "pages.jsonl"),
      `${JSON.stringify({ sourceUrl: "https://coquetteconcept.gr/default/test.html", status: "captured" })}\n`,
      "utf8"
    )
    await writeFile(
      join(captureDir, "products.jsonl"),
      `${JSON.stringify({ sourceUrl: "https://coquetteconcept.gr/default/test.html", title: "Test" })}\n`,
      "utf8"
    )
    await writeFile(
      join(captureDir, "media.jsonl"),
      `${JSON.stringify({ sourceUrl: "https://coquetteconcept.gr/media/test.bin", status: "captured", mediaFile: "media/test.bin" })}\n`,
      "utf8"
    )
    await writeFile(
      join(captureDir, "url-inventory.jsonl"),
      `${JSON.stringify({ sourceUrl: "https://coquetteconcept.gr/default/test.html", status: "captured" })}\n`,
      "utf8"
    )
    await writeFile(join(captureDir, "robots.txt"), "User-agent: *\n", "utf8")
    await writeFile(join(captureDir, "media", "test.bin"), randomBytes(2 * 1024 * 1024))

    const evidence = await createCaptureEvidencePackage({
      captureDir,
      browserMode: "headed",
      codeRevision: "streaming-contract",
      operatorLabel: "streaming_contract",
      packagedAt: "2026-08-29T00:00:00.000Z",
    })
    const evidenceVerification = await verifyCaptureEvidencePackage(captureDir)
    assert(evidenceVerification.isValid, "Evidence package fixture must verify")

    const ingestionReportPath = join(workDir, "ingestion-report.json")
    await writeFile(
      ingestionReportPath,
      `${JSON.stringify(
        {
          capture: {
            captureId,
            evidencePackage: {
              isValid: true,
              packageChecksum: evidence.packageChecksum,
            },
          },
        },
        null,
        2
      )}\n`,
      "utf8"
    )

    const handoff = await createStreamingCaptureHandoff({
      captureDir,
      ingestionReportPath,
      outputDir,
      generatedAt: "2026-08-29T00:00:00.000Z",
      codeRevision: "streaming-contract",
    })
    const verification = await verifyStreamingCaptureHandoffArchive(handoff.archivePath)
    assert(verification.valid, `Streaming handoff must verify: ${verification.errors.join(", ")}`)
    assert(
      verification.archiveChecksum === handoff.archiveChecksum,
      "Streaming handoff archive checksum must round-trip"
    )
    assert(
      verification.manifest?.handoffChecksum === handoff.manifest.handoffChecksum,
      "Streaming handoff semantic checksum must round-trip"
    )

    const archive = await readFile(handoff.archivePath)
    assert(archive.length > 100, "Streaming contract archive unexpectedly small")
    archive[Math.floor(archive.length / 2)] ^= 0xff
    const tamperedDir = join(root, "tampered")
    await mkdir(tamperedDir, { recursive: true })
    const tamperedPath = join(tamperedDir, basename(handoff.archivePath))
    await writeFile(tamperedPath, archive)
    const tampered = await verifyStreamingCaptureHandoffArchive(tamperedPath)
    assert(!tampered.valid, "Tampered streaming handoff must fail closed")
    assert(
      tampered.errors.includes("archive_filename_checksum_mismatch"),
      `Tampered archive must fail checksum binding: ${tampered.errors.join(", ")}`
    )

    console.log(
      JSON.stringify(
        {
          status: "streaming_capture_handoff_contract_passed",
          archive: handoff.archivePath,
          archiveChecksum: handoff.archiveChecksum,
          evidencePackageChecksum: evidence.packageChecksum,
          handoffChecksum: handoff.manifest.handoffChecksum,
        },
        null,
        2
      )
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
