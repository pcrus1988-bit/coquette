import { MedusaError } from "@medusajs/framework/utils"
import { stat } from "node:fs/promises"
import { resolve } from "node:path"
import { verifyCaptureHandoffArchive } from "../migration/capture-handoff"
import { verifyStreamingCaptureHandoffArchive } from "../migration/streaming-capture-handoff"

const STREAMING_THRESHOLD_BYTES = 512 * 1024 * 1024

async function main() {
  const archivePath = process.env.COQUETTE_CAPTURE_HANDOFF_FILE?.trim()
  if (!archivePath) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "COQUETTE_CAPTURE_HANDOFF_FILE is required"
    )
  }

  const resolvedArchive = resolve(archivePath)
  const metadata = await stat(resolvedArchive)
  const verification =
    metadata.size > STREAMING_THRESHOLD_BYTES
      ? await verifyStreamingCaptureHandoffArchive(resolvedArchive, {
          progress: (message) => console.log(message),
        })
      : await verifyCaptureHandoffArchive(resolvedArchive)

  console.log(
    JSON.stringify(
      {
        archive: resolvedArchive,
        verificationMode:
          metadata.size > STREAMING_THRESHOLD_BYTES ? "streaming" : "buffered",
        archiveBytes: metadata.size,
        archiveChecksum: verification.archiveChecksum,
        valid: verification.valid,
        errors: verification.errors,
        captureId: verification.manifest?.captureId,
        evidencePackageChecksum: verification.manifest?.evidencePackageChecksum,
        handoffChecksum: verification.manifest?.handoffChecksum,
      },
      null,
      2
    )
  )

  if (!verification.valid) process.exitCode = 2
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
