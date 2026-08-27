const { admin, json } = require('../../lib/medusa')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Method not allowed' })

  try {
    const result = await admin(req, '/admin/studio/lifecycle/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}),
    })
    if (result.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (!result.response) return json(res, 502, { message: 'Lifecycle review service unavailable' })
    return json(res, result.response.status, result.payload || {})
  } catch (error) {
    console.error('studio lifecycle review failed', error)
    return json(res, 502, { message: 'Lifecycle review service unavailable' })
  }
}
