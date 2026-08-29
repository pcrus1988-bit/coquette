export const migrationEntityTypes = [
  "category",
  "brand",
  "product",
  "variant",
  "price",
  "inventory",
  "media",
  "content_page",
  "customer",
  "address",
  "order",
  "promotion",
  "url_rewrite",
] as const

export type MigrationEntityType = (typeof migrationEntityTypes)[number]

export const migrationStatuses = [
  "pending",
  "imported",
  "skipped",
  "error",
] as const

export type MigrationStatus = (typeof migrationStatuses)[number]

export const reconstructionEvidenceGrades = [
  "direct",
  "derived",
  "inferred",
  "unavailable",
] as const

export type ReconstructionEvidenceGrade =
  (typeof reconstructionEvidenceGrades)[number]

export type ReconstructionEvidence = {
  sourceUrl: string
  capturedAt: string
  grade: ReconstructionEvidenceGrade
  note?: string
}

export type MigrationSourceKey = {
  entityType: MigrationEntityType
  sourceId: string
  locale?: "el" | "en"
}

export type MigrationManifestEntry = MigrationSourceKey & {
  sourceChecksum: string
  targetId?: string
  status: MigrationStatus
  warnings: string[]
  errors: string[]
  attempts: number
  sourceUpdatedAt?: string
  firstImportedAt?: string
  lastAttemptAt?: string
}

export type RecoveredConfigurableVariant = {
  /** Magento child product ID observed in the configurable product jsonConfig. */
  sourceProductId: string
  /** Exact option-label combination observed for this child product ID. */
  optionValues: Record<string, string>
  /** Child SKU remains absent until independently observed; it is never derived from the parent. */
  sku?: string
  regularPrice?: number
  salePrice?: number
}

export type NormalizedStorefrontProduct = {
  sourceId: string
  canonicalUrl?: string
  alternateLocaleUrl?: string
  sku: string
  name: string
  status: "enabled" | "disabled"
  visibility: "catalog_search" | "catalog" | "search" | "not_visible"
  type: "simple" | "configurable" | "virtual" | "unknown"
  urlKey?: string
  description?: string
  shortDescription?: string
  brandSourceId?: string
  categorySourceIds: string[]
  optionValues: Record<string, string>
  mediaSourceIds: string[]
  /**
   * Direct Magento configurable-parent evidence. This is preserved for
   * reconciliation even while child SKU identity is still unavailable.
   */
  configurableVariants?: RecoveredConfigurableVariant[]
  configurableVariantMatrixComplete?: boolean
  stockState?: "in_stock" | "out_of_stock" | "unknown"
  lowStockMessage?: string
  regularPrice?: number
  salePrice?: number
  currencyCode?: "EUR"
  evidence: ReconstructionEvidence[]
  capturedAt?: string
}

/**
 * Compatibility alias retained while Phase 4 code is being migrated from the
 * original database-export assumption to public storefront reconstruction.
 */
export type NormalizedMagentoProduct = NormalizedStorefrontProduct

export type ReconciliationInput = {
  entityType: MigrationEntityType
  expectedSourceCount: number
  manifestEntries: MigrationManifestEntry[]
}

export type ReconciliationResult = {
  entityType: MigrationEntityType
  expectedSourceCount: number
  manifestCount: number
  imported: number
  skipped: number
  errors: number
  pending: number
  duplicateSourceKeys: string[]
  unexplainedVariance: number
  isReconciled: boolean
}
