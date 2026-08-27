const { admin, clearSessionCookie, json } = require('../_lib/medusa')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { message: 'Method not allowed' })
  try {
    const result = await admin(req, '/admin/users/me')
    if (result.unauthorized || !result.response?.ok || !result.payload?.user) {
      res.setHeader('set-cookie', clearSessionCookie())
      return json(res, 401, { authenticated: false })
    }
    const user = result.payload.user
    return json(res, 200, { authenticated: true, user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name } })
  } catch (error) {
    console.error('studio me failed', error)
    return json(res, 502, { authenticated: false, message: 'Backend unavailable' })
  }
}
