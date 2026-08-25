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

export type NormalizedMagentoProduct = {
  sourceId: string
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
  rawUpdatedAt?: string
}

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
