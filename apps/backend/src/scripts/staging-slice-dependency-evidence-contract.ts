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
    const mediaBytes = Buffer.from("authoritative-product-image")
    const mediaFile = "media/product.jpg"
    await writeFile(join(root, mediaFile), mediaBytes)

    const sourceUrl = "https://coquetteconcept.gr/default/test-product.html"
    const categoryUrl = "https://coquetteconcept.gr/default/clothing.html"
    const mediaUrl = "https://coquetteconcept.gr/media/catalog/product/test-product.jpg"
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
            categoryReferences: [{ name: "Clothing", url: categoryUrl }],
          },
        },
      },
    }

    const mediaRecord: StagingSliceMediaRecord = {
      sourceUrl: mediaUrl,
      status: "captured",
      contentType: "image/jpeg",
      bytes: mediaBytes.length,
      checksum: sha256(mediaBytes),
      mediaFile,
    }
    const withoutEvidenceChecksum: Omit<CaptureEvidencePackage, "packageChecksum"> = {
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
          path: mediaFile,
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
      ready.entries.filter((entry) => entry.entityType === "category")[0].category
        ?.name,
      "Clothing"
    )
    assert.equal(
      ready.entries.filter((entry) => entry.entityType === "media")[0].media
        ?.checksum,
      sha256(mediaBytes)
    )

    await writeFile(join(root, mediaFile), Buffer.from("tampered"))
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
      "COQUETTE staging slice dependency evidence contract passed: ready category/media evidence is checksum-bound and tampered media fails closed"
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
