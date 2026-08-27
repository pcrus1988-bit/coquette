const { admin, json, readJsonBody } = require('../../lib/medusa')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Method not allowed' })

  try {
    const body = await readJsonBody(req)
    const result = await admin(req, '/admin/studio/pricing/plan', {
      method: 'POST',
      body,
    })
    if (result.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (!result.response) return json(res, 502, { message: 'Pricing review service unavailable' })
    return json(res, result.response.status, result.payload || {})
  } catch (error) {
    console.error('studio pricing plan failed', error)
    return json(res, 502, { message: 'Pricing review service unavailable' })
  }
}
