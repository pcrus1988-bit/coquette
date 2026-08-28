const { admin, json, parseBody } = require('../../lib/medusa')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Method not allowed' })

  try {
    const body = await parseBody(req)
    const result = await admin(req, '/admin/studio/tax/plan', {
      method: 'POST',
      body,
    })
    if (result.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (!result.response) return json(res, 502, { message: 'Tax review service unavailable' })
    return json(res, result.response.status, result.payload || {})
  } catch (error) {
    console.error('studio tax plan failed', error)
    return json(res, 502, { message: 'Tax review service unavailable' })
  }
}
