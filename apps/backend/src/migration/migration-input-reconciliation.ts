import { sourceChecksum } from "./checksum"
import { buildInventoryPlan, type InventoryPlan } from "./inventory-plan"
import { buildProductImportPlan, type ProductImportPlan } from "./import-plan"
import { buildPricePlan, type PricePlan } from "./price-plan"
import {
  applyReconstructionReviewDecisions,
  type ReconstructionReviewApplication,
} from "./review-application"
import {
  buildReconstructionReviewPlan,
  type ReconstructionReviewPlan,
  type ReviewDecision,
} from "./review-decisions"
import type { RecoveryProductCandidate } from "./recovery-candidates"
import type { ReconstructionUrlUniverse } from "./url-universe"

export type CaptureIngestionReportForReconciliation = {
  schemaVersion?: number
  generatedAt?: string
  capture?: {
    captureId?: string
    source?: unknown
    startedAt?: string
    completedAt?: string
    declaredComplete?: boolean
    failureReason?: string
    validation?: {
      isValid?: boolean
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  candidates?: {
    records?: RecoveryProductCandidate[]
    [key: string]: unknown
  }
  importPlan?: ProductImportPlan
  urlUniverse?: ReconstructionUrlUniverse
  [key: string]: unknown
}

export type MigrationInputReconciliationChecksums = {
  capture: string
  candidates: string
  sourceProductPlan: string
  decisions: string
  reviewPlan: string
  reviewApplication: string
  productPlan: string
  pricePlan: string
  inventoryPlan: string
  urlUniverse: string
}

export type MigrationInputReconciliation = {
  schemaVersion: 1
  generatedAt: string
  captureId?: string
  checksums: MigrationInputReconciliationChecksums
  reviewPlan: ReconstructionReviewPlan
  reviewApplication: ReconstructionReviewApplication
  productPlan: ProductImportPlan
  pricePlan: PricePlan
  inventoryPlan: InventoryPlan
  urlUniverse: ReconstructionUrlUniverse
  globalBlockers: string[]
  warnings: string[]
  bundleChecksum: string
  isReconciled: boolean
  isReadyForStagingExecution: boolean
  isExecutable: false
}

export type MigrationInputBundleVerification = {
  valid: boolean
  errors: string[]
  recomputedBundleChecksum?: string
}

function stableDecisions(decisions: ReviewDecision[]) {
  return [...decisions].sort((left, right) => {
    const key = left.reviewKey.localeCompare(right.reviewKey)
    if (key !== 0) return key
    const checksum = left.evidenceChecksum.localeCompare(right.evidenceChecksum)
    if (checksum !== 0) return checksum
    return left.action.localeCompare(right.action)
  })
}

function reportCaptureChecksum(report: CaptureIngestionReportForReconciliation) {
  return sourceChecksum({
    capture: report.capture,
    schemaVersion: report.schemaVersion,
  })
}

function bundlePayload(bundle: Omit<MigrationInputReconciliation, "bundleChecksum">) {
  return {
    schemaVersion: bundle.schemaVersion,
    captureId: bundle.captureId,
    checksums: bundle.checksums,
    reviewPlan: bundle.reviewPlan,
    reviewApplication: bundle.reviewApplication,
    productPlan: bundle.productPlan,
    pricePlan: bundle.pricePlan,
    inventoryPlan: bundle.inventoryPlan,
    urlUniverse: bundle.urlUniverse,
    globalBlockers: bundle.globalBlockers,
    warnings: bundle.warnings,
    isReconciled: bundle.isReconciled,
    isReadyForStagingExecution: bundle.isReadyForStagingExecution,
    isExecutable: bundle.isExecutable,
  }
}

function pushUnique(target: string[], value: string) {
  if (!target.includes(value)) target.push(value)
}

function emptyProductPlan(): ProductImportPlan {
  return buildProductImportPlan([])
}

function emptyUrlUniverse(): ReconstructionUrlUniverse {
  return {
    entries: [],
    totals: {
      captured: 0,
      skipped: 0,
      error: 0,
      indexed_only: 0,
      unavailable: 0,
    },
    unresolved: 0,
    isFullyClassified: false,
  }
}

export function buildMigrationInputReconciliation(input: {
  report: CaptureIngestionReportForReconciliation
  decisions?: ReviewDecision[]
  generatedAt?: string
}): MigrationInputReconciliation {
  const decisions = stableDecisions(input.decisions ?? [])
  const globalBlockers: string[] = []
  const warnings: string[] = []
  const report = input.report

  if (report.schemaVersion !== 3) {
    pushUnique(globalBlockers, "capture_ingestion_schema_version_3_required")
  }
  if (!report.capture?.captureId?.trim()) {
    pushUnique(globalBlockers, "capture_id_required")
  }
  if (report.capture?.validation?.isValid !== true) {
    pushUnique(globalBlockers, "capture_artifact_validation_must_pass")
  }
  if (report.capture?.declaredComplete !== true) {
    pushUnique(globalBlockers, "direct_capture_must_be_declared_complete")
  }
  if (report.capture?.failureReason?.trim()) {
    pushUnique(globalBlockers, "capture_failure_reason_present")
  }

  const candidates = report.candidates?.records ?? []
  if (candidates.length === 0) {
    pushUnique(globalBlockers, "recovered_product_candidates_required")
  }

  const rebuiltSourceProductPlan = buildProductImportPlan(candidates)
  const suppliedSourceProductPlan = report.importPlan ?? emptyProductPlan()
  if (!report.importPlan) {
    pushUnique(globalBlockers, "capture_ingestion_product_plan_required")
  } else if (
    sourceChecksum(report.importPlan) !== sourceChecksum(rebuiltSourceProductPlan)
  ) {
    pushUnique(globalBlockers, "capture_product_plan_does_not_match_candidates")
  }

  const sourceProductPlan = report.importPlan ?? rebuiltSourceProductPlan
  const reviewPlan = buildReconstructionReviewPlan({
    candidates,
    productPlan: sourceProductPlan,
    decisions,
  })
  const reviewApplication = applyReconstructionReviewDecisions({
    candidates,
    productPlan: sourceProductPlan,
    decisions,
  })

  if (!reviewPlan.isReconciled || !reviewApplication.isReconciled) {
    pushUnique(globalBlockers, "review_decisions_not_reconciled")
  }
  if (reviewPlan.totals.open > 0) {
    pushUnique(globalBlockers, "review_items_remain_open")
  }
  if (reviewPlan.totals.deferred > 0) {
    pushUnique(globalBlockers, "review_items_remain_deferred")
  }
  if (reviewPlan.totals.invalid > 0) {
    pushUnique(globalBlockers, "review_items_invalid")
  }

  const productPlan = reviewApplication.resultingProductPlan
  if (!productPlan.isExecutable) {
    pushUnique(globalBlockers, "reviewed_product_plan_not_executable")
  }

  const pricePlan = buildPricePlan(productPlan)
  if (!pricePlan.isReconciled) {
    pushUnique(globalBlockers, "price_plan_not_reconciled")
  }
  if (pricePlan.totals.unavailable > 0) {
    warnings.push(
      `${pricePlan.totals.unavailable} product price record(s) are explicitly unavailable from public evidence.`
    )
  }

  const inventoryPlan = buildInventoryPlan(productPlan)
  if (!inventoryPlan.isReconciled) {
    pushUnique(globalBlockers, "inventory_evidence_plan_not_reconciled")
  }
  if (inventoryPlan.totals.unavailable > 0) {
    warnings.push(
      `${inventoryPlan.totals.unavailable} product inventory record(s) are explicitly unavailable from public evidence.`
    )
  }
  if (inventoryPlan.runtimeManifestEntries.length !== 0 || inventoryPlan.isExecutable) {
    pushUnique(globalBlockers, "inventory_plan_must_remain_non_executable")
  }

  const urlUniverse = report.urlUniverse ?? emptyUrlUniverse()
  if (!report.urlUniverse) {
    pushUnique(globalBlockers, "reconstruction_url_universe_required")
  } else if (!urlUniverse.isFullyClassified || urlUniverse.unresolved !== 0) {
    pushUnique(globalBlockers, "reconstruction_url_universe_not_fully_classified")
  }

  const checksums: MigrationInputReconciliationChecksums = {
    capture: reportCaptureChecksum(report),
    candidates: sourceChecksum(candidates),
    sourceProductPlan: sourceChecksum(sourceProductPlan),
    decisions: sourceChecksum(decisions),
    reviewPlan: sourceChecksum(reviewPlan),
    reviewApplication: sourceChecksum(reviewApplication),
    productPlan: sourceChecksum(productPlan),
    pricePlan: sourceChecksum(pricePlan),
    inventoryPlan: sourceChecksum(inventoryPlan),
    urlUniverse: sourceChecksum(urlUniverse),
  }

  const isReconciled = globalBlockers.length === 0
  const isReadyForStagingExecution =
    isReconciled &&
    productPlan.isExecutable &&
    pricePlan.isReconciled &&
    inventoryPlan.isReconciled &&
    urlUniverse.isFullyClassified

  const withoutChecksum: Omit<MigrationInputReconciliation, "bundleChecksum"> = {
    schemaVersion: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    captureId: report.capture?.captureId,
    checksums,
    reviewPlan,
    reviewApplication,
    productPlan,
    pricePlan,
    inventoryPlan,
    urlUniverse,
    globalBlockers: [...globalBlockers].sort(),
    warnings: [...warnings].sort(),
    isReconciled,
    isReadyForStagingExecution,
    isExecutable: false,
  }

  return {
    ...withoutChecksum,
    bundleChecksum: sourceChecksum(bundlePayload(withoutChecksum)),
  }
}

export function verifyMigrationInputReconciliationBundle(
  bundle: MigrationInputReconciliation
): MigrationInputBundleVerification {
  const errors: string[] = []
  if (bundle.schemaVersion !== 1) errors.push("migration_input_bundle_schema_version_1_required")

  const expectedChecksums: MigrationInputReconciliationChecksums = {
    capture: bundle.checksums.capture,
    candidates: sourceChecksum(bundle.reviewApplication.candidates.map((candidate) => {
      const { reviewDecisionAudit, ...sourceCandidate } = candidate
      void reviewDecisionAudit
      return sourceCandidate
    })),
    sourceProductPlan: bundle.checksums.sourceProductPlan,
    decisions: bundle.checksums.decisions,
    reviewPlan: sourceChecksum(bundle.reviewPlan),
    reviewApplication: sourceChecksum(bundle.reviewApplication),
    productPlan: sourceChecksum(bundle.productPlan),
    pricePlan: sourceChecksum(bundle.pricePlan),
    inventoryPlan: sourceChecksum(bundle.inventoryPlan),
    urlUniverse: sourceChecksum(bundle.urlUniverse),
  }

  for (const key of [
    "reviewPlan",
    "reviewApplication",
    "productPlan",
    "pricePlan",
    "inventoryPlan",
    "urlUniverse",
  ] as const) {
    if (bundle.checksums[key] !== expectedChecksums[key]) {
      errors.push(`${key}_checksum_mismatch`)
    }
  }

  if (bundle.globalBlockers.length > 0) errors.push("migration_input_bundle_has_blockers")
  if (!bundle.isReconciled) errors.push("migration_input_bundle_not_reconciled")
  if (!bundle.isReadyForStagingExecution) errors.push("migration_input_bundle_not_ready")
  if (bundle.isExecutable !== false) errors.push("migration_input_bundle_must_be_non_writing")
  if (!bundle.productPlan.isExecutable) errors.push("product_plan_not_executable")
  if (!bundle.pricePlan.isReconciled) errors.push("price_plan_not_reconciled")
  if (!bundle.inventoryPlan.isReconciled) errors.push("inventory_plan_not_reconciled")
  if (bundle.inventoryPlan.isExecutable) errors.push("inventory_plan_must_be_non_executable")
  if (bundle.inventoryPlan.runtimeManifestEntries.length !== 0) {
    errors.push("inventory_runtime_manifest_must_be_empty")
  }
  if (!bundle.urlUniverse.isFullyClassified || bundle.urlUniverse.unresolved !== 0) {
    errors.push("url_universe_not_fully_classified")
  }
  if (bundle.reviewPlan.totals.open > 0) errors.push("review_items_remain_open")
  if (bundle.reviewPlan.totals.deferred > 0) errors.push("review_items_remain_deferred")
  if (bundle.reviewPlan.totals.invalid > 0) errors.push("review_items_invalid")

  const { bundleChecksum: _bundleChecksum, ...withoutChecksum } = bundle
  void _bundleChecksum
  const recomputedBundleChecksum = sourceChecksum(bundlePayload(withoutChecksum))
  if (bundle.bundleChecksum !== recomputedBundleChecksum) {
    errors.push("migration_input_bundle_checksum_mismatch")
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)].sort(),
    recomputedBundleChecksum,
  }
}

export function assertMigrationInputReconciliationReady(
  bundle: MigrationInputReconciliation
) {
  const verification = verifyMigrationInputReconciliationBundle(bundle)
  if (!verification.valid) {
    throw new Error(
      `Migration input reconciliation bundle is not ready: ${verification.errors.join(", ")}`
    )
  }
  return bundle
}
