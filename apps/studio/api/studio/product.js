const { admin, json } = require('../../lib/medusa')

function cleanId(value) {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return ''
  const id = raw.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ''
}

function mapVariant(variant) {
  const prices = Array.isArray(variant?.prices)
    ? variant.prices
        .filter((price) => typeof price?.amount === 'number')
        .map((price) => ({ amount: price.amount, currency_code: price.currency_code || null }))
    : []
  return {
    id: variant.id,
    title: variant.title || 'Variant',
    sku: variant.sku || null,
    barcode: variant.barcode || null,
    manage_inventory: Boolean(variant.manage_inventory),
    allow_backorder: Boolean(variant.allow_backorder),
    prices,
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { message: 'Method not allowed' })
  const id = cleanId(req.query?.id)
  if (!id) return json(res, 400, { message: 'Valid product id required' })

  const params = new URLSearchParams({
    fields: '+metadata,*images,*variants,*variants.prices,*options,*categories,*collection',
  })

  try {
    const result = await admin(req, `/admin/products/${encodeURIComponent(id)}?${params.toString()}`)
    if (result.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (result.response?.status === 404) return json(res, 404, { message: 'Product not found' })
    if (!result.response?.ok || !result.payload?.product) {
      console.error('studio product detail failed', result.response?.status, result.payload)
      return json(res, 502, { message: 'Product unavailable' })
    }

    const product = result.payload.product
    return json(res, 200, {
      product: {
        id: product.id,
        title: product.title,
        subtitle: product.subtitle || null,
        description: product.description || null,
        handle: product.handle || null,
        status: product.status || 'draft',
        thumbnail: product.thumbnail || product.images?.[0]?.url || null,
        images: Array.isArray(product.images) ? product.images.map((image) => ({ id: image.id, url: image.url })) : [],
        variants: Array.isArray(product.variants) ? product.variants.map(mapVariant) : [],
        options: Array.isArray(product.options) ? product.options.map((option) => ({ id: option.id, title: option.title })) : [],
        categories: Array.isArray(product.categories) ? product.categories.map((category) => ({ id: category.id, name: category.name })) : [],
        collection: product.collection ? { id: product.collection.id, title: product.collection.title } : null,
        metadata: product.metadata && typeof product.metadata === 'object' ? product.metadata : {},
        created_at: product.created_at || null,
        updated_at: product.updated_at || null,
      },
    })
  } catch (error) {
    console.error('studio product detail failed', error)
    return json(res, 502, { message: 'Product unavailable' })
  }
}
