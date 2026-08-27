import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createCaptureEvidencePackage } from "../migration/capture-evidence-package"
import { createCaptureHandoff } from "../migration/capture-handoff"
import { buildDependencyProvisioningEvidencePlan } from "../migration/dependency-provisioning-evidence"
import { buildProductImportPlan } from "../migration/import-plan"
import type { CaptureIngestionReportForReconciliation } from "../migration/migration-input-reconciliation"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductObservation,
} from "../migration/recovery-candidates"
import {
  buildReconstructionReviewPlan,
  type ReviewDecision,
} from "../migration/review-decisions"
import type { ReconstructionUrlUniverse } from "../migration/url-universe"

const capturedAt = "2026-08-27T10:00:00.000Z"
const productUrl = "https://coquetteconcept.gr/default/phase-4u-contract.html"
const categoryUrl = "https://coquetteconcept.gr/default/dresses.html"
const mediaUrl =
  "https://coquetteconcept.gr/media/catalog/product/phase-4u-contract.jpg"
const brandSourceId = "legacy-designer:phase-4u-contract"
const mediaBytes = Buffer.from("phase-4u-captured-image-bytes")
const mediaChecksum = createHash("sha256").update(mediaBytes).digest("hex")

type FixtureMode = "ready" | "category-name-missing" | "media-checksum-mismatch"

function observation(): RecoveryProductObservation {
  return {
    authority: "direct_storefront",
    sourceUrl: productUrl,
    observedAt: capturedAt,
    fields: {
      sourceId: productUrl,
      canonicalUrl: productUrl,
      sku: "PHASE-4U-1",
      name: "Phase 4U Contract Product",
      status: "enabled",
      visibility: "catalog_search",
      type: "simple",
      brandSourceId,
      categorySourceIds: [categoryUrl],
      optionValues: { size: "S" },
      mediaSourceIds: [mediaUrl],
      stockState: "in_stock",
      regularPrice: 159,
      currencyCode: "EUR",
    },
  }
}

function urlUniverse(): ReconstructionUrlUniverse {
  return {
    entries: [
      {
        url: productUrl,
        status: "captured",
        canonicalUrl: productUrl,
        evidence: [
          {
            source: "direct_capture",
            observedAt: capturedAt,
            captureStatus: "captured",
            httpStatus: 200,
            pageType: "product",
            checksum: "phase-4u-page-checksum",
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

function localizationDecision(
  candidate: ReturnType<typeof buildRecoveryProductCandidate>,
  productPlan: ReturnType<typeof buildProductImportPlan>
): ReviewDecision {
  const item = buildReconstructionReviewPlan({
    candidates: [candidate],
    productPlan,
  }).items.find((entry) => entry.issueType === "localization_pairing_missing")
  assert.ok(item)
  return {
    reviewKey: item.reviewKey,
    evidenceChecksum: item.evidenceChecksum,
    action: "mark_unavailable",
    decidedBy: "phase-4u-contract",
    decidedAt: "2026-08-27T10:05:00.000Z",
    rationale: "Complete fixture capture has no alternate-locale PDP.",
  }
}

async function makeFixture(root: string, mode: FixtureMode) {
  const captureDir = join(root, `capture-${mode}`)
  const handoffDir = join(root, `handoff-${mode}`)
  const reportPath = join(root, `report-${mode}.json`)
  await mkdir(join(captureDir, "pages"), { recursive: true })
  await mkdir(join(captureDir, "media"), { recursive: true })

  await writeFile(
    join(captureDir, "manifest.json"),
    `${JSON.stringify({
      schemaVersion: 2,
      captureId: `phase-4u-${mode}`,
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
  await writeFile(join(captureDir, "robots.txt"), "User-agent: *\nDisallow:\n", "utf8")
  await writeFile(
    join(captureDir, "pages", "fixture.html"),
    `<html><head><link rel="canonical" href="${productUrl}"></head><body>Phase 4U</body></html>`,
    "utf8"
  )
  await writeFile(join(captureDir, "media", "fixture.jpg"), mediaBytes)
  await writeFile(
    join(captureDir, "pages.jsonl"),
    `${JSON.stringify({
      sourceUrl: productUrl,
      finalUrl: productUrl,
      status: "captured",
      httpStatus: 200,
      capturedAt,
      pageFile: "pages/fixture.html",
      pageType: "product",
    })}\n`,
    "utf8"
  )
  await writeFile(
    join(captureDir, "products.jsonl"),
    `${JSON.stringify({
      sourceUrl: productUrl,
      canonicalUrl: productUrl,
      sku: "PHASE-4U-1",
      name: "Phase 4U Contract Product",
      brand: "COQUETTE TEST DESIGNER",
    })}\n`,
    "utf8"
  )
  await writeFile(
    join(captureDir, "media.jsonl"),
    `${JSON.stringify({
      sourceUrl: mediaUrl,
      status: "captured",
      httpStatus: 200,
      contentType: "image/jpeg",
      bytes: mediaBytes.length,
      checksum:
        mode === "media-checksum-mismatch" ? "0".repeat(64) : mediaChecksum,
      mediaFile: "media/fixture.jpg",
      capturedAt,
    })}\n`,
    "utf8"
  )
  await writeFile(
    join(captureDir, "url-inventory.jsonl"),
    `${JSON.stringify({
      sourceUrl: productUrl,
      finalUrl: productUrl,
      status: "captured",
      httpStatus: 200,
      pageType: "product",
    })}\n`,
    "utf8"
  )

  const evidence = await createCaptureEvidencePackage({
    captureDir,
    browserMode: "headed",
    codeRevision: "phase-4u-contract-revision",
    packagedAt: "2026-08-27T10:01:00.000Z",
  })
  const candidate = buildRecoveryProductCandidate(`phase-4u-${mode}`, [
    observation(),
  ])
  const productPlan = buildProductImportPlan([candidate])
  const report: CaptureIngestionReportForReconciliation & {
    productStructure: {
      records: Record<
        string,
        {
          galleryMedia: string[]
          categoryReferences: Array<{ name?: string; url: string }>
          optionGroups: Array<{ name: string; values: string[] }>
        }
      >
    }
  } = {
    schemaVersion: 3,
    generatedAt: "2026-08-27T10:02:00.000Z",
    capture: {
      captureId: `phase-4u-${mode}`,
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
        codeRevision: "phase-4u-contract-revision",
        files: evidence.totals.files,
        bytes: evidence.totals.bytes,
      },
    },
    candidates: { records: [candidate] },
    importPlan: productPlan,
    urlUniverse: urlUniverse(),
    productStructure: {
      records: {
        [productUrl]: {
          galleryMedia: [mediaUrl],
          categoryReferences: [
            {
              url: categoryUrl,
              ...(mode === "category-name-missing"
                ? {}
                : { name: "Dresses" }),
            },
          ],
          optionGroups: [{ name: "size", values: ["S"] }],
        },
      },
    },
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  const handoff = await createCaptureHandoff({
    captureDir,
    ingestionReportPath: reportPath,
    outputDir: handoffDir,
    generatedAt: "2026-08-27T10:03:00.000Z",
    codeRevision: "phase-4u-contract-revision",
  })

  return {
    handoffPath: handoff.archivePath,
    decision: localizationDecision(candidate, productPlan),
    evidencePackageChecksum: evidence.packageChecksum,
  }
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "coquette-phase-4u-evidence-"))
  try {
    const readyFixture = await makeFixture(root, "ready")
    const ready = await buildDependencyProvisioningEvidencePlan({
      handoffPath: readyFixture.handoffPath,
      decisions: [readyFixture.decision],
      generatedAt: "2026-08-27T10:06:00.000Z",
    })
    assert.equal(ready.isReadyForProvisioning, true)
    assert.equal(ready.isExecutable, false)
    assert.deepEqual(ready.globalBlockers, [])
    assert.equal(ready.entries.length, 3)
    assert.equal(ready.totals.ready, 3)
    assert.equal(ready.totals.blocked, 0)
    assert.equal(
      ready.captureEvidencePackageChecksum,
      readyFixture.evidencePackageChecksum
    )

    const category = ready.entries.find((entry) => entry.entityType === "category")
    const brand = ready.entries.find((entry) => entry.entityType === "brand")
    const media = ready.entries.find((entry) => entry.entityType === "media")
    assert.equal(category?.category?.name, "Dresses")
    assert.deepEqual(category?.category?.productSourceIds, [productUrl])
    assert.equal(brand?.brand?.name, "COQUETTE TEST DESIGNER")
    assert.deepEqual(brand?.brand?.productSourceIds, [productUrl])
    assert.equal(media?.media?.checksum, mediaChecksum)
    assert.equal(media?.media?.bytes, mediaBytes.length)
    assert.equal(media?.media?.contentType, "image/jpeg")
    assert.equal(media?.media?.archivePath, "capture/media/fixture.jpg")
    assert.match(ready.planChecksum, /^[a-f0-9]{64}$/)

    const regenerated = await buildDependencyProvisioningEvidencePlan({
      handoffPath: readyFixture.handoffPath,
      decisions: [readyFixture.decision],
      generatedAt: "2026-08-27T12:00:00.000Z",
    })
    assert.equal(regenerated.planChecksum, ready.planChecksum)
    assert.equal(regenerated.intakeChecksum, ready.intakeChecksum)

    const missingCategoryFixture = await makeFixture(root, "category-name-missing")
    const missingCategory = await buildDependencyProvisioningEvidencePlan({
      handoffPath: missingCategoryFixture.handoffPath,
      decisions: [missingCategoryFixture.decision],
    })
    assert.equal(missingCategory.isReadyForProvisioning, false)
    const blockedCategory = missingCategory.entries.find(
      (entry) => entry.entityType === "category"
    )
    assert.equal(blockedCategory?.state, "blocked")
    assert.ok(blockedCategory?.blockers.includes("category_public_name_missing"))

    const badMediaFixture = await makeFixture(root, "media-checksum-mismatch")
    const badMedia = await buildDependencyProvisioningEvidencePlan({
      handoffPath: badMediaFixture.handoffPath,
      decisions: [badMediaFixture.decision],
    })
    assert.equal(badMedia.isReadyForProvisioning, false)
    const blockedMedia = badMedia.entries.find((entry) => entry.entityType === "media")
    assert.equal(blockedMedia?.state, "blocked")
    assert.ok(blockedMedia?.blockers.includes("captured_media_checksum_mismatch"))

    console.log(
      "COQUETTE Phase 4U dependency provisioning evidence contract passed"
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
