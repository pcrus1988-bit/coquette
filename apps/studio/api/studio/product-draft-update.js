const { admin, json } = require('../../lib/medusa')

const ALLOWED_ORIGINS = new Set(['quick_draft'])
const ALLOWED_CHOICE_MODES = new Set(['one-size', 'size', 'color', 'size-color'])
const LOCKED_CHOICE_METADATA = [
  'coquette_studio_choice_mode',
  'coquette_studio_sizes',
  'coquette_studio_colors',
]

function bodyObject(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return null }
  }
  return null
}

function cleanId(value) {
  if (typeof value !== 'string') return ''
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ''
}

function optionalText(value, max, { nullable = false, required = false } = {}) {
  if (value === null && nullable) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const cleaned = value.trim().slice(0, max)
  if (required && !cleaned) return { ok: false }
  return { ok: true, value: cleaned || (nullable ? null : '') }
}

function slug(value) {
  const parsed = optionalText(value, 200, { nullable: true })
  if (!parsed.ok) return parsed
  if (parsed.value === null) return parsed
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parsed.value)) return { ok: false }
  return parsed
}

function listOfText(value, maxItems = 30, maxLength = 40) {
  if (!Array.isArray(value) || value.length > maxItems) return { ok: false }
  const items = []
  for (const item of value) {
    if (typeof item !== 'string') return { ok: false }
    const cleaned = item.trim().slice(0, maxLength)
    if (!cleaned) continue
    if (!items.includes(cleaned)) items.push(cleaned)
  }
  return { ok: true, value: items }
}

function parseStudioMetadata(input) {
  if (input === undefined) return { ok: true, metadata: {} }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false }
  const metadata = {}

  if ('step' in input) {
    const step = Number(input.step)
    if (!Number.isInteger(step) || step < 1 || step > 8) return { ok: false }
    metadata.coquette_studio_wizard_step = String(step)
  }

  const textFields = [
    ['visual_notes', 'coquette_studio_visual_notes', 1200],
    ['composition', 'coquette_studio_composition', 800],
    ['fit', 'coquette_studio_fit', 800],
    ['care', 'coquette_studio_care', 800],
    ['country', 'coquette_studio_country', 120],
    ['collection_note', 'coquette_studio_collection_note', 500],
    ['seo_title', 'coquette_studio_seo_title', 180],
    ['seo_description', 'coquette_studio_seo_description', 360],
  ]
  for (const [inputKey, metadataKey, max] of textFields) {
    if (!(inputKey in input)) continue
    const parsed = optionalText(input[inputKey], max, { nullable: true })
    if (!parsed.ok) return { ok: false }
    metadata[metadataKey] = parsed.value ?? ''
  }

  if ('choice_mode' in input) {
    if (typeof input.choice_mode !== 'string' || !ALLOWED_CHOICE_MODES.has(input.choice_mode)) return { ok: false }
    metadata.coquette_studio_choice_mode = input.choice_mode
  }
  if ('sizes' in input) {
    const parsed = listOfText(input.sizes)
    if (!parsed.ok) return { ok: false }
    metadata.coquette_studio_sizes = JSON.stringify(parsed.value)
  }
  if ('colors' in input) {
    const parsed = listOfText(input.colors)
    if (!parsed.ok) return { ok: false }
    metadata.coquette_studio_colors = JSON.stringify(parsed.value)
  }
  if ('new_in' in input) {
    if (typeof input.new_in !== 'boolean') return { ok: false }
    metadata.coquette_studio_placement_new_in = String(input.new_in)
  }
  if ('featured' in input) {
    if (typeof input.featured !== 'boolean') return { ok: false }
    metadata.coquette_studio_placement_featured = String(input.featured)
  }

  metadata.coquette_studio_flow = 'guided_new_piece'
  return { ok: true, metadata }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { message: 'Method not allowed' })
  const body = bodyObject(req)
  if (!body) return json(res, 400, { message: 'Invalid JSON body' })

  const id = cleanId(body.id)
  if (!id) return json(res, 400, { message: 'Valid draft id required' })
  const expectedUpdatedAt = typeof body.expected_updated_at === 'string' ? body.expected_updated_at.trim() : ''
  const fields = body.fields
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return json(res, 400, { message: 'Draft fields are required' })
  }

  const update = {}
  if ('title' in fields) {
    const parsed = optionalText(fields.title, 160, { required: true })
    if (!parsed.ok) return json(res, 400, { message: 'A valid product title is required' })
    update.title = parsed.value
  }
  if ('subtitle' in fields) {
    const parsed = optionalText(fields.subtitle, 255, { nullable: true })
    if (!parsed.ok) return json(res, 400, { message: 'Invalid subtitle' })
    update.subtitle = parsed.value
  }
  if ('description' in fields) {
    const parsed = optionalText(fields.description, 10000, { nullable: true })
    if (!parsed.ok) return json(res, 400, { message: 'Invalid description' })
    update.description = parsed.value
  }
  if ('handle' in fields) {
    const parsed = slug(fields.handle)
    if (!parsed.ok) return json(res, 400, { message: 'Handle must contain lowercase letters, numbers and hyphens only' })
    update.handle = parsed.value
  }

  const studioMetadata = parseStudioMetadata(fields.studio)
  if (!studioMetadata.ok) return json(res, 400, { message: 'Invalid New Piece draft data' })

  try {
    const currentResult = await admin(req, `/admin/products/${encodeURIComponent(id)}?fields=+metadata,+updated_at,+status`)
    if (currentResult.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (currentResult.response?.status === 404) return json(res, 404, { message: 'Draft not found' })
    if (!currentResult.response?.ok || !currentResult.payload?.product) {
      return json(res, 502, { message: 'Draft could not be verified' })
    }

    const current = currentResult.payload.product
    if (current.status !== 'draft') {
      return json(res, 409, { message: 'Only unpublished drafts can be edited in New Piece', code: 'not_a_draft' })
    }
    const origin = current.metadata?.coquette_studio_origin
    if (!ALLOWED_ORIGINS.has(origin)) {
      return json(res, 403, { message: 'This draft was not created through the guarded COQUETTE Studio flow' })
    }
    if (current.metadata?.coquette_studio_archived === 'true') {
      return json(res, 409, {
        message: 'This product is archived. Restore it to an editable draft before making changes.',
        code: 'product_archived',
      })
    }
    if (expectedUpdatedAt && current.updated_at && expectedUpdatedAt !== current.updated_at) {
      return json(res, 409, {
        message: 'This draft changed in another session. Reload it before continuing.',
        code: 'stale_draft',
        updated_at: current.updated_at,
      })
    }

    const existingMetadata = current.metadata && typeof current.metadata === 'object' ? current.metadata : {}
    if (existingMetadata.coquette_studio_variants_generated === 'true') {
      const changedLockedChoice = LOCKED_CHOICE_METADATA.some((key) =>
        Object.prototype.hasOwnProperty.call(studioMetadata.metadata, key) &&
        studioMetadata.metadata[key] !== existingMetadata[key]
      )
      if (changedLockedChoice) {
        return json(res, 409, {
          message: 'The size and colour blueprint is locked because its Medusa choices have already been built.',
          code: 'variant_blueprint_locked',
        })
      }
    }

    update.metadata = { ...existingMetadata, ...studioMetadata.metadata }

    const result = await admin(req, `/admin/products/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(update),
    })
    if (result.unauthorized) return json(res, 401, { message: 'Unauthorized' })
    if (!result.response?.ok || !result.payload?.product) {
      console.error('studio draft update failed', result.response?.status, result.payload)
      return json(res, 502, { message: 'Draft changes could not be saved' })
    }

    const product = result.payload.product
    if (product.status !== 'draft') {
      console.error('studio guided draft invariant failed', { productId: product.id, status: product.status })
      return json(res, 500, { message: 'Draft safety invariant failed' })
    }

    return json(res, 200, {
      product: {
        id: product.id,
        title: product.title,
        subtitle: product.subtitle || null,
        description: product.description || null,
        handle: product.handle || null,
        status: product.status,
        metadata: product.metadata && typeof product.metadata === 'object' ? product.metadata : update.metadata,
        updated_at: product.updated_at || null,
      },
    })
  } catch (error) {
    console.error('studio draft update failed', error)
    return json(res, 502, { message: 'Draft changes could not be saved' })
  }
}
