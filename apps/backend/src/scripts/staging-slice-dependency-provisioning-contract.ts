import assert from "node:assert/strict"
import { sourceChecksum } from "../migration/checksum"
import type { StagingSliceDependencyEvidencePlan } from "../migration/staging-slice-dependency-evidence"
import {
  buildProvisionedDependencyMappingBundle,
  buildStagingSliceDependencyProvisioningPlan,
  deterministicMigrationCategoryHandle,
  deterministicMigrationMediaFilename,
  type StagingSliceDependencyProvisioningManifestEntry,
} from "../migration/staging-slice-dependency-provisioning"

const categorySourceId = "https://coquetteconcept.gr/default/dresses.html"
const categoryPageSourceId = categorySourceId
const mediaSourceId = "https://coquetteconcept.gr/media/catalog/product/test.jpg"
const categoryEvidenceChecksum = sourceChecksum({ categorySourceId, name: "Dresses" })
const mediaEvidenceChecksum = sourceChecksum({ mediaSourceId, checksum: "a".repeat(64) })

const evidencePayload = {
  schemaVersion: 1 as const,
  captureId: "capture-provisioning-contract",
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
        categoryPageSourceIds: [categoryPageSourceId],
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
        mediaFile: "media\\test.jpg",
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

const first = buildStagingSliceDependencyProvisioningPlan({
  evidencePlan,
  expectedEvidencePlanChecksum: evidencePlan.planChecksum,
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(first.isExecutable, true)
assert.deepEqual(first.totals, { create: 2, skip: 0, blocked: 0 })
assert.match(
  deterministicMigrationCategoryHandle("Dresses", categorySourceId),
  /^legacy-dresses-[a-f0-9]{10}$/
)
assert.match(
  deterministicMigrationMediaFilename("media\\test.jpg", "a".repeat(64)),
  /^phase4-a{20}-test\.jpg$/
)

const now = "2026-08-29T13:30:00.000Z"
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
    status: "imported",
    targetUrl: "https://coquette-media.example/phase4-test.jpg",
    attempts: 1,
    firstImportedAt: now,
    lastAttemptAt: now,
  },
]
const second = buildStagingSliceDependencyProvisioningPlan({
  evidencePlan,
  expectedEvidencePlanChecksum: evidencePlan.planChecksum,
  previousManifestEntries: manifest,
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(second.isExecutable, true)
assert.deepEqual(second.totals, { create: 0, skip: 2, blocked: 0 })

const mappingBundle = buildProvisionedDependencyMappingBundle({
  evidencePlan,
  provisioningPlan: second,
  manifestEntries: manifest,
})
assert.equal(mappingBundle.mappings.length, 2)
assert.equal(
  mappingBundle.mappings.find((entry) => entry.entityType === "category")?.targetId,
  "pcat_test"
)
assert.equal(
  mappingBundle.mappings.find((entry) => entry.entityType === "media")?.targetUrl,
  "https://coquette-media.example/phase4-test.jpg"
)

const changedEvidencePlan: StagingSliceDependencyEvidencePlan = {
  ...evidencePlan,
  entries: evidencePlan.entries.map((entry) =>
    entry.entityType === "media"
      ? { ...entry, evidenceChecksum: sourceChecksum("changed-media") }
      : entry
  ),
  planChecksum: "",
}
changedEvidencePlan.planChecksum = sourceChecksum(
  (({ planChecksum: _ignored, ...payload }) => payload)(changedEvidencePlan)
)
const changed = buildStagingSliceDependencyProvisioningPlan({
  evidencePlan: changedEvidencePlan,
  expectedEvidencePlanChecksum: changedEvidencePlan.planChecksum,
  previousManifestEntries: manifest,
  allowedMediaHosts: ["coquette-media.example"],
})
assert.equal(changed.isExecutable, false)
assert.equal(changed.totals.blocked, 1)
assert.ok(
  changed.entries
    .find((entry) => entry.entityType === "media")
    ?.blockers.includes("dependency_evidence_changed_requires_reconciliation")
)

const legacyHost = buildStagingSliceDependencyProvisioningPlan({
  evidencePlan,
  expectedEvidencePlanChecksum: evidencePlan.planChecksum,
  allowedMediaHosts: ["coquetteconcept.gr"],
})
assert.equal(legacyHost.isExecutable, false)
assert.ok(legacyHost.globalBlockers.includes("legacy_host_cannot_be_serving_media_host"))

console.log(
  "COQUETTE staging dependency provisioning contract passed: checksum-pinned create/skip idempotency, mapping output, evidence-change blocking and legacy-media-host rejection"
)
