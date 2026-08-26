import { sourceChecksum } from "./checksum"
import { manifestKey } from "./manifest"
import type {
  ProductImportPlan,
  ProductImportPlanEntry,
} from "./import-plan"
import type {
  MigrationManifestEntry,
  MigrationSourceKey,
  NormalizedStorefrontProduct,
} from "./types"

export const stagingProductExecutionActions = ["create", "skip", "blocked"] as const
export type StagingProductExecutionAction =
  (typeof stagingProductExecutionActions)[number]

export type MigrationDependencyEntityType = "category" | "media" | "brand"

export type MigrationDependencyMapping = {
  entityType: MigrationDependencyEntityType
  sourceId: string
  status: "imported" | "unavailable" | "error"
  targetId?: string
  targetUrl?: string
  note?: string
}

export type StagingProductExecutionEntry = {
  candidateKey: string
  action: StagingProductExecutionAction
  sourceKey?: MigrationSourceKey
  sourceChecksum?: string
  executionChecksum: string
  normalizedProduct?: NormalizedStorefrontProduct
  categoryTargetIds: string[]
  mediaTargetUrls: string[]
  brandTargetId?: string
  existingTargetId?: string
  previousManifestEntry?: MigrationManifestEntry
  blockers: string[]
}

export type StagingProductExecutionPlan = {
  schemaVersion: 1
  sourceProductPlanSchemaVersion: number
  entries: StagingProductExecutionEntry[]
  totals: Record<StagingProductExecutionAction, number>
  duplicateDependencyKeys: string[]
  globalBlockers: string[]
  isExecutable: boolean
}

export type BuildStagingProductExecutionPlanInput = {
  importPlan: ProductImportPlan
  dependencyMappings: MigrationDependencyMapping[]
  previousProductManifestEntries?: MigrationManifestEntry[]
  allowedMediaHosts: string[]
}

export type PreparedMedusaSimpleProductInput = {
  title: string
  description?: string
  status: "published" | "draft"
  shipping_profile_id: string
  sales_channels: Array<{ id: string }>
  categories: Array<{ id: string }>
  images: Array<{ url: string }>
  options: Array<{ title: string; values: string[] }>
  variants: Array<{
    title: string
    sku: string
    options: Record<string, string>
    manage_inventory: true
    allow_backorder: false
  }>
  metadata: Record<string, string>
}

function dependencyKey(entityType: MigrationDependencyEntityType, sourceId: string) {
  return `${entityType}:${encodeURIComponent(sourceId)}`
}

function duplicateValues(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort()
}

function safeHttpsUrlOnAllowedHost(value: string | undefined, allowedHosts: Set<string>) {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return undefined
    if (!allowedHosts.has(url.hostname.toLowerCase())) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

function mappingIndex(mappings: MigrationDependencyMapping[]) {
  return new Map(
    mappings.map((mapping) => [
      dependencyKey(mapping.entityType, mapping.sourceId),
      mapping,
    ])
  )
}

function previousProductManifestIndex(entries: MigrationManifestEntry[]) {
  const relevant = entries.filter((entry) => entry.entityType === "product")
  const byKey = new Map<string, MigrationManifestEntry[]>()
  for (const entry of relevant) {
    const key = manifestKey(entry)
    const existing = byKey.get(key) ?? []
    existing.push(entry)
    byKey.set(key, existing)
  }
  return byKey
}

function requiredRuntimeManifestEntry(
  importPlan: ProductImportPlan,
  entry: ProductImportPlanEntry
) {
  if (!entry.sourceKey || !entry.sourceChecksum) return undefined
  return importPlan.runtimeManifestEntries.find(
    (manifestEntry) =>
      manifestKey(manifestEntry) === manifestKey(entry.sourceKey!) &&
      manifestEntry.sourceChecksum === entry.sourceChecksum &&
      manifestEntry.status === "pending"
  )
}

function buildEntry(
  importPlan: ProductImportPlan,
  entry: ProductImportPlanEntry,
  dependencies: Map<string, MigrationDependencyMapping>,
  previousProducts: Map<string, MigrationManifestEntry[]>,
  allowedMediaHosts: Set<string>,
  globalBlockers: string[]
): StagingProductExecutionEntry {
  const blockers = [...globalBlockers]
  const product = entry.normalizedProduct
  const categoryTargetIds: string[] = []
  const mediaTargetUrls: string[] = []
  let brandTargetId: string | undefined
  let existingTargetId: string | undefined
  let previousManifestEntry: MigrationManifestEntry | undefined

  if (entry.state !== "ready") blockers.push("product_import_plan_entry_not_ready")
  if (!entry.sourceKey) blockers.push("product_source_key_missing")
  if (!entry.sourceChecksum) blockers.push("product_source_checksum_missing")
  if (!product) blockers.push("normalized_product_missing")
  if (!requiredRuntimeManifestEntry(importPlan, entry)) {
    blockers.push("matching_pending_runtime_manifest_entry_missing")
  }

  if (product?.type !== "simple") {
    blockers.push("staging_executor_supports_simple_products_only")
  }

  for (const categorySourceId of product?.categorySourceIds ?? []) {
    const mapping = dependencies.get(dependencyKey("category", categorySourceId))
    if (mapping?.status !== "imported" || !mapping.targetId?.trim()) {
      blockers.push(`category_mapping_missing:${categorySourceId}`)
      continue
    }
    categoryTargetIds.push(mapping.targetId.trim())
  }

  for (const mediaSourceId of product?.mediaSourceIds ?? []) {
    const mapping = dependencies.get(dependencyKey("media", mediaSourceId))
    if (mapping?.status !== "imported") {
      blockers.push(`media_mapping_missing:${mediaSourceId}`)
      continue
    }
    const targetUrl = safeHttpsUrlOnAllowedHost(mapping.targetUrl, allowedMediaHosts)
    if (!targetUrl) {
      blockers.push(`media_target_url_not_allowed:${mediaSourceId}`)
      continue
    }
    mediaTargetUrls.push(targetUrl)
  }

  if (product?.brandSourceId) {
    const mapping = dependencies.get(
      dependencyKey("brand", product.brandSourceId)
    )
    if (mapping?.status !== "imported" || !mapping.targetId?.trim()) {
      blockers.push(`brand_mapping_missing:${product.brandSourceId}`)
    } else {
      brandTargetId = mapping.targetId.trim()
    }
    blockers.push("brand_link_execution_not_implemented")
  }

  if (entry.sourceKey) {
    const previous = previousProducts.get(manifestKey(entry.sourceKey)) ?? []
    if (previous.length > 1) {
      blockers.push("duplicate_previous_product_manifest_entries")
    } else if (previous.length === 1) {
      const prior = previous[0]
      previousManifestEntry = prior
      if (prior.status === "imported") {
        if (!prior.targetId?.trim()) {
          blockers.push("imported_previous_manifest_missing_target_id")
        } else if (prior.sourceChecksum === entry.sourceChecksum) {
          existingTargetId = prior.targetId
        } else {
          blockers.push("existing_product_checksum_changed_requires_update_path")
        }
      } else if (prior.status === "skipped") {
        blockers.push("previous_product_manifest_requires_reconciliation:skipped")
      } else if (prior.sourceChecksum !== entry.sourceChecksum) {
        blockers.push(
          `previous_product_manifest_checksum_changed:${prior.status}`
        )
      }
    }
  }

  const uniqueBlockers = [...new Set(blockers)].sort()
  const action: StagingProductExecutionAction =
    uniqueBlockers.length > 0 ? "blocked" : existingTargetId ? "skip" : "create"

  const executionChecksum = sourceChecksum({
    candidateKey: entry.candidateKey,
    sourceKey: entry.sourceKey,
    sourceChecksum: entry.sourceChecksum,
    action,
    categoryTargetIds: [...categoryTargetIds].sort(),
    mediaTargetUrls: [...mediaTargetUrls].sort(),
    brandTargetId,
    existingTargetId,
    previousManifestStatus: previousManifestEntry?.status,
    blockers: uniqueBlockers,
  })

  return {
    candidateKey: entry.candidateKey,
    action,
    sourceKey: entry.sourceKey,
    sourceChecksum: entry.sourceChecksum,
    executionChecksum,
    normalizedProduct: product,
    categoryTargetIds: [...new Set(categoryTargetIds)],
    mediaTargetUrls: [...new Set(mediaTargetUrls)],
    brandTargetId,
    existingTargetId,
    previousManifestEntry,
    blockers: uniqueBlockers,
  }
}

export function buildStagingProductExecutionPlan(
  input: BuildStagingProductExecutionPlanInput
): StagingProductExecutionPlan {
  const dependencyKeys = input.dependencyMappings.map((mapping) =>
    dependencyKey(mapping.entityType, mapping.sourceId)
  )
  const duplicateDependencyKeys = duplicateValues(dependencyKeys)
  const globalBlockers: string[] = []

  if (input.importPlan.schemaVersion !== 1) {
    globalBlockers.push("unsupported_product_import_plan_schema")
  }
  if (!input.importPlan.isExecutable) {
    globalBlockers.push("product_import_plan_not_executable")
  }
  if (duplicateDependencyKeys.length > 0) {
    globalBlockers.push("duplicate_dependency_mapping_keys")
  }

  const allowedMediaHosts = new Set(
    input.allowedMediaHosts.map((host) => host.trim().toLowerCase()).filter(Boolean)
  )
  if (allowedMediaHosts.size === 0) {
    globalBlockers.push("allowed_media_hosts_required")
  }
  if (allowedMediaHosts.has("coquetteconcept.gr")) {
    globalBlockers.push("legacy_host_cannot_be_serving_media_host")
  }

  const dependencies = mappingIndex(input.dependencyMappings)
  const previousProducts = previousProductManifestIndex(
    input.previousProductManifestEntries ?? []
  )
  const entries = input.importPlan.entries.map((entry) =>
    buildEntry(
      input.importPlan,
      entry,
      dependencies,
      previousProducts,
      allowedMediaHosts,
      globalBlockers
    )
  )

  const totals = Object.fromEntries(
    stagingProductExecutionActions.map((action) => [
      action,
      entries.filter((entry) => entry.action === action).length,
    ])
  ) as Record<StagingProductExecutionAction, number>

  return {
    schemaVersion: 1,
    sourceProductPlanSchemaVersion: input.importPlan.schemaVersion,
    entries,
    totals,
    duplicateDependencyKeys,
    globalBlockers: [...new Set(globalBlockers)].sort(),
    isExecutable:
      entries.length > 0 &&
      totals.blocked === 0 &&
      duplicateDependencyKeys.length === 0 &&
      globalBlockers.length === 0,
  }
}

export function prepareMedusaSimpleProductInput(
  entry: StagingProductExecutionEntry,
  runtime: {
    defaultSalesChannelId: string
    defaultShippingProfileId: string
  }
): PreparedMedusaSimpleProductInput {
  if (entry.action !== "create" || !entry.normalizedProduct) {
    throw new Error("Only executable create entries can be prepared for Medusa")
  }
  if (entry.normalizedProduct.type !== "simple") {
    throw new Error("Only explicitly simple products can be prepared by Phase 4G")
  }
  if (entry.blockers.length > 0) {
    throw new Error("Blocked product execution entries cannot be prepared")
  }
  if (entry.brandTargetId) {
    throw new Error("Brand-bearing products require the product-brand link execution path")
  }

  const product = entry.normalizedProduct
  const optionEntries = Object.entries(product.optionValues)
  const resolvedOptions =
    optionEntries.length > 0
      ? optionEntries
      : [["Default Option", "Default Variant"] as [string, string]]
  const options = resolvedOptions.map(([title, value]) => ({
    title,
    values: [value],
  }))
  const variantOptions = Object.fromEntries(resolvedOptions)

  const metadata: Record<string, string> = {
    coquette_migration_source_id: product.sourceId,
    coquette_migration_source_checksum: entry.sourceChecksum ?? "",
    coquette_migration_candidate_key: entry.candidateKey,
    coquette_legacy_visibility: product.visibility,
    coquette_legacy_status: product.status,
  }
  if (product.canonicalUrl) metadata.coquette_legacy_canonical_url = product.canonicalUrl
  if (product.alternateLocaleUrl) {
    metadata.coquette_legacy_alternate_locale_url = product.alternateLocaleUrl
  }

  return {
    title: product.name,
    description: product.description,
    status: product.status === "enabled" ? "published" : "draft",
    shipping_profile_id: runtime.defaultShippingProfileId,
    sales_channels: [{ id: runtime.defaultSalesChannelId }],
    categories: entry.categoryTargetIds.map((id) => ({ id })),
    images: entry.mediaTargetUrls.map((url) => ({ url })),
    options,
    variants: [
      {
        title: product.name,
        sku: product.sku,
        options: variantOptions,
        manage_inventory: true,
        allow_backorder: false,
      },
    ],
    metadata,
  }
}

export function assertStagingMigrationWriteGuard(env: NodeJS.ProcessEnv) {
  if (env.COQUETTE_MIGRATION_TARGET !== "staging") {
    throw new Error("COQUETTE_MIGRATION_TARGET must be exactly 'staging'")
  }
  if (env.COQUETTE_MIGRATION_ALLOW_WRITE !== "COQUETTE_STAGING_WRITE_CONFIRMED") {
    throw new Error(
      "COQUETTE_MIGRATION_ALLOW_WRITE must equal COQUETTE_STAGING_WRITE_CONFIRMED"
    )
  }

  const databaseUrl = env.DATABASE_URL
  const expectedHost = env.COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST?.trim()
  const expectedDatabase = env.COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME?.trim()
  if (!databaseUrl || !expectedHost || !expectedDatabase) {
    throw new Error(
      "DATABASE_URL, COQUETTE_MIGRATION_EXPECTED_DATABASE_HOST and COQUETTE_MIGRATION_EXPECTED_DATABASE_NAME are required for write mode"
    )
  }

  const parsed = new URL(databaseUrl)
  const databaseName = parsed.pathname.replace(/^\//, "")
  if (parsed.hostname !== expectedHost) {
    throw new Error(
      `Database host mismatch: expected ${expectedHost}, received ${parsed.hostname}`
    )
  }
  if (databaseName !== expectedDatabase) {
    throw new Error(
      `Database name mismatch: expected ${expectedDatabase}, received ${databaseName}`
    )
  }

  return {
    target: "staging" as const,
    databaseHost: parsed.hostname,
    databaseName,
  }
}
