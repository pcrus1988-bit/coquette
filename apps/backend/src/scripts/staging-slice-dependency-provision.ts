import { createHash } from "node:crypto"
import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  writeFile,
} from "node:fs/promises"
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path"
import type { StagingSliceDependencyEvidencePlan } from "../migration/staging-slice-dependency-evidence"
import {
  buildProvisionedDependencyMappingBundle,
  buildStagingSliceDependencyProvisioningPlan,
  deterministicMigrationCategoryHandle,
  deterministicMigrationMediaFilename,
  type StagingSliceDependencyProvisioningManifestEntry,
} from "../migration/staging-slice-dependency-provisioning"
import { assertStagingMigrationWriteGuard } from "../migration/staging-product-execution"

const COQUETTE_STAGING_SUPABASE_PROJECT_REF = "pijetwrxqznxaoacnakr"

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex")
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

async function readManifest(path?: string) {
  if (!path) return [] as StagingSliceDependencyProvisioningManifestEntry[]
  try {
    const value = await readJson<unknown>(path)
    if (!Array.isArray(value)) throw unexpected("Dependency provisioning manifest must be a JSON array")
    return value as StagingSliceDependencyProvisioningManifestEntry[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
}

async function atomicWriteJson(path: string, value: unknown) {
  const target = resolve(path)
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  await rename(temporary, target)
}

function manifestKey(entry: Pick<StagingSliceDependencyProvisioningManifestEntry, "entityType" | "sourceId">) {
  return `${entry.entityType}:${encodeURIComponent(entry.sourceId)}`
}

function upsertManifestEntry(
  entries: StagingSliceDependencyProvisioningManifestEntry[],
  next: StagingSliceDependencyProvisioningManifestEntry
) {
  const key = manifestKey(next)
  const matches = entries.filter((entry) => manifestKey(entry) === key)
  if (matches.length > 1) throw unexpected(`Duplicate dependency manifest entries for ${key}`)
  return [...entries.filter((entry) => manifestKey(entry) !== key), next].sort((a, b) =>
    manifestKey(a).localeCompare(manifestKey(b))
  )
}

function allowedMediaHosts() {
  const configured = (process.env.COQUETTE_MIGRATION_ALLOWED_MEDIA_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  const s3FileUrl = process.env.S3_FILE_URL?.trim()
  if (s3FileUrl) {
    try {
      configured.push(new URL(s3FileUrl).hostname.toLowerCase())
    } catch {
      throw unexpected("S3_FILE_URL must be an absolute URL")
    }
  }
  return [...new Set(configured)].sort()
}

function assertCoquetteProjectIdentity() {
  const guard = assertStagingMigrationWriteGuard(process.env)
  const expectedRef = process.env.COQUETTE_MIGRATION_EXPECTED_SUPABASE_PROJECT_REF?.trim()
  if (expectedRef !== COQUETTE_STAGING_SUPABASE_PROJECT_REF) {
    throw unexpected(
      `COQUETTE_MIGRATION_EXPECTED_SUPABASE_PROJECT_REF must equal the dedicated COQUETTE project ref ${COQUETTE_STAGING_SUPABASE_PROJECT_REF}`
    )
  }
  const databaseUrl = new URL(process.env.DATABASE_URL!)
  const username = decodeURIComponent(databaseUrl.username).toLowerCase()
  const host = databaseUrl.hostname.toLowerCase()
  if (!host.includes(expectedRef) && !username.includes(expectedRef)) {
    throw unexpected(
      "DATABASE_URL does not identify the dedicated COQUETTE Supabase project by host or pooler username"
    )
  }
  return guard
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === "string" ? value : undefined
}

async function containedCaptureFile(captureDir: string, archivePath: string) {
  const normalized = archivePath.replace(/\\/g, "/")
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.split("/").includes("..") ||
    /^[a-zA-Z]:\//.test(normalized)
  ) {
    return undefined
  }
  try {
    const root = await realpath(resolve(captureDir))
    const candidate = await realpath(join(root, normalized))
    const relation = relative(root, candidate)
    if (relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
      return undefined
    }
    const metadata = await lstat(candidate)
    if (!metadata.isFile() || metadata.isSymbolicLink()) return undefined
    return candidate
  } catch {
    return undefined
  }
}

function nextImported(
  entry: StagingSliceDependencyProvisioningManifestEntry | undefined,
  input: {
    entityType: "category" | "media" | "brand"
    sourceId: string
    evidenceChecksum: string
    targetId?: string
    targetUrl?: string
  }
): StagingSliceDependencyProvisioningManifestEntry {
  const now = new Date().toISOString()
  return {
    ...input,
    status: "imported",
    attempts: (entry?.attempts ?? 0) + 1,
    firstImportedAt: entry?.firstImportedAt ?? now,
    lastAttemptAt: now,
  }
}

function nextError(
  previous: StagingSliceDependencyProvisioningManifestEntry | undefined,
  input: {
    entityType: "category" | "media" | "brand"
    sourceId: string
    evidenceChecksum: string
  },
  error: unknown
): StagingSliceDependencyProvisioningManifestEntry {
  return {
    ...input,
    status: "error",
    attempts: (previous?.attempts ?? 0) + 1,
    firstImportedAt: previous?.firstImportedAt,
    lastAttemptAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  }
}

export default async function stagingSliceDependencyProvision({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const executionMode = mode()
  const captureDir = process.env.COQUETTE_CAPTURE_DIR?.trim()
  const evidencePath = process.env.COQUETTE_STAGING_SLICE_DEPENDENCY_EVIDENCE?.trim()
  const expectedEvidenceChecksum =
    process.env.COQUETTE_STAGING_SLICE_DEPENDENCY_EVIDENCE_CHECKSUM?.trim()
  const manifestPath = process.env.COQUETTE_STAGING_DEPENDENCY_PROVISIONING_MANIFEST?.trim()
  const mappingPath = process.env.COQUETTE_STAGING_PROVISIONED_DEPENDENCY_MAPPINGS?.trim()

  if (!captureDir || !evidencePath || !expectedEvidenceChecksum) {
    throw unexpected(
      "COQUETTE_CAPTURE_DIR, COQUETTE_STAGING_SLICE_DEPENDENCY_EVIDENCE and COQUETTE_STAGING_SLICE_DEPENDENCY_EVIDENCE_CHECKSUM are required"
    )
  }

  const evidencePlan = await readJson<StagingSliceDependencyEvidencePlan>(evidencePath)
  let manifestEntries = await readManifest(manifestPath)
  const mediaHosts = allowedMediaHosts()
  const provisioningPlan = buildStagingSliceDependencyProvisioningPlan({
    evidencePlan,
    expectedEvidencePlanChecksum: expectedEvidenceChecksum,
    previousManifestEntries: manifestEntries,
    allowedMediaHosts: mediaHosts,
  })

  logger.info(
    `COQUETTE staging dependency provisioning preflight: mode=${executionMode}, evidencePlan=${evidencePlan.planChecksum}, create=${provisioningPlan.totals.create}, skip=${provisioningPlan.totals.skip}, blocked=${provisioningPlan.totals.blocked}`
  )

  if (!provisioningPlan.isExecutable) {
    logger.error(
      `COQUETTE staging dependency provisioning blocked: ${JSON.stringify({
        globalBlockers: provisioningPlan.globalBlockers,
        duplicateManifestKeys: provisioningPlan.duplicateManifestKeys,
        blocked: provisioningPlan.entries
          .filter((entry) => entry.action === "blocked")
          .map((entry) => ({
            entityType: entry.entityType,
            sourceId: entry.sourceId,
            blockers: entry.blockers,
          })),
      })}`
    )
    throw unexpected("Staging dependency provisioning preflight failed; no writes were attempted")
  }

  if (executionMode === "dry-run") {
    logger.info(
      `COQUETTE staging dependency provisioning dry-run passed: ${JSON.stringify({
        planChecksum: provisioningPlan.planChecksum,
        totals: provisioningPlan.totals,
        categoryCreates: provisioningPlan.entries.filter(
          (entry) => entry.action === "create" && entry.entityType === "category"
        ).length,
        mediaCreates: provisioningPlan.entries.filter(
          (entry) => entry.action === "create" && entry.entityType === "media"
        ).length,
      })}`
    )
    return
  }

  assertCoquetteProjectIdentity()
  if (!manifestPath || !mappingPath) {
    throw unexpected(
      "COQUETTE_STAGING_DEPENDENCY_PROVISIONING_MANIFEST and COQUETTE_STAGING_PROVISIONED_DEPENDENCY_MAPPINGS are required in write mode"
    )
  }
  if (!process.env.S3_FILE_URL?.trim()) {
    throw unexpected("S3_FILE_URL is required in write mode")
  }

  const productModuleService = container.resolve(Modules.PRODUCT)

  for (const entry of provisioningPlan.entries) {
    if (entry.action === "skip") continue
    if (entry.action !== "create") {
      throw unexpected(`Unexpected non-create action in executable dependency plan: ${entry.action}`)
    }

    const prior = entry.previous
    try {
      if (entry.entityType === "category") {
        const name = entry.evidence.category?.name?.trim()
        if (!name) throw unexpected(`Category evidence lost its name for ${entry.sourceId}`)
        const handle = deterministicMigrationCategoryHandle(name, entry.sourceId)
        const existing = await productModuleService.listProductCategories({ handle })
        if (existing.length > 1) {
          throw unexpected(`Multiple product categories already use migration handle ${handle}`)
        }
        let targetId: string
        if (existing.length === 1) {
          const category = existing[0]
          const metadata = category.metadata as Record<string, unknown> | null | undefined
          if (
            metadataString(metadata, "coquette_migration_source_id") !== entry.sourceId ||
            metadataString(metadata, "coquette_migration_evidence_checksum") !== entry.evidenceChecksum
          ) {
            throw unexpected(
              `Existing category ${category.id} at handle ${handle} is unrelated to the current migration evidence`
            )
          }
          targetId = category.id
        } else {
          const category = await productModuleService.createProductCategories({
            name,
            handle,
            is_active: false,
            is_internal: true,
            metadata: {
              coquette_migration_source_id: entry.sourceId,
              coquette_migration_evidence_checksum: entry.evidenceChecksum,
              coquette_migration_dependency_plan_checksum: evidencePlan.planChecksum,
            },
          })
          targetId = category.id
        }
        manifestEntries = upsertManifestEntry(
          manifestEntries,
          nextImported(prior, {
            entityType: "category",
            sourceId: entry.sourceId,
            evidenceChecksum: entry.evidenceChecksum,
            targetId,
          })
        )
      } else if (entry.entityType === "media") {
        const media = entry.evidence.media
        if (!media) throw unexpected(`Media evidence missing for ${entry.sourceId}`)
        const absolute = await containedCaptureFile(captureDir, media.mediaFile)
        if (!absolute) {
          throw unexpected(`Captured media file is missing or unsafe: ${media.mediaFile}`)
        }
        const bytes = await readFile(absolute)
        if (bytes.length !== media.bytes || sha256(bytes) !== media.checksum) {
          throw unexpected(`Captured media bytes no longer match dependency evidence for ${entry.sourceId}`)
        }
        const filename = deterministicMigrationMediaFilename(media.mediaFile, media.checksum)
        const { result } = await uploadFilesWorkflow(container).run({
          input: {
            files: [
              {
                filename,
                mimeType: media.contentType,
                content: bytes.toString("base64"),
                access: "public",
              },
            ],
          },
        })
        const uploaded = result?.[0]
        if (!uploaded?.url) throw unexpected(`Media upload returned no public URL for ${entry.sourceId}`)
        const target = new URL(uploaded.url)
        if (target.protocol !== "https:" || !mediaHosts.includes(target.hostname.toLowerCase())) {
          throw unexpected(`Uploaded media URL is outside the allowed COQUETTE media hosts: ${uploaded.url}`)
        }
        manifestEntries = upsertManifestEntry(
          manifestEntries,
          nextImported(prior, {
            entityType: "media",
            sourceId: entry.sourceId,
            evidenceChecksum: entry.evidenceChecksum,
            targetId: uploaded.id,
            targetUrl: uploaded.url,
          })
        )
      } else {
        throw unexpected(
          `Brand provisioning is not enabled for this slice because the verified evidence plan contains no brands: ${entry.sourceId}`
        )
      }

      await atomicWriteJson(manifestPath, manifestEntries)
    } catch (error) {
      manifestEntries = upsertManifestEntry(
        manifestEntries,
        nextError(
          prior,
          {
            entityType: entry.entityType,
            sourceId: entry.sourceId,
            evidenceChecksum: entry.evidenceChecksum,
          },
          error
        )
      )
      await atomicWriteJson(manifestPath, manifestEntries)
      throw error
    }
  }

  const completedPlan = buildStagingSliceDependencyProvisioningPlan({
    evidencePlan,
    expectedEvidencePlanChecksum: expectedEvidenceChecksum,
    previousManifestEntries: manifestEntries,
    allowedMediaHosts: mediaHosts,
  })
  if (!completedPlan.isExecutable || completedPlan.totals.create !== 0) {
    throw unexpected("Dependency provisioning completed without a fully idempotent imported manifest")
  }
  const mappingBundle = buildProvisionedDependencyMappingBundle({
    evidencePlan,
    provisioningPlan: completedPlan,
    manifestEntries,
  })
  await atomicWriteJson(mappingPath, mappingBundle)

  logger.info(
    `COQUETTE staging dependency provisioning complete: ${JSON.stringify({
      evidencePlanChecksum: evidencePlan.planChecksum,
      provisioningPlanChecksum: completedPlan.planChecksum,
      mappingBundleChecksum: mappingBundle.bundleChecksum,
      mappings: mappingBundle.mappings.length,
      categories: mappingBundle.mappings.filter((entry) => entry.entityType === "category").length,
      media: mappingBundle.mappings.filter((entry) => entry.entityType === "media").length,
    })}`
  )
}
