import { MedusaError } from "@medusajs/framework/utils"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { sourceChecksum } from "../migration/checksum"
import type { RecoveryProductCandidate } from "../migration/recovery-candidates"
import { buildStagingTargetPolicyApplication } from "../migration/staging-target-policy"

type CaptureIngestionReport = {
  schemaVersion?: number
  capture?: {
    captureId?: string
    evidencePackage?: {
      isValid?: boolean
      packageChecksum?: string
    }
  }
  candidates?: {
    records?: RecoveryProductCandidate[]
  }
}

async function atomicWriteJson(path: string, value: unknown) {
  const target = resolve(path)
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  await rename(temporary, target)
}

async function main() {
  const reportPath = process.env.COQUETTE_CAPTURE_INGESTION_REPORT?.trim()
  const outputPath = process.env.COQUETTE_STAGING_TARGET_POLICY_BUNDLE?.trim()
  if (!reportPath || !outputPath) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "COQUETTE_CAPTURE_INGESTION_REPORT and COQUETTE_STAGING_TARGET_POLICY_BUNDLE are required"
    )
  }

  const report = JSON.parse(
    await readFile(resolve(reportPath), "utf8")
  ) as CaptureIngestionReport
  if (report.schemaVersion !== 3) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Capture ingestion report schemaVersion 3 is required"
    )
  }
  if (report.capture?.evidencePackage?.isValid !== true) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "A valid operator capture evidence package is required"
    )
  }

  const evidencePackageChecksum = report.capture.evidencePackage.packageChecksum?.trim()
  if (!evidencePackageChecksum) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Capture evidence package checksum is required"
    )
  }
  const expectedEvidenceChecksum =
    process.env.COQUETTE_EXPECTED_EVIDENCE_PACKAGE_CHECKSUM?.trim()
  if (
    expectedEvidenceChecksum &&
    expectedEvidenceChecksum !== evidencePackageChecksum
  ) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Evidence package checksum mismatch: expected ${expectedEvidenceChecksum}, received ${evidencePackageChecksum}`
    )
  }

  const candidates = report.candidates?.records ?? []
  if (candidates.length === 0) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Recovered product candidates are required"
    )
  }

  const application = buildStagingTargetPolicyApplication(candidates)
  const withoutChecksum = {
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    captureId: report.capture?.captureId,
    evidencePackageChecksum,
    sourceIngestionReportChecksum: sourceChecksum(report),
    application,
  }
  const bundle = {
    ...withoutChecksum,
    bundleChecksum: sourceChecksum(withoutChecksum),
  }
  await atomicWriteJson(outputPath, bundle)

  console.log(
    JSON.stringify(
      {
        status: application.isExecutable
          ? "staging_target_policy_slice_ready"
          : "staging_target_policy_slice_blocked",
        captureId: report.capture?.captureId,
        evidencePackageChecksum,
        sourceIngestionReportChecksum: bundle.sourceIngestionReportChecksum,
        bundleChecksum: bundle.bundleChecksum,
        sourceCandidateCount: application.sourceCandidateCount,
        eligibleCandidateCount: application.eligibleCandidateCount,
        quarantinedCandidateCount: application.quarantinedCandidateCount,
        productPlanTotals: application.productPlan.totals,
        productPlanExecutable: application.productPlan.isExecutable,
        policy: application.policy,
        output: resolve(outputPath),
      },
      null,
      2
    )
  )

  if (!application.isExecutable) process.exitCode = 3
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
