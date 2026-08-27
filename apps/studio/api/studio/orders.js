const { admin, json } = require('../../lib/medusa')

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(Array.isArray(value) ? value[0] : value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

function cleanText(value, max = 120) {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw.trim().slice(0, max) : ''
}

function mapOrder(order) {
  return {
    id: order.id,
    display_id: order.display_id,
    created_at: order.created_at || null,
    updated_at: order.updated_at || null,
    email: order.email || order.customer?.email || null,
    total: typeof order.total === 'number' ? order.total : null,
    currency_code: order.currency_code || null,
    fulfillment_status: order.fulfillment_status || null,
    payment_status: order.payment_status || null,
    status: order.status || null,
    item_count: Array.isArray(order.items)
      ? order.items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
      : null,
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { message: 'Method not allowed' })

  const limit = boundedInteger(req.query?.limit, 25, 1, 50)
  const offset = boundedInteger(req.query?.offset, 0, 0, 100000)
  const q = cleanText(req.query?.q)
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), order: '-created_at' })
  if (q) params.set('q', q)

  try {
    const result = await admin(req, `/admin/orders?${params.toString()}`)
    if (result.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (!result.response?.ok) {
      console.error('studio orders failed', result.response?.status, result.payload)
      return json(res, 502, { message: 'Orders unavailable' })
    }

    const orders = Array.isArray(result.payload?.orders) ? result.payload.orders.map(mapOrder) : []
    return json(res, 200, {
      orders,
      count: Number(result.payload?.count || 0),
      limit,
      offset,
      query: q || null,
    })
  } catch (error) {
    console.error('studio orders failed', error)
    return json(res, 502, { message: 'Orders unavailable' })
  }
}
