const { admin, json } = require('../../lib/medusa')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { message: 'Method not allowed' })
  const productId = typeof req.query?.product_id === 'string' ? req.query.product_id.trim() : ''
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(productId)) {
    return json(res, 400, { message: 'Valid Studio product id required' })
  }

  try {
    const result = await admin(req, `/admin/studio/placement-taxonomy?product_id=${encodeURIComponent(productId)}`)
    if (result.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (!result.response) return json(res, 502, { message: 'Placement state service unavailable' })
    return json(res, result.response.status, result.payload || {})
  } catch (error) {
    console.error('studio placement taxonomy state failed', error)
    return json(res, 502, { message: 'Placement state service unavailable' })
  }
}
