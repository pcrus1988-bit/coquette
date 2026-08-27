import { MedusaError } from "@medusajs/framework/utils"
import { resolve } from "node:path"
import { verifyCaptureEvidencePackage } from "../migration/capture-evidence-package"

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

async function main() {
  const captureDir = process.env.COQUETTE_CAPTURE_DIR?.trim()
  if (!captureDir) {
    throw unexpected("COQUETTE_CAPTURE_DIR is required")
  }

  const verification = await verifyCaptureEvidencePackage(resolve(captureDir))
  console.log(
    JSON.stringify(
      {
        captureDir: resolve(captureDir),
        isValid: verification.isValid,
        critical: verification.critical,
        review: verification.review,
        packageChecksum: verification.package?.packageChecksum,
        recomputedPackageChecksum: verification.recomputedPackageChecksum,
        provenance: verification.package?.provenance,
        totals: verification.package?.totals,
        issues: verification.issues,
      },
      null,
      2
    )
  )

  if (!verification.isValid) process.exitCode = 2
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
