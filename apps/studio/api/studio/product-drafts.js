const { admin, json } = require('../../lib/medusa')

function bodyObject(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return null }
  }
  return null
}

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Method not allowed' })

  const body = bodyObject(req)
  if (!body) return json(res, 400, { message: 'Invalid JSON body' })

  const title = text(body.title, 160)
  const description = text(body.description, 5000)
  const requestId = text(body.request_id, 80)
  if (!title) return json(res, 400, { message: 'A product title is required' })
  if (!/^[A-Za-z0-9-]{20,80}$/.test(requestId)) {
    return json(res, 400, { message: 'A valid Studio request id is required' })
  }

  try {
    const profiles = await admin(req, '/admin/shipping-profiles?limit=50')
    if (profiles.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (!profiles.response?.ok) return json(res, 502, { message: 'Store configuration unavailable' })

    const available = Array.isArray(profiles.payload?.shipping_profiles) ? profiles.payload.shipping_profiles : []
    const shippingProfile = available.find((profile) => profile?.type === 'default') || available[0]
    if (!shippingProfile?.id) {
      return json(res, 409, { message: 'No shipping profile is configured for product drafts' })
    }

    const payload = {
      title,
      status: 'draft',
      shipping_profile_id: shippingProfile.id,
      metadata: {
        coquette_studio_origin: 'quick_draft',
        coquette_studio_request_id: requestId,
      },
    }
    if (description) payload.description = description

    const created = await admin(req, '/admin/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (created.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (created.response?.status === 409) return json(res, 409, { message: 'A product with conflicting data already exists' })
    if (!created.response?.ok || !created.payload?.product) {
      console.error('studio quick draft failed', created.response?.status, created.payload)
      return json(res, 502, { message: 'The draft could not be created' })
    }

    const product = created.payload.product
    if (product.status && product.status !== 'draft') {
      console.error('studio draft invariant failed', { productId: product.id, status: product.status })
      return json(res, 500, { message: 'Draft safety invariant failed' })
    }

    return json(res, 201, {
      product: {
        id: product.id,
        title: product.title,
        status: product.status || 'draft',
        handle: product.handle || null,
      },
    })
  } catch (error) {
    console.error('studio quick draft failed', error)
    return json(res, 502, { message: 'The draft could not be created' })
  }
}
