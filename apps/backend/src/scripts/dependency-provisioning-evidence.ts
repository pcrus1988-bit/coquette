import { MedusaError } from "@medusajs/framework/utils"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { buildDependencyProvisioningEvidencePlan } from "../migration/dependency-provisioning-evidence"
import type { ReviewDecision } from "../migration/review-decisions"

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

async function readDecisions(path?: string) {
  if (!path?.trim()) return []
  const value = JSON.parse(await readFile(resolve(path), "utf8")) as unknown
  if (!Array.isArray(value)) {
    throw unexpected("COQUETTE_REVIEW_DECISIONS_FILE must contain a JSON array")
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
  const handoffPath = process.env.COQUETTE_CAPTURE_HANDOFF_FILE?.trim()
  const outputPath = process.env.COQUETTE_DEPENDENCY_PROVISIONING_EVIDENCE?.trim()
  if (!handoffPath || !outputPath) {
    throw unexpected(
      "COQUETTE_CAPTURE_HANDOFF_FILE and COQUETTE_DEPENDENCY_PROVISIONING_EVIDENCE are required"
    )
  }

  const decisions = await readDecisions(process.env.COQUETTE_REVIEW_DECISIONS_FILE)
  const plan = await buildDependencyProvisioningEvidencePlan({
    handoffPath,
    decisions,
  })
  await atomicWriteJson(outputPath, plan)

  console.log(
    JSON.stringify(
      {
        captureId: plan.captureId,
        migrationInputBundleChecksum: plan.migrationInputBundleChecksum,
        intakeChecksum: plan.intakeChecksum,
        planChecksum: plan.planChecksum,
        totals: plan.totals,
        isReadyForProvisioning: plan.isReadyForProvisioning,
        blocked: plan.entries
          .filter((entry) => entry.state === "blocked")
          .map((entry) => ({
            entityType: entry.entityType,
            sourceId: entry.sourceId,
            candidateKeys: entry.candidateKeys,
            blockers: entry.blockers,
          })),
        ready: plan.entries
          .filter((entry) => entry.state === "ready")
          .map((entry) => ({
            entityType: entry.entityType,
            sourceId: entry.sourceId,
            categoryName: entry.category?.name,
            brandName: entry.brand?.name,
            mediaFile: entry.media?.mediaFile,
            mediaChecksum: entry.media?.checksum,
          })),
        outputPath: resolve(outputPath),
        next: plan.isReadyForProvisioning
          ? "Use this exact checksum-pinned evidence plan as the only input to the guarded staging dependency provisioner."
          : "Resolve the listed evidence gaps from the verified handoff; do not create guessed dependency targets.",
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
