import { sourceChecksum } from "./checksum"
import {
  buildDirectCaptureProductCandidates,
  type CaptureArtifactBundle,
} from "./capture-ingestion"
import {
  buildRecoveryProductCandidate,
  type RecoveryProductCandidate,
  type RecoveryProductFields,
  type RecoveryProductObservation,
} from "./recovery-candidates"

const aliasSafetyFields = [
  "sku",
  "type",
  "optionValues",
  "configurableVariants",
  "configurableVariantMatrixComplete",
  "stockState",
  "regularPrice",
  "salePrice",
  "currencyCode",
  "brandSourceId",
] as const satisfies readonly (keyof RecoveryProductFields)[]

function sourceId(candidate: RecoveryProductCandidate) {
  return candidate.selected.sourceId?.trim()
}

function sourceLocale(value: string) {
  try {
    const path = new URL(value).pathname.toLowerCase()
    if (path === "/default" || path.startsWith("/default/")) return "el" as const
    if (path === "/en" || path.startsWith("/en/")) return "en" as const
    return "unknown" as const
  } catch {
    return "unknown" as const
  }
}

function routeRank(value: string) {
  try {
    const path = new URL(value).pathname
    const canonicalLooking = path.replace(/\/+$/, "").endsWith(".html") ? 0 : 1
    const alias = /\/catalog\/product\/view\//i.test(path) ? 1 : 0
    const locale = sourceLocale(value) === "el" ? 0 : sourceLocale(value) === "en" ? 1 : 2
    return [canonicalLooking, alias, locale, path.length, value] as const
  } catch {
    return [2, 2, 2, Number.MAX_SAFE_INTEGER, value] as const
  }
}

function compareRoutePreference(left: string, right: string) {
  const a = routeRank(left)
  const b = routeRank(right)
  for (let index = 0; index < a.length - 1; index += 1) {
    if (a[index] < b[index]) return -1
    if (a[index] > b[index]) return 1
  }
  return String(a[a.length - 1]).localeCompare(String(b[b.length - 1]))
}

function distinctDefinedFieldDigests(
  candidates: RecoveryProductCandidate[],
  field: keyof RecoveryProductFields
) {
  return new Set(
    candidates.flatMap((candidate) => {
      const value = candidate.selected[field]
      return value === undefined || value === null
        ? []
        : [sourceChecksum(value)]
    })
  )
}

function mergeStringFieldArrays(
  candidates: RecoveryProductCandidate[],
  field: "categorySourceIds" | "mediaSourceIds"
) {
  return [
    ...new Set(
      candidates.flatMap((candidate) => candidate.selected[field] ?? [])
    ),
  ].sort()
}

function observedAt(candidate: RecoveryProductCandidate) {
  return candidate.evidence
    .map((entry) => entry.capturedAt)
    .filter((value) => value && value !== "unknown")
    .sort()
    .at(-1)
}

function canFoldExactMagentoAliasGroup(
  bundle: CaptureArtifactBundle,
  candidates: RecoveryProductCandidate[]
) {
  if (candidates.length < 2) return undefined

  const identities = candidates.map((candidate) => {
    const url = sourceId(candidate)
    const parentProductId = url
      ? bundle.productStructures?.[url]?.parentProductId?.trim()
      : undefined
    const sku = candidate.selected.sku?.trim().toLowerCase()
    return { url, parentProductId, sku }
  })

  if (identities.some((identity) => !identity.url || !identity.parentProductId || !identity.sku)) {
    return undefined
  }

  const parentIds = new Set(identities.map((identity) => identity.parentProductId))
  const skus = new Set(identities.map((identity) => identity.sku))
  if (parentIds.size !== 1 || skus.size !== 1) return undefined

  for (const field of aliasSafetyFields) {
    if (distinctDefinedFieldDigests(candidates, field).size > 1) return undefined
  }

  return identities[0].parentProductId!
}

function mergeExactMagentoAliasGroup(
  candidates: RecoveryProductCandidate[],
  parentProductId: string
) {
  const ordered = [...candidates].sort((left, right) =>
    compareRoutePreference(sourceId(left) ?? "", sourceId(right) ?? "")
  )
  const primary = ordered[0]
  const primarySourceId = sourceId(primary)!
  const mergedFields: RecoveryProductFields = {
    ...primary.selected,
    sourceId: primarySourceId,
    legacyProductId: parentProductId,
  }

  for (const field of aliasSafetyFields) {
    if (mergedFields[field] !== undefined) continue
    const fallback = ordered.find((candidate) => candidate.selected[field] !== undefined)
    if (fallback) {
      ;(mergedFields as Record<string, unknown>)[field] = fallback.selected[field]
    }
  }

  const categorySourceIds = mergeStringFieldArrays(ordered, "categorySourceIds")
  const mediaSourceIds = mergeStringFieldArrays(ordered, "mediaSourceIds")
  if (categorySourceIds.length > 0) mergedFields.categorySourceIds = categorySourceIds
  if (mediaSourceIds.length > 0) mergedFields.mediaSourceIds = mediaSourceIds

  const primaryObservation: RecoveryProductObservation = {
    authority: "direct_storefront",
    sourceUrl: primarySourceId,
    observedAt: observedAt(primary),
    note: `Exact Magento route aliases reconciled by matching SKU + parent_product_id=${parentProductId}; aliases=${ordered.length}`,
    fields: mergedFields,
  }

  const retainedAliasEvidence: RecoveryProductObservation[] = ordered
    .flatMap((candidate) => candidate.evidence)
    .filter((entry) => entry.sourceUrl !== primarySourceId)
    .filter(
      (entry, index, entries) =>
        entries.findIndex((candidate) => candidate.sourceUrl === entry.sourceUrl) === index
    )
    .map((entry) => ({
      authority: "direct_storefront" as const,
      sourceUrl: entry.sourceUrl,
      observedAt: entry.capturedAt === "unknown" ? undefined : entry.capturedAt,
      note: [
        "Magento route-alias evidence retained after exact parent identity reconciliation.",
        entry.note,
      ]
        .filter(Boolean)
        .join(" "),
      fields: {},
    }))

  const sku = mergedFields.sku!
  return buildRecoveryProductCandidate(
    `direct:magento:${encodeURIComponent(parentProductId)}:sku:${encodeURIComponent(sku)}`,
    [primaryObservation, ...retainedAliasEvidence]
  )
}

/**
 * Builds the direct-capture candidates and folds only exact Magento route
 * aliases. SKU equality alone is never sufficient: every candidate in the
 * group must also expose the same product-specific Magento parent ID and must
 * agree on all structural/price safety fields.
 */
export function buildCanonicalCaptureProductCandidates(
  bundle: CaptureArtifactBundle
): RecoveryProductCandidate[] {
  const direct = buildDirectCaptureProductCandidates(bundle)
  const bySku = new Map<string, RecoveryProductCandidate[]>()
  const withoutSku: RecoveryProductCandidate[] = []

  for (const candidate of direct) {
    const sku = candidate.selected.sku?.trim().toLowerCase()
    if (!sku) {
      withoutSku.push(candidate)
      continue
    }
    const group = bySku.get(sku) ?? []
    group.push(candidate)
    bySku.set(sku, group)
  }

  const result = [...withoutSku]
  for (const candidates of bySku.values()) {
    if (candidates.length === 1) {
      result.push(candidates[0])
      continue
    }

    const parentProductId = canFoldExactMagentoAliasGroup(bundle, candidates)
    if (!parentProductId) {
      result.push(...candidates)
      continue
    }
    result.push(mergeExactMagentoAliasGroup(candidates, parentProductId))
  }

  return result.sort((left, right) => left.candidateKey.localeCompare(right.candidateKey))
}
