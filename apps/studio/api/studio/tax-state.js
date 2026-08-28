const { admin, json } = require('../../lib/medusa')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { message: 'Method not allowed' })

  try {
    const result = await admin(req, '/admin/studio/tax')
    if (result.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (!result.response) return json(res, 502, { message: 'Tax state service unavailable' })
    return json(res, result.response.status, result.payload || {})
  } catch (error) {
    console.error('studio tax state failed', error)
    return json(res, 502, { message: 'Tax state service unavailable' })
  }
}
