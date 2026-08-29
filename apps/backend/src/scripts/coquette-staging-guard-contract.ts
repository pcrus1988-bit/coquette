import assert from "node:assert/strict"
import {
  assertDedicatedCoquetteStagingProject,
  COQUETTE_STAGING_SUPABASE_PROJECT_REF,
} from "../migration/coquette-staging-guard"

const common = {
  COQUETTE_MIGRATION_TARGET: "staging",
  COQUETTE_MIGRATION_ALLOW_WRITE: "COQUETTE_STAGING_WRITE_CONFIRMED",
  COQUETTE_MIGRATION_EXPECTED_SUPABASE_PROJECT_REF:
    COQUETTE_STAGING_SUPABASE_PROJECT_REF,
  COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME: "postgres",
}

assert.deepEqual(
  assertDedicatedCoquetteStagingProject({
    ...common,
    DATABASE_URL: `postgres://postgres:secret@db.${COQUETTE_STAGING_SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`,
    COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST: `db.${COQUETTE_STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
  }),
  {
    target: "staging",
    databaseHost: `db.${COQUETTE_STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
    databaseName: "postgres",
    supabaseProjectRef: COQUETTE_STAGING_SUPABASE_PROJECT_REF,
  }
)

assert.deepEqual(
  assertDedicatedCoquetteStagingProject({
    ...common,
    DATABASE_URL: `postgres://postgres.${COQUETTE_STAGING_SUPABASE_PROJECT_REF}:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
    COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST:
      "aws-0-eu-central-1.pooler.supabase.com",
  }),
  {
    target: "staging",
    databaseHost: "aws-0-eu-central-1.pooler.supabase.com",
    databaseName: "postgres",
    supabaseProjectRef: COQUETTE_STAGING_SUPABASE_PROJECT_REF,
  }
)

assert.throws(
  () =>
    assertDedicatedCoquetteStagingProject({
      ...common,
      COQUETTE_MIGRATION_EXPECTED_SUPABASE_PROJECT_REF: "eemihhfreggbigxejjhj",
      DATABASE_URL:
        "postgres://postgres:secret@db.eemihhfreggbigxejjhj.supabase.co:5432/postgres",
      COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST:
        "db.eemihhfreggbigxejjhj.supabase.co",
    }),
  /dedicated COQUETTE project ref/
)

assert.throws(
  () =>
    assertDedicatedCoquetteStagingProject({
      ...common,
      DATABASE_URL:
        "postgres://postgres:secret@db.eemihhfreggbigxejjhj.supabase.co:5432/postgres",
      COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST:
        "db.eemihhfreggbigxejjhj.supabase.co",
    }),
  /does not identify the dedicated COQUETTE Supabase project/
)

console.log(
  "COQUETTE dedicated staging identity contract passed: direct and pooler URLs are accepted only for the pinned COQUETTE Supabase project"
)
