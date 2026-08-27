(() => {
  const root = document.querySelector('#new-piece-layer')
  if (!root) return

  let loadedProductId = null
  let loading = false
  let busy = false
  let confirming = false
  let inventoryState = null
  let planPayload = null
  let errorMessage = ''
  let successMessage = ''
  let quantities = new Map()

  function studioApi() { return window.CoquetteNewPiece }
  function currentProduct() { return studioApi()?.getProduct?.() || null }
  function onInventoryStep() { return studioApi()?.currentStep?.() === 5 && !root.hidden }

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
      const error = new Error(payload.message || 'Inventory request failed')
      error.code = payload.code
      throw error
    }
    return payload
  }

  function variants() { return Array.isArray(inventoryState?.variants) ? inventoryState.variants : [] }
  function locations() { return Array.isArray(inventoryState?.locations) ? inventoryState.locations : [] }
  function key(variantId, locationId) { return `${variantId}::${locationId}` }

  function hydrateState(payload) {
    inventoryState = payload
    quantities = new Map()
    variants().forEach((variant) => {
      ;(variant.levels || []).forEach((level) => {
        quantities.set(
          key(variant.variant_id, level.location_id),
          level.stocked_quantity == null ? '' : String(level.stocked_quantity)
        )
      })
    })
    planPayload = null
    confirming = false
  }

  function invalidatePlan() {
    planPayload = null
    confirming = false
    errorMessage = ''
    successMessage = ''
  }

  function inventoryRequest() {
    return {
      variants: variants().map((variant) => ({
        variant_id: variant.variant_id,
        locations: locations().map((location) => {
          const raw = String(quantities.get(key(variant.variant_id, location.location_id)) ?? '').trim()
          if (!/^\d+$/.test(raw)) {
            throw new Error(`Enter an explicit whole-piece stock quantity for ${variant.title || 'this variant'} at ${location.name || 'the stock location'}. Use 0 when there are no pieces.`)
          }
          const numeric = Number(raw)
          if (!Number.isSafeInteger(numeric) || numeric < 0 || numeric > 1_000_000_000) {
            throw new Error('Stock quantities must be whole pieces between 0 and 1,000,000,000.')
          }
          return { location_id: location.location_id, stocked_quantity: numeric }
        }),
      })),
    }
  }

  function actionBadge(action) {
    if (action === 'create') return '<span class="np-stock-action create">Create</span>'
    if (action === 'update') return '<span class="np-stock-action update">Update</span>'
    return '<span class="np-stock-action quiet">No change</span>'
  }

  function editorMarkup() {
    return `<div class="np-stock-grid">${variants().map((variant) => `
      <section class="np-stock-variant" data-stock-variant="${escapeHtml(variant.variant_id)}">
        <div class="np-stock-variant-head"><div><strong>${escapeHtml(variant.title || 'Variant')}</strong><small>${escapeHtml(variant.sku || variant.barcode || 'No SKU / barcode')}</small></div><small>${variant.inventory_item_id ? 'Inventory item linked' : 'Inventory item will be created after review'}</small></div>
        <div class="np-stock-levels">${locations().map((location) => {
          const level = (variant.levels || []).find((item) => item.location_id === location.location_id)
          const value = quantities.get(key(variant.variant_id, location.location_id)) ?? ''
          return `<label class="np-stock-level" data-stock-location="${escapeHtml(location.location_id)}">
            <span class="np-stock-location"><strong>${escapeHtml(location.name || 'Stock location')}</strong><small>${level?.stocked_quantity == null ? 'No stock level yet' : `Live on hand: ${escapeHtml(level.stocked_quantity)}${level?.incoming_quantity ? ` · incoming ${escapeHtml(level.incoming_quantity)}` : ''}`}</small></span>
            <span class="np-stock-input"><input type="number" min="0" max="1000000000" step="1" inputmode="numeric" data-stock-quantity value="${escapeHtml(value)}" placeholder="0" ${busy ? 'disabled' : ''}/><span>pieces</span></span>
          </label>`
        }).join('')}</div>
      </section>`).join('')}</div>`
  }

  function planMarkup() {
    const plan = planPayload?.plan
    if (!plan) return ''
    return `<section class="np-inventory-plan">
      <div class="np-inventory-plan-head"><div><span>Server-verified stock plan</span><strong>${Number(plan.change_count || 0)} ${Number(plan.change_count || 0) === 1 ? 'change' : 'changes'}</strong></div><span>On-hand pieces</span></div>
      <div class="np-inventory-plan-list">${(plan.variants || []).map((variant) => `
        <div class="np-inventory-plan-row">
          <strong>${escapeHtml(variant.title || 'Variant')}</strong>
          <small>${variant.inventory_item_action === 'create' ? 'Create one Medusa inventory item · required quantity 1' : 'Use the existing Medusa inventory item'}${variant.manage_inventory_action === 'enable' ? ' · enable stock tracking' : ''}</small>
          <div class="np-inventory-plan-levels">${(variant.locations || []).map((level) => `
            <div class="np-inventory-plan-level"><span>${escapeHtml(level.location_name)} · ${level.current_stocked_quantity == null ? 'not configured' : escapeHtml(level.current_stocked_quantity)} → <strong>${escapeHtml(level.intended_stocked_quantity)}</strong></span>${actionBadge(level.action)}</div>`).join('')}</div>
        </div>`).join('')}</div>
    </section>`
  }

  function confirmationMarkup() {
    const plan = planPayload?.plan
    if (!plan || !confirming) return ''
    return `<section class="np-inventory-confirm">
      <span>Final stock confirmation</span>
      <strong>Apply these exact on-hand quantities now?</strong>
      <p>Studio will create missing native Medusa inventory items/levels where required and enable stock tracking. Prices, SKU/EAN/UPC/barcode, backorders, sales channels and publication stay unchanged.</p>
      <div><button type="button" data-stock-cancel ${busy ? 'disabled' : ''}>Not yet</button><button type="button" class="apply" data-stock-confirm ${busy ? 'disabled' : ''}>${busy ? 'Applying safely…' : 'Apply reviewed stock'}</button></div>
    </section>`
  }

  function waitingMarkup(message, badge = 'Guarded') {
    return `<section class="np-inventory-panel" id="np-inventory-panel"><div class="np-inventory-head"><div><span>Stock & locations</span><strong>${escapeHtml(message)}</strong></div><b>${escapeHtml(badge)}</b></div><div class="np-inventory-safety"><span>Whole pieces only</span><span>No guessing</span><span>No backorders</span><span>Draft stays private</span></div></section>`
  }

  function blockedMarkup() {
    return `<section class="np-inventory-panel blocked" id="np-inventory-panel"><div class="np-inventory-head"><div><span>Stock & locations</span><strong>Protected from unsafe overwrite.</strong></div><b>Blocked</b></div><div class="np-inventory-message error">${escapeHtml(inventoryState?.message || 'Inventory must be reconciled in Medusa before Studio can edit it.')}</div><p>Studio will not flatten inventory kits, overwrite stock with active reservations, or repair ambiguous inventory topology automatically.</p></section>`
  }

  function panelMarkup() {
    if (loading) return waitingMarkup('Reading live Medusa stock…', 'Loading')
    if (!inventoryState) return waitingMarkup('Stock state is not loaded yet.')
    if (inventoryState.ready === false && inventoryState.code === 'variant_graph_required') {
      return waitingMarkup('Build product choices before entering stock.', 'Step 04')
    }
    if (inventoryState.ready === false) return blockedMarkup()

    return `<section class="np-inventory-panel" id="np-inventory-panel">
      <div class="np-inventory-head"><div><span>Stock & locations</span><strong>How many pieces are physically on hand?</strong></div><b>Guarded</b></div>
      <p>Enter the exact physical count for every choice and stock location. Use 0 explicitly when no piece is available. Reserved units are calculated by Medusa and are never edited here.</p>
      ${editorMarkup()}
      <div class="np-inventory-safety"><span>On-hand quantity</span><span>Whole pieces</span><span>Native Medusa inventory</span><span>Review before write</span></div>
      ${errorMessage ? `<div class="np-inventory-message error">${escapeHtml(errorMessage)}</div>` : ''}
      ${successMessage ? `<div class="np-inventory-message success">${escapeHtml(successMessage)}</div>` : ''}
      ${planMarkup()}
      ${confirmationMarkup()}
      <div class="np-inventory-actions"><button type="button" data-stock-reload ${busy ? 'disabled' : ''}>Reload live stock</button>${confirming ? '' : planPayload?.plan ? `<button type="button" class="apply" data-stock-apply ${busy ? 'disabled' : ''}>Apply reviewed stock →</button>` : `<button type="button" class="review" data-stock-review ${busy ? 'disabled' : ''}>${busy ? 'Checking stock…' : 'Review stock →'}</button>`}</div>
    </section>`
  }

  function renderPanel() {
    if (!onInventoryStep()) return
    const current = root.querySelector('#np-inventory-panel')
    if (!current) return
    const wrapper = document.createElement('div')
    wrapper.innerHTML = panelMarkup()
    const next = wrapper.firstElementChild
    if (next) current.replaceWith(next)
    bindPanel()
  }

  async function freshProduct() {
    const product = currentProduct()
    if (!product?.id) throw new Error('Open a Studio draft first.')
    const detail = await requestJson(`/api/studio/product?id=${encodeURIComponent(product.id)}`)
    studioApi()?.mergeProduct?.(detail.product, false)
    return currentProduct()
  }

  async function loadInventoryState() {
    const product = currentProduct()
    if (!product?.id || loading || busy) return
    loading = true
    errorMessage = ''
    successMessage = ''
    renderPanel()
    try {
      const payload = await requestJson(`/api/studio/inventory-state?product_id=${encodeURIComponent(product.id)}`)
      hydrateState(payload)
      loadedProductId = product.id
    } catch (error) {
      inventoryState = null
      errorMessage = error.message || 'Live stock could not be loaded.'
    } finally {
      loading = false
      renderPanel()
    }
  }

  async function reviewStock() {
    if (busy || !inventoryState?.ready) return
    busy = true
    errorMessage = ''
    successMessage = ''
    planPayload = null
    confirming = false
    renderPanel()
    try {
      const request = inventoryRequest()
      const product = await freshProduct()
      planPayload = await requestJson('/api/studio/inventory-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, expected_updated_at: product.updated_at || inventoryState.expected_updated_at || '', inventory: request }),
      })
    } catch (error) {
      errorMessage = error.code === 'stale_draft' ? 'The draft changed elsewhere. Reload it before reviewing stock.' : error.message || 'The requested stock could not be reviewed safely.'
    } finally {
      busy = false
      renderPanel()
    }
  }

  async function applyStock() {
    const approved = planPayload?.plan
    if (busy || !approved?.inventory_hash) return
    busy = true
    errorMessage = ''
    successMessage = ''
    renderPanel()
    try {
      const request = inventoryRequest()
      const product = await freshProduct()
      const refreshed = await requestJson('/api/studio/inventory-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, expected_updated_at: product.updated_at || '', inventory: request }),
      })
      if (!refreshed.ready || refreshed.plan?.inventory_hash !== approved.inventory_hash) {
        planPayload = refreshed
        confirming = false
        throw new Error('The live stock state changed after review. Check the refreshed plan before applying it.')
      }
      await requestJson('/api/studio/inventory-apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, expected_updated_at: product.updated_at || '', inventory_hash: approved.inventory_hash, inventory: request }),
      })
      const latest = await requestJson(`/api/studio/inventory-state?product_id=${encodeURIComponent(product.id)}`)
      hydrateState(latest)
      successMessage = 'Reviewed on-hand stock is now saved in Medusa. The product remains an unpublished draft.'
      confirming = false
    } catch (error) {
      errorMessage = error.code === 'stale_inventory_plan' ? 'Stock changed after review. Refresh the plan before applying it.' : error.code === 'stale_draft' ? 'The draft changed elsewhere. Reload it before applying stock.' : error.message || 'Stock could not be applied safely.'
      confirming = false
    } finally {
      busy = false
      renderPanel()
    }
  }

  function bindPanel() {
    const panel = root.querySelector('#np-inventory-panel')
    if (!panel || panel.dataset.bound === 'true') return
    panel.dataset.bound = 'true'
    panel.querySelectorAll('[data-stock-variant]').forEach((variantEl) => {
      const variantId = variantEl.dataset.stockVariant
      variantEl.querySelectorAll('[data-stock-location]').forEach((locationEl) => {
        const locationId = locationEl.dataset.stockLocation
        const input = locationEl.querySelector('[data-stock-quantity]')
        input?.addEventListener('input', () => {
          quantities.set(key(variantId, locationId), input.value)
          invalidatePlan()
        })
      })
    })
    panel.querySelector('[data-stock-reload]')?.addEventListener('click', loadInventoryState)
    panel.querySelector('[data-stock-review]')?.addEventListener('click', reviewStock)
    panel.querySelector('[data-stock-apply]')?.addEventListener('click', () => { confirming = true; renderPanel() })
    panel.querySelector('[data-stock-cancel]')?.addEventListener('click', () => { confirming = false; renderPanel() })
    panel.querySelector('[data-stock-confirm]')?.addEventListener('click', applyStock)
  }

  function enhanceInventoryStep() {
    if (!onInventoryStep()) return
    const card = root.querySelector('.new-piece-form-card')
    if (!card) return
    let panel = card.querySelector('#np-inventory-panel')
    if (!panel) {
      const pricingPanel = card.querySelector('#np-pricing-panel')
      const nav = card.querySelector('.new-piece-nav')
      if (pricingPanel) pricingPanel.insertAdjacentHTML('afterend', panelMarkup())
      else if (nav) nav.insertAdjacentHTML('beforebegin', panelMarkup())
      else card.insertAdjacentHTML('beforeend', panelMarkup())
      panel = card.querySelector('#np-inventory-panel')
    }
    if (panel) bindPanel()
    const product = currentProduct()
    if (product?.id && loadedProductId !== product.id && !loading && !busy) {
      queueMicrotask(loadInventoryState)
    }
  }

  const observer = new MutationObserver(() => queueMicrotask(enhanceInventoryStep))
  observer.observe(root, { childList: true, subtree: true })
  document.addEventListener('DOMContentLoaded', enhanceInventoryStep)
  enhanceInventoryStep()
})()