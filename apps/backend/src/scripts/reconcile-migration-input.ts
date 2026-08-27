import { MedusaError } from "@medusajs/framework/utils"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import {
  buildMigrationInputReconciliation,
  type CaptureIngestionReportForReconciliation,
} from "../migration/migration-input-reconciliation"
import type { ReviewDecision } from "../migration/review-decisions"

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T
}

async function optionalDecisions(path?: string): Promise<ReviewDecision[]> {
  if (!path?.trim()) return []
  const value = await readJson<unknown>(path)
  if (!Array.isArray(value)) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "COQUETTE_REVIEW_DECISIONS_FILE must contain a JSON array"
    )
  }
  return value as ReviewDecision[]
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
  const outputPath = process.env.COQUETTE_MIGRATION_RECONCILIATION_BUNDLE?.trim()
  if (!reportPath || !outputPath) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "COQUETTE_CAPTURE_INGESTION_REPORT and COQUETTE_MIGRATION_RECONCILIATION_BUNDLE are required"
    )
  }

  const report = await readJson<CaptureIngestionReportForReconciliation>(reportPath)
  const decisions = await optionalDecisions(
    process.env.COQUETTE_REVIEW_DECISIONS_FILE
  )
  const bundle = buildMigrationInputReconciliation({ report, decisions })
  await atomicWriteJson(outputPath, bundle)

  console.log(
    JSON.stringify(
      {
        captureId: bundle.captureId,
        bundleChecksum: bundle.bundleChecksum,
        isReconciled: bundle.isReconciled,
        isReadyForStagingExecution: bundle.isReadyForStagingExecution,
        blockers: bundle.globalBlockers,
        warnings: bundle.warnings,
        productTotals: bundle.productPlan.totals,
        priceTotals: bundle.pricePlan.totals,
        inventoryTotals: bundle.inventoryPlan.totals,
        reviewTotals: bundle.reviewPlan.totals,
        unresolvedUrls: bundle.urlUniverse.unresolved,
      },
      null,
      2
    )
  )

  if (!bundle.isReadyForStagingExecution) {
    process.exitCode = 3
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
