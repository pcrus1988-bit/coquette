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
import { assertDedicatedCoquetteStagingProject } from "../migration/coquette-staging-guard"

const CONFIRMATION = "COQUETTE_STORAGE_RECOVERY_REHEARSAL_CONFIRMED"
const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
const SENTINEL_BYTES = Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
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

async function assertSentinelDeleted(
  fileModuleService: { retrieveFile: (id: string) => Promise<{ url?: string }> },
  uploadedId: string,
  uploadedUrl: string,
  storage: ReturnType<typeof requiredStorageRuntime>
) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const candidateUrls = new Set<string>([uploadedUrl])
    try {
      const retrieved = await fileModuleService.retrieveFile(uploadedId)
      if (retrieved?.url) {
        assertAllowedRetrievalUrl(retrieved.url, storage)
        candidateUrls.add(retrieved.url)
      }
    } catch {
      // A provider may reject retrieval after deletion; that is acceptable.
    }

    let stillReadable = false
    for (const candidateUrl of candidateUrls) {
      try {
        const response = await fetch(candidateUrl, { cache: "no-store" })
        if (response.ok) {
          stillReadable = true
          break
        }
      } catch {
        // Network/read failure after deletion also proves the object is unavailable.
      }
    }

    if (!stillReadable) return
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  throw unexpected("Storage recovery rehearsal sentinel remained HTTP-readable after deletion")
}

export default async function stagingStorageRecoveryRehearsal({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (process.env.COQUETTE_STORAGE_RECOVERY_REHEARSAL !== CONFIRMATION) {
    throw unexpected(
      `COQUETTE_STORAGE_RECOVERY_REHEARSAL must equal ${CONFIRMATION}`
    )
  }

  const project = assertDedicatedCoquetteStagingProject(process.env)
  const storage = requiredStorageRuntime()
  const fileModuleService = container.resolve(Modules.FILE)
  const filename = `phase4-recovery-rehearsal-${Date.now()}-${process.pid}.png`
  let uploadedId: string | undefined
  let uploadedUrl: string | undefined
  let deletionVerified = false

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
    await assertExactSentinelReadable(uploadedUrl, "Storage recovery rehearsal public read")

    const retrieved = await fileModuleService.retrieveFile(uploadedId)
    if (!retrieved?.url) {
      throw unexpected("Storage recovery rehearsal could not retrieve the uploaded sentinel")
    }
    const retrievedUrl = assertAllowedRetrievalUrl(retrieved.url, storage)
    await assertExactSentinelReadable(retrievedUrl.toString(), "Storage recovery rehearsal provider read")

    await deleteFilesWorkflow(container).run({ input: { ids: [uploadedId] } })
    await assertSentinelDeleted(fileModuleService, uploadedId, uploadedUrl, storage)
    deletionVerified = true

    logger.info(
      `COQUETTE storage recovery rehearsal passed: ${JSON.stringify({
        supabaseProjectRef: project.supabaseProjectRef,
        databaseHost: project.databaseHost,
        databaseName: project.databaseName,
        servingMediaHost: storage.servingUrl.hostname.toLowerCase(),
        retrievalHost: retrievedUrl.hostname.toLowerCase(),
        uploadedId,
        uploadedUrl,
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
