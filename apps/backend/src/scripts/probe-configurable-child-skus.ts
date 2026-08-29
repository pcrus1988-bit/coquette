import { MedusaError } from "@medusajs/framework/utils"
import { execFile } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { promisify } from "node:util"
import { verifyCaptureEvidencePackage } from "../migration/capture-evidence-package"
import { buildCanonicalCaptureProductCandidates } from "../migration/canonical-product-identity"
import { readCaptureArtifactBundle } from "../migration/capture-ingestion"
import { sourceChecksum } from "../migration/checksum"
import { BrowserTransport } from "../reconstruction/browser-transport"
import {
  configurableChildSkuGraphqlQuery,
  parseConfigurableChildSkuGraphqlResponse,
} from "../reconstruction/configurable-child-sku-evidence"
import { textContent } from "../reconstruction/html-evidence"

const execFileAsync = promisify(execFile)
const GRAPHQL_URL = "https://coquetteconcept.gr/graphql"

function unexpected(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function booleanEnv(name: string, fallback: boolean) {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  return !["0", "false", "no", "off"].includes(raw.toLowerCase())
}

function integerEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function assertOperatorEnvironment() {
  if (booleanEnv("CI", false) || booleanEnv("GITHUB_ACTIONS", false)) {
    throw unexpected(
      "Configurable child SKU probe refuses CI/GitHub Actions. Run it from the accepted local/operator browser network."
    )
  }
  const mode = process.env.COQUETTE_CAPTURE_BROWSER_MODE?.trim() || "headed"
  if (mode !== "headed" && mode !== "headless") {
    throw unexpected(
      "COQUETTE_CAPTURE_BROWSER_MODE must be either 'headed' or 'headless'"
    )
  }
  return mode
}

async function gitRevision() {
  if (process.env.COQUETTE_CAPTURE_CODE_REVISION?.trim()) {
    return process.env.COQUETTE_CAPTURE_CODE_REVISION.trim()
  }
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      timeout: 5_000,
    })
    return stdout.trim() || undefined
  } catch {
    return undefined
  }
}

function jsonFromBrowserDocument(html: string) {
  const raw = textContent(html).trim()
  if (!raw) throw unexpected("GraphQL browser response body is empty")
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw unexpected("GraphQL browser response is not valid JSON")
  }
}

function graphqlGetUrl(parentSku: string) {
  const url = new URL(GRAPHQL_URL)
  url.searchParams.set("query", configurableChildSkuGraphqlQuery())
  url.searchParams.set("variables", JSON.stringify({ sku: parentSku }))
  return url.toString()
}

function hasGraphqlErrors(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Array.isArray((value as Record<string, unknown>).errors) &&
    ((value as Record<string, unknown>).errors as unknown[]).length > 0
}

async function main() {
  const browserMode = assertOperatorEnvironment()
  const captureDir = process.env.COQUETTE_CAPTURE_DIR?.trim()
  const expectedEvidenceChecksum =
    process.env.COQUETTE_EXPECTED_EVIDENCE_PACKAGE_CHECKSUM?.trim()
  if (!captureDir || !expectedEvidenceChecksum) {
    throw unexpected(
      "COQUETTE_CAPTURE_DIR and COQUETTE_EXPECTED_EVIDENCE_PACKAGE_CHECKSUM are required"
    )
  }

  const resolvedCaptureDir = resolve(captureDir)
  const evidenceVerification = await verifyCaptureEvidencePackage(resolvedCaptureDir)
  if (!evidenceVerification.isValid || !evidenceVerification.package) {
    throw unexpected("Verified operator capture evidence package is required")
  }
  if (
    evidenceVerification.package.packageChecksum !== expectedEvidenceChecksum
  ) {
    throw unexpected(
      `Evidence package checksum mismatch: expected ${expectedEvidenceChecksum}, received ${evidenceVerification.package.packageChecksum}`
    )
  }

  const bundle = await readCaptureArtifactBundle(resolvedCaptureDir)
  const candidates = buildCanonicalCaptureProductCandidates(bundle)
  const configurable = candidates
    .filter(
      (candidate) =>
        candidate.selected.type === "configurable" &&
        Boolean(candidate.selected.sku?.trim()) &&
        Boolean(candidate.selected.sourceId?.trim()) &&
        candidate.selected.configurableVariantMatrixComplete === true &&
        (candidate.selected.configurableVariants?.length ?? 0) > 0
    )
    .sort((left, right) => left.candidateKey.localeCompare(right.candidateKey))

  if (configurable.length === 0) {
    throw unexpected(
      "No configurable candidates with complete archived child-ID matrices are available to probe"
    )
  }

  const limit = Math.min(
    configurable.length,
    integerEnv("COQUETTE_CHILD_SKU_PROBE_LIMIT", configurable.length)
  )
  const selected = configurable.slice(0, limit)
  const delayMs = integerEnv("COQUETTE_CHILD_SKU_PROBE_DELAY_MS", 250)
  const generatedAt = new Date().toISOString()
  const codeRevision = await gitRevision()
  const outputPath = resolve(
    process.env.COQUETTE_CHILD_SKU_EVIDENCE_FILE?.trim() ||
      `migration-data/capture-supplements/${bundle.manifest.captureId ?? "unknown-capture"}/configurable-child-skus-${generatedAt.replace(/[:.]/g, "-")}.json`
  )

  process.env.COQUETTE_CAPTURE_CHALLENGE_TIMEOUT_MS ??= "120000"
  process.env.COQUETTE_CAPTURE_BROWSER_MODE = browserMode

  const browser = await BrowserTransport.launch()
  const records: Array<Record<string, unknown>> = []
  let stoppedEarly = false

  try {
    for (let index = 0; index < selected.length; index += 1) {
      const candidate = selected[index]
      const parentSku = candidate.selected.sku!.trim()
      const parentSourceUrl = candidate.selected.sourceId!.trim()
      const expectedChildIds = [
        ...new Set(
          (candidate.selected.configurableVariants ?? [])
            .map((variant) => variant.sourceProductId.trim())
            .filter(Boolean)
        ),
      ].sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true })
      )

      console.log(
        `Child SKU probe: ${index + 1}/${selected.length} ${parentSku} (${expectedChildIds.length} child IDs)`
      )

      const parentPage = await browser.fetchText(parentSourceUrl)
      if (!parentPage.ok) {
        records.push({
          candidateKey: candidate.candidateKey,
          parentSku,
          parentSourceUrl,
          legacyProductId: candidate.selected.legacyProductId,
          expectedChildIds,
          parentPage: {
            ok: false,
            status: parentPage.status,
            finalUrl: parentPage.url,
            contentType: parentPage.contentType,
          },
          parsed: {
            parentSku,
            resolved: [],
            unresolvedSourceProductIds: expectedChildIds,
            issues: [`parent_page_http_status:${parentPage.status}`],
            complete: false,
          },
        })
        await sleep(delayMs)
        continue
      }

      const response = await browser.fetchText(graphqlGetUrl(parentSku))
      let rawResponse: unknown
      let parseIssue: string | undefined
      try {
        rawResponse = jsonFromBrowserDocument(response.text)
      } catch (error) {
        parseIssue = error instanceof Error ? error.message : String(error)
      }

      const parsed = rawResponse
        ? parseConfigurableChildSkuGraphqlResponse({
            parentSku,
            expectedSourceProductIds: expectedChildIds,
            response: rawResponse,
          })
        : {
            parentSku,
            resolved: [],
            unresolvedSourceProductIds: expectedChildIds,
            issues: [
              `graphql_http_status:${response.status}`,
              parseIssue ?? "graphql_response_unavailable",
            ],
            complete: false,
          }

      records.push({
        candidateKey: candidate.candidateKey,
        parentSku,
        parentSourceUrl,
        legacyProductId: candidate.selected.legacyProductId,
        expectedChildIds,
        parentPage: {
          ok: parentPage.ok,
          status: parentPage.status,
          finalUrl: parentPage.url,
          contentType: parentPage.contentType,
        },
        graphql: {
          requestUrl: GRAPHQL_URL,
          method: "GET",
          status: response.status,
          ok: response.ok,
          contentType: response.contentType,
          responseChecksum: rawResponse ? sourceChecksum(rawResponse) : undefined,
          response: rawResponse,
        },
        parsed,
      })

      const endpointOrSchemaFailure =
        !response.ok || Boolean(parseIssue) || hasGraphqlErrors(rawResponse)
      if (endpointOrSchemaFailure) {
        stoppedEarly = true
        console.log(
          "Child SKU probe stopped after endpoint/schema failure; diagnostic evidence will be saved without further GraphQL requests."
        )
        break
      }

      await sleep(delayMs)
    }
  } finally {
    await browser.close()
  }

  const completeParents = records.filter(
    (record) => (record.parsed as { complete?: boolean } | undefined)?.complete === true
  ).length
  const resolvedChildren = records.reduce((sum, record) => {
    const parsed = record.parsed as { resolved?: unknown[] } | undefined
    return sum + (parsed?.resolved?.length ?? 0)
  }, 0)
  const unresolvedChildren = records.reduce((sum, record) => {
    const parsed = record.parsed as
      | { unresolvedSourceProductIds?: unknown[] }
      | undefined
    return sum + (parsed?.unresolvedSourceProductIds?.length ?? 0)
  }, 0)
  const unprobedParents = selected.length - records.length

  const payload = {
    schemaVersion: 1 as const,
    generatedAt,
    captureId: bundle.manifest.captureId,
    captureEvidencePackageChecksum: expectedEvidenceChecksum,
    provenance: {
      mode: "operator_local_browser" as const,
      transport: "browser_graphql_get" as const,
      browserMode,
      codeRevision,
      source: GRAPHQL_URL,
    },
    queryChecksum: sourceChecksum(configurableChildSkuGraphqlQuery()),
    parentsSelected: selected.length,
    parentsProbed: records.length,
    stoppedEarly,
    records,
    totals: {
      completeParents,
      incompleteParents: records.length - completeParents,
      unprobedParents,
      resolvedChildren,
      unresolvedChildren,
    },
  }
  const evidence = {
    ...payload,
    evidenceChecksum: sourceChecksum(payload),
  }

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8")

  console.log(
    JSON.stringify(
      {
        status:
          evidence.totals.incompleteParents === 0 &&
          evidence.totals.unprobedParents === 0 &&
          evidence.totals.unresolvedChildren === 0
            ? "configurable_child_sku_evidence_complete"
            : "configurable_child_sku_evidence_partial",
        captureId: evidence.captureId,
        captureEvidencePackageChecksum: evidence.captureEvidencePackageChecksum,
        evidenceChecksum: evidence.evidenceChecksum,
        parentsSelected: evidence.parentsSelected,
        parentsProbed: evidence.parentsProbed,
        stoppedEarly: evidence.stoppedEarly,
        totals: evidence.totals,
        output: outputPath,
      },
      null,
      2
    )
  )

  if (
    evidence.totals.incompleteParents > 0 ||
    evidence.totals.unprobedParents > 0 ||
    evidence.totals.unresolvedChildren > 0
  ) {
    process.exitCode = 3
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
