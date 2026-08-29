import { loadEnv } from "@medusajs/framework/utils"
import { inspectCoquetteStagingRuntimeEnvironment } from "../migration/staging-runtime-environment"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const result = inspectCoquetteStagingRuntimeEnvironment(process.env)
console.log(JSON.stringify(result, null, 2))

if (!result.ready) {
  process.exitCode = 3
}
