const { admin, json } = require('../../lib/medusa')

function bodyObject(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return null }
  }
  return null
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Method not allowed' })
  const body = bodyObject(req)
  if (!body) return json(res, 400, { message: 'Invalid JSON body' })

  try {
    const result = await admin(req, '/admin/studio/media/order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (result.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (!result.response) return json(res, 502, { message: 'Managed media service unavailable' })
    return json(res, result.response.status, result.payload || {})
  } catch (error) {
    console.error('studio media order failed', error)
    return json(res, 502, { message: 'Managed media service unavailable' })
  }
}
