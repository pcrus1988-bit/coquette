(() => {
  const model = { productId: '', state: null, plan: null, error: '', busy: false }

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      ...options,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.message || 'Archive action failed')
    return payload
  }

  function host() {
    return document.querySelector('#workspace-body')
  }

  function ensurePanel() {
    const workspace = host()
    if (!workspace) return null
    let panel = workspace.querySelector('#studio-archive-panel')
    if (panel) return panel
    panel = document.createElement('section')
    panel.id = 'studio-archive-panel'
    panel.className = 'studio-archive-panel'
    const boundary = workspace.querySelector('.safe-boundary')
    if (boundary) boundary.before(panel)
    else workspace.appendChild(panel)
    return panel
  }

  function render() {
    const panel = ensurePanel()
    if (!panel) return
    if (!model.productId) {
      panel.innerHTML = ''
      panel.hidden = true
      return
    }
    panel.hidden = false

    if (model.busy && !model.state) {
      panel.innerHTML = '<p class="studio-archive-kicker">Archive policy</p><p class="studio-archive-muted">Reading the canonical product state…</p>'
      return
    }
    if (model.error && !model.state) {
      panel.innerHTML = `<p class="studio-archive-kicker">Archive policy</p><p class="studio-archive-error">${escapeHtml(model.error)}</p><button class="studio-archive-secondary" data-archive-reload>Try again</button>`
      return
    }
    if (!model.state) return

    const archived = Boolean(model.state.archive?.archived)
    const invariantOk = model.state.archive?.visibility_invariant_ok !== false
    const action = archived ? 'restore' : 'archive'
    const actionLabel = archived ? 'Review restoration' : 'Review archive'
    const previous = model.state.archive?.previous_status || 'not recorded'
    const statusCopy = archived
      ? `Archived · previously ${escapeHtml(previous)}`
      : `${escapeHtml(model.state.product.status)} · active catalogue record`
    const explanatory = archived
      ? 'Restoration returns this piece to an editable draft. It never republishes automatically.'
      : model.state.product.status === 'published'
        ? 'Archiving will unpublish this piece and retain its commerce data for a reversible restoration.'
        : 'Archiving keeps the product, variants, pricing, stock, media and placement while removing it from active work.'

    let review = ''
    if (model.plan) {
      const plan = model.plan
      review = `
        <div class="studio-archive-review">
          <div><span>Before</span><strong>${escapeHtml(plan.before.status)} · ${plan.before.archived ? 'archived' : 'active'}</strong></div>
          <div><span>After</span><strong>${escapeHtml(plan.after.status)} · ${plan.after.archived ? 'archived' : 'restored'}</strong></div>
          <div><span>Sales channels</span><strong>Preserved (${plan.after.sales_channel_ids.length})</strong></div>
          <div><span>Catalogue data</span><strong>Variants, prices, stock, media, placement preserved</strong></div>
        </div>
        <p class="studio-archive-confirm">${action === 'archive' ? 'Confirm archive' : 'Confirm restoration'} only after reviewing this exact state.</p>
        <div class="studio-archive-actions">
          <button class="studio-archive-secondary" data-archive-cancel ${model.busy ? 'disabled' : ''}>Cancel</button>
          <button class="studio-archive-primary" data-archive-apply ${model.busy ? 'disabled' : ''}>${model.busy ? 'Applying…' : (action === 'archive' ? 'Archive piece' : 'Restore to draft')}</button>
        </div>`
    }

    panel.innerHTML = `
      <div class="studio-archive-heading">
        <div>
          <p class="studio-archive-kicker">Archive policy</p>
          <h3>${archived ? 'Preserved, not deleted' : 'Reversible catalogue retirement'}</h3>
        </div>
        <span class="studio-archive-badge ${archived ? 'is-archived' : ''}">${statusCopy}</span>
      </div>
      <p class="studio-archive-copy">${explanatory}</p>
      ${!invariantOk ? '<p class="studio-archive-error">Safety invariant blocked: an archived product must remain an unpublished draft.</p>' : ''}
      ${model.error ? `<p class="studio-archive-error">${escapeHtml(model.error)}</p>` : ''}
      ${review || `<div class="studio-archive-actions"><button class="studio-archive-primary" data-archive-review data-action="${action}" ${model.busy || !invariantOk ? 'disabled' : ''}>${model.busy ? 'Reviewing…' : actionLabel}</button><button class="studio-archive-secondary" data-archive-reload ${model.busy ? 'disabled' : ''}>Refresh state</button></div>`}
      <p class="studio-archive-footnote">Deletion is intentionally not performed here. Archive is a COQUETTE policy layered over canonical Medusa commerce state.</p>`
  }

  async function load(productId = model.productId) {
    if (!productId) return
    model.productId = productId
    model.state = null
    model.plan = null
    model.error = ''
    model.busy = true
    render()
    try {
      model.state = await request(`/api/studio/archive-state?product_id=${encodeURIComponent(productId)}`)
    } catch (error) {
      model.error = error.message
    } finally {
      model.busy = false
      render()
    }
  }

  async function review(action) {
    if (!model.state || model.busy) return
    model.busy = true
    model.error = ''
    render()
    try {
      const payload = await request('/api/studio/archive-plan', {
        method: 'POST',
        body: JSON.stringify({
          product_id: model.productId,
          expected_updated_at: model.state.product.updated_at,
          action,
        }),
      })
      model.plan = payload.plan
    } catch (error) {
      model.error = error.message
      model.plan = null
    } finally {
      model.busy = false
      render()
    }
  }

  async function apply() {
    if (!model.plan || model.busy) return
    model.busy = true
    model.error = ''
    render()
    try {
      const payload = await request('/api/studio/archive-apply', {
        method: 'POST',
        body: JSON.stringify({
          product_id: model.productId,
          expected_updated_at: model.plan.expected_updated_at,
          action: model.plan.action,
          archive_hash: model.plan.archive_hash,
        }),
      })
      model.state = payload.state
      model.plan = null
      document.querySelector('#refresh')?.click()
      document.querySelector('#workspace-body [data-life-reload]')?.click()
    } catch (error) {
      model.error = error.message
      model.plan = null
    } finally {
      model.busy = false
      render()
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button')
    if (button?.matches('[data-archive-review]')) return void review(button.dataset.action)
    if (button?.matches('[data-archive-apply]')) return void apply()
    if (button?.matches('[data-archive-cancel]')) {
      model.plan = null
      model.error = ''
      return render()
    }
    if (button?.matches('[data-archive-reload]')) return void load()

    const productTarget = event.target.closest('[data-product-id]')
    const productId = productTarget?.dataset?.productId
    if (productId && productId !== model.productId) {
      window.setTimeout(() => load(productId), 40)
    }
  })
})()
