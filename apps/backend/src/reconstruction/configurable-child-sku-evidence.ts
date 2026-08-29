export type ConfigurableChildSkuEvidence = {
  sourceProductId: string
  sku: string
}

export type ConfigurableChildSkuProbeResult = {
  parentSku: string
  resolved: ConfigurableChildSkuEvidence[]
  unresolvedSourceProductIds: string[]
  issues: string[]
  complete: boolean
}

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined
}

function positiveMagentoId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return String(value)
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const normalized = value.trim().replace(/^0+(?=\d)/, "")
    return normalized === "0" ? undefined : normalized
  }
  return undefined
}

export function configurableChildSkuGraphqlQuery() {
  return `query CoquetteConfigurableChildSkus($sku: String!) {
  products(filter: { sku: { eq: $sku } }) {
    items {
      sku
      __typename
      ... on ConfigurableProduct {
        variants {
          product {
            id
            sku
          }
        }
      }
    }
  }
}`
}

export function parseConfigurableChildSkuGraphqlResponse(input: {
  parentSku: string
  expectedSourceProductIds: string[]
  response: unknown
}): ConfigurableChildSkuProbeResult {
  const parentSku = input.parentSku.trim()
  const expected = [...new Set(input.expectedSourceProductIds.map((value) => value.trim()))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  const expectedSet = new Set(expected)
  const issues: string[] = []
  const root = record(input.response)

  if (!parentSku) issues.push("parent_sku_required")
  if (expected.length === 0) issues.push("expected_child_ids_required")
  if (!root) issues.push("graphql_response_object_required")

  const errors = Array.isArray(root?.errors) ? root?.errors : []
  if (errors.length > 0) issues.push("graphql_response_contains_errors")

  const data = record(root?.data)
  const products = record(data?.products)
  const items = Array.isArray(products?.items) ? products.items : []
  const matchingParents = items
    .map(record)
    .filter((item): item is JsonRecord => Boolean(item))
    .filter((item) => nonEmptyString(item.sku) === parentSku)

  if (matchingParents.length !== 1) {
    issues.push(`parent_product_match_count:${matchingParents.length}`)
  }

  const parent = matchingParents[0]
  if (parent && parent.__typename !== "ConfigurableProduct") {
    issues.push(`parent_graphql_type:${String(parent.__typename ?? "missing")}`)
  }

  const rawVariants = Array.isArray(parent?.variants) ? parent.variants : []
  if (parent && !Array.isArray(parent.variants)) {
    issues.push("configurable_variants_missing")
  }

  const byId = new Map<string, string[]>()
  for (const rawVariant of rawVariants) {
    const variant = record(rawVariant)
    const product = record(variant?.product)
    const sourceProductId = positiveMagentoId(product?.id)
    const sku = nonEmptyString(product?.sku)
    if (!sourceProductId) {
      issues.push("variant_numeric_product_id_missing")
      continue
    }
    if (!sku) {
      issues.push(`variant_sku_missing:${sourceProductId}`)
      continue
    }
    const skus = byId.get(sourceProductId) ?? []
    skus.push(sku)
    byId.set(sourceProductId, skus)
  }

  const unexpectedIds = [...byId.keys()].filter((id) => !expectedSet.has(id))
  for (const id of unexpectedIds.sort()) {
    issues.push(`unexpected_child_id:${id}`)
  }

  const resolved: ConfigurableChildSkuEvidence[] = []
  const unresolvedSourceProductIds: string[] = []
  const seenSkus = new Map<string, string>()

  for (const sourceProductId of expected) {
    const skus = [...new Set(byId.get(sourceProductId) ?? [])]
    if (skus.length !== 1) {
      unresolvedSourceProductIds.push(sourceProductId)
      issues.push(`child_sku_match_count:${sourceProductId}:${skus.length}`)
      continue
    }
    const sku = skus[0]
    const existingId = seenSkus.get(sku.toLowerCase())
    if (existingId && existingId !== sourceProductId) {
      unresolvedSourceProductIds.push(sourceProductId)
      issues.push(`duplicate_child_sku:${sku}`)
      continue
    }
    seenSkus.set(sku.toLowerCase(), sourceProductId)
    resolved.push({ sourceProductId, sku })
  }

  const normalizedIssues = [...new Set(issues)].sort()
  const uniqueUnresolved = [...new Set(unresolvedSourceProductIds)].sort()
  const complete =
    normalizedIssues.length === 0 &&
    uniqueUnresolved.length === 0 &&
    resolved.length === expected.length &&
    resolved.length > 0

  return {
    parentSku,
    resolved: resolved.sort((left, right) =>
      left.sourceProductId.localeCompare(right.sourceProductId, undefined, {
        numeric: true,
      })
    ),
    unresolvedSourceProductIds: uniqueUnresolved,
    issues: normalizedIssues,
    complete,
  }
}
