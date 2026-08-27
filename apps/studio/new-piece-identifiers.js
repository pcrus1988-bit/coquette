(() => {
  const root = document.querySelector('#new-piece-layer')
  if (!root) return

  let loadedProductId = null
  let loading = false
  let busy = false
  let confirming = false
  let identifierState = null
  let planPayload = null
  let errorMessage = ''
  let successMessage = ''
  let values = new Map()

  function studioApi() { return window.CoquetteNewPiece }
  function currentProduct() { return studioApi()?.getProduct?.() || null }
  function onIdentifierStep() { return studioApi()?.currentStep?.() === 4 && !root.hidden }
  function isGenerated(product = currentProduct()) {
    return product?.metadata?.coquette_studio_variants_generated === 'true'
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options })
    if (response.status === 401) {
      window.location.replace('/')
      throw new Error('Unauthorized')
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload.message || 'Variant identifier request failed')
      error.code = payload.code
      throw error
    }
    return payload
  }

  function clean(value) {
    const text = String(value ?? '').trim()
    return text || null
  }

  function variantRows() {
    return Array.isArray(identifierState?.variants) ? identifierState.variants : []
  }

  function hydrateState(payload) {
    identifierState = payload
    values = new Map((payload?.variants || []).map((variant) => [variant.variant_id, {
      sku: variant.sku || '',
      ean: variant.ean || '',
      upc: variant.upc || '',
      barcode: variant.barcode || '',
    }]))
    planPayload = null
    confirming = false
  }

  function identifierRequest() {
    return {
      variants: variantRows().map((variant) => {
        const row = values.get(variant.variant_id) || {}
        return {
          variant_id: variant.variant_id,
          sku: clean(row.sku),
          ean: clean(row.ean),
          upc: clean(row.upc),
          barcode: clean(row.barcode),
        }
      }),
    }
  }

  function waitingMarkup(message, badge = 'Guarded') {
    return `<section class="np-id-panel" id="np-identifier-panel">
      <div class="np-id-head"><div><span>Variant identity</span><strong>${escapeHtml(message)}</strong></div><b>${escapeHtml(badge)}</b></div>
      <div class="np-id-safety"><span>No generated codes</span><span>No price changes</span><span>No stock changes</span><span>Draft stays private</span></div>
    </section>`
  }

  function blockedMarkup() {
    return `<section class="np-id-panel blocked" id="np-identifier-panel">
      <div class="np-id-head"><div><span>Variant identity</span><strong>Protected from overwrite.</strong></div><b>Blocked</b></div>
      <div class="np-id-message error">${escapeHtml(identifierState?.message || 'Variant identifiers cannot be changed safely in this state.')}</div>
      <p>COQUETTE Studio will not invent, merge or replace identifiers outside the guarded draft flow.</p>
    </section>`
  }

  function inputField(field, label, value, hint = '') {
    return `<label class="np-id-field"><span>${escapeHtml(label)}${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</span><input type="text" autocomplete="off" spellcheck="false" data-id-field="${escapeHtml(field)}" value="${escapeHtml(value || '')}" ${busy ? 'disabled' : ''}/></label>`
  }

  function editorMarkup() {
    return `<div class="np-id-editor">${variantRows().map((variant) => {
      const row = values.get(variant.variant_id) || {}
      return `<article class="np-id-row" data-id-variant="${escapeHtml(variant.variant_id)}">
        <header><div><span>Variant</span><strong>${escapeHtml(variant.title || 'Choice')}</strong></div><small>${escapeHtml(variant.variant_id)}</small></header>
        <div class="np-id-fields">
          ${inputField('sku', 'SKU', row.sku, 'Your own stock code')}
          ${inputField('ean', 'EAN', row.ean, 'Valid EAN-8 / EAN-13 only')}
          ${inputField('upc', 'UPC', row.upc, 'Valid 12-digit UPC-A only')}
          ${inputField('barcode', 'Barcode', row.barcode, 'Only when you know the exact value')}
        </div>
      </article>`
    }).join('')}</div>`
  }

  function actionBadge(action) {
    if (action === 'unchanged') return '<span class="np-id-action quiet">No change</span>'
    if (action === 'clear') return '<span class="np-id-action clear">Clear</span>'
    return '<span class="np-id-action set">Set</span>'
  }

  function valuePair(label, current, intended, action) {
    if (action === 'unchanged') return ''
    return `<div class="np-id-change"><span>${escapeHtml(label)}</span><strong>${escapeHtml(current || '—')} <i>→</i> ${escapeHtml(intended || '—')}</strong>${actionBadge(action)}</div>`
  }

  function planMarkup() {
    const plan = planPayload?.plan
    if (!plan) return ''
    return `<section class="np-id-plan">
      <div class="np-id-plan-head"><div><span>Server-verified identifier plan</span><strong>${Number(plan.change_count || 0)} ${Number(plan.change_count || 0) === 1 ? 'change' : 'changes'}</strong></div><b>SHA-256</b></div>
      <div class="np-id-plan-list">${(plan.variants || []).map((row) => {
        const changes = [
          valuePair('SKU', row.current?.sku, row.intended?.sku, row.actions?.sku),
          valuePair('EAN', row.current?.ean, row.intended?.ean, row.actions?.ean),
          valuePair('UPC', row.current?.upc, row.intended?.upc, row.actions?.upc),
          valuePair('Barcode', row.current?.barcode, row.intended?.barcode, row.actions?.barcode),
        ].filter(Boolean).join('')
        return `<article><header><span>${escapeHtml(row.title || 'Variant')}</span><small>${escapeHtml(row.variant_id)}</small></header>${changes || '<div class="np-id-unchanged">No identifier changes for this variant.</div>'}</article>`
      }).join('')}</div>
    </section>`
  }

  function confirmationMarkup() {
    const plan = planPayload?.plan
    if (!plan || !confirming) return ''
    return `<section class="np-id-confirm">
      <span>Final identifier confirmation</span>
      <strong>Apply these exact variant codes now?</strong>
      <p>This changes only SKU, EAN, UPC and barcode fields on the reviewed Medusa variants. Prices, inventory, backorders, choices, sales channels and publication remain untouched.</p>
      <div><button type="button" data-id-cancel ${busy ? 'disabled' : ''}>Not yet</button><button type="button" class="apply" data-id-confirm ${busy ? 'disabled' : ''}>${busy ? 'Applying safely…' : 'Apply reviewed codes'}</button></div>
    </section>`
  }

  function panelMarkup() {
    if (loading) return waitingMarkup('Reading live variant codes…', 'Loading')
    if (!identifierState) return waitingMarkup('Variant identity is not loaded yet.')
    if (identifierState.ready === false) return blockedMarkup()

    return `<section class="np-id-panel" id="np-identifier-panel">
      <div class="np-id-head"><div><span>Variant identity</span><strong>Give each real choice the codes you actually use.</strong></div><b>Guarded</b></div>
      <p>Codes are optional, but never inferred. Leave a field blank unless you know its exact value. EAN and UPC check digits are validated before review.</p>
      ${editorMarkup()}
      <div class="np-id-safety"><span>Catalogue-wide collision check</span><span>EAN / UPC check digits</span><span>Review before write</span><span>No commerce-state changes</span></div>
      ${errorMessage ? `<div class="np-id-message error">${escapeHtml(errorMessage)}</div>` : ''}
      ${successMessage ? `<div class="np-id-message success">${escapeHtml(successMessage)}</div>` : ''}
      ${planMarkup()}
      ${confirmationMarkup()}
      <div class="np-id-actions"><button type="button" data-id-reload ${busy ? 'disabled' : ''}>Reload live codes</button><button type="button" class="review" data-id-primary ${busy ? 'disabled' : ''}>${planPayload?.plan ? 'Apply reviewed codes →' : busy ? 'Checking codes…' : 'Review variant codes →'}</button></div>
    </section>`
  }

  function renderPanel() {
    if (!onIdentifierStep() || !isGenerated()) return
    const current = root.querySelector('#np-identifier-panel')
    if (!current) return
    const wrapper = document.createElement('div')
    wrapper.innerHTML = panelMarkup()
    const next = wrapper.firstElementChild
    if (next) current.replaceWith(next)
    bindPanel()
  }

  function invalidatePlanDom() {
    planPayload = null
    confirming = false
    errorMessage = ''
    successMessage = ''
    const panel = root.querySelector('#np-identifier-panel')
    if (!panel) return
    panel.querySelector('.np-id-plan')?.remove()
    panel.querySelector('.np-id-confirm')?.remove()
    panel.querySelectorAll('.np-id-message').forEach((node) => node.remove())
    const primary = panel.querySelector('[data-id-primary]')
    if (primary) primary.textContent = 'Review variant codes →'
  }

  async function loadIdentifierState({ preserveInputs = false } = {}) {
    const product = currentProduct()
    if (!product?.id || loading || busy || !isGenerated(product)) return
    loading = true
    errorMessage = ''
    successMessage = ''
    renderPanel()
    try {
      const payload = await requestJson(`/api/studio/variant-identifiers-state?product_id=${encodeURIComponent(product.id)}`)
      if (preserveInputs) identifierState = payload
      else hydrateState(payload)
      loadedProductId = product.id
    } catch (error) {
      identifierState = null
      errorMessage = error.message || 'Live variant codes could not be loaded.'
    } finally {
      loading = false
      renderPanel()
    }
  }

  async function freshProduct() {
    const product = currentProduct()
    if (!product?.id) throw new Error('Open a Studio draft first.')
    const detail = await requestJson(`/api/studio/product?id=${encodeURIComponent(product.id)}`)
    studioApi()?.mergeProduct?.(detail.product, false)
    return currentProduct()
  }

  async function reviewIdentifiers() {
    if (busy || !identifierState?.ready) return
    busy = true
    errorMessage = ''
    successMessage = ''
    planPayload = null
    confirming = false
    renderPanel()
    try {
      const product = await freshProduct()
      planPayload = await requestJson('/api/studio/variant-identifiers-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          expected_updated_at: product.updated_at || identifierState.expected_updated_at || '',
          identifiers: identifierRequest(),
        }),
      })
    } catch (error) {
      errorMessage = error.code === 'stale_draft'
        ? 'The draft changed elsewhere. Reload it before reviewing variant codes.'
        : error.message || 'The requested variant codes could not be reviewed safely.'
    } finally {
      busy = false
      renderPanel()
    }
  }

  async function applyIdentifiers() {
    const approved = planPayload?.plan
    if (busy || !approved?.identifier_hash) return
    busy = true
    errorMessage = ''
    successMessage = ''
    renderPanel()
    try {
      const product = await freshProduct()
      const identifiers = identifierRequest()
      const refreshed = await requestJson('/api/studio/variant-identifiers-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          expected_updated_at: product.updated_at || identifierState?.expected_updated_at || '',
          identifiers,
        }),
      })
      if (!refreshed.ready || refreshed.plan?.identifier_hash !== approved.identifier_hash) {
        planPayload = refreshed
        confirming = false
        throw new Error('The live variant-code state changed after review. Check the refreshed plan before applying it.')
      }

      const applied = await requestJson('/api/studio/variant-identifiers-apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          expected_updated_at: product.updated_at || identifierState?.expected_updated_at || '',
          identifier_hash: approved.identifier_hash,
          identifiers,
        }),
      })

      if (applied.state) hydrateState(applied.state)
      else await loadIdentifierState()
      successMessage = 'Reviewed variant codes are saved in Medusa. The product remains an unpublished draft.'
      confirming = false
    } catch (error) {
      errorMessage = error.code === 'stale_identifier_plan'
        ? 'Variant codes changed after review. Refresh the plan before applying it.'
        : error.code === 'stale_draft'
          ? 'The draft changed elsewhere. Reload it before applying variant codes.'
          : error.message || 'Variant codes could not be applied safely.'
      confirming = false
    } finally {
      busy = false
      renderPanel()
    }
  }

  function bindEditor() {
    root.querySelectorAll('[data-id-variant]').forEach((row) => {
      const variantId = row.dataset.idVariant
      row.querySelectorAll('[data-id-field]').forEach((input) => {
        input.addEventListener('input', () => {
          const current = values.get(variantId) || { sku: '', ean: '', upc: '', barcode: '' }
          current[input.dataset.idField] = input.value
          values.set(variantId, current)
          invalidatePlanDom()
        })
      })
    })
  }

  function bindPanel() {
    const panel = root.querySelector('#np-identifier-panel')
    if (!panel || panel.dataset.bound === 'true') return
    panel.dataset.bound = 'true'
    bindEditor()
    panel.querySelector('[data-id-reload]')?.addEventListener('click', () => loadIdentifierState())
    panel.querySelector('[data-id-primary]')?.addEventListener('click', () => {
      if (planPayload?.plan) {
        confirming = true
        renderPanel()
      } else {
        reviewIdentifiers()
      }
    })
    panel.querySelector('[data-id-cancel]')?.addEventListener('click', () => {
      confirming = false
      renderPanel()
    })
    panel.querySelector('[data-id-confirm]')?.addEventListener('click', applyIdentifiers)
  }

  function enhanceIdentifierStep() {
    if (!onIdentifierStep()) return
    const product = currentProduct()
    const generated = isGenerated(product)
    const existing = root.querySelector('#np-identifier-panel')

    if (!generated) {
      if (existing) existing.remove()
      return
    }

    const form = root.querySelector('#np-form')
    const builder = form?.querySelector('#np-variant-builder')
    if (!form || !builder) return

    let panel = existing
    if (!panel) {
      builder.insertAdjacentHTML('afterend', panelMarkup())
      panel = root.querySelector('#np-identifier-panel')
    }
    if (panel) bindPanel()

    if (product?.id && loadedProductId !== product.id && !loading && !busy) {
      queueMicrotask(() => loadIdentifierState())
    }
  }

  const observer = new MutationObserver(() => queueMicrotask(enhanceIdentifierStep))
  observer.observe(root, { childList: true, subtree: true })
  document.addEventListener('DOMContentLoaded', enhanceIdentifierStep)
  enhanceIdentifierStep()
})()
