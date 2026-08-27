const { clearSessionCookie, json } = require('../_lib/medusa')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Method not allowed' })
  res.setHeader('set-cookie', clearSessionCookie())
  return json(res, 200, { ok: true })
}
