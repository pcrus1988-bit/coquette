const { admin, json } = require('../../lib/medusa')

function cleanId(value) {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return ''
  const id = raw.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ''
}

function addressSummary(address) {
  if (!address || typeof address !== 'object') return null
  return {
    first_name: address.first_name || null,
    last_name: address.last_name || null,
    address_1: address.address_1 || null,
    address_2: address.address_2 || null,
    postal_code: address.postal_code || null,
    city: address.city || null,
    province: address.province || null,
    country_code: address.country_code || null,
    phone: address.phone || null,
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { message: 'Method not allowed' })
  const id = cleanId(req.query?.id)
  if (!id) return json(res, 400, { message: 'Valid order id required' })

  try {
    const result = await admin(req, `/admin/orders/${encodeURIComponent(id)}`)
    if (result.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (result.response?.status === 404) return json(res, 404, { message: 'Order not found' })
    if (!result.response?.ok || !result.payload?.order) {
      console.error('studio order detail failed', result.response?.status, result.payload)
      return json(res, 502, { message: 'Order unavailable' })
    }

    const order = result.payload.order
    const items = Array.isArray(order.items)
      ? order.items.map((item) => ({
          id: item.id,
          title: item.title || item.product_title || 'Piece',
          variant_title: item.variant_title || null,
          thumbnail: item.thumbnail || null,
          quantity: Number(item.quantity || 0),
          unit_price: typeof item.unit_price === 'number' ? item.unit_price : null,
          total: typeof item.total === 'number' ? item.total : null,
          sku: item.variant_sku || item.variant?.sku || null,
        }))
      : []

    return json(res, 200, {
      order: {
        id: order.id,
        display_id: order.display_id,
        created_at: order.created_at || null,
        updated_at: order.updated_at || null,
        email: order.email || order.customer?.email || null,
        customer: order.customer
          ? {
              id: order.customer.id,
              first_name: order.customer.first_name || null,
              last_name: order.customer.last_name || null,
              email: order.customer.email || null,
            }
          : null,
        items,
        subtotal: typeof order.subtotal === 'number' ? order.subtotal : null,
        shipping_total: typeof order.shipping_total === 'number' ? order.shipping_total : null,
        tax_total: typeof order.tax_total === 'number' ? order.tax_total : null,
        discount_total: typeof order.discount_total === 'number' ? order.discount_total : null,
        total: typeof order.total === 'number' ? order.total : null,
        currency_code: order.currency_code || null,
        status: order.status || null,
        fulfillment_status: order.fulfillment_status || null,
        payment_status: order.payment_status || null,
        shipping_address: addressSummary(order.shipping_address),
        billing_address: addressSummary(order.billing_address),
      },
    })
  } catch (error) {
    console.error('studio order detail failed', error)
    return json(res, 502, { message: 'Order unavailable' })
  }
}
