type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
  }) => Promise<{ data: unknown[] }>
}

type SalePriceListRecord = {
  id?: string
  type?: string
  status?: string
  starts_at?: string | Date | null
  ends_at?: string | Date | null
  rules_count?: number | null
  prices?: Array<{
    price_set?: {
      variant?: {
        product_id?: string | null
      } | null
    } | null
  }> | null
}

function isCurrentlyActive(
  priceList: SalePriceListRecord,
  now: Date
): boolean {
  if (priceList.status !== "active" || priceList.type !== "sale") {
    return false
  }

  if (Number(priceList.rules_count ?? 0) > 0) {
    return false
  }

  const startsAt = priceList.starts_at ? new Date(priceList.starts_at) : null
  const endsAt = priceList.ends_at ? new Date(priceList.ends_at) : null

  if (startsAt && !Number.isNaN(startsAt.getTime()) && startsAt > now) {
    return false
  }

  if (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt <= now) {
    return false
  }

  return true
}

export async function getPublicSaleCandidateProductIds(
  query: QueryGraph,
  now = new Date()
): Promise<string[]> {
  const { data } = await query.graph({
    entity: "price_list",
    fields: [
      "id",
      "type",
      "status",
      "starts_at",
      "ends_at",
      "rules_count",
      "prices.price_set.variant.product_id",
    ],
    filters: {
      type: "sale",
      status: "active",
    },
  })

  const productIds = new Set<string>()

  for (const record of data as SalePriceListRecord[]) {
    if (!isCurrentlyActive(record, now)) {
      continue
    }

    for (const price of record.prices ?? []) {
      const productId = price.price_set?.variant?.product_id

      if (productId) {
        productIds.add(productId)
      }
    }
  }

  return [...productIds]
}
