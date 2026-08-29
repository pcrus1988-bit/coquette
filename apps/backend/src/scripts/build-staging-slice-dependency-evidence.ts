import { MedusaError } from "@medusajs/framework/utils"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import type { CaptureEvidencePackage } from "../migration/capture-evidence-package"
import {
  buildStagingSliceDependencyEvidencePlan,
  type StagingSliceMediaRecord,
  type StagingSliceProductRecord,
  type StagingSliceSourceIngestionReport,
  type StagingTargetPolicyBundle,
} from "../migration/staging-slice-dependency-evidence"

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

async function atomicWriteJson(path: string, value: unknown) {
  const target = resolve(path)
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  await rename(temporary, target)
}

async function readJson<T>(path: string) {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T
}

async function readJsonl<T>(path: string) {
  return (await readFile(resolve(path), "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

function histogram(values: string[]) {
  const counts = new Map<string, number>()
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
  return Object.fromEntries(
    [...counts.entries()].sort((left, right) => {
      const count = right[1] - left[1]
      return count !== 0 ? count : left[0].localeCompare(right[0])
    })
  )
}

async function main() {
  const captureDir = process.env.COQUETTE_CAPTURE_DIR?.trim()
  const reportPath = process.env.COQUETTE_CAPTURE_INGESTION_REPORT?.trim()
  const policyPath = process.env.COQUETTE_STAGING_TARGET_POLICY_BUNDLE?.trim()
  const outputPath = process.env.COQUETTE_STAGING_SLICE_DEPENDENCY_EVIDENCE?.trim()
  const expectedEvidencePackageChecksum =
    process.env.COQUETTE_EXPECTED_EVIDENCE_PACKAGE_CHECKSUM?.trim()

  if (!captureDir || !reportPath || !policyPath || !outputPath) {
    throw unexpected(
      "COQUETTE_CAPTURE_DIR, COQUETTE_CAPTURE_INGESTION_REPORT, COQUETTE_STAGING_TARGET_POLICY_BUNDLE and COQUETTE_STAGING_SLICE_DEPENDENCY_EVIDENCE are required"
    )
  }

  const resolvedCaptureDir = resolve(captureDir)
  const [report, policyBundle, evidencePackage, mediaRecords, products] =
    await Promise.all([
      readJson<StagingSliceSourceIngestionReport>(reportPath),
      readJson<StagingTargetPolicyBundle>(policyPath),
      readJson<CaptureEvidencePackage>(join(resolvedCaptureDir, "evidence-package.json")),
      readJsonl<StagingSliceMediaRecord>(join(resolvedCaptureDir, "media.jsonl")),
      readJsonl<StagingSliceProductRecord>(join(resolvedCaptureDir, "products.jsonl")),
    ])

  const plan = await buildStagingSliceDependencyEvidencePlan({
    captureDir: resolvedCaptureDir,
    report,
    policyBundle,
    evidencePackage,
    mediaRecords,
    products,
    expectedEvidencePackageChecksum,
  })
  await atomicWriteJson(outputPath, plan)

  const entityTotals = Object.fromEntries(
    ["category", "media", "brand"].map((entityType) => [
      entityType,
      {
        ready: plan.entries.filter(
          (entry) => entry.entityType === entityType && entry.state === "ready"
        ).length,
        blocked: plan.entries.filter(
          (entry) => entry.entityType === entityType && entry.state === "blocked"
        ).length,
      },
    ])
  )
  const blockedReasons = histogram(
    plan.entries
      .filter((entry) => entry.state === "blocked")
      .flatMap((entry) => entry.blockers)
  )

  console.log(
    JSON.stringify(
      {
        status: plan.isReadyForProvisioning
          ? "staging_slice_dependency_evidence_ready"
          : "staging_slice_dependency_evidence_blocked",
        captureId: plan.captureId,
        evidencePackageChecksum: plan.captureEvidencePackageChecksum,
        sourceIngestionReportChecksum: plan.sourceIngestionReportChecksum,
        stagingTargetPolicyBundleChecksum:
          plan.stagingTargetPolicyBundleChecksum,
        requirementsChecksum: plan.requirementsChecksum,
        planChecksum: plan.planChecksum,
        totals: plan.totals,
        entityTotals,
        blockedReasonTotals: blockedReasons,
        globalBlockers: plan.globalBlockers,
        output: resolve(outputPath),
      },
      null,
      2
    )
  )

  if (!plan.isReadyForProvisioning) process.exitCode = 3
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
