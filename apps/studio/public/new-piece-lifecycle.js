(() => {
  const wizardRoot = document.querySelector('#new-piece-layer')
  const workspaceBody = document.querySelector('#workspace-body')
  if (!wizardRoot || !workspaceBody) return

  const contexts = {
    wizard: { productId: null, state: null, plan: null, busy: false, confirming: false, error: '', success: '' },
    drawer: { productId: null, state: null, plan: null, busy: false, confirming: false, error: '', success: '' },
  }

  function studioApi() { return window.CoquetteNewPiece }
  function currentWizardProduct() { return studioApi()?.getProduct?.() || null }
  function onWizardReview() { return studioApi()?.currentStep?.() === 8 && !wizardRoot.hidden }

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
      const error = new Error(payload.message || 'Lifecycle request failed')
      error.code = payload.code
      throw error
    }
    return payload
  }

  function resetContext(name, productId) {
    const ctx = contexts[name]
    ctx.productId = productId || null
    ctx.state = null
    ctx.plan = null
    ctx.busy = false
    ctx.confirming = false
    ctx.error = ''
    ctx.success = ''
  }

  function actionFor(ctx) {
    if (ctx.state?.product?.status === 'draft') return 'publish'
    if (ctx.state?.product?.status === 'published') return 'unpublish'
    return null
  }

  function actionTitle(action) {
    return action === 'publish' ? 'Publish to the boutique' : 'Take off the boutique'
  }

  function actionButton(action) {
    return action === 'publish' ? 'Review publication →' : 'Review unpublish →'
  }

  function statusLabel(status) {
    return status === 'published' ? 'Published' : status === 'draft' ? 'Unpublished draft' : status || 'Unknown'
  }

  function blockersMarkup(ctx) {
    const blockers = Array.isArray(ctx.state?.publish_readiness?.blockers)
      ? ctx.state.publish_readiness.blockers
      : []
    if (!blockers.length) return ''
    return `<div class="np-lifecycle-blockers"><strong>Publication is not ready yet.</strong><ul>${blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
  }

  function planMarkup(ctx) {
    const plan = ctx.plan?.plan
    if (!plan) return ''
    const channelChange = plan.attach_canonical_sales_channel
      ? `<li>Attach the product to the canonical channel <strong>${escapeHtml(plan.canonical_sales_channel_id)}</strong>.</li>`
      : '<li>Keep the existing canonical sales-channel link unchanged.</li>'
    return `<section class="np-lifecycle-plan">
      <div><span>Server-verified visibility plan</span><strong>${escapeHtml(plan.before?.status)} <i>→</i> ${escapeHtml(plan.after?.status)}</strong></div>
      <ul>${channelChange}<li>Verify the reviewed EUR price fingerprint for ${Number(plan.price_fingerprint?.length || 0)} variant(s).</li><li>Apply only the reviewed lifecycle transition.</li></ul>
      <small>Plan fingerprint · SHA-256</small>
    </section>`
  }

  function confirmationMarkup(ctx, action) {
    const plan = ctx.plan?.plan
    if (!plan || !ctx.confirming) return ''
    const question = action === 'publish'
      ? 'Make this exact reviewed product visible to customers?'
      : 'Remove this product from customer visibility now?'
    return `<section class="np-lifecycle-confirm">
      <span>Final visibility confirmation</span>
      <strong>${escapeHtml(question)}</strong>
      <p>${action === 'publish'
        ? 'Studio will publish only this product and attach only the configured canonical store sales channel when it is missing.'
        : 'Studio will return the product to draft. The canonical channel link is preserved for a future reviewed re-publication.'}</p>
      <div><button type="button" data-life-cancel ${ctx.busy ? 'disabled' : ''}>Not yet</button><button type="button" class="apply" data-life-confirm ${ctx.busy ? 'disabled' : ''}>${ctx.busy ? 'Applying safely…' : action === 'publish' ? 'Publish reviewed product' : 'Unpublish reviewed product'}</button></div>
    </section>`
  }

  function panelMarkup(ctx, name) {
    if (!ctx.productId) return ''
    if (!ctx.state) {
      return `<section class="np-lifecycle-panel loading" data-life-context="${name}"><div class="np-lifecycle-head"><div><span>Visibility</span><strong>${escapeHtml(ctx.error || 'Reading live publication state…')}</strong></div><b>${ctx.error ? 'Blocked' : 'Loading'}</b></div></section>`
    }

    const action = actionFor(ctx)
    const status = ctx.state.product?.status
    const publishReady = Boolean(ctx.state.publish_readiness?.ready)
    const canAct = action === 'unpublish' || (action === 'publish' && publishReady)
    const currentChannels = Array.isArray(ctx.state.current_sales_channels) ? ctx.state.current_sales_channels : []
    const channelCopy = currentChannels.length
      ? currentChannels.map((channel) => channel.name || channel.id).join(', ')
      : 'No channel attached yet'

    return `<section class="np-lifecycle-panel ${status === 'published' ? 'published' : ''}" data-life-context="${name}">
      <div class="np-lifecycle-head"><div><span>Visibility</span><strong>${escapeHtml(statusLabel(status))}</strong></div><b>${status === 'published' ? 'Live' : 'Guarded'}</b></div>
      <div class="np-lifecycle-facts"><span>Canonical channel <strong>${escapeHtml(ctx.state.canonical_sales_channel?.name || 'Default Sales Channel')}</strong></span><span>Current exposure <strong>${escapeHtml(channelCopy)}</strong></span><span>Variants priced <strong>${Number(ctx.state.publish_readiness?.priced_variants || 0)} / ${Number(ctx.state.publish_readiness?.variants || 0)}</strong></span></div>
      ${blockersMarkup(ctx)}
      ${ctx.error ? `<div class="np-lifecycle-message error">${escapeHtml(ctx.error)}</div>` : ''}
      ${ctx.success ? `<div class="np-lifecycle-message success">${escapeHtml(ctx.success)}</div>` : ''}
      ${planMarkup(ctx)}
      ${confirmationMarkup(ctx, action)}
      <div class="np-lifecycle-safety"><span>Explicit action only</span><span>Canonical channel only</span><span>Price fingerprint checked</span><span>No archive guessing</span></div>
      ${action ? `<div class="np-lifecycle-actions"><button type="button" data-life-reload ${ctx.busy ? 'disabled' : ''}>Reload state</button><button type="button" class="review ${action === 'unpublish' ? 'quiet' : ''}" data-life-primary ${ctx.busy || !canAct ? 'disabled' : ''}>${ctx.plan?.plan ? (action === 'publish' ? 'Publish reviewed →' : 'Unpublish reviewed →') : ctx.busy ? 'Checking…' : escapeHtml(actionButton(action))}</button></div>` : ''}
      ${action === 'publish' && !publishReady ? '<p class="np-lifecycle-note">Resolve every blocker above before publication can be reviewed.</p>' : ''}
    </section>`
  }

  function patchWizardStatus(ctx) {
    if (!onWizardReview() || !ctx.state) return
    const rows = wizardRoot.querySelectorAll('.np-review-row')
    rows.forEach((row) => {
      const label = row.querySelector('span')?.textContent?.trim()
      if (label === 'Status') {
        const strong = row.querySelector('strong')
        if (strong) strong.textContent = statusLabel(ctx.state.product?.status)
      }
    })
    const disabled = wizardRoot.querySelector('.np-disabled-publish')
    if (disabled) disabled.hidden = true
  }

  function renderContext(name) {
    const ctx = contexts[name]
    if (name === 'wizard') {
      if (!onWizardReview()) return
      const product = currentWizardProduct()
      if (!product?.id || product.id !== ctx.productId) return
      const card = wizardRoot.querySelector('.new-piece-form-card')
      if (!card) return
      let panel = card.querySelector('[data-life-context="wizard"]')
      const markup = panelMarkup(ctx, 'wizard')
      if (!panel) {
        const disabled = card.querySelector('.np-disabled-publish')
        if (disabled) disabled.insertAdjacentHTML('beforebegin', markup)
        else card.insertAdjacentHTML('beforeend', markup)
        panel = card.querySelector('[data-life-context="wizard"]')
      } else {
        const wrapper = document.createElement('div')
        wrapper.innerHTML = markup
        const next = wrapper.firstElementChild
        if (next) panel.replaceWith(next)
        panel = card.querySelector('[data-life-context="wizard"]')
      }
      patchWizardStatus(ctx)
      bindPanel('wizard', panel)
      return
    }

    if (!ctx.productId || !workspaceBody.closest('.workspace-drawer')?.classList.contains('open')) return
    let panel = workspaceBody.querySelector('[data-life-context="drawer"]')
    const markup = panelMarkup(ctx, 'drawer')
    if (!panel) {
      const boundary = workspaceBody.querySelector('.safe-boundary')
      if (!boundary) return
      boundary.insertAdjacentHTML('beforebegin', markup)
      panel = workspaceBody.querySelector('[data-life-context="drawer"]')
    } else {
      const wrapper = document.createElement('div')
      wrapper.innerHTML = markup
      const next = wrapper.firstElementChild
      if (next) panel.replaceWith(next)
      panel = workspaceBody.querySelector('[data-life-context="drawer"]')
    }
    bindPanel('drawer', panel)
  }

  async function loadState(name, productId, force = false) {
    const ctx = contexts[name]
    if (!productId || ctx.busy) return
    if (!force && ctx.productId === productId && ctx.state) {
      renderContext(name)
      return
    }
    if (ctx.productId !== productId) resetContext(name, productId)
    ctx.error = ''
    renderContext(name)
    try {
      ctx.state = await requestJson(`/api/studio/lifecycle-state?product_id=${encodeURIComponent(productId)}`)
      ctx.plan = null
      ctx.confirming = false
    } catch (error) {
      ctx.state = null
      ctx.error = error.message || 'Visibility state could not be loaded safely.'
    }
    renderContext(name)
  }

  async function review(name) {
    const ctx = contexts[name]
    const action = actionFor(ctx)
    if (!ctx.productId || !ctx.state || !action || ctx.busy) return
    ctx.busy = true
    ctx.error = ''
    ctx.success = ''
    ctx.plan = null
    ctx.confirming = false
    renderContext(name)
    try {
      const latest = await requestJson(`/api/studio/lifecycle-state?product_id=${encodeURIComponent(ctx.productId)}`)
      ctx.state = latest
      const currentAction = actionFor(ctx)
      if (currentAction !== action) throw new Error('The product visibility changed. Review the current state again.')
      ctx.plan = await requestJson('/api/studio/lifecycle-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: ctx.productId,
          expected_updated_at: latest.product?.updated_at || '',
          action,
        }),
      })
    } catch (error) {
      ctx.error = error.message || 'Visibility could not be reviewed safely.'
    } finally {
      ctx.busy = false
      renderContext(name)
    }
  }

  async function apply(name) {
    const ctx = contexts[name]
    const approved = ctx.plan?.plan
    if (!approved?.lifecycle_hash || ctx.busy) return
    const action = approved.action
    ctx.busy = true
    ctx.error = ''
    ctx.success = ''
    renderContext(name)
    try {
      const latest = await requestJson(`/api/studio/lifecycle-state?product_id=${encodeURIComponent(ctx.productId)}`)
      ctx.state = latest
      const refreshed = await requestJson('/api/studio/lifecycle-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: ctx.productId,
          expected_updated_at: latest.product?.updated_at || '',
          action,
        }),
      })
      if (!refreshed.ready || refreshed.plan?.lifecycle_hash !== approved.lifecycle_hash) {
        ctx.plan = refreshed
        ctx.confirming = false
        throw new Error('The live visibility state changed after review. Check the refreshed plan before applying it.')
      }

      await requestJson('/api/studio/lifecycle-apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: ctx.productId,
          expected_updated_at: latest.product?.updated_at || '',
          action,
          lifecycle_hash: approved.lifecycle_hash,
        }),
      })

      ctx.state = await requestJson(`/api/studio/lifecycle-state?product_id=${encodeURIComponent(ctx.productId)}`)
      ctx.plan = null
      ctx.confirming = false
      ctx.success = action === 'publish'
        ? 'Published through the canonical COQUETTE storefront channel.'
        : 'Returned to unpublished draft visibility. The canonical channel is preserved for a future reviewed publication.'

      if (name === 'wizard') {
        const detail = await requestJson(`/api/studio/product?id=${encodeURIComponent(ctx.productId)}`)
        studioApi()?.mergeProduct?.(detail.product, false)
      }
      document.querySelector('#refresh')?.click()
    } catch (error) {
      ctx.error = error.code === 'stale_lifecycle_plan'
        ? 'Visibility changed after review. Review the lifecycle plan again.'
        : error.code === 'stale_product'
          ? 'The product changed elsewhere. Reload it before changing visibility.'
          : error.message || 'Visibility could not be changed safely.'
      ctx.confirming = false
    } finally {
      ctx.busy = false
      renderContext(name)
    }
  }

  function bindPanel(name, panel) {
    if (!panel || panel.dataset.bound === 'true') return
    panel.dataset.bound = 'true'
    const ctx = contexts[name]
    panel.querySelector('[data-life-reload]')?.addEventListener('click', () => loadState(name, ctx.productId, true))
    panel.querySelector('[data-life-primary]')?.addEventListener('click', () => {
      if (ctx.plan?.plan) {
        ctx.confirming = true
        renderContext(name)
      } else {
        review(name)
      }
    })
    panel.querySelector('[data-life-cancel]')?.addEventListener('click', () => {
      ctx.confirming = false
      renderContext(name)
    })
    panel.querySelector('[data-life-confirm]')?.addEventListener('click', () => apply(name))
  }

  function enhanceWizard() {
    if (!onWizardReview()) return
    const product = currentWizardProduct()
    if (!product?.id) return
    if (contexts.wizard.productId !== product.id || !contexts.wizard.state) {
      queueMicrotask(() => loadState('wizard', product.id))
    } else {
      renderContext('wizard')
    }
  }

  function enhanceDrawer() {
    const ctx = contexts.drawer
    if (!ctx.productId) return
    const boundary = workspaceBody.querySelector('.safe-boundary')
    if (!boundary) return
    if (!ctx.state && !ctx.error) {
      queueMicrotask(() => loadState('drawer', ctx.productId))
    } else {
      renderContext('drawer')
    }
  }

  document.addEventListener('click', (event) => {
    const card = event.target.closest?.('[data-product-id]')
    if (card?.dataset?.productId) {
      resetContext('drawer', card.dataset.productId)
      queueMicrotask(enhanceDrawer)
    }
  }, true)

  const wizardObserver = new MutationObserver(() => queueMicrotask(enhanceWizard))
  wizardObserver.observe(wizardRoot, { childList: true, subtree: true })
  const drawerObserver = new MutationObserver(() => queueMicrotask(enhanceDrawer))
  drawerObserver.observe(workspaceBody, { childList: true, subtree: true })

  document.addEventListener('DOMContentLoaded', () => {
    enhanceWizard()
    enhanceDrawer()
  })
  enhanceWizard()
})()
