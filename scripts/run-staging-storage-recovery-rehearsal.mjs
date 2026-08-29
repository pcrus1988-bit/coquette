import { spawn } from "node:child_process"

const PROJECT_REF = "pijetwrxqznxaoacnakr"
const EXPECTED_DATABASE = "postgres"
const EXPECTED_SERVICE = "coquette-backend"
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

console.log("COQUETTE guarded storage rehearsal stage: validating deployed Railway runtime")

if (process.platform !== "linux") {
  fail(
    "this guarded rehearsal must execute inside the deployed Railway Linux container; railway run executes locally, so use railway ssh"
  )
}

const railwayDeploymentId = process.env.RAILWAY_DEPLOYMENT_ID?.trim()
const railwayReplicaId = process.env.RAILWAY_REPLICA_ID?.trim()
const railwayServiceName = process.env.RAILWAY_SERVICE_NAME?.trim()
if (!railwayDeploymentId || !railwayReplicaId) {
  fail(
    "RAILWAY_DEPLOYMENT_ID and RAILWAY_REPLICA_ID are required to prove execution inside a deployed Railway replica"
  )
}
if (railwayServiceName !== EXPECTED_SERVICE) {
  fail(
    `RAILWAY_SERVICE_NAME must equal ${EXPECTED_SERVICE}; received ${railwayServiceName || "missing"}`
  )
}

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) fail("DATABASE_URL is missing from the deployed runtime environment")

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
  COQUETTE_DISABLE_REDIS: "true",
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
      execution: {
        platform: process.platform,
        cwd: process.cwd(),
        railwayServiceName,
        railwayDeploymentId,
        railwayReplicaId,
        railwayReplicaRegion: process.env.RAILWAY_REPLICA_REGION || null,
      },
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
      redis: {
        disabledForStorageRehearsal: true,
      },
    },
    null,
    2
  )
)

const pnpmExecPath = process.env.npm_execpath?.trim()
if (!pnpmExecPath) {
  fail("pnpm executable path is unavailable; run this wrapper through the repository pnpm script")
}

console.log("COQUETTE guarded storage rehearsal stage: launching Medusa rehearsal child")

const child = spawn(
  process.execPath,
  [pnpmExecPath, "--filter", "@coquette/backend", "staging:storage-recovery-rehearsal"],
  {
    stdio: "inherit",
    env,
    shell: false,
    windowsHide: false,
  }
)

const heartbeat = setInterval(() => {
  console.log(
    `COQUETTE guarded storage rehearsal stage: Medusa child still running (pid=${child.pid ?? "unknown"})`
  )
}, 15000)
heartbeat.unref()

child.once("error", (error) => {
  clearInterval(heartbeat)
  console.error(`COQUETTE guarded storage rehearsal failed to launch: ${error.message}`)
  process.exitCode = 1
})

child.once("exit", (code, signal) => {
  clearInterval(heartbeat)
  if (signal) {
    console.error(`COQUETTE guarded storage rehearsal child exited via signal ${signal}`)
    process.exitCode = 1
    return
  }
  console.log(
    `COQUETTE guarded storage rehearsal stage: Medusa child exited with code ${code ?? 1}`
  )
  process.exitCode = code ?? 1
})
