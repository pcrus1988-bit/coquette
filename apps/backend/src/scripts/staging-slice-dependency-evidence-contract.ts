import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { CaptureEvidencePackage } from "../migration/capture-evidence-package"
import { sourceChecksum } from "../migration/checksum"
import { buildRecoveryProductCandidate } from "../migration/recovery-candidates"
import {
  buildStagingSliceDependencyEvidencePlan,
  type StagingSliceMediaRecord,
  type StagingSlicePageRecord,
  type StagingSliceSourceIngestionReport,
  type StagingTargetPolicyBundle,
} from "../migration/staging-slice-dependency-evidence"
import {
  buildStagingTargetPolicyApplication,
  stagingTargetPolicyBundleChecksum,
} from "../migration/staging-target-policy"

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function evidenceChecksum(value: Omit<CaptureEvidencePackage, "packageChecksum">) {
  return sourceChecksum({
    schemaVersion: value.schemaVersion,
    captureId: value.captureId,
    source: value.source,
    provenance: value.provenance,
    files: value.files,
    totals: value.totals,
  })
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "coquette-staging-slice-deps-"))
  try {
    const mediaDir = join(root, "media")
    const pagesDir = join(root, "pages")
    await mkdir(mediaDir, { recursive: true })
    await mkdir(pagesDir, { recursive: true })

    const mediaBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
      0x01, 0xff, 0xd9,
    ])
    const evidenceMediaFile = "media/product.jpg"
    const windowsMediaFile = "media\\product.jpg"
    await writeFile(join(root, evidenceMediaFile), mediaBytes)

    const categoryHtml = Buffer.from(`<!doctype html>
<html><body>
<div class="breadcrumbs"><ul class="items">
<li class="item home"><a href="/default/">Αρχική</a></li>
<li class="item category"><strong>Μπλούζες</strong></li>
</ul></div>
</body></html>`)
    const evidenceCategoryFile = "pages/category.html"
    const windowsCategoryFile = "pages\\category.html"
    await writeFile(join(root, evidenceCategoryFile), categoryHtml)

    const sourceUrl = "https://coquetteconcept.gr/default/test-product.html"
    const aliasUrl =
      "https://coquetteconcept.gr/default/catalog/product/view/id/1234/"
    const categoryUrl =
      "https://coquetteconcept.gr/default/clothing/clothing-categories/tops.html"
    const mediaUrl =
      "https://coquetteconcept.gr/media/catalog/product/test-product.jpg"
    const capturedAt = "2026-08-29T10:00:00.000Z"
    const candidate = buildRecoveryProductCandidate("direct:sku:TEST-1", [
      {
        authority: "direct_storefront",
        sourceUrl,
        observedAt: capturedAt,
        fields: {
          sourceId: sourceUrl,
          sku: "TEST-1",
          name: "Test Product",
          type: "simple",
          categorySourceIds: [categoryUrl],
          mediaSourceIds: [mediaUrl],
          regularPrice: 80,
          salePrice: 16,
          currencyCode: "EUR",
        },
      },
      {
        authority: "direct_storefront",
        sourceUrl: aliasUrl,
        observedAt: capturedAt,
        note: "Retained exact Magento alias evidence.",
        fields: {},
      },
    ])
    const application = buildStagingTargetPolicyApplication([candidate])
    assert.equal(application.isExecutable, true)
    assert.equal(application.eligibleCandidateCount, 1)

    const report: StagingSliceSourceIngestionReport = {
      schemaVersion: 3,
      capture: {
        captureId: "capture-contract",
        evidencePackage: {
          isValid: true,
          packageChecksum: "pending",
          provenanceMode: "operator_local_browser",
          transport: "browser",
          browserMode: "headed",
        },
      },
      candidates: { records: [candidate] },
      productStructure: {
        records: {
          [sourceUrl]: {
            // Listing-derived category relationships are intentionally URL-only.
            categoryReferences: [{ url: categoryUrl }],
          },
          [aliasUrl]: { categoryReferences: [{ url: categoryUrl }] },
        },
      },
    }

    const mediaRecord: StagingSliceMediaRecord = {
      sourceUrl: mediaUrl,
      status: "captured",
      // Interrupted/resumed Windows media downloads can legitimately retain no
      // HTTP content-type. The dependency gate must prove the image from bytes.
      bytes: mediaBytes.length,
      checksum: sha256(mediaBytes),
      mediaFile: windowsMediaFile,
    }
    const pageRecord: StagingSlicePageRecord = {
      sourceUrl: categoryUrl,
      finalUrl: categoryUrl,
      canonicalUrl: categoryUrl,
      status: "captured",
      pageType: "category",
      pageFile: windowsCategoryFile,
    }

    const files = [
      {
        path: evidenceMediaFile,
        bytes: mediaBytes.length,
        checksum: sha256(mediaBytes),
      },
      {
        path: evidenceCategoryFile,
        bytes: categoryHtml.length,
        checksum: sha256(categoryHtml),
      },
    ].sort((left, right) => left.path.localeCompare(right.path))
    const withoutEvidenceChecksum: Omit<
      CaptureEvidencePackage,
      "packageChecksum"
    > = {
      schemaVersion: 1,
      captureId: "capture-contract",
      source: "https://coquetteconcept.gr/",
      packagedAt: capturedAt,
      provenance: {
        mode: "operator_local_browser",
        transport: "browser",
        browserMode: "headed",
      },
      files,
      totals: {
        files: files.length,
        bytes: files.reduce((sum, entry) => sum + entry.bytes, 0),
      },
    }
    const evidencePackage: CaptureEvidencePackage = {
      ...withoutEvidenceChecksum,
      packageChecksum: evidenceChecksum(withoutEvidenceChecksum),
    }
    report.capture!.evidencePackage!.packageChecksum = evidencePackage.packageChecksum

    const policyPayload = {
      schemaVersion: 1 as const,
      generatedAt: capturedAt,
      captureId: "capture-contract",
      evidencePackageChecksum: evidencePackage.packageChecksum,
      sourceIngestionReportChecksum: sourceChecksum(report),
      application,
    }
    const policyBundle: StagingTargetPolicyBundle = {
      ...policyPayload,
      bundleChecksum: stagingTargetPolicyBundleChecksum(policyPayload),
    }

    const build = (input?: {
      evidencePackage?: CaptureEvidencePackage
      policyBundle?: StagingTargetPolicyBundle
    }) =>
      buildStagingSliceDependencyEvidencePlan({
        captureDir: root,
        report,
        policyBundle: input?.policyBundle ?? policyBundle,
        evidencePackage: input?.evidencePackage ?? evidencePackage,
        mediaRecords: [mediaRecord],
        products: [{ sourceUrl }],
        pages: [pageRecord],
        expectedEvidencePackageChecksum: evidencePackage.packageChecksum,
      })

    const ready = await build()
    assert.equal(ready.isReadyForProvisioning, true)
    assert.deepEqual(ready.totals, { ready: 2, blocked: 0 })
    const readyCategory = ready.entries.find(
      (entry) => entry.entityType === "category"
    )?.category
    assert.equal(readyCategory?.name, "Μπλούζες")
    assert.deepEqual(readyCategory?.categoryPageSourceIds, [categoryUrl])
    const readyMedia = ready.entries.find((entry) => entry.entityType === "media")
      ?.media
    assert.equal(readyMedia?.checksum, sha256(mediaBytes))
    assert.equal(readyMedia?.contentType, "image/jpeg")
    assert.equal(readyMedia?.mediaFile, evidenceMediaFile)

    const semanticTamper: CaptureEvidencePackage = {
      ...evidencePackage,
      totals: { ...evidencePackage.totals, bytes: evidencePackage.totals.bytes + 1 },
    }
    const semanticTamperPlan = await build({ evidencePackage: semanticTamper })
    assert.equal(semanticTamperPlan.isReadyForProvisioning, false)
    assert.ok(
      semanticTamperPlan.globalBlockers.includes(
        "capture_evidence_package_semantic_checksum_mismatch"
      )
    )

    const changedApplication = {
      ...application,
      quarantinedCandidateCount: application.quarantinedCandidateCount + 1,
    }
    const changedPolicyPayload = {
      ...policyPayload,
      application: changedApplication,
    }
    const changedPolicyBundle: StagingTargetPolicyBundle = {
      ...changedPolicyPayload,
      bundleChecksum: stagingTargetPolicyBundleChecksum(changedPolicyPayload),
    }
    const changedPolicyPlan = await build({ policyBundle: changedPolicyBundle })
    assert.equal(changedPolicyPlan.isReadyForProvisioning, false)
    assert.ok(
      changedPolicyPlan.globalBlockers.includes(
        "staging_target_policy_application_source_mismatch"
      )
    )

    await writeFile(join(root, evidenceMediaFile), Buffer.from("tampered"))
    const tamperedMedia = await build()
    assert.equal(tamperedMedia.isReadyForProvisioning, false)
    assert.ok(
      tamperedMedia.entries
        .find((entry) => entry.entityType === "media")
        ?.blockers.includes("captured_media_actual_checksum_mismatch")
    )
    await writeFile(join(root, evidenceMediaFile), mediaBytes)

    await writeFile(join(root, evidenceCategoryFile), Buffer.from("tampered"))
    const tamperedCategory = await build()
    assert.equal(tamperedCategory.isReadyForProvisioning, false)
    assert.ok(
      tamperedCategory.entries
        .find((entry) => entry.entityType === "category")
        ?.blockers.includes("category_page_evidence_package_checksum_mismatch")
    )

    console.log(
      "COQUETTE staging slice dependency evidence contract passed: URL-only categories resolve from checksum-bound captured category pages, Windows media paths and byte-derived MIME are accepted only with exact evidence; semantic/category/media tampering fails closed"
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
