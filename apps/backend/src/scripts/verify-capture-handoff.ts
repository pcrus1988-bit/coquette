import { MedusaError } from "@medusajs/framework/utils"
import { resolve } from "node:path"
import { verifyCaptureHandoffArchive } from "../migration/capture-handoff"

async function main() {
  const archivePath = process.env.COQUETTE_CAPTURE_HANDOFF_FILE?.trim()
  if (!archivePath) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "COQUETTE_CAPTURE_HANDOFF_FILE is required"
    )
  }

  const verification = await verifyCaptureHandoffArchive(resolve(archivePath))
  console.log(
    JSON.stringify(
      {
        archive: resolve(archivePath),
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
