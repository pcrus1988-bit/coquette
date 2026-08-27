const { admin, json } = require('../../lib/medusa')

function stepNumber(metadata) {
  const parsed = Number(metadata?.coquette_studio_wizard_step || 1)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 8 ? parsed : 1
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { message: 'Method not allowed' })

  try {
    const params = new URLSearchParams({
      limit: '30',
      offset: '0',
      status: 'draft',
      order: '-updated_at',
      fields: '+metadata,+thumbnail,+updated_at',
    })
    const result = await admin(req, `/admin/products?${params.toString()}`)
    if (result.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (!result.response?.ok) return json(res, 502, { message: 'Drafts unavailable' })

    const products = Array.isArray(result.payload?.products) ? result.payload.products : []
    const drafts = products
      .filter((product) => product?.status === 'draft' && product?.metadata?.coquette_studio_origin === 'quick_draft')
      .map((product) => ({
        id: product.id,
        title: product.title || 'Untitled piece',
        subtitle: product.subtitle || null,
        handle: product.handle || null,
        thumbnail: product.thumbnail || null,
        updated_at: product.updated_at || null,
        step: stepNumber(product.metadata),
        flow: product.metadata?.coquette_studio_flow || 'quick_draft',
      }))
      .slice(0, 20)

    return json(res, 200, { drafts })
  } catch (error) {
    console.error('studio drafts list failed', error)
    return json(res, 502, { message: 'Drafts unavailable' })
  }
}
