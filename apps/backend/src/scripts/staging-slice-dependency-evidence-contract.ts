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
    await mkdir(mediaDir, { recursive: true })
    const mediaBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
      0x01, 0xff, 0xd9,
    ])
    const evidenceMediaFile = "media/product.jpg"
    const windowsMediaFile = "media\\product.jpg"
    await writeFile(join(root, evidenceMediaFile), mediaBytes)

    const sourceUrl = "https://coquetteconcept.gr/default/test-product.html"
    const aliasUrl =
      "https://coquetteconcept.gr/default/catalog/product/view/id/1234/"
    const categoryUrl = "https://coquetteconcept.gr/default/clothing.html"
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
          [sourceUrl]: { categoryReferences: [] },
          [aliasUrl]: {
            categoryReferences: [{ name: "Clothing", url: categoryUrl }],
          },
        },
      },
    }

    const mediaRecord: StagingSliceMediaRecord = {
      sourceUrl: mediaUrl,
      status: "captured",
      // The Windows operator capture can legitimately have no HTTP content-type.
      // The dependency gate must prove the image from the captured bytes instead.
      bytes: mediaBytes.length,
      checksum: sha256(mediaBytes),
      mediaFile: windowsMediaFile,
    }
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
      files: [
        {
          path: evidenceMediaFile,
          bytes: mediaBytes.length,
          checksum: sha256(mediaBytes),
        },
      ],
      totals: { files: 1, bytes: mediaBytes.length },
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

    const ready = await buildStagingSliceDependencyEvidencePlan({
      captureDir: root,
      report,
      policyBundle,
      evidencePackage,
      mediaRecords: [mediaRecord],
      products: [{ sourceUrl }],
      expectedEvidencePackageChecksum: evidencePackage.packageChecksum,
    })
    assert.equal(ready.isReadyForProvisioning, true)
    assert.deepEqual(ready.totals, { ready: 2, blocked: 0 })
    assert.equal(
      ready.entries.find((entry) => entry.entityType === "category")?.category
        ?.name,
      "Clothing"
    )
    const readyMedia = ready.entries.find((entry) => entry.entityType === "media")
      ?.media
    assert.equal(readyMedia?.checksum, sha256(mediaBytes))
    assert.equal(readyMedia?.contentType, "image/jpeg")
    assert.equal(readyMedia?.mediaFile, evidenceMediaFile)

    const semanticTamper: CaptureEvidencePackage = {
      ...evidencePackage,
      totals: { ...evidencePackage.totals, bytes: evidencePackage.totals.bytes + 1 },
    }
    const semanticTamperPlan = await buildStagingSliceDependencyEvidencePlan({
      captureDir: root,
      report,
      policyBundle,
      evidencePackage: semanticTamper,
      mediaRecords: [mediaRecord],
      products: [{ sourceUrl }],
      expectedEvidencePackageChecksum: evidencePackage.packageChecksum,
    })
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
    const changedPolicyPlan = await buildStagingSliceDependencyEvidencePlan({
      captureDir: root,
      report,
      policyBundle: changedPolicyBundle,
      evidencePackage,
      mediaRecords: [mediaRecord],
      products: [{ sourceUrl }],
      expectedEvidencePackageChecksum: evidencePackage.packageChecksum,
    })
    assert.equal(changedPolicyPlan.isReadyForProvisioning, false)
    assert.ok(
      changedPolicyPlan.globalBlockers.includes(
        "staging_target_policy_application_source_mismatch"
      )
    )

    await writeFile(join(root, evidenceMediaFile), Buffer.from("tampered"))
    const tampered = await buildStagingSliceDependencyEvidencePlan({
      captureDir: root,
      report,
      policyBundle,
      evidencePackage,
      mediaRecords: [mediaRecord],
      products: [{ sourceUrl }],
      expectedEvidencePackageChecksum: evidencePackage.packageChecksum,
    })
    assert.equal(tampered.isReadyForProvisioning, false)
    assert.ok(
      tampered.entries
        .find((entry) => entry.entityType === "media")
        ?.blockers.includes("captured_media_actual_checksum_mismatch")
    )

    console.log(
      "COQUETTE staging slice dependency evidence contract passed: retained alias category evidence, Windows media paths and byte-derived image MIME are accepted only when checksum-bound; semantic/tamper changes fail closed"
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
