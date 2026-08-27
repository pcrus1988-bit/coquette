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
  let values = new Map()

  function studioApi() { return window.CoquetteNewPiece }
  function currentProduct() { return studioApi()?.getProduct?.() || null }
  function onInventoryStep() { return studioApi()?.currentStep?.() === 5 && !root.hidden }
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
      const error = new Error(payload.message || 'Inventory request failed')
      error.code = payload.code
      throw error
    }
    return payload
  }

  function variantRows() {
    return Array.isArray(inventoryState?.variants) ? inventoryState.variants : []
  }

  function hydrateState(payload) {
    inventoryState = payload
    values = new Map((payload?.variants || []).map((variant) => [
      variant.variant_id,
      String(variant.stocked_quantity ?? 0),
    ]))
    planPayload = null
    confirming = false
  }

  function inventoryRequest() {
    return {
      variants: variantRows().map((variant) => {
        const raw = values.get(variant.variant_id)
        const number = Number(raw)
        return {
          variant_id: variant.variant_id,
          stocked_quantity: Number.isSafeInteger(number) ? number : -1,
        }
      }),
    }
  }

  function waitingMarkup(message, badge = 'Guarded') {
    return `<section class="np-stock-panel" id="np-inventory-panel">
      <div class="np-stock-head"><div><span>Availability</span><strong>${escapeHtml(message)}</strong></div><b>${escapeHtml(badge)}</b></div>
      <div class="np-stock-safety"><span>One reviewed location</span><span>No guessed stock</span><span>Reservations untouched</span><span>Draft stays private</span></div>
    </section>`
  }

  function blockedMarkup() {
    return `<section class="np-stock-panel blocked" id="np-inventory-panel">
      <div class="np-stock-head"><div><span>Availability</span><strong>Protected from an unsafe stock write.</strong></div><b>Blocked</b></div>
      <div class="np-stock-message error">${escapeHtml(errorMessage || 'Inventory cannot be edited safely in this state.')}</div>
      <p>COQUETTE Studio will not create an alternate location, edit an inventory kit, rewrite reservations or silently enable backorders.</p>
    </section>`
  }

  function editorMarkup() {
    return `<div class="np-stock-editor">${variantRows().map((variant) => {
      const value = values.get(variant.variant_id) ?? String(variant.stocked_quantity ?? 0)
      return `<article class="np-stock-row" data-stock-variant="${escapeHtml(variant.variant_id)}">
        <div class="np-stock-identity">
          <span>Variant</span>
          <strong>${escapeHtml(variant.title || 'Choice')}</strong>
          <small>${escapeHtml(variant.sku || variant.variant_id)}</small>
        </div>
        <label><span>In stock</span><input type="number" min="0" max="1000000" step="1" inputmode="numeric" data-stock-quantity value="${escapeHtml(value)}" ${busy ? 'disabled' : ''}/></label>
        <div class="np-stock-readonly"><span>Reserved <strong>${Number(variant.reserved_quantity || 0)}</strong></span><span>Incoming <strong>${Number(variant.incoming_quantity || 0)}</strong></span></div>
      </article>`
    }).join('')}</div>`
  }

  function actionLabel(action) {
    if (action === 'setup_tracking') return 'Create tracked inventory'
    if (action === 'create_level') return 'Create location level'
    if (action === 'update') return 'Update quantity'
    return 'No change'
  }

  function planMarkup() {
    const plan = planPayload?.plan
    if (!plan) return ''
    return `<section class="np-stock-plan">
      <div class="np-stock-plan-head"><div><span>Server-verified stock plan</span><strong>${Number(plan.change_count || 0)} ${Number(plan.change_count || 0) === 1 ? 'change' : 'changes'}</strong></div><b>SHA-256</b></div>
      <div class="np-stock-plan-list">${(plan.variants || []).map((row) => `<article>
        <div><span>${escapeHtml(row.title || 'Variant')}</span><small>${escapeHtml(actionLabel(row.action))}</small></div>
        <strong>${Number(row.stocked_quantity || 0)} <i>→</i> ${Number(row.intended_stocked_quantity || 0)}</strong>
      </article>`).join('')}</div>
    </section>`
  }

  function confirmationMarkup() {
    const plan = planPayload?.plan
    if (!plan || !confirming) return ''
    return `<section class="np-stock-confirm">
      <span>Final stock confirmation</span>
      <strong>Apply these exact quantities at ${escapeHtml(plan.location?.name || 'the managed location')}?</strong>
      <p>Studio may create the missing Medusa inventory item and one stock level for an untracked draft variant. It will not touch reservations, incoming stock, prices, identifiers, sales channels or publication.</p>
      <div><button type="button" data-stock-cancel ${busy ? 'disabled' : ''}>Not yet</button><button type="button" class="apply" data-stock-confirm ${busy ? 'disabled' : ''}>${busy ? 'Applying safely…' : 'Apply reviewed stock'}</button></div>
    </section>`
  }

  function panelMarkup() {
    if (loading) return waitingMarkup('Reading live Medusa inventory…', 'Loading')
    if (!inventoryState) {
      if (errorMessage) return blockedMarkup()
      return waitingMarkup('Inventory is not loaded yet.')
    }

    return `<section class="np-stock-panel" id="np-inventory-panel">
      <div class="np-stock-head"><div><span>Availability</span><strong>Set only the stock you can physically promise.</strong></div><b>Guarded</b></div>
      <p>Stock belongs to <strong>${escapeHtml(inventoryState.location?.name || 'COQUETTE Greece')}</strong>. Whole units only. A quantity can never be saved below existing reservations.</p>
      ${editorMarkup()}
      <div class="np-stock-safety"><span>Fixed default location</span><span>Backorders stay off</span><span>Reservations read-only</span><span>Review before write</span></div>
      ${errorMessage ? `<div class="np-stock-message error">${escapeHtml(errorMessage)}</div>` : ''}
      ${successMessage ? `<div class="np-stock-message success">${escapeHtml(successMessage)}</div>` : ''}
      ${planMarkup()}
      ${confirmationMarkup()}
      <div class="np-stock-actions"><button type="button" data-stock-reload ${busy ? 'disabled' : ''}>Reload live stock</button><button type="button" class="review" data-stock-primary ${busy ? 'disabled' : ''}>${planPayload?.plan ? 'Apply reviewed stock →' : busy ? 'Checking stock…' : 'Review stock →'}</button></div>
    </section>`
  }

  function renderPanel() {
    if (!onInventoryStep() || !isGenerated()) return
    const current = root.querySelector('#np-inventory-panel')
    if (!current) return
    const wrapper = document.createElement('div')
    wrapper.innerHTML = panelMarkup()
    const next = wrapper.firstElementChild
    if (next) current.replaceWith(next)
    bindPanel()
  }

  function invalidatePlan() {
    planPayload = null
    confirming = false
    errorMessage = ''
    successMessage = ''
    const panel = root.querySelector('#np-inventory-panel')
    panel?.querySelector('.np-stock-plan')?.remove()
    panel?.querySelector('.np-stock-confirm')?.remove()
    panel?.querySelectorAll('.np-stock-message').forEach((node) => node.remove())
    const primary = panel?.querySelector('[data-stock-primary]')
    if (primary) primary.textContent = 'Review stock →'
  }

  async function loadInventoryState() {
    const product = currentProduct()
    if (!product?.id || loading || busy || !isGenerated(product)) return
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
      errorMessage = error.message || 'Live inventory could not be loaded.'
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

  async function reviewInventory() {
    if (busy || !inventoryState?.ready) return
    busy = true
    errorMessage = ''
    successMessage = ''
    planPayload = null
    confirming = false
    renderPanel()
    try {
      const product = await freshProduct()
      planPayload = await requestJson('/api/studio/inventory-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          expected_updated_at: product.updated_at || inventoryState.product?.updated_at || '',
          inventory: inventoryRequest(),
        }),
      })
    } catch (error) {
      errorMessage = error.code === 'stale_draft'
        ? 'The draft changed elsewhere. Reload it before reviewing stock.'
        : error.message || 'The requested stock could not be reviewed safely.'
    } finally {
      busy = false
      renderPanel()
    }
  }

  async function applyInventory() {
    const approved = planPayload?.plan
    if (busy || !approved?.inventory_hash) return
    busy = true
    errorMessage = ''
    successMessage = ''
    renderPanel()
    try {
      const product = await freshProduct()
      const request = inventoryRequest()
      const refreshed = await requestJson('/api/studio/inventory-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          expected_updated_at: product.updated_at || '',
          inventory: request,
        }),
      })
      if (!refreshed.ready || refreshed.plan?.inventory_hash !== approved.inventory_hash) {
        planPayload = refreshed
        confirming = false
        throw new Error('The live stock state changed after review. Check the refreshed plan before applying it.')
      }

      await requestJson('/api/studio/inventory-apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          expected_updated_at: product.updated_at || '',
          inventory_hash: approved.inventory_hash,
          inventory: request,
        }),
      })

      const latest = await requestJson(`/api/studio/inventory-state?product_id=${encodeURIComponent(product.id)}`)
      hydrateState(latest)
      successMessage = 'Reviewed stock is saved in Medusa at the single managed location. The product remains an unpublished draft.'
      confirming = false
    } catch (error) {
      errorMessage = error.code === 'stale_inventory_plan'
        ? 'Inventory changed after review. Refresh the stock plan before applying it.'
        : error.code === 'stale_draft'
          ? 'The draft changed elsewhere. Reload it before applying stock.'
          : error.message || 'Stock could not be applied safely.'
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

    panel.querySelectorAll('[data-stock-variant]').forEach((row) => {
      const id = row.dataset.stockVariant
      const input = row.querySelector('[data-stock-quantity]')
      input?.addEventListener('input', () => {
        values.set(id, input.value)
        invalidatePlan()
      })
    })

    panel.querySelector('[data-stock-reload]')?.addEventListener('click', loadInventoryState)
    panel.querySelector('[data-stock-primary]')?.addEventListener('click', () => {
      if (planPayload?.plan) {
        confirming = true
        renderPanel()
      } else {
        reviewInventory()
      }
    })
    panel.querySelector('[data-stock-cancel]')?.addEventListener('click', () => {
      confirming = false
      renderPanel()
    })
    panel.querySelector('[data-stock-confirm]')?.addEventListener('click', applyInventory)
  }

  function enhanceInventoryStep() {
    if (!onInventoryStep()) return
    const product = currentProduct()
    const generated = isGenerated(product)
    const card = root.querySelector('.new-piece-form-card')
    if (!card) return

    const existing = card.querySelector('#np-inventory-panel')
    if (!generated) {
      existing?.remove()
      return
    }

    let panel = existing
    if (!panel) {
      const pricing = card.querySelector('#np-pricing-panel')
      const nav = card.querySelector('.new-piece-nav')
      if (pricing) pricing.insertAdjacentHTML('afterend', panelMarkup())
      else if (nav) nav.insertAdjacentHTML('beforebegin', panelMarkup())
      else card.insertAdjacentHTML('beforeend', panelMarkup())
      panel = card.querySelector('#np-inventory-panel')
    }
    if (panel) bindPanel()

    if (product?.id && loadedProductId !== product.id && !loading && !busy) {
      queueMicrotask(loadInventoryState)
    }
  }

  const observer = new MutationObserver(() => queueMicrotask(enhanceInventoryStep))
  observer.observe(root, { childList: true, subtree: true })
  document.addEventListener('DOMContentLoaded', enhanceInventoryStep)
  enhanceInventoryStep()
})()
