import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import {
  deleteFilesWorkflow,
  uploadFilesWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  assertDedicatedCoquetteStagingProject,
  COQUETTE_STAGING_SUPABASE_PROJECT_REF,
} from "../migration/coquette-staging-guard"

const EXPECTED_RAILWAY_SERVICE = "coquette-backend"
const EXPECTED_DATABASE = "postgres"
const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
const SENTINEL_BYTES = Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")

type PgConnection = {
  raw: (
    sql: string,
    bindings?: unknown[]
  ) => Promise<{ rows?: Array<{ object_count?: number | string }> }>
}

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function requiredDeployedRailwayGuardEnv() {
  if (process.platform !== "linux") {
    throw unexpected(
      "Storage recovery rehearsal must execute inside the deployed Railway Linux service"
    )
  }

  const railwayServiceName = process.env.RAILWAY_SERVICE_NAME?.trim()
  if (railwayServiceName !== EXPECTED_RAILWAY_SERVICE) {
    throw unexpected(
      `RAILWAY_SERVICE_NAME must equal ${EXPECTED_RAILWAY_SERVICE}; received ${railwayServiceName || "missing"}`
    )
  }

  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw unexpected("DATABASE_URL is required inside the deployed Railway service")
  }

  const parsed = new URL(databaseUrl)
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""))
  const databaseUsername = decodeURIComponent(parsed.username).toLowerCase()
  const databaseHost = parsed.hostname.toLowerCase()

  if (databaseName !== EXPECTED_DATABASE) {
    throw unexpected(
      `DATABASE_URL must target ${EXPECTED_DATABASE}; received ${databaseName || "missing"}`
    )
  }
  if (
    !databaseHost.includes(COQUETTE_STAGING_SUPABASE_PROJECT_REF) &&
    !databaseUsername.includes(COQUETTE_STAGING_SUPABASE_PROJECT_REF)
  ) {
    throw unexpected(
      "DATABASE_URL does not identify the dedicated COQUETTE Supabase staging project"
    )
  }

  return {
    ...process.env,
    COQUETTE_MIGRATION_TARGET: "staging",
    COQUETTE_MIGRATION_ALLOW_WRITE: "COQUETTE_STAGING_WRITE_CONFIRMED",
    COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST: parsed.hostname,
    COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME: databaseName,
    COQUETTE_MIGRATION_EXPECTED_SUPABASE_PROJECT_REF:
      COQUETTE_STAGING_SUPABASE_PROJECT_REF,
  }
}

function requiredHttpsUrl(name: string) {
  const raw = process.env[name]?.trim()
  if (!raw) throw unexpected(`${name} is required for the storage recovery rehearsal`)
  const url = new URL(raw)
  if (url.protocol !== "https:") {
    throw unexpected(`${name} must use HTTPS for the storage recovery rehearsal`)
  }
  return url
}

function requiredStorageRuntime() {
  const servingUrl = requiredHttpsUrl("S3_FILE_URL")
  const endpointUrl = requiredHttpsUrl("S3_ENDPOINT")
  const bucket = process.env.S3_BUCKET?.trim()
  if (!bucket) throw unexpected("S3_BUCKET is required for the storage recovery rehearsal")

  const servingHost = servingUrl.hostname.toLowerCase()
  if (servingHost === "coquetteconcept.gr" || servingHost.endsWith(".coquetteconcept.gr")) {
    throw unexpected("Legacy coquetteconcept.gr cannot be used as the COQUETTE serving-media host")
  }

  return {
    servingUrl,
    endpointUrl,
    bucket,
  }
}

function assertAllowedRetrievalUrl(raw: string, storage: ReturnType<typeof requiredStorageRuntime>) {
  const url = new URL(raw)
  if (url.protocol !== "https:") {
    throw unexpected(`Storage recovery rehearsal retrieval URL must use HTTPS: ${raw}`)
  }

  const host = url.hostname.toLowerCase()
  const servingHost = storage.servingUrl.hostname.toLowerCase()
  const endpointHost = storage.endpointUrl.hostname.toLowerCase()

  if (host === servingHost) return url
  if (host !== endpointHost) {
    throw unexpected(
      `Storage recovery rehearsal retrieved outside configured COQUETTE storage hosts: ${raw}`
    )
  }

  const endpointPath = storage.endpointUrl.pathname.replace(/\/$/, "")
  const expectedPrefix = `${endpointPath}/${encodeURIComponent(storage.bucket)}/`
  if (!url.pathname.startsWith(expectedPrefix)) {
    throw unexpected(
      `Storage recovery rehearsal retrieval URL escaped the configured COQUETTE bucket: ${raw}`
    )
  }

  return url
}

async function assertExactSentinelReadable(url: string, label: string) {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) {
    throw unexpected(`${label} failed with HTTP ${response.status}`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length !== SENTINEL_BYTES.length || !bytes.equals(SENTINEL_BYTES)) {
    throw unexpected(`${label} did not return the exact uploaded sentinel bytes`)
  }
}

async function storageObjectCount(
  pgConnection: PgConnection,
  bucket: string,
  objectName: string
) {
  const result = await pgConnection.raw(
    `select count(*)::int as object_count
       from storage.objects
      where bucket_id = ?
        and name = ?`,
    [bucket, objectName]
  )
  return Number(result?.rows?.[0]?.object_count ?? 0)
}

async function assertAuthoritativeStorageObjectState(
  pgConnection: PgConnection,
  bucket: string,
  objectName: string,
  expectedCount: 0 | 1,
  label: string
) {
  let lastCount = -1
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    lastCount = await storageObjectCount(pgConnection, bucket, objectName)
    if (lastCount === expectedCount) return
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  throw unexpected(
    `${label}: expected storage.objects count ${expectedCount}, received ${lastCount}`
  )
}

async function observePostDeletePublicRead(uploadedUrl: string) {
  const probeUrl = new URL(uploadedUrl)
  probeUrl.searchParams.set(
    "coquetteRecoveryProbe",
    `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}`
  )

  try {
    const response = await fetch(probeUrl, { cache: "no-store" })
    return {
      status: response.status,
      readable: response.ok,
    }
  } catch (error) {
    return {
      status: "network-error",
      readable: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export default async function stagingStorageRecoveryRehearsal({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const guardedEnv = requiredDeployedRailwayGuardEnv()
  const project = assertDedicatedCoquetteStagingProject(guardedEnv)
  const storage = requiredStorageRuntime()
  const fileModuleService = container.resolve(Modules.FILE)
  const pgConnection = container.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  ) as PgConnection
  const filename = `phase4-recovery-rehearsal-${Date.now()}-${process.pid}.png`
  let uploadedId: string | undefined
  let uploadedUrl: string | undefined
  let deletionVerified = false

  logger.info(
    `COQUETTE storage recovery rehearsal deployed runtime verified: ${JSON.stringify({
      platform: process.platform,
      railwayServiceName: process.env.RAILWAY_SERVICE_NAME,
      railwayDeploymentId: process.env.RAILWAY_DEPLOYMENT_ID || null,
      railwayReplicaId: process.env.RAILWAY_REPLICA_ID || null,
      supabaseProjectRef: project.supabaseProjectRef,
      databaseHost: project.databaseHost,
      databaseName: project.databaseName,
    })}`
  )

  try {
    const { result } = await uploadFilesWorkflow(container).run({
      input: {
        files: [
          {
            filename,
            mimeType: "image/png",
            content: ONE_PIXEL_PNG_BASE64,
            access: "public",
          },
        ],
      },
    })
    const uploaded = result?.[0]
    if (!uploaded?.id || !uploaded.url) {
      throw unexpected("Storage recovery rehearsal upload returned no file ID/URL")
    }
    uploadedId = uploaded.id
    uploadedUrl = uploaded.url

    const uploadedPublicUrl = new URL(uploadedUrl)
    if (
      uploadedPublicUrl.protocol !== "https:" ||
      uploadedPublicUrl.hostname.toLowerCase() !== storage.servingUrl.hostname.toLowerCase()
    ) {
      throw unexpected(
        `Storage recovery rehearsal uploaded outside the configured COQUETTE serving host: ${uploadedUrl}`
      )
    }

    await assertAuthoritativeStorageObjectState(
      pgConnection,
      storage.bucket,
      uploadedId,
      1,
      "Storage recovery rehearsal authoritative upload check failed"
    )
    await assertExactSentinelReadable(uploadedUrl, "Storage recovery rehearsal public read")

    const retrieved = await fileModuleService.retrieveFile(uploadedId)
    if (!retrieved?.url) {
      throw unexpected("Storage recovery rehearsal could not retrieve the uploaded sentinel")
    }
    const retrievedUrl = assertAllowedRetrievalUrl(retrieved.url, storage)
    await assertExactSentinelReadable(retrievedUrl.toString(), "Storage recovery rehearsal provider read")

    await deleteFilesWorkflow(container).run({ input: { ids: [uploadedId] } })
    await assertAuthoritativeStorageObjectState(
      pgConnection,
      storage.bucket,
      uploadedId,
      0,
      "Storage recovery rehearsal authoritative deletion check failed"
    )
    deletionVerified = true

    const postDeletePublicProbe = await observePostDeletePublicRead(uploadedUrl)

    logger.info(
      `COQUETTE storage recovery rehearsal passed: ${JSON.stringify({
        supabaseProjectRef: project.supabaseProjectRef,
        databaseHost: project.databaseHost,
        databaseName: project.databaseName,
        servingMediaHost: storage.servingUrl.hostname.toLowerCase(),
        retrievalHost: retrievedUrl.hostname.toLowerCase(),
        uploadedId,
        uploadedUrl,
        authoritativeDeletion: "storage.objects absent",
        postDeletePublicProbe,
        deleted: true,
      })}`
    )
  } finally {
    if (uploadedId && !deletionVerified) {
      try {
        await deleteFilesWorkflow(container).run({ input: { ids: [uploadedId] } })
        logger.info(
          `COQUETTE storage recovery rehearsal cleanup removed sentinel after an interrupted/failed rehearsal: ${uploadedId}`
        )
      } catch (cleanupError) {
        logger.error(
          `COQUETTE storage recovery rehearsal cleanup FAILED for sentinel ${uploadedId}: ${
            cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          }`
        )
      }
    }
  }
}
