import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  buildDirectCaptureProductCandidates,
  readCaptureArtifactBundle,
} from "../migration/capture-ingestion"
import { validateCaptureArtifactBundle } from "../migration/capture-validation"
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

  const bundle = await readCaptureArtifactBundle(resolve(captureDir))
  const validation = validateCaptureArtifactBundle(bundle)
  const manualUnavailable = await optionalManualUnavailable(
    process.env.COQUETTE_UNAVAILABLE_URLS_FILE
  )
  const candidates = buildDirectCaptureProductCandidates(bundle)
  const urlUniverse = buildReconstructionUrlUniverse(
    bundle.pages,
    baseline,
    manualUnavailable
  )
  const productStructures = bundle.productStructures ?? {}
  const structures = Object.values(productStructures)

  const report = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    capture: {
      captureId: bundle.manifest.captureId,
      source: bundle.manifest.source,
      startedAt: bundle.manifest.startedAt,
      completedAt: bundle.manifest.completedAt,
      declaredComplete: bundle.manifest.complete,
      failureReason: bundle.manifest.failureReason,
      validation,
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
    urlUniverse,
  }

  const output = `${JSON.stringify(report, null, 2)}\n`
  const outputPath = process.env.COQUETTE_CAPTURE_INGESTION_REPORT
  if (outputPath) await writeFile(resolve(outputPath), output, "utf8")
  console.log(output)

  if (!validation.isValid) process.exitCode = 2
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
