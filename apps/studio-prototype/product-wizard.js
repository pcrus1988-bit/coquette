(() => {
  const root = document.querySelector('#product-wizard')
  if (!root) return

  const steps = [...document.querySelectorAll('.wizard-step')]
  const links = [...document.querySelectorAll('[data-step-link]')]
  const next = document.querySelector('#wizard-next')
  const back = document.querySelector('#wizard-back')
  const position = document.querySelector('#wizard-position')
  const saveState = document.querySelector('#wizard-save-state')
  let current = 0

  const fields = {
    name: document.querySelector('#piece-name'),
    designer: document.querySelector('#piece-designer'),
    category: document.querySelector('#piece-category'),
    sku: document.querySelector('#piece-sku'),
    barcode: document.querySelector('#piece-barcode'),
    description: document.querySelector('#piece-description'),
    material: document.querySelector('#piece-material'),
    fit: document.querySelector('#piece-fit'),
    care: document.querySelector('#piece-care'),
    model: document.querySelector('#piece-model'),
    price: document.querySelector('#piece-price'),
    salePrice: document.querySelector('#piece-sale-price'),
    handle: document.querySelector('#piece-handle'),
    seoTitle: document.querySelector('#piece-seo-title'),
    seoDescription: document.querySelector('#piece-seo-description'),
  }

  const storageKey = 'coquette-studio-product-draft-v1'
  let mediaCount = 0

  function slugify(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function fieldValue(field) {
    return field?.value?.trim?.() || ''
  }

  function markSaving() {
    if (!saveState) return
    saveState.textContent = 'Saving…'
    window.clearTimeout(markSaving.timer)
    markSaving.timer = window.setTimeout(() => {
      saveState.textContent = 'Saved locally · prototype'
    }, 360)
  }

  function serialize() {
    return Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [key, field?.value || ''])
    )
  }

  function save() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ ...serialize(), mediaCount, current }))
      markSaving()
    } catch {}
  }

  function restore() {
    try {
      const draft = JSON.parse(window.localStorage.getItem(storageKey) || 'null')
      if (!draft) return
      Object.entries(fields).forEach(([key, field]) => {
        if (field && typeof draft[key] === 'string') field.value = draft[key]
      })
      mediaCount = Number(draft.mediaCount || 0)
      if (Number.isInteger(draft.current) && draft.current >= 0 && draft.current < steps.length) current = draft.current
    } catch {}
  }

  function updatePreview() {
    const name = fieldValue(fields.name) || 'New Piece'
    const designer = fieldValue(fields.designer) || 'Designer'
    const priceValue = Number(fields.price?.value || 0)
    const saleValue = Number(fields.salePrice?.value || 0)
    const handle = fieldValue(fields.handle) || slugify(name) || 'new-piece'
    const seoTitle = fieldValue(fields.seoTitle) || `${name} | COQUETTE`
    const seoDescription = fieldValue(fields.seoDescription) || 'Η περιγραφή αναζήτησης θα εμφανιστεί εδώ καθώς τη γράφετε.'

    document.querySelector('#preview-name').textContent = name
    document.querySelector('#preview-designer').textContent = designer
    document.querySelector('#preview-price').textContent = saleValue > 0 ? `€${saleValue.toFixed(0)} · από €${priceValue.toFixed(0)}` : priceValue > 0 ? `€${priceValue.toFixed(0)}` : 'Price not set'
    document.querySelector('#seo-handle-preview').textContent = handle
    document.querySelector('#seo-title-preview').textContent = seoTitle
    document.querySelector('#seo-description-preview').textContent = seoDescription

    if (!fieldValue(fields.handle) && fields.handle && fieldValue(fields.name)) fields.handle.placeholder = handle
    if (!fieldValue(fields.seoTitle) && fields.seoTitle && fieldValue(fields.name)) fields.seoTitle.placeholder = seoTitle

    document.querySelector('#review-piece').textContent = name === 'New Piece' ? 'Untitled piece' : name
    document.querySelector('#review-designer').textContent = designer === 'Designer' ? 'Not set' : designer
    document.querySelector('#review-media').textContent = mediaCount ? `${mediaCount} image${mediaCount === 1 ? '' : 's'} selected` : 'No images yet'
    document.querySelector('#review-price').textContent = saleValue > 0 ? `€${saleValue.toFixed(2)} sale · €${priceValue.toFixed(2)} regular` : priceValue > 0 ? `€${priceValue.toFixed(2)}` : 'Not set'
    document.querySelector('#review-search').textContent = fieldValue(fields.seoDescription) ? 'Ready for review' : 'Needs review'
  }

  function render() {
    steps.forEach((step, index) => step.classList.toggle('active', index === current))
    links.forEach((link, index) => {
      link.classList.toggle('active', index === current)
      link.classList.toggle('done', index < current)
    })
    if (position) position.textContent = `Step ${current + 1} of ${steps.length}`
    if (back) back.style.visibility = current === 0 ? 'hidden' : 'visible'
    if (next) next.textContent = current === steps.length - 1 ? 'Publish piece' : 'Continue →'
    updatePreview()
    save()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function go(index) {
    current = Math.max(0, Math.min(index, steps.length - 1))
    render()
  }

  Object.values(fields).forEach((field) => {
    field?.addEventListener('input', () => {
      updatePreview()
      save()
    })
    field?.addEventListener('change', () => {
      updatePreview()
      save()
    })
  })

  next?.addEventListener('click', () => {
    if (current < steps.length - 1) {
      go(current + 1)
      return
    }
    next.disabled = true
    next.textContent = 'Prototype only'
    document.querySelector('#preview-note').textContent = 'Ready · no production change was made'
    window.setTimeout(() => {
      next.disabled = false
      next.textContent = 'Publish piece'
    }, 1300)
  })

  back?.addEventListener('click', () => go(current - 1))
  links.forEach((link, index) => link.addEventListener('click', () => go(index)))
  document.querySelectorAll('[data-edit-step]').forEach((button) => button.addEventListener('click', () => go(Number(button.dataset.editStep))))

  document.querySelector('#save-and-exit')?.addEventListener('click', () => {
    save()
    window.location.assign('/products')
  })

  document.querySelector('#quick-draft')?.addEventListener('click', () => {
    if (!fieldValue(fields.name)) fields.name.value = 'Untitled Piece'
    save()
    window.location.assign('/products')
  })

  document.querySelector('#media-input')?.addEventListener('change', (event) => {
    mediaCount = event.target.files?.length || 0
    const summary = document.querySelector('#media-summary')
    const image = document.querySelector('#live-card-image')
    if (summary) summary.textContent = mediaCount ? `${mediaCount} εικόνα${mediaCount === 1 ? '' : 'ες'} επιλέχθηκαν · η πρώτη θα λειτουργεί ως cover στο preview.` : 'Καμία εικόνα ακόμη.'
    image?.classList.toggle('has-media', mediaCount > 0)
    updatePreview()
    save()
  })

  document.querySelector('#copy-draft')?.addEventListener('click', () => {
    if (!fields.description) return
    const piece = fieldValue(fields.name) || 'Το νέο piece'
    const designer = fieldValue(fields.designer)
    const hint = designer ? `${piece} από ${designer}, με καθαρή γραμμή και σύγχρονη θηλυκότητα. Συμπληρώστε εδώ μόνο πραγματικά στοιχεία για ύφασμα, εφαρμογή και αίσθηση.` : `${piece}, με καθαρή γραμμή και σύγχρονη θηλυκότητα. Συμπληρώστε εδώ μόνο πραγματικά στοιχεία για ύφασμα, εφαρμογή και αίσθηση.`
    if (!fieldValue(fields.description)) fields.description.value = hint
    updatePreview()
    save()
  })

  document.querySelectorAll('.choice-card').forEach((card) => card.addEventListener('click', () => {
    document.querySelectorAll('.choice-card').forEach((item) => item.classList.remove('selected'))
    card.classList.add('selected')
  }))

  document.querySelector('#add-size')?.addEventListener('click', () => {
    const value = window.prompt('Νέο μέγεθος')
    if (!value?.trim()) return
    const container = document.querySelector('#size-pills')
    const addButton = document.querySelector('#add-size')
    const pill = document.createElement('span')
    pill.className = 'option-pill'
    pill.innerHTML = `${value.trim()} <button type="button">×</button>`
    pill.querySelector('button').addEventListener('click', () => pill.remove())
    container?.insertBefore(pill, addButton)
  })

  document.querySelectorAll('#size-pills .option-pill:not(.add-pill) button').forEach((button) => button.addEventListener('click', () => button.closest('.option-pill')?.remove()))

  restore()
  const mediaSummary = document.querySelector('#media-summary')
  if (mediaSummary && mediaCount) mediaSummary.textContent = `${mediaCount} εικόνα${mediaCount === 1 ? '' : 'ες'} έχουν αποθηκευτεί στο prototype draft.`
  document.querySelector('#live-card-image')?.classList.toggle('has-media', mediaCount > 0)
  render()
})()
