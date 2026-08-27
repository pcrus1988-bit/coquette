import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createCaptureEvidencePackage } from "../migration/capture-evidence-package"
import { createCaptureHandoff } from "../migration/capture-handoff"
import {
  buildCaptureHandoffIntake,
  readVerifiedCaptureHandoffReport,
} from "../migration/capture-handoff-intake"
import { buildProductImportPlan } from "../migration/import-plan"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"
import {
  buildReconstructionReviewPlan,
  type ReviewDecision,
} from "../migration/review-decisions"
import type { CaptureIngestionReportForReconciliation } from "../migration/migration-input-reconciliation"
import type { ReconstructionUrlUniverse } from "../migration/url-universe"

const capturedAt = "2026-08-27T09:30:00.000Z"
const sourceUrl = "https://coquetteconcept.gr/default/phase-4t-contract.html"
const categoryUrl = "https://coquetteconcept.gr/default/dresses.html"
const mediaUrl =
  "https://coquetteconcept.gr/media/catalog/product/phase-4t-contract.jpg"

function observation(): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl,
    observedAt: capturedAt,
    fields: {
      sourceId: sourceUrl,
      canonicalUrl: sourceUrl,
      sku: "PHASE-4T-1",
      name: "Phase 4T Contract Product",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      categorySourceIds: [categoryUrl],
      optionValues: { size: "S" },
      mediaSourceIds: [mediaUrl],
      stockState: "in_stock",
      regularPrice: 139,
      currencyCode: "EUR",
    },
  }
}

function urlUniverse(): ReconstructionUrlUniverse {
  return {
    entries: [
      {
        url: sourceUrl,
        status: "captured",
        canonicalUrl: sourceUrl,
        evidence: [
          {
            source: "direct_capture",
            observedAt: capturedAt,
            captureStatus: "captured",
            httpStatus: 200,
            pageType: "product",
            checksum: "phase-4t-page-checksum",
          },
        ],
      },
    ],
    totals: {
      captured: 1,
      skipped: 0,
      error: 0,
      indexed_only: 0,
      unavailable: 0,
    },
    unresolved: 0,
    isFullyClassified: true,
  }
}

async function writeCaptureFixture(root: string) {
  await mkdir(join(root, "pages"), { recursive: true })
  await mkdir(join(root, "media"), { recursive: true })
  await writeFile(
    join(root, "manifest.json"),
    `${JSON.stringify({
      schemaVersion: 2,
      captureId: "phase-4t-contract",
      source: "https://coquetteconcept.gr/",
      evidenceMode: "public_storefront",
      transport: "browser",
      startedAt: capturedAt,
      completedAt: capturedAt,
      complete: true,
      remainingQueue: 0,
      pages: { captured: 1, skipped: 0, errors: 0, products: 1 },
      media: { discovered: 1, captured: 1, skipped: 0, errors: 0 },
    }, null, 2)}\n`,
    "utf8"
  )
  await writeFile(join(root, "robots.txt"), "User-agent: *\nDisallow:\n", "utf8")
  await writeFile(
    join(root, "pages", "fixture.html"),
    `<html><head><link rel="canonical" href="${sourceUrl}"></head><body><img src="${mediaUrl}"></body></html>`,
    "utf8"
  )
  await writeFile(join(root, "media", "fixture.jpg"), Buffer.from("phase-4t-media"))
  await writeFile(
    join(root, "pages.jsonl"),
    `${JSON.stringify({ sourceUrl, finalUrl: sourceUrl, status: "captured", httpStatus: 200, capturedAt, pageFile: "pages/fixture.html", pageType: "product" })}\n`,
    "utf8"
  )
  await writeFile(
    join(root, "products.jsonl"),
    `${JSON.stringify({ sourceUrl, canonicalUrl: sourceUrl, sku: "PHASE-4T-1", name: "Phase 4T Contract Product" })}\n`,
    "utf8"
  )
  await writeFile(
    join(root, "media.jsonl"),
    `${JSON.stringify({ sourceUrl: mediaUrl, status: "captured", httpStatus: 200, contentType: "image/jpeg", mediaFile: "media/fixture.jpg", capturedAt })}\n`,
    "utf8"
  )
  await writeFile(
    join(root, "url-inventory.jsonl"),
    `${JSON.stringify({ sourceUrl, finalUrl: sourceUrl, status: "captured", httpStatus: 200, pageType: "product" })}\n`,
    "utf8"
  )
}

function localizationDecision(candidate: ReturnType<typeof buildRecoveryProductCandidate>, productPlan: ReturnType<typeof buildProductImportPlan>): ReviewDecision {
  const item = buildReconstructionReviewPlan({
    candidates: [candidate],
    productPlan,
  }).items.find((entry) => entry.issueType === "localization_pairing_missing")
  assert.ok(item)
  return {
    reviewKey: item.reviewKey,
    evidenceChecksum: item.evidenceChecksum,
    action: "mark_unavailable",
    decidedBy: "phase-4t-contract",
    decidedAt: "2026-08-27T09:35:00.000Z",
    rationale: "Complete capture contains no alternate-locale PDP for this fixture.",
  }
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "coquette-phase-4t-intake-"))
  const captureDir = join(root, "capture")
  const handoffDir = join(root, "handoff")
  const reportPath = join(root, "ingestion-report.json")

  try {
    await writeCaptureFixture(captureDir)
    const evidence = await createCaptureEvidencePackage({
      captureDir,
      browserMode: "headed",
      codeRevision: "phase-4t-contract-revision",
      packagedAt: "2026-08-27T09:31:00.000Z",
    })

    const candidate = buildRecoveryProductCandidate("phase-4t-contract", [
      observation(),
    ])
    const productPlan = buildProductImportPlan([candidate])
    const report: CaptureIngestionReportForReconciliation = {
      schemaVersion: 3,
      generatedAt: "2026-08-27T09:32:00.000Z",
      capture: {
        captureId: "phase-4t-contract",
        source: "https://coquetteconcept.gr/",
        startedAt: capturedAt,
        completedAt: capturedAt,
        declaredComplete: true,
        validation: { isValid: true },
        evidencePackage: {
          isValid: true,
          packageChecksum: evidence.packageChecksum,
          provenanceMode: "operator_local_browser",
          transport: "browser",
          browserMode: "headed",
          codeRevision: "phase-4t-contract-revision",
          files: evidence.totals.files,
          bytes: evidence.totals.bytes,
        },
      },
      candidates: { records: [candidate] },
      importPlan: productPlan,
      urlUniverse: urlUniverse(),
    }
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

    const handoff = await createCaptureHandoff({
      captureDir,
      ingestionReportPath: reportPath,
      outputDir: handoffDir,
      generatedAt: "2026-08-27T09:33:00.000Z",
      codeRevision: "phase-4t-contract-revision",
    })

    const embedded = await readVerifiedCaptureHandoffReport(handoff.archivePath)
    assert.equal(embedded.manifest.captureId, "phase-4t-contract")
    assert.equal(
      embedded.report.capture?.evidencePackage?.packageChecksum,
      evidence.packageChecksum
    )

    const withoutReview = await buildCaptureHandoffIntake({
      handoffPath: handoff.archivePath,
      generatedAt: "2026-08-27T09:34:00.000Z",
    })
    assert.equal(withoutReview.isReadyForDependencyProvisioning, false)
    assert.equal(withoutReview.dependencyRequirements.length, 0)
    assert.ok(withoutReview.globalBlockers.includes("review_items_remain_open"))
    assert.equal(withoutReview.reviewWorklist.length, 1)
    assert.equal(withoutReview.reviewWorklist[0].state, "open")
    assert.equal(withoutReview.unresolvedUrls, 0)
    assert.equal(withoutReview.isExecutable, false)

    const decision = localizationDecision(candidate, productPlan)
    const ready = await buildCaptureHandoffIntake({
      handoffPath: handoff.archivePath,
      decisions: [decision],
      generatedAt: "2026-08-27T09:36:00.000Z",
    })
    assert.equal(ready.isReadyForDependencyProvisioning, true)
    assert.deepEqual(ready.globalBlockers, [])
    assert.equal(ready.reviewWorklist.length, 0)
    assert.equal(ready.dependencyRequirements.length, 2)
    assert.deepEqual(
      ready.dependencyRequirements.map((entry) => entry.entityType).sort(),
      ["category", "media"]
    )
    assert.equal(
      ready.captureEvidencePackageChecksum,
      evidence.packageChecksum
    )
    assert.match(ready.migrationInput.bundleChecksum, /^[a-f0-9]{64}$/)
    assert.match(ready.intakeChecksum, /^[a-f0-9]{64}$/)

    const regenerated = await buildCaptureHandoffIntake({
      handoffPath: handoff.archivePath,
      decisions: [decision],
      generatedAt: "2026-08-27T11:00:00.000Z",
    })
    assert.equal(
      regenerated.migrationInput.bundleChecksum,
      ready.migrationInput.bundleChecksum
    )
    assert.equal(regenerated.intakeChecksum, ready.intakeChecksum)

    console.log(
      "COQUETTE Phase 4T verified handoff -> Phase 4N intake and dependency-worklist contract passed"
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
