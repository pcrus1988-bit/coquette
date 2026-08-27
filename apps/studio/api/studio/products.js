const { admin, json } = require('../../lib/medusa')

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(Array.isArray(value) ? value[0] : value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

function cleanText(value, max = 120) {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw.trim().slice(0, max) : ''
}

function mapProduct(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : []
  const images = Array.isArray(product?.images) ? product.images : []
  const primarySku = variants.find((variant) => typeof variant?.sku === 'string' && variant.sku.trim())?.sku || null
  return {
    id: product.id,
    title: product.title,
    subtitle: product.subtitle || null,
    handle: product.handle || null,
    status: product.status || 'draft',
    thumbnail: product.thumbnail || images[0]?.url || null,
    variant_count: variants.length,
    primary_sku: primarySku,
    created_at: product.created_at || null,
    updated_at: product.updated_at || null,
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { message: 'Method not allowed' })

  const limit = boundedInteger(req.query?.limit, 24, 1, 48)
  const offset = boundedInteger(req.query?.offset, 0, 0, 100000)
  const q = cleanText(req.query?.q)
  const status = cleanText(req.query?.status, 32)
  if (status && !['draft', 'published', 'proposed', 'rejected'].includes(status)) {
    return json(res, 400, { message: 'Unsupported product status filter' })
  }

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    order: '-updated_at',
    fields: '+thumbnail,+status,+updated_at,*variants,*images',
  })
  if (q) params.set('q', q)
  if (status) params.set('status', status)

  try {
    const result = await admin(req, `/admin/products?${params.toString()}`)
    if (result.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (!result.response?.ok) {
      console.error('studio products failed', result.response?.status, result.payload)
      return json(res, 502, { message: 'Catalogue unavailable' })
    }

    const products = Array.isArray(result.payload?.products) ? result.payload.products.map(mapProduct) : []
    return json(res, 200, {
      products,
      count: Number(result.payload?.count || 0),
      limit,
      offset,
      query: q || null,
      status: status || null,
    })
  } catch (error) {
    console.error('studio products failed', error)
    return json(res, 502, { message: 'Catalogue unavailable' })
  }
}
