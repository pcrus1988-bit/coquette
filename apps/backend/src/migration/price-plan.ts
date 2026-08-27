import { sourceChecksum } from "./checksum"
import {
  createPendingManifestEntry,
  findDuplicateManifestKeys,
  manifestKey,
} from "./manifest"
import type {
  ProductImportPlan,
  ProductImportPlanEntry,
} from "./import-plan"
import type {
  MigrationManifestEntry,
  MigrationSourceKey,
} from "./types"

export const pricePlanStates = ["ready", "unavailable", "blocked"] as const
export type PricePlanState = (typeof pricePlanStates)[number]

export type ReconstructedPrice = {
  sku: string
  currencyCode: "EUR"
  regularPrice: number
  salePrice?: number
}

export type PricePlanEntry = {
  candidateKey: string
  state: PricePlanState
  productSourceKey?: MigrationSourceKey
  sourceKey?: MigrationSourceKey
  sku?: string
  sourceChecksum?: string
  sourceUpdatedAt?: string
  reconstructedPrice?: ReconstructedPrice
  blockers: string[]
  warnings: string[]
  errors: string[]
}

export type PricePlan = {
  schemaVersion: 1
  entries: PricePlanEntry[]
  totals: Record<PricePlanState, number>
  runtimeManifestEntries: MigrationManifestEntry[]
  duplicateSourceKeys: string[]
  duplicateRuntimeManifestKeys: string[]
  duplicateSkus: string[]
  isExecutable: boolean
  isReconciled: boolean
}

function duplicateValues(values: Array<string | undefined>) {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value?.trim()) continue
    const normalized = value.trim()
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort()
}

function priceSourceKey(
  productSourceKey: MigrationSourceKey
): MigrationSourceKey {
  return {
    entityType: "price",
    sourceId: productSourceKey.sourceId,
    locale: productSourceKey.locale,
  }
}

export function semanticPriceChecksum(price: ReconstructedPrice) {
  return sourceChecksum({
    sku: price.sku,
    currencyCode: price.currencyCode,
    regularPrice: price.regularPrice,
    salePrice: price.salePrice,
  })
}

function block(entry: PricePlanEntry, reason: string, error?: string) {
  entry.state = "blocked"
  if (!entry.blockers.includes(reason)) entry.blockers.push(reason)
  if (error && !entry.errors.includes(error)) entry.errors.push(error)
}

function initialPriceEntry(productEntry: ProductImportPlanEntry): PricePlanEntry {
  const entry: PricePlanEntry = {
    candidateKey: productEntry.candidateKey,
    state: "blocked",
    productSourceKey: productEntry.sourceKey,
    sourceKey: productEntry.sourceKey
      ? priceSourceKey(productEntry.sourceKey)
      : undefined,
    sku: productEntry.sku,
    sourceUpdatedAt: productEntry.sourceUpdatedAt,
    blockers: [],
    warnings: [],
    errors: [],
  }

  if (productEntry.state !== "ready") {
    block(
      entry,
      "structural_product_not_ready",
      `Structural product plan state is ${productEntry.state}; price execution must not outrun product identity.`
    )
    return entry
  }

  if (!productEntry.sourceKey || productEntry.sourceKey.entityType !== "product") {
    block(
      entry,
      "missing_structural_product_source_key",
      "A ready structural product must have an entityType=product source key before pricing can be planned."
    )
    return entry
  }

  const product = productEntry.normalizedProduct
  if (!product || !productEntry.sku?.trim()) {
    block(
      entry,
      "missing_structural_product_identity",
      "A ready structural product must expose normalized product data and a non-empty SKU."
    )
    return entry
  }

  const regularPrice = product.regularPrice
  const salePrice = product.salePrice
  const currencyCode = product.currencyCode

  if (regularPrice === undefined && salePrice === undefined) {
    entry.state = "unavailable"
    entry.warnings.push("public_price_not_recovered")
    return entry
  }

  if (regularPrice === undefined && salePrice !== undefined) {
    block(
      entry,
      "sale_price_without_regular_price",
      "A sale/special price cannot be reconstructed without the corresponding public regular price."
    )
    return entry
  }

  if (currencyCode !== "EUR") {
    block(
      entry,
      "missing_or_unsupported_price_currency",
      "Recovered public pricing requires an explicit EUR currency code; currency is never inferred during migration."
    )
    return entry
  }

  if (!Number.isFinite(regularPrice) || regularPrice! <= 0) {
    block(
      entry,
      "invalid_regular_price",
      "Regular price must be a finite positive major-unit amount."
    )
    return entry
  }

  if (salePrice !== undefined) {
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      block(
        entry,
        "invalid_sale_price",
        "Sale price must be a finite positive major-unit amount when present."
      )
      return entry
    }

    if (salePrice >= regularPrice!) {
      block(
        entry,
        "non_discounting_sale_price",
        "Sale price must be strictly lower than the recovered regular price; stale or ambiguous sale markup requires review."
      )
      return entry
    }
  }

  const reconstructedPrice: ReconstructedPrice = {
    sku: productEntry.sku.trim(),
    currencyCode,
    regularPrice: regularPrice!,
    salePrice,
  }

  entry.state = "ready"
  entry.reconstructedPrice = reconstructedPrice
  entry.sourceChecksum = semanticPriceChecksum(reconstructedPrice)
  return entry
}

export function buildPricePlan(productPlan: ProductImportPlan): PricePlan {
  const entries = productPlan.entries
    .map(initialPriceEntry)
    .sort((left, right) => left.candidateKey.localeCompare(right.candidateKey))

  const duplicateSkus = duplicateValues(
    entries
      .filter((entry) => entry.state !== "blocked")
      .map((entry) => entry.sku)
  )
  for (const entry of entries) {
    if (entry.sku && duplicateSkus.includes(entry.sku)) {
      block(entry, "duplicate_price_sku_requires_identity_resolution")
    }
  }

  const duplicateSourceKeys = duplicateValues(
    entries
      .filter((entry) => entry.state !== "blocked")
      .map((entry) => (entry.sourceKey ? manifestKey(entry.sourceKey) : undefined))
  )
  for (const entry of entries) {
    if (
      entry.sourceKey &&
      duplicateSourceKeys.includes(manifestKey(entry.sourceKey))
    ) {
      block(entry, "duplicate_price_source_key")
    }
  }

  const provisionalRuntimeManifestEntries = entries.flatMap((entry) => {
    if (
      entry.state !== "ready" ||
      !entry.sourceKey ||
      !entry.sourceChecksum
    ) {
      return []
    }

    return [
      createPendingManifestEntry(
        entry.sourceKey,
        entry.sourceChecksum,
        entry.sourceUpdatedAt
      ),
    ]
  })

  const duplicateRuntimeManifestKeys = findDuplicateManifestKeys(
    provisionalRuntimeManifestEntries
  )
  if (duplicateRuntimeManifestKeys.length > 0) {
    for (const entry of entries) {
      if (
        entry.sourceKey &&
        duplicateRuntimeManifestKeys.includes(manifestKey(entry.sourceKey))
      ) {
        block(entry, "duplicate_runtime_price_manifest_key")
      }
    }
  }

  const runtimeManifestEntries = entries.flatMap((entry) => {
    if (
      entry.state !== "ready" ||
      !entry.sourceKey ||
      !entry.sourceChecksum
    ) {
      return []
    }

    return [
      createPendingManifestEntry(
        entry.sourceKey,
        entry.sourceChecksum,
        entry.sourceUpdatedAt
      ),
    ]
  })

  const totals = Object.fromEntries(
    pricePlanStates.map((state) => [
      state,
      entries.filter((entry) => entry.state === state).length,
    ])
  ) as Record<PricePlanState, number>

  const isReconciled =
    totals.blocked === 0 &&
    duplicateSourceKeys.length === 0 &&
    duplicateRuntimeManifestKeys.length === 0 &&
    duplicateSkus.length === 0

  return {
    schemaVersion: 1,
    entries,
    totals,
    runtimeManifestEntries,
    duplicateSourceKeys,
    duplicateRuntimeManifestKeys,
    duplicateSkus,
    isExecutable: isReconciled && totals.ready > 0,
    isReconciled,
  }
}
