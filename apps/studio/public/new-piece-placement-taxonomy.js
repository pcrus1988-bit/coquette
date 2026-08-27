(() => {
  const root = document.querySelector('#new-piece-layer')
  if (!root) return

  let loadedProductId = null
  let loading = false
  let busy = false
  let confirming = false
  let placementState = null
  let planPayload = null
  let selectedCategories = new Set()
  let selectedDesigner = null
  let errorMessage = ''
  let successMessage = ''

  function api() { return window.CoquetteNewPiece }
  function product() { return api()?.getProduct?.() || null }
  function onStep() { return api()?.currentStep?.() === 6 && !root.hidden }

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
      const error = new Error(payload.message || 'Placement request failed')
      error.code = payload.code
      throw error
    }
    return payload
  }

  function hydrate(payload) {
    placementState = payload
    selectedCategories = new Set(payload?.current?.category_ids || [])
    selectedDesigner = payload?.current?.designer_id || null
    planPayload = null
    confirming = false
  }

  function requestBody() {
    return {
      category_ids: [...selectedCategories].sort(),
      designer_id: selectedDesigner || null,
    }
  }

  function designerName(id) {
    if (!id) return 'No designer'
    return placementState?.designers?.find((designer) => designer.id === id)?.name || id
  }

  function categoryName(id) {
    return placementState?.categories?.find((category) => category.id === id)?.name || id
  }

  function waitingMarkup(copy, badge = 'Guarded') {
    return `<section class="np-taxonomy-panel" id="np-placement-taxonomy-panel">
      <div class="np-taxonomy-head"><div><span>Category & designer</span><strong>${escapeHtml(copy)}</strong></div><b>${escapeHtml(badge)}</b></div>
    </section>`
  }

  function blockedMarkup() {
    return `<section class="np-taxonomy-panel blocked" id="np-placement-taxonomy-panel">
      <div class="np-taxonomy-head"><div><span>Category & designer</span><strong>Protected from an unsafe placement write.</strong></div><b>Blocked</b></div>
      <div class="np-taxonomy-message error">${escapeHtml(errorMessage || 'Placement cannot be edited safely in this state.')}</div>
      <p>Studio will not expose internal/inactive categories or invent a designer relationship.</p>
    </section>`
  }

  function categoryMarkup() {
    const categories = placementState?.categories || []
    if (!categories.length) {
      return '<div class="np-taxonomy-empty">No active merchant-facing categories are configured yet.</div>'
    }
    return `<div class="np-taxonomy-categories">${categories.map((category) => {
      const checked = selectedCategories.has(category.id)
      const context = category.parent_name ? `${category.parent_name} · ` : ''
      return `<label class="np-taxonomy-category ${checked ? 'selected' : ''}">
        <input type="checkbox" data-taxonomy-category value="${escapeHtml(category.id)}" ${checked ? 'checked' : ''} ${busy ? 'disabled' : ''}/>
        <span><strong>${escapeHtml(category.name)}</strong><small>${escapeHtml(context + category.handle)}</small></span>
      </label>`
    }).join('')}</div>`
  }

  function planMarkup() {
    const plan = planPayload?.plan
    if (!plan) return ''
    const beforeCategories = plan.before?.category_ids || []
    const afterCategories = plan.after?.category_ids || []
    return `<section class="np-taxonomy-plan">
      <div><span>Server-verified placement plan</span><b>${Number(plan.change_count || 0)} ${Number(plan.change_count || 0) === 1 ? 'change' : 'changes'}</b></div>
      <article><span>Categories</span><strong>${escapeHtml(beforeCategories.map(categoryName).join(', ') || 'None')} <i>→</i> ${escapeHtml(afterCategories.map(categoryName).join(', ') || 'None')}</strong></article>
      <article><span>Designer</span><strong>${escapeHtml(designerName(plan.before?.designer_id))} <i>→</i> ${escapeHtml(designerName(plan.after?.designer_id))}</strong></article>
    </section>`
  }

  function confirmationMarkup() {
    if (!confirming || !planPayload?.plan) return ''
    return `<section class="np-taxonomy-confirm">
      <span>Final placement confirmation</span>
      <strong>Apply exactly this category and designer relationship?</strong>
      <p>This changes only product categories and the COQUETTE designer link. It does not publish the draft, change prices, stock, identifiers, sales channels or merchandising flags.</p>
      <div><button type="button" data-taxonomy-cancel>Not yet</button><button type="button" class="apply" data-taxonomy-confirm>${busy ? 'Applying safely…' : 'Apply reviewed placement'}</button></div>
    </section>`
  }

  function panelMarkup() {
    if (loading) return waitingMarkup('Reading live Medusa categories and designers…', 'Loading')
    if (!placementState) return errorMessage ? blockedMarkup() : waitingMarkup('Placement is not loaded yet.')

    return `<section class="np-taxonomy-panel" id="np-placement-taxonomy-panel">
      <div class="np-taxonomy-head"><div><span>Category & designer</span><strong>Place the piece where customers expect to find it.</strong></div><b>Guarded</b></div>
      <p>Choose from existing COQUETTE taxonomy only. Leaving categories or designer blank is allowed for a private draft; publication rules remain a separate gate.</p>
      <label class="np-taxonomy-designer"><span>Designer</span><select data-taxonomy-designer ${busy ? 'disabled' : ''}>
        <option value="">No designer selected</option>
        ${(placementState.designers || []).map((designer) => `<option value="${escapeHtml(designer.id)}" ${selectedDesigner === designer.id ? 'selected' : ''}>${escapeHtml(designer.name)}</option>`).join('')}
      </select></label>
      <div class="np-taxonomy-label">Categories</div>
      ${categoryMarkup()}
      <div class="np-taxonomy-safety"><span>Existing taxonomy only</span><span>Internal categories hidden</span><span>No auto-publish</span><span>Review before write</span></div>
      ${errorMessage ? `<div class="np-taxonomy-message error">${escapeHtml(errorMessage)}</div>` : ''}
      ${successMessage ? `<div class="np-taxonomy-message success">${escapeHtml(successMessage)}</div>` : ''}
      ${planMarkup()}
      ${confirmationMarkup()}
      <div class="np-taxonomy-actions"><button type="button" data-taxonomy-reload ${busy ? 'disabled' : ''}>Reload live placement</button><button type="button" class="review" data-taxonomy-primary ${busy ? 'disabled' : ''}>${planPayload?.plan ? 'Apply reviewed placement →' : busy ? 'Checking placement…' : 'Review placement →'}</button></div>
    </section>`
  }

  function renderPanel() {
    if (!onStep()) return
    const current = root.querySelector('#np-placement-taxonomy-panel')
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
    renderPanel()
  }

  async function loadState() {
    const current = product()
    if (!current?.id || loading || busy) return
    loading = true
    errorMessage = ''
    successMessage = ''
    renderPanel()
    try {
      hydrate(await requestJson(`/api/studio/placement-taxonomy-state?product_id=${encodeURIComponent(current.id)}`))
      loadedProductId = current.id
    } catch (error) {
      placementState = null
      errorMessage = error.message || 'Live placement could not be loaded.'
    } finally {
      loading = false
      renderPanel()
    }
  }

  async function freshProduct() {
    const current = product()
    if (!current?.id) throw new Error('Open a Studio draft first.')
    const detail = await requestJson(`/api/studio/product?id=${encodeURIComponent(current.id)}`)
    api()?.mergeProduct?.(detail.product, false)
    return product()
  }

  async function reviewPlacement() {
    if (busy || !placementState?.ready) return
    busy = true
    errorMessage = ''
    successMessage = ''
    planPayload = null
    confirming = false
    renderPanel()
    try {
      await api()?.saveCurrent?.()
      const current = await freshProduct()
      planPayload = await requestJson('/api/studio/placement-taxonomy-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: current.id,
          expected_updated_at: current.updated_at || placementState.product?.updated_at || '',
          placement: requestBody(),
        }),
      })
    } catch (error) {
      errorMessage = error.code === 'stale_draft'
        ? 'The draft changed elsewhere. Reload it before reviewing placement.'
        : error.message || 'The requested placement could not be reviewed safely.'
    } finally {
      busy = false
      renderPanel()
    }
  }

  async function applyPlacement() {
    const approved = planPayload?.plan
    if (busy || !approved?.placement_hash) return
    busy = true
    errorMessage = ''
    successMessage = ''
    renderPanel()
    try {
      const current = await freshProduct()
      const placement = requestBody()
      const refreshed = await requestJson('/api/studio/placement-taxonomy-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: current.id,
          expected_updated_at: current.updated_at || '',
          placement,
        }),
      })
      if (!refreshed.ready || refreshed.plan?.placement_hash !== approved.placement_hash) {
        planPayload = refreshed
        confirming = false
        throw new Error('The live category/designer state changed after review. Check the refreshed plan before applying it.')
      }

      await requestJson('/api/studio/placement-taxonomy-apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: current.id,
          expected_updated_at: current.updated_at || '',
          placement_hash: approved.placement_hash,
          placement,
        }),
      })

      hydrate(await requestJson(`/api/studio/placement-taxonomy-state?product_id=${encodeURIComponent(current.id)}`))
      successMessage = 'Reviewed categories and designer are saved in Medusa. The product remains an unpublished draft.'
    } catch (error) {
      errorMessage = error.code === 'stale_placement_plan'
        ? 'Placement changed after review. Refresh the plan before applying it.'
        : error.code === 'stale_draft'
          ? 'The draft changed elsewhere. Reload it before applying placement.'
          : error.message || 'Placement could not be applied safely.'
      confirming = false
    } finally {
      busy = false
      renderPanel()
    }
  }

  function bindPanel() {
    const panel = root.querySelector('#np-placement-taxonomy-panel')
    if (!panel || panel.dataset.bound === 'true') return
    panel.dataset.bound = 'true'

    panel.querySelector('[data-taxonomy-designer]')?.addEventListener('change', (event) => {
      selectedDesigner = event.target.value || null
      invalidatePlan()
    })
    panel.querySelectorAll('[data-taxonomy-category]').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) selectedCategories.add(input.value)
        else selectedCategories.delete(input.value)
        invalidatePlan()
      })
    })
    panel.querySelector('[data-taxonomy-reload]')?.addEventListener('click', loadState)
    panel.querySelector('[data-taxonomy-primary]')?.addEventListener('click', () => {
      if (planPayload?.plan) {
        confirming = true
        renderPanel()
      } else reviewPlacement()
    })
    panel.querySelector('[data-taxonomy-cancel]')?.addEventListener('click', () => {
      confirming = false
      renderPanel()
    })
    panel.querySelector('[data-taxonomy-confirm]')?.addEventListener('click', applyPlacement)
  }

  function enhance() {
    if (!onStep()) return
    const card = root.querySelector('.new-piece-form-card')
    if (!card) return
    let panel = card.querySelector('#np-placement-taxonomy-panel')
    if (!panel) {
      const nav = card.querySelector('.new-piece-nav')
      if (nav) nav.insertAdjacentHTML('beforebegin', panelMarkup())
      else card.insertAdjacentHTML('beforeend', panelMarkup())
      panel = card.querySelector('#np-placement-taxonomy-panel')
    }
    if (panel) bindPanel()

    const current = product()
    if (current?.id && loadedProductId !== current.id && !loading && !busy) {
      queueMicrotask(loadState)
    }
  }

  const observer = new MutationObserver(() => queueMicrotask(enhance))
  observer.observe(root, { childList: true, subtree: true })
  document.addEventListener('DOMContentLoaded', enhance)
  enhance()
})()
