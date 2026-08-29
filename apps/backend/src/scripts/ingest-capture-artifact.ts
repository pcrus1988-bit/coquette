import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { verifyCaptureEvidencePackage } from "../migration/capture-evidence-package"
import { buildCanonicalCaptureProductCandidates } from "../migration/canonical-product-identity"
import { readCaptureArtifactBundle } from "../migration/capture-ingestion"
import {
  validateCaptureArtifactBundle,
  type CaptureValidationIssue,
} from "../migration/capture-validation"
import {
  applyConfigurableChildSkuSupplement,
  type ConfigurableChildSkuSupplement,
} from "../migration/configurable-child-sku-supplement"
import { buildProductImportPlan } from "../migration/import-plan"
import type { IndexedRecoveryBaseline } from "../migration/indexed-recovery"
import { buildReconstructionUrlUniverse } from "../migration/url-universe"

type ManualUnavailable = Array<{ url: string; note: string }>

async function optionalManualUnavailable(path?: string): Promise<ManualUnavailable> {
  if (!path) return []
  const value = JSON.parse(await readFile(resolve(path), "utf8")) as unknown
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const record = entry as Record<string, unknown>
    if (typeof record.url !== "string" || typeof record.note !== "string") return []
    if (!record.url.trim() || !record.note.trim()) return []
    return [{ url: record.url, note: record.note }]
  })
}

async function optionalChildSkuSupplement(path?: string) {
  if (!path?.trim()) return undefined
  return JSON.parse(
    await readFile(resolve(path), "utf8")
  ) as ConfigurableChildSkuSupplement
}

function raiseExitCode(code: number) {
  const current = typeof process.exitCode === "number" ? process.exitCode : 0
  process.exitCode = Math.max(current, code)
}

async function main() {
  const captureDir = process.env.COQUETTE_CAPTURE_DIR
  if (!captureDir) {
    console.error("COQUETTE_CAPTURE_DIR is required")
    process.exitCode = 1
    return
  }

  const baselinePath = resolve(
    process.cwd(),
    "../../docs/migration/indexed-recovery-baseline.json"
  )
  const baseline = JSON.parse(
    await readFile(baselinePath, "utf8")
  ) as IndexedRecoveryBaseline

  const resolvedCaptureDir = resolve(captureDir)
  const evidencePackageValidation = await verifyCaptureEvidencePackage(
    resolvedCaptureDir
  )
  const evidencePackage = evidencePackageValidation.package
  const expectedEvidenceChecksum =
    process.env.COQUETTE_EXPECTED_EVIDENCE_PACKAGE_CHECKSUM?.trim()
  if (
    expectedEvidenceChecksum &&
    evidencePackage?.packageChecksum !== expectedEvidenceChecksum
  ) {
    console.error(
      `Evidence package checksum mismatch: expected ${expectedEvidenceChecksum}, received ${
        evidencePackage?.packageChecksum ?? "missing"
      }`
    )
    process.exitCode = 1
    return
  }

  const bundle = await readCaptureArtifactBundle(resolvedCaptureDir)
  const artifactValidation = validateCaptureArtifactBundle(bundle)
  const packageIssues: CaptureValidationIssue[] =
    evidencePackageValidation.issues.map((issue) => ({
      severity: issue.severity,
      code: issue.code,
      message: issue.path ? `${issue.message} (${issue.path})` : issue.message,
    }))
  const issues = [...artifactValidation.issues, ...packageIssues]
  const critical = issues.filter((issue) => issue.severity === "critical").length
  const review = issues.filter((issue) => issue.severity === "review").length
  const validation = {
    issues,
    critical,
    review,
    isValid: critical === 0,
  }

  const manualUnavailable = await optionalManualUnavailable(
    process.env.COQUETTE_UNAVAILABLE_URLS_FILE
  )
  const sourceCandidates = buildCanonicalCaptureProductCandidates(bundle)
  const childSkuSupplement = await optionalChildSkuSupplement(
    process.env.COQUETTE_CONFIGURABLE_CHILD_SKU_EVIDENCE_FILE
  )
  const childSkuApplication = childSkuSupplement
    ? applyConfigurableChildSkuSupplement({
        candidates: sourceCandidates,
        evidence: childSkuSupplement,
        expectedCaptureId: bundle.manifest.captureId,
        expectedEvidencePackageChecksum:
          evidencePackage?.packageChecksum ?? "missing",
      })
    : undefined
  const candidates = childSkuApplication?.candidates ?? sourceCandidates
  const importPlan = buildProductImportPlan(candidates)
  const urlUniverse = buildReconstructionUrlUniverse(
    bundle.pages,
    baseline,
    manualUnavailable
  )
  const productStructures = bundle.productStructures ?? {}
  const structures = Object.values(productStructures)

  const analysisCodeRevision =
    process.env.COQUETTE_CAPTURE_ANALYSIS_CODE_REVISION?.trim()
  const report = {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    ...(analysisCodeRevision || expectedEvidenceChecksum || childSkuApplication
      ? {
          analysis: {
            ...(analysisCodeRevision
              ? { codeRevision: analysisCodeRevision }
              : {}),
            ...(expectedEvidenceChecksum
              ? { expectedEvidencePackageChecksum: expectedEvidenceChecksum }
              : {}),
            actualEvidencePackageChecksum: evidencePackage?.packageChecksum,
            ...(childSkuApplication
              ? {
                  configurableChildSkuEvidenceChecksum:
                    childSkuApplication.evidenceChecksum,
                }
              : {}),
          },
        }
      : {}),
    capture: {
      captureId: bundle.manifest.captureId,
      source: bundle.manifest.source,
      startedAt: bundle.manifest.startedAt,
      completedAt: bundle.manifest.completedAt,
      declaredComplete: bundle.manifest.complete,
      failureReason: bundle.manifest.failureReason,
      validation,
      evidencePackage: {
        isValid: evidencePackageValidation.isValid,
        packageChecksum: evidencePackage?.packageChecksum,
        provenanceMode: evidencePackage?.provenance.mode,
        transport: evidencePackage?.provenance.transport,
        browserMode: evidencePackage?.provenance.browserMode,
        codeRevision: evidencePackage?.provenance.codeRevision,
        files: evidencePackage?.totals.files,
        bytes: evidencePackage?.totals.bytes,
      },
      pages: bundle.pages.length,
      products: bundle.products.length,
      media: bundle.media.length,
      pagesWithRecoveredMediaRelationships: Object.keys(bundle.pageMedia).length,
    },
    productStructure: {
      productsReparsed: structures.length,
      withGalleryMedia: structures.filter(
        (structure) => structure.galleryMedia.length > 0
      ).length,
      withCategories: structures.filter(
        (structure) => structure.categoryReferences.length > 0
      ).length,
      withOptionGroups: structures.filter(
        (structure) => structure.optionGroups.length > 0
      ).length,
      explicitlyConfigurable: structures.filter(
        (structure) => structure.typeHint === "configurable"
      ).length,
      records: productStructures,
    },
    ...(childSkuApplication
      ? {
          configurableChildSkuSupplement: {
            evidenceChecksum: childSkuApplication.evidenceChecksum,
            completeEvidenceParents:
              childSkuApplication.completeEvidenceParents,
            appliedParents: childSkuApplication.appliedParents,
            appliedChildren: childSkuApplication.appliedChildren,
            unresolvedRecords: childSkuApplication.unresolvedRecords,
          },
        }
      : {}),
    candidates: {
      total: candidates.length,
      ready: candidates.filter((candidate) => candidate.disposition === "ready").length,
      needsReview: candidates.filter(
        (candidate) => candidate.disposition === "needs_review"
      ).length,
      rejected: candidates.filter((candidate) => candidate.disposition === "rejected")
        .length,
      records: candidates,
    },
    importPlan,
    urlUniverse,
  }

  const output = `${JSON.stringify(report, null, 2)}\n`
  const outputPath = process.env.COQUETTE_CAPTURE_INGESTION_REPORT
  if (outputPath) await writeFile(resolve(outputPath), output, "utf8")

  if (process.env.COQUETTE_RUNTIME_IMPORT_MANIFEST?.trim()) {
    console.error(
      "COQUETTE_RUNTIME_IMPORT_MANIFEST is retired. Capture ingestion cannot emit a raw runtime manifest; create and verify a Phase 4N reconciliation bundle instead."
    )
    raiseExitCode(4)
  }

  if (outputPath) {
    console.log(
      JSON.stringify(
        {
          captureId: bundle.manifest.captureId,
          evidencePackageChecksum: evidencePackage?.packageChecksum,
          analysisCodeRevision,
          reportPath: resolve(outputPath),
          validation: {
            critical: validation.critical,
            review: validation.review,
            isValid: validation.isValid,
          },
          productStructure: {
            productsReparsed: structures.length,
            explicitlyConfigurable: structures.filter(
              (structure) => structure.typeHint === "configurable"
            ).length,
          },
          ...(childSkuApplication
            ? {
                configurableChildSkuSupplement: {
                  evidenceChecksum: childSkuApplication.evidenceChecksum,
                  completeEvidenceParents:
                    childSkuApplication.completeEvidenceParents,
                  appliedParents: childSkuApplication.appliedParents,
                  appliedChildren: childSkuApplication.appliedChildren,
                  unresolvedRecords: childSkuApplication.unresolvedRecords.length,
                },
              }
            : {}),
          candidates: {
            total: candidates.length,
            ready: candidates.filter(
              (candidate) => candidate.disposition === "ready"
            ).length,
            needsReview: candidates.filter(
              (candidate) => candidate.disposition === "needs_review"
            ).length,
            rejected: candidates.filter(
              (candidate) => candidate.disposition === "rejected"
            ).length,
          },
          importPlan: {
            totals: importPlan.totals,
            duplicateSkus: importPlan.duplicateSkus.length,
            isExecutable: importPlan.isExecutable,
          },
          unresolvedUrls: urlUniverse.unresolved,
        },
        null,
        2
      )
    )
  } else {
    console.log(output)
  }

  if (!validation.isValid) {
    raiseExitCode(2)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
