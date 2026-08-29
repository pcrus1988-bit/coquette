import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { deleteFilesWorkflow } from "@medusajs/medusa/core-flows"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { assertDedicatedCoquetteStagingProject } from "../migration/coquette-staging-guard"
import type { StagingSliceDependencyEvidencePlan } from "../migration/staging-slice-dependency-evidence"
import {
  assertExecutableStagingSliceDependencyRollbackPlan,
  buildStagingSliceDependencyRollbackPlan,
} from "../migration/staging-slice-dependency-rollback"
import type { StagingSliceDependencyProvisioningManifestEntry } from "../migration/staging-slice-dependency-provisioning"

const ROLLBACK_CONFIRMATION = "COQUETTE_STAGING_DEPENDENCY_ROLLBACK_CONFIRMED"

type RollbackResultStatus = "deleted" | "already_absent" | "error"
type RollbackResultEntry = {
  entityType: "category" | "media" | "brand"
  sourceId: string
  evidenceChecksum: string
  targetId?: string
  targetUrl?: string
  status: RollbackResultStatus
  attemptedAt: string
  error?: string
}

type RollbackReport = {
  schemaVersion: 1
  captureId: string
  sourceDependencyEvidencePlanChecksum: string
  rollbackPlanChecksum: string
  startedAt: string
  completedAt?: string
  status: "in_progress" | "complete" | "error"
  entries: RollbackResultEntry[]
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function mode() {
  const value = process.env.COQUETTE_MIGRATION_MODE?.trim() || "dry-run"
  if (value !== "dry-run" && value !== "write") {
    throw unexpected("COQUETTE_MIGRATION_MODE must be 'dry-run' or 'write'")
  }
  return value
}

async function readJson<T>(path: string) {
  return JSON.parse(await readFile(resolve(path), "utf8")) as T
}

async function readManifest(path: string) {
  const value = await readJson<unknown>(path)
  if (!Array.isArray(value)) {
    throw unexpected("Dependency provisioning manifest must be a JSON array")
  }
  return value as StagingSliceDependencyProvisioningManifestEntry[]
}

async function atomicWriteJson(path: string, value: unknown) {
  const target = resolve(path)
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  await rename(temporary, target)
}

function allowedMediaHosts() {
  const hosts = (process.env.COQUETTE_MIGRATION_ALLOWED_MEDIA_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  const s3FileUrl = process.env.S3_FILE_URL?.trim()
  if (s3FileUrl) {
    const parsed = new URL(s3FileUrl)
    hosts.push(parsed.hostname.toLowerCase())
  }
  return [...new Set(hosts)].sort()
}

function metadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key]
  return typeof value === "string" ? value : undefined
}

function upsertReportEntry(report: RollbackReport, next: RollbackResultEntry) {
  const key = `${next.entityType}:${encodeURIComponent(next.sourceId)}`
  report.entries = [
    ...report.entries.filter(
      (entry) => `${entry.entityType}:${encodeURIComponent(entry.sourceId)}` !== key
    ),
    next,
  ].sort((left, right) =>
    `${left.entityType}:${left.sourceId}`.localeCompare(
      `${right.entityType}:${right.sourceId}`
    )
  )
}

export default async function stagingSliceDependencyRollback({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const executionMode = mode()
  const evidencePath = process.env.COQUETTE_STAGING_SLICE_DEPENDENCY_EVIDENCE?.trim()
  const expectedEvidenceChecksum =
    process.env.COQUETTE_STAGING_SLICE_DEPENDENCY_EVIDENCE_CHECKSUM?.trim()
  const manifestPath =
    process.env.COQUETTE_STAGING_DEPENDENCY_PROVISIONING_MANIFEST?.trim()
  const reportPath = process.env.COQUETTE_STAGING_DEPENDENCY_ROLLBACK_REPORT?.trim()

  if (!evidencePath || !expectedEvidenceChecksum || !manifestPath) {
    throw unexpected(
      "COQUETTE_STAGING_SLICE_DEPENDENCY_EVIDENCE, COQUETTE_STAGING_SLICE_DEPENDENCY_EVIDENCE_CHECKSUM and COQUETTE_STAGING_DEPENDENCY_PROVISIONING_MANIFEST are required"
    )
  }

  const evidencePlan = await readJson<StagingSliceDependencyEvidencePlan>(evidencePath)
  const manifestEntries = await readManifest(manifestPath)
  const rollbackPlan = buildStagingSliceDependencyRollbackPlan({
    evidencePlan,
    expectedEvidencePlanChecksum: expectedEvidenceChecksum,
    manifestEntries,
    allowedMediaHosts: allowedMediaHosts(),
  })

  logger.info(
    `COQUETTE staging dependency rollback preflight: mode=${executionMode}, evidencePlan=${evidencePlan.planChecksum}, delete=${rollbackPlan.totals.delete}, skip=${rollbackPlan.totals.skip}, blocked=${rollbackPlan.totals.blocked}`
  )
  assertExecutableStagingSliceDependencyRollbackPlan(rollbackPlan)

  if (executionMode === "dry-run") {
    logger.info(
      `COQUETTE staging dependency rollback dry-run passed: ${JSON.stringify({
        rollbackPlanChecksum: rollbackPlan.planChecksum,
        totals: rollbackPlan.totals,
      })}`
    )
    return
  }

  if (process.env.COQUETTE_STAGING_DEPENDENCY_ROLLBACK !== ROLLBACK_CONFIRMATION) {
    throw unexpected(
      `COQUETTE_STAGING_DEPENDENCY_ROLLBACK must equal ${ROLLBACK_CONFIRMATION}`
    )
  }
  assertDedicatedCoquetteStagingProject(process.env)
  if (!reportPath) {
    throw unexpected("COQUETTE_STAGING_DEPENDENCY_ROLLBACK_REPORT is required in write mode")
  }

  const productModuleService = container.resolve(Modules.PRODUCT)
  const fileModuleService = container.resolve(Modules.FILE)
  const anyProducts = await productModuleService.listProducts({}, { take: 1 })
  if (anyProducts.length > 0) {
    throw unexpected(
      "Dependency rollback is only permitted before product import; staging currently contains at least one product"
    )
  }

  const report: RollbackReport = {
    schemaVersion: 1,
    captureId: evidencePlan.captureId,
    sourceDependencyEvidencePlanChecksum: evidencePlan.planChecksum,
    rollbackPlanChecksum: rollbackPlan.planChecksum,
    startedAt: new Date().toISOString(),
    status: "in_progress",
    entries: [],
  }
  await atomicWriteJson(reportPath, report)

  for (const entry of rollbackPlan.entries.filter((item) => item.action === "delete")) {
    const attemptedAt = new Date().toISOString()
    try {
      if (!entry.targetId) {
        throw unexpected(`Rollback target ID missing for ${entry.entityType}:${entry.sourceId}`)
      }

      if (entry.entityType === "category") {
        const categories = await productModuleService.listProductCategories({ id: entry.targetId })
        if (categories.length > 1) {
          throw unexpected(`Multiple categories resolved for rollback target ${entry.targetId}`)
        }
        if (categories.length === 0) {
          upsertReportEntry(report, { ...entry, status: "already_absent", attemptedAt })
        } else {
          const category = categories[0]
          const metadata = category.metadata as Record<string, unknown> | null | undefined
          if (
            metadataString(metadata, "coquette_migration_source_id") !== entry.sourceId ||
            metadataString(metadata, "coquette_migration_evidence_checksum") !== entry.evidenceChecksum
          ) {
            throw unexpected(
              `Category ${entry.targetId} no longer matches the checksum-bound migration evidence; refusing deletion`
            )
          }
          await productModuleService.deleteProductCategories([entry.targetId])
          const remaining = await productModuleService.listProductCategories({ id: entry.targetId })
          if (remaining.length > 0) {
            throw unexpected(`Category ${entry.targetId} remained visible after rollback deletion`)
          }
          upsertReportEntry(report, { ...entry, status: "deleted", attemptedAt })
        }
      } else if (entry.entityType === "media") {
        let existingUrl: string | undefined
        try {
          existingUrl = (await fileModuleService.retrieveFile(entry.targetId)).url
        } catch {
          // Already absent is an idempotent rollback success.
        }
        if (!existingUrl) {
          upsertReportEntry(report, { ...entry, status: "already_absent", attemptedAt })
        } else {
          if (!entry.targetUrl || existingUrl !== entry.targetUrl) {
            throw unexpected(
              `Media ${entry.targetId} no longer matches its checksum-bound provisioning URL; refusing deletion`
            )
          }
          await deleteFilesWorkflow(container).run({ input: { ids: [entry.targetId] } })
          let stillPresent = false
          try {
            await fileModuleService.retrieveFile(entry.targetId)
            stillPresent = true
          } catch {
            // Expected after deletion.
          }
          if (stillPresent) {
            throw unexpected(`Media ${entry.targetId} remained retrievable after rollback deletion`)
          }
          upsertReportEntry(report, { ...entry, status: "deleted", attemptedAt })
        }
      } else {
        throw unexpected(`Brand rollback is not supported: ${entry.sourceId}`)
      }
      await atomicWriteJson(reportPath, report)
    } catch (error) {
      upsertReportEntry(report, {
        ...entry,
        status: "error",
        attemptedAt,
        error: error instanceof Error ? error.message : String(error),
      })
      report.status = "error"
      report.completedAt = new Date().toISOString()
      await atomicWriteJson(reportPath, report)
      throw error
    }
  }

  report.status = "complete"
  report.completedAt = new Date().toISOString()
  await atomicWriteJson(reportPath, report)
  logger.info(
    `COQUETTE staging dependency rollback complete: ${JSON.stringify({
      rollbackPlanChecksum: rollbackPlan.planChecksum,
      deleted: report.entries.filter((entry) => entry.status === "deleted").length,
      alreadyAbsent: report.entries.filter((entry) => entry.status === "already_absent").length,
      report: resolve(reportPath),
    })}`
  )
}
