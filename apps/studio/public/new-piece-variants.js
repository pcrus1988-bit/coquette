(() => {
  const root = document.querySelector('#new-piece-layer')
  if (!root) return

  let busy = false
  let confirming = false
  let planPayload = null
  let planError = ''

  function studioApi() {
    return window.CoquetteNewPiece
  }

  function currentProduct() {
    return studioApi()?.getProduct?.() || null
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  function isGenerated(product = currentProduct()) {
    return product?.metadata?.coquette_studio_variants_generated === 'true'
  }

  function generatedCount(product = currentProduct()) {
    const metadataCount = Number(product?.metadata?.coquette_studio_variant_count || 0)
    if (Number.isInteger(metadataCount) && metadataCount > 0) return metadataCount
    return Array.isArray(product?.variants) ? product.variants.length : 0
  }

  function splitList(value) {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  function blueprintFromForm(form) {
    return {
      choice_mode: form?.elements?.choice_mode?.value || 'one-size',
      sizes: splitList(form?.elements?.sizes?.value),
      colors: splitList(form?.elements?.colors?.value),
    }
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options })
    if (response.status === 401) {
      window.location.replace('/')
      throw new Error('Unauthorized')
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload.message || 'Choice request failed')
      error.code = payload.code
      error.updatedAt = payload.updated_at
      error.blueprintHash = payload.blueprint_hash
      throw error
    }
    return payload
  }

  function choiceControls(form = root.querySelector('#np-form')) {
    return form ? Array.from(form.querySelectorAll('[name="choice_mode"], [name="sizes"], [name="colors"]')) : []
  }

  function setChoiceControlsDisabled(disabled) {
    const locked = isGenerated()
    choiceControls().forEach((control) => { control.disabled = Boolean(disabled || locked) })
  }

  function summaryOptions(plan) {
    const options = Array.isArray(plan?.options) ? plan.options : []
    if (!options.length) return ''
    return `<div class="np-variant-option-list">${options.map((option) => `
      <div class="np-variant-option-row">
        <span>${escapeHtml(option.title || 'Choice')}</span>
        <strong>${(option.values || []).map((value) => escapeHtml(value)).join(' · ')}</strong>
      </div>`).join('')}</div>`
  }

  function variantPreview(plan) {
    const variants = Array.isArray(plan?.variants) ? plan.variants : []
    if (!variants.length) return ''
    const visible = variants.slice(0, 8)
    const remainder = Math.max(variants.length - visible.length, 0)
    return `<div class="np-variant-preview"><span>Generated choices</span><div>${visible.map((variant) => `<b>${escapeHtml(variant.title || 'Choice')}</b>`).join('')}${remainder ? `<b class="more">+${remainder} more</b>` : ''}</div></div>`
  }

  function generatedMarkup(product) {
    const count = generatedCount(product)
    return `<section class="np-variant-builder generated" id="np-variant-builder">
      <div class="np-variant-builder-head"><div><span class="np-variant-kicker">Choice structure</span><strong>Built and locked.</strong></div><b>${count || '—'} ${count === 1 ? 'variant' : 'variants'}</b></div>
      <p>The saved size / colour blueprint is now a real Medusa option and variant graph. Editing this structure will require its own guarded workflow, so the original blueprint is locked against silent drift.</p>
      <div class="np-variant-safety-grid"><span>Still unpublished</span><span>No price amounts added</span><span>No stock quantities added</span><span>Backorders off</span></div>
    </section>`
  }

  function idleMarkup() {
    return `<section class="np-variant-builder" id="np-variant-builder">
      <div class="np-variant-builder-head"><div><span class="np-variant-kicker">Choice structure</span><strong>Turn the blueprint into real choices.</strong></div><b>Guarded</b></div>
      <p>COQUETTE will save the visible blueprint, normalize it on the server and show the exact Medusa variant count before anything structural is created.</p>
      ${planError ? `<div class="np-variant-message error">${escapeHtml(planError)}</div>` : ''}
      <button type="button" class="np-variant-review" data-variant-review ${busy ? 'disabled' : ''}>${busy ? 'Checking saved choices…' : 'Review saved choices →'}</button>
    </section>`
  }

  function incompleteMarkup(payload) {
    const message = payload?.problem?.message || 'Complete the saved size / colour blueprint before building choices.'
    return `<section class="np-variant-builder" id="np-variant-builder">
      <div class="np-variant-builder-head"><div><span class="np-variant-kicker">Choice structure</span><strong>Blueprint needs attention.</strong></div><b>Not ready</b></div>
      <div class="np-variant-message">${escapeHtml(message)}</div>
      <button type="button" class="np-variant-review" data-variant-review ${busy ? 'disabled' : ''}>Review again after saving →</button>
    </section>`
  }

  function blockedMarkup(payload) {
    return `<section class="np-variant-builder blocked" id="np-variant-builder">
      <div class="np-variant-builder-head"><div><span class="np-variant-kicker">Choice structure</span><strong>Protected from overwrite.</strong></div><b>Blocked</b></div>
      <div class="np-variant-message error">${escapeHtml(payload?.message || 'This product already contains a variant graph outside the guarded Studio generator.')}</div>
      <p>COQUETTE will not replace or merge an unknown existing graph automatically.</p>
    </section>`
  }

  function readyMarkup(payload) {
    const plan = payload?.plan || {}
    const count = Number(plan.variant_count || 0)
    const options = Array.isArray(plan.options) ? plan.options.length : 0

    if (confirming) {
      return `<section class="np-variant-builder confirming" id="np-variant-builder">
        <div class="np-variant-builder-head"><div><span class="np-variant-kicker">Final structural confirmation</span><strong>Build ${count} ${count === 1 ? 'choice' : 'choices'} now?</strong></div><b>${options} ${options === 1 ? 'option' : 'options'}</b></div>
        <p>This creates the real Medusa option / variant structure and locks this blueprint afterward. It does <strong>not</strong> add prices, stock quantities, sales channels or publication.</p>
        <div class="np-variant-confirm-actions"><button type="button" data-variant-cancel ${busy ? 'disabled' : ''}>Not yet</button><button type="button" class="build" data-variant-confirm ${busy ? 'disabled' : ''}>${busy ? 'Building safely…' : 'Build choices'}</button></div>
      </section>`
    }

    return `<section class="np-variant-builder ready" id="np-variant-builder">
      <div class="np-variant-builder-head"><div><span class="np-variant-kicker">Server-verified plan</span><strong>${count} ${count === 1 ? 'variant' : 'variants'} ready to build.</strong></div><b>${options} ${options === 1 ? 'option' : 'options'}</b></div>
      ${summaryOptions(plan)}
      ${variantPreview(plan)}
      <div class="np-variant-safety-grid"><span>No prices</span><span>No stock</span><span>No backorders</span><span>Draft stays private</span></div>
      ${planError ? `<div class="np-variant-message error">${escapeHtml(planError)}</div>` : ''}
      <div class="np-variant-actions"><button type="button" data-variant-review ${busy ? 'disabled' : ''}>Refresh plan</button><button type="button" class="build" data-variant-build ${busy ? 'disabled' : ''}>Build ${count} ${count === 1 ? 'choice' : 'choices'} →</button></div>
    </section>`
  }

  function panelMarkup() {
    const product = currentProduct()
    if (isGenerated(product)) return generatedMarkup(product)
    if (!planPayload) return idleMarkup()
    if (planPayload.state === 'blocked') return blockedMarkup(planPayload)
    if (!planPayload.ready) return incompleteMarkup(planPayload)
    return readyMarkup(planPayload)
  }

  function renderPanel() {
    const current = root.querySelector('#np-variant-builder')
    if (!current) return
    const wrapper = document.createElement('div')
    wrapper.innerHTML = panelMarkup()
    const next = wrapper.firstElementChild
    if (next) current.replaceWith(next)
    bindPanel()
  }

  function invalidatePlan() {
    if (busy || isGenerated()) return
    planPayload = null
    planError = ''
    confirming = false
    renderPanel()
  }

  async function fetchFreshProduct(productId) {
    const detail = await requestJson(`/api/studio/product?id=${encodeURIComponent(productId)}`)
    studioApi()?.mergeProduct?.(detail.product, false)
    return currentProduct()
  }

  async function flushVisibleBlueprint() {
    const api = studioApi()
    const product = currentProduct()
    const form = root.querySelector('#np-form')
    if (!api?.saveCurrent || !product?.id || !form?.elements?.choice_mode) {
      throw new Error('The New Piece choice editor is not ready.')
    }

    const visibleBlueprint = blueprintFromForm(form)
    setChoiceControlsDisabled(true)

    const baseSaved = await api.saveCurrent()
    if (!baseSaved) throw new Error('Save the current draft before reviewing its choices.')

    let fresh = await fetchFreshProduct(product.id)
    if (isGenerated(fresh)) return fresh

    const saved = await requestJson('/api/studio/product-draft-update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: fresh.id,
        expected_updated_at: fresh.updated_at || '',
        fields: {
          studio: {
            step: 4,
            choice_mode: visibleBlueprint.choice_mode,
            sizes: visibleBlueprint.sizes,
            colors: visibleBlueprint.colors,
          },
        },
      }),
    })
    api.mergeProduct?.(saved.product, false)
    fresh = currentProduct()
    return fresh
  }

  async function reviewPlan() {
    if (busy || isGenerated()) return
    busy = true
    planError = ''
    confirming = false
    renderPanel()
    try {
      const product = await flushVisibleBlueprint()
      if (isGenerated(product)) {
        planPayload = null
        studioApi()?.refresh?.()
        return
      }
      planPayload = await requestJson(`/api/studio/variant-plan?product_id=${encodeURIComponent(product.id)}`)
    } catch (error) {
      planPayload = null
      planError = error.code === 'stale_draft'
        ? 'This draft changed elsewhere. Reload it before reviewing choices.'
        : error.message || 'The saved choice plan could not be checked.'
    } finally {
      busy = false
      setChoiceControlsDisabled(false)
      renderPanel()
    }
  }

  async function buildChoices() {
    if (busy || !planPayload?.ready || !planPayload?.plan?.blueprint_hash) return
    busy = true
    planError = ''
    renderPanel()

    const approvedHash = planPayload.plan.blueprint_hash
    try {
      const product = await flushVisibleBlueprint()
      if (isGenerated(product)) {
        planPayload = null
        studioApi()?.refresh?.()
        return
      }

      const refreshedPlan = await requestJson(`/api/studio/variant-plan?product_id=${encodeURIComponent(product.id)}`)
      if (!refreshedPlan.ready || refreshedPlan.plan?.blueprint_hash !== approvedHash) {
        planPayload = refreshedPlan
        confirming = false
        throw new Error('The blueprint changed after your review. Check the refreshed plan before building choices.')
      }

      const latest = currentProduct()
      const generated = await requestJson('/api/studio/variant-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: latest.id,
          expected_updated_at: latest.updated_at || '',
          blueprint_hash: approvedHash,
        }),
      })

      studioApi()?.mergeProduct?.(generated.product, false)
      const detail = await requestJson(`/api/studio/product?id=${encodeURIComponent(latest.id)}`)
      planPayload = null
      confirming = false
      studioApi()?.mergeProduct?.(detail.product, true)
    } catch (error) {
      planError = error.code === 'stale_draft'
        ? 'This draft changed elsewhere. Reload it before building choices.'
        : error.code === 'stale_blueprint'
          ? 'The blueprint changed after review. Refresh the server plan first.'
          : error.message || 'The choice graph could not be built safely.'
      confirming = false
    } finally {
      busy = false
      setChoiceControlsDisabled(false)
      renderPanel()
    }
  }

  function bindPanel() {
    const panel = root.querySelector('#np-variant-builder')
    if (!panel || panel.dataset.bound === 'true') return
    panel.dataset.bound = 'true'
    panel.querySelector('[data-variant-review]')?.addEventListener('click', reviewPlan)
    panel.querySelector('[data-variant-build]')?.addEventListener('click', () => {
      confirming = true
      renderPanel()
    })
    panel.querySelector('[data-variant-cancel]')?.addEventListener('click', () => {
      confirming = false
      renderPanel()
    })
    panel.querySelector('[data-variant-confirm]')?.addEventListener('click', buildChoices)
  }

  function enhanceChoiceStep() {
    if (root.hidden) return
    const form = root.querySelector('#np-form')
    if (!form?.elements?.choice_mode || !form.elements?.sizes || !form.elements?.colors) return

    const product = currentProduct()
    const generated = isGenerated(product)
    setChoiceControlsDisabled(generated || busy)

    const intro = root.querySelector('.new-piece-intro>p')
    if (intro) {
      intro.textContent = generated
        ? 'The saved choice blueprint is now a real Medusa variant graph. Its structure is locked while pricing and stock remain separate guarded actions.'
        : 'Define the human size / colour blueprint, review the exact server-normalized matrix, then build it only when you explicitly approve the structure.'
    }

    const safety = form.querySelector('.new-piece-safety')
    if (safety) {
      safety.innerHTML = generated
        ? '<strong>Structure built, commerce still separate.</strong><p>No price amount, stock quantity, backorder permission, sales-channel visibility or publication was created with these choices.</p>'
        : '<strong>Blueprint first, structure second.</strong><p>Autosave stores only the human plan. “Build choices” is a separate guarded action that creates Medusa options and variants with no prices or stock quantities.</p>'
    }

    let panel = form.querySelector('#np-variant-builder')
    if (!panel) {
      const safetyNode = form.querySelector('.new-piece-safety')
      if (safetyNode) safetyNode.insertAdjacentHTML('beforebegin', panelMarkup())
      panel = form.querySelector('#np-variant-builder')
      form.addEventListener('input', invalidatePlan)
      form.addEventListener('change', invalidatePlan)
    }
    if (panel) bindPanel()
  }

  const observer = new MutationObserver(() => queueMicrotask(enhanceChoiceStep))
  observer.observe(root, { childList: true, subtree: true })
  document.addEventListener('DOMContentLoaded', enhanceChoiceStep)
  enhanceChoiceStep()
})()
