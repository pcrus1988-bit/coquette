import { spawnSync } from "node:child_process"

const PROJECT_REF = "pijetwrxqznxaoacnakr"
const EXPECTED_DATABASE = "postgres"
const REQUIRED_S3 = [
  "S3_FILE_URL",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
]

function fail(message) {
  console.error(`COQUETTE guarded storage rehearsal blocked: ${message}`)
  process.exit(3)
}

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) fail("DATABASE_URL is missing from the injected runtime environment")

let parsed
try {
  parsed = new URL(databaseUrl)
} catch {
  fail("DATABASE_URL is invalid")
}

const databaseHost = parsed.hostname.toLowerCase()
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""))
const databaseUsername = decodeURIComponent(parsed.username).toLowerCase()

if (!databaseHost.includes(PROJECT_REF) && !databaseUsername.includes(PROJECT_REF)) {
  fail("DATABASE_URL does not identify the dedicated COQUETTE Supabase project")
}
if (databaseName !== EXPECTED_DATABASE) {
  fail(`DATABASE_URL must target database ${EXPECTED_DATABASE}`)
}

const missingS3 = REQUIRED_S3.filter((key) => !process.env[key]?.trim())
if (missingS3.length > 0) {
  fail(`missing required storage environment variables: ${missingS3.join(", ")}`)
}

const env = {
  ...process.env,
  COQUETTE_MIGRATION_TARGET: "staging",
  COQUETTE_MIGRATION_ALLOW_WRITE: "COQUETTE_STAGING_WRITE_CONFIRMED",
  COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST: parsed.hostname,
  COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME: databaseName,
  COQUETTE_MIGRATION_EXPECTED_SUPABASE_PROJECT_REF: PROJECT_REF,
  COQUETTE_STORAGE_RECOVERY_REHEARSAL: "COQUETTE_STORAGE_RECOVERY_REHEARSAL_CONFIRMED",
}

console.log(
  JSON.stringify(
    {
      status: "guarded_storage_rehearsal_runtime_ready",
      projectRef: PROJECT_REF,
      database: {
        host: parsed.hostname,
        name: databaseName,
      },
      storage: {
        configured: true,
        bucket: process.env.S3_BUCKET,
        region: process.env.S3_REGION,
        hasAccessKey: Boolean(process.env.S3_ACCESS_KEY_ID?.trim()),
        hasSecretKey: Boolean(process.env.S3_SECRET_ACCESS_KEY?.trim()),
      },
    },
    null,
    2
  )
)

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const result = spawnSync(
  command,
  ["--filter", "@coquette/backend", "staging:storage-recovery-rehearsal"],
  {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  }
)

if (result.error) {
  console.error(`COQUETTE guarded storage rehearsal failed to launch: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
