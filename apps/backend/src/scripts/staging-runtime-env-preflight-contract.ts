import assert from "node:assert/strict"
import {
  inspectCoquetteStagingRuntimeEnvironment,
} from "../migration/staging-runtime-environment"

const directEnv: NodeJS.ProcessEnv = {
  DATABASE_URL:
    "postgresql://postgres:db-secret-password@db.pijetwrxqznxaoacnakr.supabase.co:5432/postgres",
  S3_FILE_URL:
    "https://pijetwrxqznxaoacnakr.supabase.co/storage/v1/object/public/coquette-media",
  S3_ENDPOINT:
    "https://pijetwrxqznxaoacnakr.storage.supabase.co/storage/v1/s3",
  S3_REGION: "eu-central-1",
  S3_BUCKET: "coquette-media",
  S3_ACCESS_KEY_ID: "access-secret",
  S3_SECRET_ACCESS_KEY: "secret-secret",
}

const direct = inspectCoquetteStagingRuntimeEnvironment(directEnv)
assert.equal(direct.ready, true)
assert.equal(direct.status, "staging_runtime_environment_ready")
assert.equal(direct.database.projectIdentityMatched, true)
assert.equal(direct.database.host, "db.pijetwrxqznxaoacnakr.supabase.co")
assert.equal(direct.database.name, "postgres")
assert.equal(direct.storage.projectIdentityMatched, true)
assert.equal(direct.storage.hasAccessKey, true)
assert.equal(direct.storage.hasSecretKey, true)

const serialized = JSON.stringify(direct)
assert.equal(serialized.includes("db-secret-password"), false)
assert.equal(serialized.includes("access-secret"), false)
assert.equal(serialized.includes("secret-secret"), false)

const pooler = inspectCoquetteStagingRuntimeEnvironment({
  ...directEnv,
  DATABASE_URL:
    "postgresql://postgres.pijetwrxqznxaoacnakr:pooler-secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
})
assert.equal(pooler.ready, true)
assert.equal(pooler.database.projectIdentityMatched, true)
assert.equal(JSON.stringify(pooler).includes("pooler-secret"), false)

const missing = inspectCoquetteStagingRuntimeEnvironment({})
assert.equal(missing.ready, false)
for (const key of [
  "DATABASE_URL",
  "S3_FILE_URL",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
]) {
  assert(missing.blockers.includes(`missing_environment_variable:${key}`))
}

const wrongProject = inspectCoquetteStagingRuntimeEnvironment({
  ...directEnv,
  DATABASE_URL: "postgresql://postgres:secret@db.otherproject.supabase.co:5432/postgres",
})
assert.equal(wrongProject.ready, false)
assert(
  wrongProject.blockers.includes("database_not_dedicated_coquette_supabase_project")
)

const wrongStorage = inspectCoquetteStagingRuntimeEnvironment({
  ...directEnv,
  S3_FILE_URL:
    "https://otherproject.supabase.co/storage/v1/object/public/coquette-media",
  S3_ENDPOINT: "https://otherproject.storage.supabase.co/storage/v1/s3",
  S3_REGION: "us-east-1",
  S3_BUCKET: "other-media",
})
assert.equal(wrongStorage.ready, false)
assert(
  wrongStorage.blockers.includes("s3_file_url_not_dedicated_coquette_media_bucket")
)
assert(wrongStorage.blockers.includes("s3_endpoint_not_dedicated_coquette_project"))
assert(wrongStorage.blockers.includes("s3_region_not_expected_coquette_region"))
assert(wrongStorage.blockers.includes("s3_bucket_not_expected_coquette_media_bucket"))

const invalid = inspectCoquetteStagingRuntimeEnvironment({
  ...directEnv,
  DATABASE_URL: "not-a-url",
  S3_ENDPOINT: "not-a-url",
})
assert.equal(invalid.ready, false)
assert(invalid.blockers.includes("database_url_invalid"))
assert(invalid.blockers.includes("s3_endpoint_invalid"))

console.log("COQUETTE staging runtime environment preflight contract passed")
