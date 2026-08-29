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

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function requiredS3ServingHost() {
  const raw = process.env.S3_FILE_URL?.trim()
  if (!raw) throw unexpected("S3_FILE_URL is required for the storage recovery rehearsal")
  const url = new URL(raw)
  if (url.protocol !== "https:") {
    throw unexpected("S3_FILE_URL must use HTTPS for the storage recovery rehearsal")
  }
  const host = url.hostname.toLowerCase()
  if (host === "coquetteconcept.gr" || host.endsWith(".coquetteconcept.gr")) {
    throw unexpected("Legacy coquetteconcept.gr cannot be used as the COQUETTE serving-media host")
  }
  return host
}

export default async function stagingStorageRecoveryRehearsal({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (process.env.COQUETTE_STORAGE_RECOVERY_REHEARSAL !== CONFIRMATION) {
    throw unexpected(
      `COQUETTE_STORAGE_RECOVERY_REHEARSAL must equal ${CONFIRMATION}`
    )
  }

  const project = assertDedicatedCoquetteStagingProject(process.env)
  const servingHost = requiredS3ServingHost()
  const fileModuleService = container.resolve(Modules.FILE)
  const filename = `phase4-recovery-rehearsal-${Date.now()}-${process.pid}.png`
  let uploadedId: string | undefined
  let uploadedUrl: string | undefined
  let deleted = false

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

    const url = new URL(uploadedUrl)
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== servingHost) {
      throw unexpected(
        `Storage recovery rehearsal uploaded outside the configured COQUETTE serving host: ${uploadedUrl}`
      )
    }

    const retrieved = await fileModuleService.retrieveFile(uploadedId)
    if (!retrieved?.url) {
      throw unexpected("Storage recovery rehearsal could not retrieve the uploaded sentinel")
    }
    const retrievedUrl = new URL(retrieved.url)
    if (
      retrievedUrl.protocol !== "https:" ||
      retrievedUrl.hostname.toLowerCase() !== servingHost
    ) {
      throw unexpected(
        `Storage recovery rehearsal retrieved outside the configured COQUETTE serving host: ${retrieved.url}`
      )
    }

    await deleteFilesWorkflow(container).run({ input: { ids: [uploadedId] } })
    deleted = true

    let stillRetrievable = false
    try {
      await fileModuleService.retrieveFile(uploadedId)
      stillRetrievable = true
    } catch {
      // Expected after deletion.
    }
    if (stillRetrievable) {
      throw unexpected(
        "Storage recovery rehearsal sentinel remained retrievable after deletion"
      )
    }

    logger.info(
      `COQUETTE storage recovery rehearsal passed: ${JSON.stringify({
        supabaseProjectRef: project.supabaseProjectRef,
        databaseHost: project.databaseHost,
        databaseName: project.databaseName,
        servingMediaHost: servingHost,
        uploadedId,
        uploadedUrl,
        deleted: true,
      })}`
    )
  } finally {
    if (uploadedId && !deleted) {
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
