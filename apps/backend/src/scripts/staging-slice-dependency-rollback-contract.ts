import assert from "node:assert/strict"
import { sourceChecksum } from "../migration/checksum"
import type { StagingSliceDependencyEvidencePlan } from "../migration/staging-slice-dependency-evidence"
import {
  buildStagingSliceDependencyRollbackPlan,
} from "../migration/staging-slice-dependency-rollback"
import type { StagingSliceDependencyProvisioningManifestEntry } from "../migration/staging-slice-dependency-provisioning"

const categorySourceId = "https://coquetteconcept.gr/default/dresses.html"
const mediaSourceId = "https://coquetteconcept.gr/media/catalog/product/test.jpg"
const categoryEvidenceChecksum = sourceChecksum({ categorySourceId, name: "Dresses" })
const mediaEvidenceChecksum = sourceChecksum({ mediaSourceId, checksum: "a".repeat(64) })

const evidencePayload = {
  schemaVersion: 1 as const,
  captureId: "capture-rollback-contract",
  captureEvidencePackageChecksum: "b".repeat(64),
  sourceIngestionReportChecksum: "c".repeat(64),
  stagingTargetPolicyBundleChecksum: "d".repeat(64),
  requirementsChecksum: "e".repeat(64),
  entries: [
    {
      entityType: "category" as const,
      sourceId: categorySourceId,
      candidateKeys: ["direct:sku:TEST-1"],
      requirementChecksum: sourceChecksum({ entityType: "category", sourceId: categorySourceId }),
      state: "ready" as const,
      blockers: [],
      evidenceChecksum: categoryEvidenceChecksum,
      category: {
        name: "Dresses",
        productSourceIds: ["https://coquetteconcept.gr/default/test.html"],
        categoryPageSourceIds: [categorySourceId],
      },
    },
    {
      entityType: "media" as const,
      sourceId: mediaSourceId,
      candidateKeys: ["direct:sku:TEST-1"],
      requirementChecksum: sourceChecksum({ entityType: "media", sourceId: mediaSourceId }),
      state: "ready" as const,
      blockers: [],
      evidenceChecksum: mediaEvidenceChecksum,
      media: {
        mediaFile: "media/test.jpg",
        contentType: "image/jpeg",
        bytes: 123,
        checksum: "a".repeat(64),
      },
    },
  ],
  totals: { ready: 2, blocked: 0 },
  globalBlockers: [],
  isReadyForProvisioning: true,
  isExecutable: false as const,
}
const evidencePlan: StagingSliceDependencyEvidencePlan = {
  ...evidencePayload,
  planChecksum: sourceChecksum(evidencePayload),
}

const now = "2026-08-29T14:00:00.000Z"
const manifest: StagingSliceDependencyProvisioningManifestEntry[] = [
  {
    entityType: "category",
    sourceId: categorySourceId,
    evidenceChecksum: categoryEvidenceChecksum,
    status: "imported",
    targetId: "pcat_test",
    attempts: 1,
    firstImportedAt: now,
    lastAttemptAt: now,
  },
  {
    entityType: "media",
    sourceId: mediaSourceId,
    evidenceChecksum: mediaEvidenceChecksum,
    status: "error",
    targetId: "file_test",
    targetUrl: "https://coquette-media.example/phase4-test.jpg",
    attempts: 1,
    lastAttemptAt: now,
    error: "fixture failure after upload",
  },
]

const ready = buildStagingSliceDependencyRollbackPlan({
  evidencePlan,
  expectedEvidencePlanChecksum: evidencePlan.planChecksum,
  manifestEntries: manifest,
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(ready.isExecutable, true)
assert.deepEqual(ready.totals, { delete: 2, skip: 0, blocked: 0 })
assert.equal(ready.entries.find((entry) => entry.entityType === "media")?.targetId, "file_test")

const missingManifest = buildStagingSliceDependencyRollbackPlan({
  evidencePlan,
  expectedEvidencePlanChecksum: evidencePlan.planChecksum,
  manifestEntries: [],
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(missingManifest.isExecutable, true)
assert.deepEqual(missingManifest.totals, { delete: 0, skip: 2, blocked: 0 })

const changed = buildStagingSliceDependencyRollbackPlan({
  evidencePlan,
  expectedEvidencePlanChecksum: evidencePlan.planChecksum,
  manifestEntries: [{ ...manifest[0], evidenceChecksum: "f".repeat(64) }],
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(changed.isExecutable, false)
assert.equal(changed.totals.blocked, 1)
assert.ok(
  changed.entries[0].blockers.includes("dependency_evidence_changed_requires_reconciliation")
)

const unknown = buildStagingSliceDependencyRollbackPlan({
  evidencePlan,
  expectedEvidencePlanChecksum: evidencePlan.planChecksum,
  manifestEntries: [
    ...manifest,
    {
      ...manifest[0],
      sourceId: "https://coquetteconcept.gr/default/not-in-evidence.html",
      targetId: "pcat_unknown",
    },
  ],
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(unknown.isExecutable, false)
assert.ok(unknown.globalBlockers.includes("manifest_contains_unknown_dependency_keys"))

const legacyHost = buildStagingSliceDependencyRollbackPlan({
  evidencePlan,
  expectedEvidencePlanChecksum: evidencePlan.planChecksum,
  manifestEntries: manifest,
  allowedMediaHosts: ["coquetteconcept.gr"],
})
assert.equal(legacyHost.isExecutable, false)
assert.ok(legacyHost.globalBlockers.includes("legacy_host_cannot_be_serving_media_host"))

console.log(
  "COQUETTE staging dependency rollback contract passed: checksum-bound delete/skip planning, interrupted-media target cleanup, changed-evidence blocking, unknown-manifest rejection and legacy-host rejection"
)
