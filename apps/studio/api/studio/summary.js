const { admin, json } = require('../_lib/medusa')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { message: 'Method not allowed' })
  try {
    const [orders, products] = await Promise.all([
      admin(req, '/admin/orders?limit=5&offset=0&order=-created_at'),
      admin(req, '/admin/products?limit=1&offset=0'),
    ])
    if (orders.unauthorized || products.unauthorized) return json(res, 401, { message: 'Unauthorized' })

    const ordersOk = Boolean(orders.response?.ok)
    const productsOk = Boolean(products.response?.ok)
    if (!ordersOk && !productsOk) return json(res, 502, { message: 'Commerce data unavailable' })

    const rawOrders = ordersOk && Array.isArray(orders.payload?.orders) ? orders.payload.orders : []
    const items = rawOrders.map((order) => ({
      id: order.id,
      display_id: order.display_id,
      created_at: order.created_at,
      email: order.email,
      total: order.total,
      currency_code: order.currency_code,
      fulfillment_status: order.fulfillment_status,
      payment_status: order.payment_status,
    }))

    return json(res, 200, {
      partial: !(ordersOk && productsOk),
      orders: { count: ordersOk ? Number(orders.payload?.count || 0) : null, items },
      products: { count: productsOk ? Number(products.payload?.count || 0) : null },
    })
  } catch (error) {
    console.error('studio summary failed', error)
    return json(res, 502, { message: 'Commerce data unavailable' })
  }
}
