(() => {
  const root = document.querySelector('#new-piece-layer')
  if (!root) return

  let loadedProductId = null
  let loading = false
  let busy = false
  let confirming = false
  let pricingState = null
  let planPayload = null
  let errorMessage = ''
  let successMessage = ''
  let mode = 'uniform'
  let uniform = { regular: '', sale: '' }
  let variantValues = new Map()

  function studioApi() { return window.CoquetteNewPiece }
  function currentProduct() { return studioApi()?.getProduct?.() || null }
  function onPricingStep() { return studioApi()?.currentStep?.() === 5 && !root.hidden }

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
      const error = new Error(payload.message || 'Pricing request failed')
      error.code = payload.code
      throw error
    }
    return payload
  }

  function euro(value) {
    if (value == null || value === '') return '—'
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return String(value)
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(numeric)
  }

  function variantRows() {
    return Array.isArray(pricingState?.variants) ? pricingState.variants : []
  }

  function hydrateState(payload) {
    pricingState = payload
    mode = payload?.suggested_mode === 'per_variant' ? 'per_variant' : 'uniform'
    const rows = variantRows()
    const first = rows[0]
    uniform = {
      regular: first?.regular || '',
      sale: first?.sale || '',
    }
    variantValues = new Map(rows.map((row) => [row.variant_id, {
      regular: row.regular || '',
      sale: row.sale || '',
    }]))
    planPayload = null
    confirming = false
  }

  function pricingRequest() {
    if (mode === 'uniform') {
      return {
        mode,
        uniform: {
          regular: String(uniform.regular || '').trim(),
          sale: String(uniform.sale || '').trim() || null,
        },
      }
    }
    return {
      mode,
      variants: variantRows().map((variant) => {
        const values = variantValues.get(variant.variant_id) || { regular: '', sale: '' }
        return {
          variant_id: variant.variant_id,
          regular: String(values.regular || '').trim(),
          sale: String(values.sale || '').trim() || null,
        }
      }),
    }
  }

  function invalidatePlan() {
    planPayload = null
    confirming = false
    errorMessage = ''
    successMessage = ''
  }

  function modeMarkup() {
    return `<div class="np-pricing-mode" role="radiogroup" aria-label="Pricing mode">
      <label class="np-price-choice"><input type="radio" name="np-price-mode" value="uniform" ${mode === 'uniform' ? 'checked' : ''} ${busy ? 'disabled' : ''}/><span><strong>Same price for every choice</strong><small>One regular price, with an optional sale price.</small></span></label>
      <label class="np-price-choice"><input type="radio" name="np-price-mode" value="per_variant" ${mode === 'per_variant' ? 'checked' : ''} ${busy ? 'disabled' : ''}/><span><strong>Price choices separately</strong><small>Set each size / colour variant explicitly.</small></span></label>
    </div>`
  }

  function moneyInput(name, label, value, hint = '') {
    return `<label class="np-price-field"><span>${escapeHtml(label)}${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</span><div class="np-money"><b>€</b><input type="text" inputmode="decimal" autocomplete="off" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="0.00" ${busy ? 'disabled' : ''}/></div></label>`
  }

  function editorMarkup() {
    if (mode === 'uniform') {
      return `<div class="np-pricing-uniform">
        ${moneyInput('np-regular', 'Regular price', uniform.regular)}
        ${moneyInput('np-sale', 'Sale price · optional', uniform.sale, 'Must be lower than regular price')}
      </div>`
    }
    return `<div class="np-pricing-variants">
      <div class="np-pricing-row np-pricing-row-head"><span>Choice</span><span>Regular</span><span>Sale · optional</span></div>
      ${variantRows().map((variant) => {
        const values = variantValues.get(variant.variant_id) || { regular: '', sale: '' }
        return `<div class="np-pricing-row" data-price-variant="${escapeHtml(variant.variant_id)}">
          <div class="np-price-variant-name"><strong>${escapeHtml(variant.title || 'Variant')}</strong><small>${escapeHtml(variant.sku || variant.barcode || 'No SKU yet')}</small></div>
          <div class="np-money compact"><b>€</b><input type="text" inputmode="decimal" autocomplete="off" data-price-regular value="${escapeHtml(values.regular)}" placeholder="0.00" ${busy ? 'disabled' : ''}/></div>
          <div class="np-money compact"><b>€</b><input type="text" inputmode="decimal" autocomplete="off" data-price-sale value="${escapeHtml(values.sale)}" placeholder="—" ${busy ? 'disabled' : ''}/></div>
        </div>`
      }).join('')}
    </div>`
  }

  function changeBadge(action) {
    if (action === 'unchanged') return '<span class="np-price-action quiet">No change</span>'
    if (action === 'remove') return '<span class="np-price-action remove">Remove sale</span>'
    if (action === 'create') return '<span class="np-price-action create">Add</span>'
    return '<span class="np-price-action update">Update</span>'
  }

  function planMarkup() {
    const plan = planPayload?.plan
    if (!plan) return ''
    return `<section class="np-price-plan">
      <div class="np-price-plan-head"><div><span>Server-verified pricing plan</span><strong>${Number(plan.change_count || 0)} ${Number(plan.change_count || 0) === 1 ? 'change' : 'changes'}</strong></div><b>EUR</b></div>
      <div class="np-price-plan-list">${(plan.variants || []).map((line) => `
        <div class="np-price-plan-row">
          <div><strong>${escapeHtml(line.title || 'Variant')}</strong><small>Current ${euro(line.current_regular)}${line.current_sale ? ` · sale ${euro(line.current_sale)}` : ''}</small></div>
          <div class="np-price-plan-target"><span>${euro(line.regular)}${line.sale ? ` → ${euro(line.sale)}` : ''}</span><small>${changeBadge(line.regular_action)} ${changeBadge(line.sale_action)}</small></div>
        </div>`).join('')}</div>
    </section>`
  }

  function confirmationMarkup() {
    const plan = planPayload?.plan
    if (!plan || !confirming) return ''
    return `<section class="np-price-confirm">
      <span>Final price confirmation</span>
      <strong>Apply these exact EUR prices now?</strong>
      <p>This changes only regular/sale pricing for the reviewed variants. Stock, SKU, backorders, placement, sales channels and publication remain untouched.</p>
      <div><button type="button" data-price-cancel ${busy ? 'disabled' : ''}>Not yet</button><button type="button" class="apply" data-price-confirm ${busy ? 'disabled' : ''}>${busy ? 'Applying safely…' : 'Apply reviewed prices'}</button></div>
    </section>`
  }

  function blockedMarkup() {
    const message = pricingState?.message || 'Pricing is protected until the existing Medusa pricing state is reconciled.'
    return `<section class="np-pricing-panel blocked" id="np-pricing-panel">
      <div class="np-pricing-head"><div><span>Price & availability</span><strong>Protected from overwrite.</strong></div><b>Blocked</b></div>
      <div class="np-price-message error">${escapeHtml(message)}</div>
      <p>COQUETTE Studio will not replace conditional pricing or an active sale price created outside this guarded workflow.</p>
    </section>`
  }

  function waitingMarkup(message, badge = 'Guarded') {
    return `<section class="np-pricing-panel" id="np-pricing-panel">
      <div class="np-pricing-head"><div><span>Price & availability</span><strong>${escapeHtml(message)}</strong></div><b>${escapeHtml(badge)}</b></div>
      <div class="np-pricing-safety"><span>Prices only</span><span>No stock</span><span>No publication</span><span>No sales channel changes</span></div>
    </section>`
  }

  function panelMarkup() {
    if (loading) return waitingMarkup('Reading live Medusa prices…', 'Loading')
    if (!pricingState) return waitingMarkup('Pricing state is not loaded yet.')
    if (pricingState.ready === false && pricingState.code === 'variant_graph_required') {
      return `<section class="np-pricing-panel" id="np-pricing-panel"><div class="np-pricing-head"><div><span>Price & availability</span><strong>Build choices first.</strong></div><b>Step 04</b></div><p>The variant graph is the identity boundary for pricing. Return to Choices and build the reviewed size / colour structure before entering prices.</p></section>`
    }
    if (pricingState.ready === false) return blockedMarkup()

    return `<section class="np-pricing-panel" id="np-pricing-panel">
      <div class="np-pricing-head"><div><span>Price & availability</span><strong>Set what the customer will pay.</strong></div><b>Guarded</b></div>
      <p>Amounts are never inferred. Enter the exact EUR regular price and, only if intended, a lower sale price.</p>
      ${modeMarkup()}
      ${editorMarkup()}
      <div class="np-pricing-safety"><span>EUR only</span><span>No stock changes</span><span>Draft stays private</span><span>Review before write</span></div>
      ${errorMessage ? `<div class="np-price-message error">${escapeHtml(errorMessage)}</div>` : ''}
      ${successMessage ? `<div class="np-price-message success">${escapeHtml(successMessage)}</div>` : ''}
      ${planMarkup()}
      ${confirmationMarkup()}
      <div class="np-pricing-actions">
        <button type="button" data-price-reload ${busy ? 'disabled' : ''}>Reload live prices</button>
        ${confirming ? '' : planPayload?.plan ? `<button type="button" class="apply" data-price-apply ${busy ? 'disabled' : ''}>Apply reviewed prices →</button>` : `<button type="button" class="review" data-price-review ${busy ? 'disabled' : ''}>${busy ? 'Checking prices…' : 'Review prices →'}</button>`}
      </div>
    </section>`
  }

  function renderPanel() {
    if (!onPricingStep()) return
    const current = root.querySelector('#np-pricing-panel')
    if (!current) return
    const wrapper = document.createElement('div')
    wrapper.innerHTML = panelMarkup()
    const next = wrapper.firstElementChild
    if (next) current.replaceWith(next)
    bindPanel()
  }

  async function loadPricingState({ preserveInputs = false } = {}) {
    const product = currentProduct()
    if (!product?.id || loading || busy) return
    loading = true
    errorMessage = ''
    successMessage = ''
    renderPanel()
    try {
      const payload = await requestJson(`/api/studio/pricing-state?product_id=${encodeURIComponent(product.id)}`)
      if (preserveInputs) {
        pricingState = payload
      } else {
        hydrateState(payload)
      }
      loadedProductId = product.id
    } catch (error) {
      pricingState = null
      errorMessage = error.message || 'Live pricing state could not be loaded.'
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

  async function reviewPrices() {
    if (busy || !pricingState?.ready) return
    busy = true
    errorMessage = ''
    successMessage = ''
    planPayload = null
    confirming = false
    renderPanel()
    try {
      const product = await freshProduct()
      planPayload = await requestJson('/api/studio/pricing-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          expected_updated_at: product.updated_at || pricingState.expected_updated_at || '',
          pricing: pricingRequest(),
        }),
      })
    } catch (error) {
      errorMessage = error.code === 'stale_draft'
        ? 'The draft changed elsewhere. Reload it before reviewing prices.'
        : error.message || 'The requested prices could not be reviewed safely.'
    } finally {
      busy = false
      renderPanel()
    }
  }

  async function applyPrices() {
    const approved = planPayload?.plan
    if (busy || !approved?.pricing_hash) return
    busy = true
    errorMessage = ''
    successMessage = ''
    renderPanel()
    try {
      const product = await freshProduct()
      const request = pricingRequest()
      const refreshed = await requestJson('/api/studio/pricing-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          expected_updated_at: product.updated_at || '',
          pricing: request,
        }),
      })
      if (!refreshed.ready || refreshed.plan?.pricing_hash !== approved.pricing_hash) {
        planPayload = refreshed
        confirming = false
        throw new Error('The live pricing state changed after review. Check the refreshed plan before applying it.')
      }

      await requestJson('/api/studio/pricing-apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          expected_updated_at: product.updated_at || '',
          pricing_hash: approved.pricing_hash,
          pricing: request,
        }),
      })

      const latest = await requestJson(`/api/studio/pricing-state?product_id=${encodeURIComponent(product.id)}`)
      hydrateState(latest)
      successMessage = 'Reviewed prices are now saved in Medusa. The product is still an unpublished draft.'
      confirming = false
    } catch (error) {
      errorMessage = error.code === 'stale_pricing_plan'
        ? 'Pricing changed after review. Refresh the plan before applying it.'
        : error.code === 'stale_draft'
          ? 'The draft changed elsewhere. Reload it before applying prices.'
          : error.message || 'Prices could not be applied safely.'
      confirming = false
    } finally {
      busy = false
      renderPanel()
    }
  }

  function bindEditor() {
    root.querySelectorAll('[name="np-price-mode"]').forEach((control) => {
      control.addEventListener('change', () => {
        if (busy) return
        const nextMode = control.value === 'per_variant' ? 'per_variant' : 'uniform'
        if (nextMode === mode) return
        if (nextMode === 'per_variant' && mode === 'uniform') {
          variantRows().forEach((variant) => {
            const existing = variantValues.get(variant.variant_id) || { regular: '', sale: '' }
            variantValues.set(variant.variant_id, {
              regular: uniform.regular || existing.regular,
              sale: uniform.sale || existing.sale,
            })
          })
        }
        mode = nextMode
        invalidatePlan()
        renderPanel()
      })
    })

    const regular = root.querySelector('[name="np-regular"]')
    const sale = root.querySelector('[name="np-sale"]')
    regular?.addEventListener('input', () => { uniform.regular = regular.value; invalidatePlan() })
    sale?.addEventListener('input', () => { uniform.sale = sale.value; invalidatePlan() })

    root.querySelectorAll('[data-price-variant]').forEach((row) => {
      const id = row.dataset.priceVariant
      const regularInput = row.querySelector('[data-price-regular]')
      const saleInput = row.querySelector('[data-price-sale]')
      const sync = () => {
        variantValues.set(id, {
          regular: regularInput?.value || '',
          sale: saleInput?.value || '',
        })
        invalidatePlan()
      }
      regularInput?.addEventListener('input', sync)
      saleInput?.addEventListener('input', sync)
    })
  }

  function bindPanel() {
    const panel = root.querySelector('#np-pricing-panel')
    if (!panel || panel.dataset.bound === 'true') return
    panel.dataset.bound = 'true'
    bindEditor()
    panel.querySelector('[data-price-reload]')?.addEventListener('click', () => loadPricingState())
    panel.querySelector('[data-price-review]')?.addEventListener('click', reviewPrices)
    panel.querySelector('[data-price-apply]')?.addEventListener('click', () => { confirming = true; renderPanel() })
    panel.querySelector('[data-price-cancel]')?.addEventListener('click', () => { confirming = false; renderPanel() })
    panel.querySelector('[data-price-confirm]')?.addEventListener('click', applyPrices)
  }

  function enhancePricingStep() {
    if (!onPricingStep()) return
    const card = root.querySelector('.new-piece-form-card')
    if (!card) return

    const intro = root.querySelector('.new-piece-intro>p')
    if (intro) {
      intro.textContent = 'Set regular and sale pricing through an explicit server-reviewed action. Inventory remains a separate guarded step.'
    }

    const safety = card.querySelector('.new-piece-safety')
    if (safety) safety.remove()

    let panel = card.querySelector('#np-pricing-panel')
    if (!panel) {
      const nav = card.querySelector('.new-piece-nav')
      if (nav) nav.insertAdjacentHTML('beforebegin', panelMarkup())
      else card.insertAdjacentHTML('afterbegin', panelMarkup())
      panel = card.querySelector('#np-pricing-panel')
    }
    if (panel) bindPanel()

    const product = currentProduct()
    if (product?.id && loadedProductId !== product.id && !loading && !busy) {
      queueMicrotask(() => loadPricingState())
    }
  }

  const observer = new MutationObserver(() => queueMicrotask(enhancePricingStep))
  observer.observe(root, { childList: true, subtree: true })
  document.addEventListener('DOMContentLoaded', enhancePricingStep)
  enhancePricingStep()
})()
