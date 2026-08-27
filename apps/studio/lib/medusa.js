const COOKIE_NAME = 'coquette_studio_session'

function backendUrl() {
  const value = process.env.MEDUSA_BACKEND_URL || process.env.COQUETTE_MEDUSA_BACKEND_URL
  if (!value) throw new Error('MEDUSA_BACKEND_URL is not configured')
  return value.replace(/\/$/, '')
}

function readCookie(req, name = COOKIE_NAME) {
  const header = req.headers?.cookie || ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

function sessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=28800`
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`
}

async function medusa(path, options = {}) {
  const response = await fetch(`${backendUrl()}${path}`, {
    ...options,
    headers: { accept: 'application/json', ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

async function admin(req, path, options = {}) {
  const token = readCookie(req)
  if (!token) return { unauthorized: true }
  const result = await medusa(path, {
    ...options,
    headers: { ...(options.headers || {}), authorization: `Bearer ${token}` },
  })
  if (result.response.status === 401 || result.response.status === 403) return { unauthorized: true, ...result }
  return result
}

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

module.exports = { admin, backendUrl, clearSessionCookie, json, medusa, readCookie, sessionCookie }
