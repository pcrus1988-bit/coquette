import { COQUETTE_STAGING_SUPABASE_PROJECT_REF } from "./coquette-staging-guard"

export const COQUETTE_STAGING_DATABASE_NAME = "postgres"
export const COQUETTE_STAGING_MEDIA_BUCKET = "coquette-media"
export const COQUETTE_STAGING_S3_REGION = "eu-central-1"

const REQUIRED_VARIABLES = [
  "DATABASE_URL",
  "S3_FILE_URL",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const

function normalizedPath(url: URL) {
  return url.pathname.replace(/\/+$/, "")
}

function safeUrl(raw: string | undefined) {
  if (!raw?.trim()) return undefined
  try {
    return new URL(raw)
  } catch {
    return undefined
  }
}

export type CoquetteStagingRuntimeEnvironmentInspection = {
  status: "staging_runtime_environment_ready" | "staging_runtime_environment_blocked"
  ready: boolean
  projectRef: string
  database: {
    configured: boolean
    host?: string
    name?: string
    projectIdentityMatched: boolean
  }
  storage: {
    configured: boolean
    fileHost?: string
    filePath?: string
    endpointHost?: string
    endpointPath?: string
    region?: string
    bucket?: string
    hasAccessKey: boolean
    hasSecretKey: boolean
    projectIdentityMatched: boolean
  }
  missingVariables: string[]
  blockers: string[]
}

export function inspectCoquetteStagingRuntimeEnvironment(
  env: NodeJS.ProcessEnv
): CoquetteStagingRuntimeEnvironmentInspection {
  const missingVariables = REQUIRED_VARIABLES.filter((key) => !env[key]?.trim())
  const blockers: string[] = missingVariables.map((key) => `missing_environment_variable:${key}`)

  const databaseUrl = safeUrl(env.DATABASE_URL)
  let databaseHost: string | undefined
  let databaseName: string | undefined
  let databaseProjectIdentityMatched = false

  if (env.DATABASE_URL?.trim() && !databaseUrl) {
    blockers.push("database_url_invalid")
  } else if (databaseUrl) {
    databaseHost = databaseUrl.hostname.toLowerCase()
    databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""))
    const databaseUsername = decodeURIComponent(databaseUrl.username).toLowerCase()
    databaseProjectIdentityMatched =
      databaseHost.includes(COQUETTE_STAGING_SUPABASE_PROJECT_REF) ||
      databaseUsername.includes(COQUETTE_STAGING_SUPABASE_PROJECT_REF)

    if (!databaseProjectIdentityMatched) {
      blockers.push("database_not_dedicated_coquette_supabase_project")
    }
    if (databaseName !== COQUETTE_STAGING_DATABASE_NAME) {
      blockers.push("database_name_not_expected_coquette_staging_database")
    }
  }

  const fileUrl = safeUrl(env.S3_FILE_URL)
  const endpointUrl = safeUrl(env.S3_ENDPOINT)
  const expectedFileHost = `${COQUETTE_STAGING_SUPABASE_PROJECT_REF}.supabase.co`
  const expectedFilePath = `/storage/v1/object/public/${COQUETTE_STAGING_MEDIA_BUCKET}`
  const expectedEndpointHost = `${COQUETTE_STAGING_SUPABASE_PROJECT_REF}.storage.supabase.co`
  const expectedEndpointPath = "/storage/v1/s3"

  if (env.S3_FILE_URL?.trim() && !fileUrl) {
    blockers.push("s3_file_url_invalid")
  } else if (fileUrl) {
    if (
      fileUrl.protocol !== "https:" ||
      fileUrl.hostname.toLowerCase() !== expectedFileHost ||
      normalizedPath(fileUrl) !== expectedFilePath
    ) {
      blockers.push("s3_file_url_not_dedicated_coquette_media_bucket")
    }
  }

  if (env.S3_ENDPOINT?.trim() && !endpointUrl) {
    blockers.push("s3_endpoint_invalid")
  } else if (endpointUrl) {
    if (
      endpointUrl.protocol !== "https:" ||
      endpointUrl.hostname.toLowerCase() !== expectedEndpointHost ||
      normalizedPath(endpointUrl) !== expectedEndpointPath
    ) {
      blockers.push("s3_endpoint_not_dedicated_coquette_project")
    }
  }

  if (env.S3_REGION?.trim() && env.S3_REGION.trim() !== COQUETTE_STAGING_S3_REGION) {
    blockers.push("s3_region_not_expected_coquette_region")
  }
  if (env.S3_BUCKET?.trim() && env.S3_BUCKET.trim() !== COQUETTE_STAGING_MEDIA_BUCKET) {
    blockers.push("s3_bucket_not_expected_coquette_media_bucket")
  }

  const storageProjectIdentityMatched = Boolean(
    fileUrl &&
      endpointUrl &&
      fileUrl.protocol === "https:" &&
      endpointUrl.protocol === "https:" &&
      fileUrl.hostname.toLowerCase() === expectedFileHost &&
      endpointUrl.hostname.toLowerCase() === expectedEndpointHost &&
      normalizedPath(fileUrl) === expectedFilePath &&
      normalizedPath(endpointUrl) === expectedEndpointPath &&
      env.S3_REGION?.trim() === COQUETTE_STAGING_S3_REGION &&
      env.S3_BUCKET?.trim() === COQUETTE_STAGING_MEDIA_BUCKET
  )

  const uniqueBlockers = [...new Set(blockers)].sort()
  const ready = uniqueBlockers.length === 0

  return {
    status: ready ? "staging_runtime_environment_ready" : "staging_runtime_environment_blocked",
    ready,
    projectRef: COQUETTE_STAGING_SUPABASE_PROJECT_REF,
    database: {
      configured: Boolean(env.DATABASE_URL?.trim()),
      host: databaseHost,
      name: databaseName,
      projectIdentityMatched: databaseProjectIdentityMatched,
    },
    storage: {
      configured: Boolean(
        env.S3_FILE_URL?.trim() &&
          env.S3_ENDPOINT?.trim() &&
          env.S3_REGION?.trim() &&
          env.S3_BUCKET?.trim() &&
          env.S3_ACCESS_KEY_ID?.trim() &&
          env.S3_SECRET_ACCESS_KEY?.trim()
      ),
      fileHost: fileUrl?.hostname.toLowerCase(),
      filePath: fileUrl ? normalizedPath(fileUrl) : undefined,
      endpointHost: endpointUrl?.hostname.toLowerCase(),
      endpointPath: endpointUrl ? normalizedPath(endpointUrl) : undefined,
      region: env.S3_REGION?.trim() || undefined,
      bucket: env.S3_BUCKET?.trim() || undefined,
      hasAccessKey: Boolean(env.S3_ACCESS_KEY_ID?.trim()),
      hasSecretKey: Boolean(env.S3_SECRET_ACCESS_KEY?.trim()),
      projectIdentityMatched: storageProjectIdentityMatched,
    },
    missingVariables: [...missingVariables],
    blockers: uniqueBlockers,
  }
}
