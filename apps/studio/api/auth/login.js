const { json, medusa, sessionCookie } = require('../../lib/medusa')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Method not allowed' })

  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  } catch {
    return json(res, 400, { message: 'Invalid request.' })
  }

  const email = String(body.email || '').trim()
  const password = String(body.password || '')
  if (!email || !password) return json(res, 400, { message: 'Email και password είναι απαραίτητα.' })

  try {
    const auth = await medusa('/auth/user/emailpass', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!auth.response.ok || !auth.payload.token) return json(res, 401, { message: 'Invalid email or password.' })

    const me = await medusa('/admin/users/me', { headers: { authorization: `Bearer ${auth.payload.token}` } })
    if (!me.response.ok || !me.payload.user) return json(res, 403, { message: 'This account cannot access COQUETTE Studio.' })

    res.setHeader('set-cookie', sessionCookie(auth.payload.token))
    return json(res, 200, { user: { id: me.payload.user.id, email: me.payload.user.email, first_name: me.payload.user.first_name, last_name: me.payload.user.last_name } })
  } catch (error) {
    console.error('studio login failed', error)
    return json(res, 502, { message: 'Το Studio δεν μπορεί να επικοινωνήσει με το commerce backend.' })
  }
}
