import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  buildIndexedRecoveryProductCandidates,
  type IndexedRecoveryBaseline,
} from "../migration/indexed-recovery"

async function main() {
  const baselinePath = resolve(
    process.cwd(),
    "../../docs/migration/indexed-recovery-baseline.json"
  )
  const baseline = JSON.parse(
    await readFile(baselinePath, "utf8")
  ) as IndexedRecoveryBaseline

  const candidates = buildIndexedRecoveryProductCandidates(baseline)
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baselineObservedAt: baseline.observedAt,
    provenance: baseline.provenance,
    summary: {
      total: candidates.length,
      ready: candidates.filter((candidate) => candidate.disposition === "ready")
        .length,
      needsReview: candidates.filter(
        (candidate) => candidate.disposition === "needs_review"
      ).length,
      rejected: candidates.filter(
        (candidate) => candidate.disposition === "rejected"
      ).length,
    },
    candidates,
  }

  const output = `${JSON.stringify(report, null, 2)}\n`
  const outputPath = process.env.COQUETTE_RECOVERY_CANDIDATE_REPORT
  if (outputPath) {
    await writeFile(resolve(outputPath), output, "utf8")
  }

  console.log(output)

  if (report.summary.ready > 0) {
    console.error(
      "Indexed-only recovery evidence must never become an auto-ready product candidate"
    )
    process.exitCode = 2
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
