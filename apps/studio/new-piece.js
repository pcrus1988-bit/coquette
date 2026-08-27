(() => {
  const root = document.querySelector('#new-piece-layer')
  const trigger = document.querySelector('#guided-new-piece')
  if (!root || !trigger) return

  const steps = [
    ['Identity', 'Name & boutique identity'],
    ['Visual story', 'Image direction'],
    ['Story & details', 'Description & garment notes'],
    ['Choices', 'Size & colour blueprint'],
    ['Price & availability', 'Guarded commerce boundary'],
    ['Placement', 'Boutique merchandising intent'],
    ['Search presence', 'Handle & SEO intent'],
    ['Review', 'Everything before activation'],
  ]

  const state = {
    product: null,
    step: 1,
    maxStep: 1,
    dirty: false,
    saving: false,
    saveTimer: null,
    conflict: null,
    handleTouched: false,
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  function requestId() {
    return window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-new-piece`
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options })
    if (response.status === 401) {
      window.location.replace('/')
      throw new Error('Unauthorized')
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload.message || 'Request failed')
      error.code = payload.code
      error.updatedAt = payload.updated_at
      throw error
    }
    return payload
  }

  function safeList(value) {
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
    } catch { return [] }
  }

  function booleanMeta(value) { return String(value) === 'true' }

  function wizardData(product = state.product) {
    const metadata = product?.metadata || {}
    return {
      visual_notes: metadata.coquette_studio_visual_notes || '',
      composition: metadata.coquette_studio_composition || '',
      fit: metadata.coquette_studio_fit || '',
      care: metadata.coquette_studio_care || '',
      country: metadata.coquette_studio_country || '',
      choice_mode: metadata.coquette_studio_choice_mode || 'one-size',
      sizes: safeList(metadata.coquette_studio_sizes),
      colors: safeList(metadata.coquette_studio_colors),
      new_in: booleanMeta(metadata.coquette_studio_placement_new_in),
      featured: booleanMeta(metadata.coquette_studio_placement_featured),
      collection_note: metadata.coquette_studio_collection_note || '',
      seo_title: metadata.coquette_studio_seo_title || '',
      seo_description: metadata.coquette_studio_seo_description || '',
    }
  }

  function parseStep(product) {
    const value = Number(product?.metadata?.coquette_studio_wizard_step || 1)
    return Number.isInteger(value) && value >= 1 && value <= 8 ? value : 1
  }

  function formatDate(value) {
    if (!value) return '—'
    try {
      return new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
    } catch { return '—' }
  }

  function saveState(mode, text) {
    const node = root.querySelector('#np-save-state')
    if (!node) return
    node.className = `new-piece-save-state ${mode || ''}`.trim()
    node.innerHTML = `<i></i><span>${escapeHtml(text)}</span>`
  }

  function conflictMarkup() {
    if (!state.conflict) return ''
    return `<div class="np-conflict">${escapeHtml(state.conflict)}<button type="button" data-np-reload>Reload the latest draft</button></div>`
  }

  function sideMarkup() {
    const max = Math.max(state.maxStep, state.step)
    return `
      <aside class="new-piece-side">
        <div class="new-piece-brand"><img src="/assets/coquette-logo-transparent.png" alt="COQUETTE" /><button type="button" data-np-close aria-label="Close">×</button></div>
        <div class="new-piece-side-copy"><p class="eyebrow">Product Studio</p><h2>New Piece</h2><p>A calm, guided path from first idea to a complete unpublished product draft.</p></div>
        <nav class="new-piece-steps" aria-label="New Piece progress">
          ${steps.map(([label], index) => {
            const number = index + 1
            const unlocked = number <= max
            return `<button type="button" class="new-piece-step ${number === state.step ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-np-step="${number}" ${unlocked ? '' : 'disabled'}><span>${String(number).padStart(2, '0')}</span><strong>${escapeHtml(label)}</strong><small>${number < max ? 'Saved' : number === max ? 'Now' : 'Later'}</small></button>`
          }).join('')}
        </nav>
        <div class="new-piece-side-foot"><div class="new-piece-save-state saved" id="np-save-state"><i></i><span>${state.product ? 'Draft ready' : 'Not started yet'}</span></div></div>
      </aside>`
  }

  function previewMarkup() {
    const data = wizardData()
    const form = root.querySelector('#np-form')
    const field = (name, fallback = '') => form?.elements?.[name]?.value ?? fallback
    const title = field('title', state.product?.title || 'Your new piece') || 'Your new piece'
    const subtitle = field('subtitle', state.product?.subtitle || '')
    const description = field('description', state.product?.description || '') || data.composition || 'The story will take shape as you move through the steps.'
    const thumbnail = state.product?.thumbnail
    return `
      <aside class="new-piece-preview">
        <div class="preview-image">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" />` : '<span>COQUETTE</span>'}</div>
        <div><span class="preview-kicker">Unpublished preview</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(subtitle || description.slice(0, 150))}</p></div>
      </aside>`
  }

  function navMarkup({ first = false, last = false, canNext = true } = {}) {
    return `<div class="new-piece-nav"><button type="button" data-np-prev ${first ? 'disabled' : ''}>← Previous</button><button type="button" class="primary-next" data-np-next ${canNext ? '' : 'disabled'}>${last ? 'Keep as draft' : 'Save & continue →'}</button></div>`
  }

  function shell(stepContent) {
    const label = steps[state.step - 1]?.[0] || 'New Piece'
    const title = state.product?.title || 'New Piece'
    root.innerHTML = `<div class="new-piece-shell">${sideMarkup()}<main class="new-piece-main"><header class="new-piece-top"><p>${escapeHtml(title)} · <span>${escapeHtml(label)}</span></p><div class="new-piece-top-actions"><button type="button" data-np-save>Save draft</button><button type="button" class="dark" data-np-close>Back to Studio</button></div></header><div class="new-piece-content">${conflictMarkup()}${stepContent}</div></main></div>`
    bindCommon()
  }

  function field(name, label, value = '', attrs = '') {
    return `<label class="np-field"><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${attrs} /></label>`
  }

  function textarea(name, label, value = '', hint = '', attrs = '') {
    return `<label class="np-field"><span>${escapeHtml(label)}${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</span><textarea name="${escapeHtml(name)}" ${attrs}>${escapeHtml(value)}</textarea></label>`
  }

  function stepIntro(number, title, copy) {
    return `<div class="new-piece-intro"><span class="step-no">Step ${String(number).padStart(2, '0')} of 08</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p></div>`
  }

  function stepOne() {
    const p = state.product || {}
    const content = `${stepIntro(1, 'Give it an identity.', 'Start with the few things that make the piece recognizable. Nothing here publishes it.')}
      <div class="new-piece-grid"><form class="new-piece-form-card" id="np-form">
        ${field('title', 'Piece name', p.title || '', 'maxlength="160" required placeholder="e.g. Satin draped dress"')}
        ${field('subtitle', 'Short boutique line · optional', p.subtitle || '', 'maxlength="255" placeholder="e.g. Fluid evening silhouette"')}
        ${field('handle', 'Storefront handle · optional', p.handle || '', 'maxlength="200" placeholder="satin-draped-dress" pattern="[a-z0-9]+(?:-[a-z0-9]+)*"')}
        <p class="np-help">The handle stays unpublished with the draft. Leave it blank if you prefer to decide later.</p>
        ${state.product ? navMarkup({ first: true }) : `<div class="new-piece-nav"><span></span><button type="submit" class="primary-next">Begin draft →</button></div>`}
      </form>${previewMarkup()}</div>`
    shell(content)
    bindForm()
  }

  function stepTwo() {
    const data = wizardData()
    const content = `${stepIntro(2, 'Shape the visual story.', 'Upload, order and choose the cover from COQUETTE managed storage, then keep a private note for the visual direction.')}
      <div class="new-piece-grid"><form class="new-piece-form-card" id="np-form">
        ${textarea('visual_notes', 'Visual direction', data.visual_notes, 'Private Studio note', 'maxlength="1200" placeholder="Front, back, detail, texture, styling mood…"')}
        <div class="new-piece-safety"><strong>Media is governed.</strong><p>Managed uploads are verified against this exact unpublished draft. The Studio never exposes an external image URL field.</p></div>
        ${navMarkup()}
      </form>${previewMarkup()}</div>`
    shell(content)
    bindForm()
  }

  function stepThree() {
    const p = state.product || {}
    const data = wizardData()
    const content = `${stepIntro(3, 'Tell its story.', 'Write the customer-facing description and the useful garment details the team needs to keep close.')}
      <div class="new-piece-grid"><form class="new-piece-form-card" id="np-form">
        ${textarea('description', 'Product story', p.description || '', 'Customer-facing', 'maxlength="10000" placeholder="Describe the silhouette, feeling and details…"')}
        <div class="np-field-row">${textarea('composition', 'Composition', data.composition, '', 'maxlength="800" placeholder="e.g. 96% viscose, 4% elastane"')}${textarea('fit', 'Fit', data.fit, '', 'maxlength="800" placeholder="e.g. relaxed fit, true to size"')}</div>
        <div class="np-field-row">${textarea('care', 'Care', data.care, '', 'maxlength="800" placeholder="e.g. dry clean only"')}${field('country', 'Country / origin note', data.country, 'maxlength="120" placeholder="e.g. Made in Greece"')}</div>
        ${navMarkup()}
      </form>${previewMarkup()}</div>`
    shell(content)
    bindForm()
  }

  function stepFour() {
    const data = wizardData()
    const choices = [
      ['one-size', 'One size', 'A single sellable choice'],
      ['size', 'Sizes', 'A size range such as XS–XL'],
      ['color', 'Colours', 'Colour choices without size matrix'],
      ['size-color', 'Sizes + colours', 'A two-dimensional variant plan'],
    ]
    const content = `${stepIntro(4, 'Plan the choices.', 'Define the variant blueprint in a human way. This phase saves the plan but does not generate sellable variants yet.')}
      <div class="new-piece-grid"><form class="new-piece-form-card" id="np-form">
        <div class="np-choice-grid">${choices.map(([value, label, note]) => `<label class="np-choice"><input type="radio" name="choice_mode" value="${value}" ${data.choice_mode === value ? 'checked' : ''} /><span>${escapeHtml(label)}<small>${escapeHtml(note)}</small></span></label>`).join('')}</div>
        ${field('sizes', 'Sizes · comma separated', data.sizes.join(', '), 'maxlength="500" placeholder="XS, S, M, L"')}
        ${field('colors', 'Colours · comma separated', data.colors.join(', '), 'maxlength="500" placeholder="Black, Ivory, Rose"')}
        <div class="new-piece-safety"><strong>Blueprint, not inventory.</strong><p>No variants, stock units or inventory quantities are created from this step yet. The stored plan becomes the input to the next guarded variant workflow.</p></div>
        ${navMarkup()}
      </form>${previewMarkup()}</div>`
    shell(content)
    bindForm()
  }

  function stepFive() {
    const content = `${stepIntro(5, 'Price deserves an explicit action.', 'Pricing and availability are intentionally separated from descriptive autosave so a background change can never alter what a customer pays or what the shop promises to have in stock.')}
      <div class="new-piece-grid"><div class="new-piece-form-card" id="np-form">
        <div class="new-piece-safety"><strong>Commerce writes are still locked.</strong><p>This New Piece foundation does not yet write prices or inventory. That is deliberate: the variant graph must exist first, then each price and stock change will pass through its own validated, reviewable workflow.</p><ul><li>No price is guessed from text or a previous product.</li><li>No stock quantity is invented.</li><li>No backorder behavior is silently enabled.</li><li>The draft remains unpublished.</li></ul></div>
        ${navMarkup()}
      </div>${previewMarkup()}</div>`
    shell(content)
  }

  function stepSix() {
    const data = wizardData()
    const content = `${stepIntro(6, 'Decide where it belongs.', 'Save the merchandising intention now. Actual storefront placement remains separate from publication.')}
      <div class="new-piece-grid"><form class="new-piece-form-card" id="np-form">
        <div class="np-check-row">
          <label class="np-check"><input type="checkbox" name="new_in" ${data.new_in ? 'checked' : ''} /><span><strong>New In</strong><small>Mark the intention to feature it in the new-arrivals story.</small></span></label>
          <label class="np-check"><input type="checkbox" name="featured" ${data.featured ? 'checked' : ''} /><span><strong>Featured</strong><small>Mark it as a candidate for prominent boutique placement.</small></span></label>
        </div>
        ${textarea('collection_note', 'Collection / placement note', data.collection_note, 'Private Studio note', 'maxlength="500" placeholder="e.g. Evening edit · launch with September lookbook"')}
        <div class="new-piece-safety"><strong>Intent is not visibility.</strong><p>These choices are saved on the unpublished draft as merchandising intent. They do not add it to a sales channel or make it visible to customers.</p></div>
        ${navMarkup()}
      </form>${previewMarkup()}</div>`
    shell(content)
    bindForm()
  }

  function stepSeven() {
    const p = state.product || {}
    const data = wizardData()
    const content = `${stepIntro(7, 'Prepare its search presence.', 'Keep the language elegant for people and clear for search engines. These SEO notes remain on the draft until the managed storefront layer applies them.')}
      <div class="new-piece-grid"><form class="new-piece-form-card" id="np-form">
        ${field('handle', 'Storefront handle', p.handle || '', 'maxlength="200" placeholder="satin-draped-dress" pattern="[a-z0-9]+(?:-[a-z0-9]+)*"')}
        ${field('seo_title', 'SEO title intent', data.seo_title, 'maxlength="180" placeholder="Satin Draped Dress | COQUETTE"')}
        ${textarea('seo_description', 'SEO description intent', data.seo_description, '', 'maxlength="360" placeholder="A concise search description…"')}
        <div class="new-piece-safety"><strong>No accidental indexing.</strong><p>The Studio itself remains noindex, and this product remains an unpublished Medusa draft. Search intent is saved for the future storefront publication gate.</p></div>
        ${navMarkup()}
      </form>${previewMarkup()}</div>`
    shell(content)
    bindForm()
  }

  function reviewValue(value, fallback = 'Not set yet') {
    if (Array.isArray(value)) return value.length ? value.join(', ') : fallback
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return value || fallback
  }

  function stepEight() {
    const p = state.product || {}
    const data = wizardData()
    const imageCount = Array.isArray(p.images) ? p.images.length : 0
    const content = `${stepIntro(8, 'Review it like a stylist.', 'Everything below is saved on an unpublished product draft. Publishing remains a separate future gate.')}
      <div class="new-piece-grid"><div class="new-piece-form-card" id="np-form">
        <div class="np-review">
          <div class="np-review-row"><span>Piece</span><strong>${escapeHtml(reviewValue(p.title))}${p.subtitle ? `\n${escapeHtml(p.subtitle)}` : ''}</strong></div>
          <div class="np-review-row"><span>Visual story</span><strong>${imageCount ? `${imageCount} managed ${imageCount === 1 ? 'image' : 'images'} · cover selected` : 'No product imagery yet'}</strong></div>
          <div class="np-review-row"><span>Description</span><strong>${escapeHtml(reviewValue(p.description))}</strong></div>
          <div class="np-review-row"><span>Composition</span><strong>${escapeHtml(reviewValue(data.composition))}</strong></div>
          <div class="np-review-row"><span>Fit & care</span><strong>${escapeHtml(reviewValue([data.fit, data.care].filter(Boolean).join(' · ')))}</strong></div>
          <div class="np-review-row"><span>Choice plan</span><strong>${escapeHtml(reviewValue(data.choice_mode))} · ${escapeHtml(reviewValue([...data.sizes, ...data.colors]))}</strong></div>
          <div class="np-review-row"><span>Boutique intent</span><strong>${data.new_in ? 'New In · ' : ''}${data.featured ? 'Featured · ' : ''}${escapeHtml(reviewValue(data.collection_note, 'No placement selected'))}</strong></div>
          <div class="np-review-row"><span>Search</span><strong>${escapeHtml(reviewValue(data.seo_title || p.handle))}</strong></div>
          <div class="np-review-row"><span>Status</span><strong>Unpublished draft</strong></div>
        </div>
        <button type="button" class="np-disabled-publish" disabled>Publish — guarded activation not enabled yet</button>
        ${navMarkup({ last: true })}
      </div>${previewMarkup()}</div>`
    shell(content)
  }

  function renderStep() {
    clearTimeout(state.saveTimer)
    state.saveTimer = null
    state.dirty = false
    if (state.step === 1) return stepOne()
    if (state.step === 2) return stepTwo()
    if (state.step === 3) return stepThree()
    if (state.step === 4) return stepFour()
    if (state.step === 5) return stepFive()
    if (state.step === 6) return stepSix()
    if (state.step === 7) return stepSeven()
    return stepEight()
  }

  function currentFields(targetStep = state.step) {
    const form = root.querySelector('#np-form')
    const fields = { studio: { step: targetStep } }
    if (!form) return fields
    const value = (name) => form.elements?.[name]?.value?.trim?.() ?? ''

    if (state.step === 1) {
      fields.title = value('title')
      fields.subtitle = value('subtitle') || null
      fields.handle = value('handle') || null
    } else if (state.step === 2) {
      fields.studio.visual_notes = value('visual_notes')
    } else if (state.step === 3) {
      fields.description = value('description') || null
      fields.studio.composition = value('composition')
      fields.studio.fit = value('fit')
      fields.studio.care = value('care')
      fields.studio.country = value('country')
    } else if (state.step === 4) {
      fields.studio.choice_mode = form.elements?.choice_mode?.value || 'one-size'
      fields.studio.sizes = value('sizes').split(',').map((item) => item.trim()).filter(Boolean)
      fields.studio.colors = value('colors').split(',').map((item) => item.trim()).filter(Boolean)
    } else if (state.step === 6) {
      fields.studio.new_in = Boolean(form.elements?.new_in?.checked)
      fields.studio.featured = Boolean(form.elements?.featured?.checked)
      fields.studio.collection_note = value('collection_note')
    } else if (state.step === 7) {
      fields.handle = value('handle') || null
      fields.studio.seo_title = value('seo_title')
      fields.studio.seo_description = value('seo_description')
    }
    return fields
  }

  function mergeSavedProduct(saved) {
    state.product = { ...state.product, ...saved, metadata: { ...(state.product?.metadata || {}), ...(saved.metadata || {}) } }
    state.maxStep = Math.max(state.maxStep, parseStep(state.product))
  }

  async function saveNow(targetStep = state.step) {
    if (!state.product || state.saving) return true
    state.saving = true
    state.conflict = null
    saveState('saving', 'Saving…')
    try {
      const payload = await requestJson('/api/studio/product-draft-update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: state.product.id,
          expected_updated_at: state.product.updated_at || '',
          fields: currentFields(targetStep),
        }),
      })
      mergeSavedProduct(payload.product)
      state.dirty = false
      saveState('saved', `Saved · ${formatDate(state.product.updated_at)}`)
      return true
    } catch (error) {
      state.conflict = error.code === 'stale_draft'
        ? 'This piece changed somewhere else. Reload the latest version before saving more changes.'
        : error.message
      saveState('error', 'Not saved')
      const slot = root.querySelector('.new-piece-content')
      if (slot && !slot.querySelector('.np-conflict')) slot.insertAdjacentHTML('afterbegin', conflictMarkup())
      bindReload()
      return false
    } finally {
      state.saving = false
    }
  }

  function scheduleSave() {
    if (!state.product) return
    state.dirty = true
    saveState('saving', 'Unsaved changes')
    clearTimeout(state.saveTimer)
    state.saveTimer = setTimeout(() => saveNow(), 700)
  }

  function refreshPreview() {
    const preview = root.querySelector('.new-piece-preview')
    if (!preview) return
    const temp = document.createElement('div')
    temp.innerHTML = previewMarkup()
    const next = temp.firstElementChild
    if (next) preview.replaceWith(next)
  }

  function bindForm() {
    const form = root.querySelector('#np-form')
    if (!form) return
    form.addEventListener('input', (event) => {
      if (event.target?.name === 'handle') state.handleTouched = true
      scheduleSave()
      refreshPreview()
    })
    form.addEventListener('change', () => { scheduleSave(); refreshPreview() })
    if (!state.product && state.step === 1) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        const title = form.elements.title.value.trim()
        if (!title) return form.elements.title.focus()
        const submit = form.querySelector('button[type="submit"]')
        submit.disabled = true
        submit.textContent = 'Starting…'
        try {
          const created = await requestJson('/api/studio/product-drafts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title, request_id: requestId() }),
          })
          const detail = await requestJson(`/api/studio/product?id=${encodeURIComponent(created.product.id)}`)
          state.product = detail.product
          state.maxStep = 1
          state.dirty = true
          const ok = await saveNow(1)
          if (ok) renderStep()
        } catch (error) {
          state.conflict = error.message
          renderStep()
        }
      })
    }
  }

  function bindReload() {
    root.querySelector('[data-np-reload]')?.addEventListener('click', reloadProduct)
  }

  async function reloadProduct() {
    if (!state.product?.id) return
    try {
      const payload = await requestJson(`/api/studio/product?id=${encodeURIComponent(state.product.id)}`)
      state.product = payload.product
      state.step = Math.max(1, Math.min(8, parseStep(state.product)))
      state.maxStep = state.step
      state.conflict = null
      renderStep()
    } catch (error) {
      state.conflict = error.message
      renderStep()
    }
  }

  async function goNext() {
    if (!state.product) return
    if (state.step === 8) {
      const ok = state.dirty ? await saveNow(8) : true
      if (ok) await closeWizard()
      return
    }
    const next = state.step + 1
    const ok = await saveNow(next)
    if (!ok) return
    state.maxStep = Math.max(state.maxStep, next)
    state.step = next
    renderStep()
  }

  async function goPrevious() {
    if (state.step <= 1) return
    if (state.dirty) {
      const ok = await saveNow(state.step)
      if (!ok) return
    }
    state.step -= 1
    renderStep()
  }

  async function jumpTo(step) {
    if (step > state.maxStep || step === state.step) return
    if (state.dirty) {
      const ok = await saveNow(state.step)
      if (!ok) return
    }
    state.step = step
    renderStep()
  }

  async function closeWizard() {
    clearTimeout(state.saveTimer)
    if (state.product && state.dirty) {
      const ok = await saveNow(state.step)
      if (!ok) return
    }
    root.hidden = true
    root.innerHTML = ''
    document.body.style.overflow = ''
    document.querySelector('#refresh')?.click()
  }

  function bindCommon() {
    root.querySelectorAll('[data-np-close]').forEach((button) => button.addEventListener('click', closeWizard))
    root.querySelector('[data-np-save]')?.addEventListener('click', () => saveNow(state.step))
    root.querySelector('[data-np-next]')?.addEventListener('click', goNext)
    root.querySelector('[data-np-prev]')?.addEventListener('click', goPrevious)
    root.querySelectorAll('[data-np-step]').forEach((button) => button.addEventListener('click', () => jumpTo(Number(button.dataset.npStep))))
    bindReload()
  }

  async function resumeDraft(id) {
    root.innerHTML = '<div class="drawer-loading">Opening draft…</div>'
    try {
      const payload = await requestJson(`/api/studio/product?id=${encodeURIComponent(id)}`)
      state.product = payload.product
      state.step = parseStep(state.product)
      state.maxStep = state.step
      state.conflict = null
      renderStep()
    } catch (error) {
      state.product = null
      state.conflict = error.message
      await renderLauncher()
    }
  }

  async function renderLauncher() {
    state.product = null
    state.step = 1
    state.maxStep = 1
    state.dirty = false
    state.conflict = null
    root.innerHTML = `<div class="new-piece-shell">${sideMarkup()}<main class="new-piece-main"><header class="new-piece-top"><p>New Piece · Product Studio</p><div class="new-piece-top-actions"><button type="button" class="dark" data-np-close>Back to Studio</button></div></header><div class="new-piece-content"><div class="new-piece-launch"><div class="new-piece-launch-top"><div><p class="eyebrow">A new arrival begins here</p><h1>New Piece.</h1></div><p>Create calmly, save continuously, and leave commercial activation to explicit guarded steps.</p></div><button type="button" class="new-piece-start" id="np-start"><span><strong>Start a new piece</strong><span>Create the unpublished shell first, then shape identity, story, choices, placement and search presence.</span></span><b>→</b></button><section class="new-piece-resume"><h2>Continue where you left off.</h2><div class="new-piece-resume-grid" id="np-resume-grid"><div class="new-piece-resume-card"><div class="resume-copy"><strong>Loading drafts…</strong><small>Only Studio-created unpublished drafts appear here.</small></div></div></div></section></div></div></main></div>`
    bindCommon()
    root.querySelector('#np-start')?.addEventListener('click', () => { state.product = null; state.step = 1; renderStep() })
    try {
      const payload = await requestJson('/api/studio/drafts')
      const grid = root.querySelector('#np-resume-grid')
      if (!grid) return
      if (!payload.drafts?.length) {
        grid.innerHTML = '<div class="new-piece-resume-card"><div class="resume-copy"><strong>No unfinished Studio drafts.</strong><small>Your next piece can start with a clean page.</small></div></div>'
        return
      }
      grid.innerHTML = payload.drafts.map((draft) => `<button type="button" class="new-piece-resume-card" data-np-resume="${escapeHtml(draft.id)}"><div class="resume-image">${draft.thumbnail ? `<img src="${escapeHtml(draft.thumbnail)}" alt="" />` : '<span>COQUETTE</span>'}</div><div class="resume-copy"><strong>${escapeHtml(draft.title)}</strong><small>Step ${escapeHtml(draft.step)} of 8 · updated ${escapeHtml(formatDate(draft.updated_at))}</small></div></button>`).join('')
      grid.querySelectorAll('[data-np-resume]').forEach((button) => button.addEventListener('click', () => resumeDraft(button.dataset.npResume)))
    } catch (error) {
      const grid = root.querySelector('#np-resume-grid')
      if (grid) grid.innerHTML = `<div class="new-piece-resume-card"><div class="resume-copy"><strong>Drafts could not be loaded.</strong><small>${escapeHtml(error.message)}</small></div></div>`
    }
  }

  async function openWizard() {
    root.hidden = false
    document.body.style.overflow = 'hidden'
    await renderLauncher()
  }

  async function saveCurrentExternal() {
    clearTimeout(state.saveTimer)
    state.saveTimer = null
    while (state.saving) {
      await new Promise((resolve) => setTimeout(resolve, 35))
    }
    if (!state.product) return false
    return state.dirty ? saveNow(state.step) : true
  }

  function mergeProductExternal(saved, rerender = true) {
    if (!saved || typeof saved !== 'object') return state.product
    mergeSavedProduct(saved)
    state.dirty = false
    state.conflict = null
    if (rerender && !root.hidden) renderStep()
    return state.product
  }

  trigger.addEventListener('click', openWizard)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !root.hidden) closeWizard()
  })

  window.CoquetteNewPiece = {
    open: openWizard,
    getProduct: () => state.product,
    currentStep: () => state.step,
    saveCurrent: saveCurrentExternal,
    mergeProduct: mergeProductExternal,
    refresh: () => { if (!root.hidden) renderStep() },
  }
})()
