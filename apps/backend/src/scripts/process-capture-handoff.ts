import { MedusaError } from "@medusajs/framework/utils"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import {
  buildCaptureHandoffIntake,
  readVerifiedCaptureHandoffReport,
} from "../migration/capture-handoff-intake"
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
  if (!handoffPath) {
    throw unexpected("COQUETTE_CAPTURE_HANDOFF_FILE is required")
  }

  const verified = await readVerifiedCaptureHandoffReport(handoffPath)
  const decisions = await readDecisions(process.env.COQUETTE_REVIEW_DECISIONS_FILE)
  const intake = await buildCaptureHandoffIntake({
    handoffPath,
    decisions,
  })

  const defaultOutputDir = resolve(
    process.cwd(),
    "../../migration-data/handoff-intake",
    verified.manifest.captureId
  )
  const outputDir = resolve(
    process.env.COQUETTE_HANDOFF_INTAKE_DIR?.trim() || defaultOutputDir
  )
  await mkdir(outputDir, { recursive: true })

  const migrationInputPath = join(outputDir, "migration-input.json")
  const reviewWorklistPath = join(outputDir, "review-worklist.json")
  const dependencyRequirementsPath = join(
    outputDir,
    "dependency-requirements.json"
  )
  const intakePath = join(outputDir, "intake.json")

  await atomicWriteJson(migrationInputPath, intake.migrationInput)
  await atomicWriteJson(reviewWorklistPath, intake.reviewWorklist)
  await atomicWriteJson(
    dependencyRequirementsPath,
    intake.dependencyRequirements
  )
  await atomicWriteJson(intakePath, {
    schemaVersion: intake.schemaVersion,
    captureId: intake.captureId,
    archiveChecksum: intake.archiveChecksum,
    handoffChecksum: intake.handoffChecksum,
    captureEvidencePackageChecksum: intake.captureEvidencePackageChecksum,
    migrationInputBundleChecksum: intake.migrationInput.bundleChecksum,
    intakeChecksum: intake.intakeChecksum,
    isReadyForDependencyProvisioning:
      intake.isReadyForDependencyProvisioning,
    isExecutable: intake.isExecutable,
    unresolvedUrls: intake.unresolvedUrls,
    globalBlockers: intake.globalBlockers,
    reviewItems: intake.reviewWorklist.length,
    dependencyRequirements: intake.dependencyRequirements.length,
    files: {
      migrationInput: migrationInputPath,
      reviewWorklist: reviewWorklistPath,
      dependencyRequirements: dependencyRequirementsPath,
    },
  })

  console.log(
    JSON.stringify(
      {
        captureId: intake.captureId,
        archiveChecksum: intake.archiveChecksum,
        evidencePackageChecksum: intake.captureEvidencePackageChecksum,
        migrationInputBundleChecksum: intake.migrationInput.bundleChecksum,
        intakeChecksum: intake.intakeChecksum,
        isReadyForDependencyProvisioning:
          intake.isReadyForDependencyProvisioning,
        globalBlockers: intake.globalBlockers,
        unresolvedUrls: intake.unresolvedUrls,
        reviewItems: intake.reviewWorklist.length,
        dependencyRequirements: intake.dependencyRequirements.length,
        outputDir,
        next: intake.isReadyForDependencyProvisioning
          ? "Provision/import the listed category, Brand and COQUETTE-owned media targets, then build the Phase 4Q dependency mapping plan."
          : "Resolve only the emitted review/URL blockers against captured evidence, then rerun this same handoff intake command with the decisions file.",
      },
      null,
      2
    )
  )

  if (!intake.isReadyForDependencyProvisioning) process.exitCode = 3
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
