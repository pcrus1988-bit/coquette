(() => {
  const root = document.querySelector('#new-piece-layer')
  if (!root) return

  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
  const MAX_FILE_BYTES = 12 * 1024 * 1024
  const MAX_IMAGES = 20
  let busy = false
  let dragIndex = null
  let lastStatus = { mode: '', text: 'Managed storage ready' }

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

  function imageUrls(product = currentProduct()) {
    if (!Array.isArray(product?.images)) return []
    return [...new Set(product.images.map((image) => image?.url).filter((url) => typeof url === 'string' && url))]
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options })
    if (response.status === 401) {
      window.location.replace('/')
      throw new Error('Unauthorized')
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload.message || 'Managed media request failed')
      error.code = payload.code
      error.updatedAt = payload.updated_at
      throw error
    }
    return payload
  }

  function statusMarkup() {
    return `<div class="np-media-status ${escapeHtml(lastStatus.mode)}" id="np-media-status"><i></i><span>${escapeHtml(lastStatus.text)}</span></div>`
  }

  function mediaCards(product) {
    const urls = imageUrls(product)
    const cover = product?.thumbnail || urls[0] || ''
    if (!urls.length) {
      return '<div class="np-media-empty">No imagery yet. The first successful upload becomes the cover automatically.</div>'
    }
    return `<div class="np-media-grid">${urls.map((url, index) => {
      const isCover = url === cover
      const canRemove = urls.length > 1
      return `<article class="np-media-card" draggable="true" data-media-index="${index}">
        <div class="np-media-visual"><img src="${escapeHtml(url)}" alt="" loading="lazy" />${isCover ? '<span class="np-media-cover">Cover</span>' : ''}<span class="np-media-position">${index + 1}</span></div>
        <div class="np-media-controls">
          <button type="button" data-media-cover="${index}" ${isCover ? 'disabled' : ''}>${isCover ? 'Cover' : 'Set cover'}</button>
          <button type="button" data-media-left="${index}" ${index === 0 ? 'disabled' : ''} aria-label="Move image left">←</button>
          <button type="button" data-media-right="${index}" ${index === urls.length - 1 ? 'disabled' : ''} aria-label="Move image right">→</button>
          <button type="button" class="np-media-remove" data-media-remove="${index}" ${canRemove ? '' : 'disabled title="Upload a replacement before removing the only image"'}>Remove from piece</button>
        </div>
      </article>`
    }).join('')}</div>`
  }

  function managerMarkup(product) {
    const count = imageUrls(product).length
    return `<section class="np-media-manager" aria-busy="${busy}">
      <div class="np-media-drop" id="np-media-drop">
        <input id="np-media-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple />
        <div class="np-media-drop-copy"><strong>Show the piece at its best.</strong><span>Drop JPG, PNG, WebP or AVIF here. Files go directly to COQUETTE managed storage through a short-lived upload permission; external image URLs are never accepted.</span></div>
        <button type="button" class="np-media-choose" id="np-media-choose">Choose images</button>
      </div>
      ${statusMarkup()}
      <div class="np-media-heading"><strong>Visual story</strong><span>${count} / ${MAX_IMAGES} images · drag to reorder</span></div>
      ${mediaCards(product)}
      <p class="np-media-note">“Remove from piece” only detaches the image from this draft. It does not silently delete the stored original. Storage cleanup remains an explicit operation.</p>
    </section>`
  }

  function setStatus(mode, text) {
    lastStatus = { mode, text }
    const node = root.querySelector('#np-media-status')
    if (!node) return
    node.className = `np-media-status ${mode || ''}`.trim()
    node.innerHTML = `<i></i><span>${escapeHtml(text)}</span>`
  }

  async function flushDraft() {
    const api = studioApi()
    if (!api?.saveCurrent) throw new Error('New Piece autosave is not ready')
    const ok = await api.saveCurrent()
    if (!ok) throw new Error('Save the current draft changes before editing media')
  }

  function validateFiles(fileList) {
    const files = Array.from(fileList || [])
    if (!files.length) return []
    const currentCount = imageUrls().length
    if (currentCount + files.length > MAX_IMAGES) {
      throw new Error(`This workflow supports up to ${MAX_IMAGES} product images.`)
    }
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        throw new Error(`${file.name || 'A file'} is not an allowed image type.`)
      }
      if (!file.size || file.size > MAX_FILE_BYTES) {
        throw new Error(`${file.name || 'An image'} must be smaller than 12 MB.`)
      }
    }
    return files
  }

  async function uploadFiles(fileList) {
    if (busy) return
    let files
    try {
      files = validateFiles(fileList)
    } catch (error) {
      setStatus('error', error.message)
      return
    }
    if (!files.length) return

    busy = true
    root.querySelector('.np-media-manager')?.setAttribute('aria-busy', 'true')
    try {
      await flushDraft()
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const product = currentProduct()
        if (!product?.id) throw new Error('The product draft is no longer available')
        setStatus('busy', `Preparing ${index + 1} of ${files.length} · ${file.name}`)

        const presign = await requestJson('/api/studio/media-presign', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            product_id: product.id,
            filename: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          }),
        })

        const uploadHeaders = new Headers()
        Object.entries(presign.headers || {}).forEach(([key, value]) => {
          if (typeof value === 'string' && value) uploadHeaders.set(key, value)
        })

        setStatus('busy', `Uploading ${index + 1} of ${files.length} · ${file.name}`)
        let uploaded
        try {
          uploaded = await fetch(presign.upload_url, {
            method: presign.method || 'PUT',
            headers: uploadHeaders,
            body: file,
            credentials: 'omit',
          })
        } catch {
          throw new Error('Managed storage could not be reached from this browser. Check the storage CORS policy for the Studio origin.')
        }
        if (!uploaded.ok) {
          throw new Error(`Managed storage rejected ${file.name}.`)
        }

        const fresh = currentProduct()
        const attached = await requestJson('/api/studio/media-attach', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            product_id: fresh.id,
            file_key: presign.file_key,
            expected_updated_at: fresh.updated_at || '',
            set_cover: imageUrls(fresh).length === 0,
          }),
        })
        studioApi()?.mergeProduct?.(attached.product, false)
      }
      lastStatus = { mode: 'success', text: `${files.length} ${files.length === 1 ? 'image' : 'images'} saved to the draft` }
      studioApi()?.refresh?.()
    } catch (error) {
      if (error.code === 'stale_draft') {
        lastStatus = { mode: 'error', text: 'The draft changed elsewhere. Reload it before adding more media.' }
      } else {
        lastStatus = { mode: 'error', text: error.message || 'Managed image upload failed' }
      }
      setStatus(lastStatus.mode, lastStatus.text)
    } finally {
      busy = false
      root.querySelector('.np-media-manager')?.setAttribute('aria-busy', 'false')
    }
  }

  async function applyOrder(orderedUrls, coverUrl, successText) {
    if (busy) return
    busy = true
    root.querySelector('.np-media-manager')?.setAttribute('aria-busy', 'true')
    try {
      await flushDraft()
      const product = currentProduct()
      if (!product?.id) throw new Error('The product draft is no longer available')
      setStatus('busy', 'Saving image order…')
      const payload = await requestJson('/api/studio/media-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          ordered_urls: orderedUrls,
          cover_url: coverUrl,
          expected_updated_at: product.updated_at || '',
        }),
      })
      lastStatus = { mode: 'success', text: successText }
      studioApi()?.mergeProduct?.(payload.product, true)
    } catch (error) {
      lastStatus = {
        mode: 'error',
        text: error.code === 'stale_draft'
          ? 'The draft changed elsewhere. Reload it before changing media.'
          : error.message || 'Image order could not be saved',
      }
      setStatus(lastStatus.mode, lastStatus.text)
    } finally {
      busy = false
      root.querySelector('.np-media-manager')?.setAttribute('aria-busy', 'false')
    }
  }

  function moveImage(index, direction) {
    const product = currentProduct()
    const urls = imageUrls(product)
    const target = index + direction
    if (target < 0 || target >= urls.length) return
    const next = [...urls]
    ;[next[index], next[target]] = [next[target], next[index]]
    const cover = product.thumbnail && next.includes(product.thumbnail) ? product.thumbnail : next[0]
    applyOrder(next, cover, 'Image order saved')
  }

  function setCover(index) {
    const urls = imageUrls()
    const selected = urls[index]
    if (!selected) return
    applyOrder([selected, ...urls.filter((url) => url !== selected)], selected, 'Cover image updated')
  }

  function removeImage(index) {
    const product = currentProduct()
    const urls = imageUrls(product)
    if (urls.length <= 1) {
      setStatus('error', 'Upload a replacement before removing the only product image.')
      return
    }
    const selected = urls[index]
    if (!selected) return
    const next = urls.filter((_, position) => position !== index)
    const cover = product.thumbnail === selected || !next.includes(product.thumbnail) ? next[0] : product.thumbnail
    applyOrder(next, cover, 'Image detached from this draft')
  }

  function bindManager() {
    const manager = root.querySelector('.np-media-manager')
    if (!manager || manager.dataset.bound === 'true') return
    manager.dataset.bound = 'true'

    const input = manager.querySelector('#np-media-input')
    const drop = manager.querySelector('#np-media-drop')
    manager.querySelector('#np-media-choose')?.addEventListener('click', () => input?.click())
    input?.addEventListener('change', () => {
      uploadFiles(input.files)
      input.value = ''
    })

    drop?.addEventListener('dragenter', (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return
      event.preventDefault()
      drop.classList.add('dragging')
    })
    drop?.addEventListener('dragover', (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return
      event.preventDefault()
      drop.classList.add('dragging')
    })
    drop?.addEventListener('dragleave', () => drop.classList.remove('dragging'))
    drop?.addEventListener('drop', (event) => {
      if (!event.dataTransfer?.files?.length) return
      event.preventDefault()
      drop.classList.remove('dragging')
      uploadFiles(event.dataTransfer.files)
    })

    manager.querySelectorAll('[data-media-cover]').forEach((button) => button.addEventListener('click', () => setCover(Number(button.dataset.mediaCover))))
    manager.querySelectorAll('[data-media-left]').forEach((button) => button.addEventListener('click', () => moveImage(Number(button.dataset.mediaLeft), -1)))
    manager.querySelectorAll('[data-media-right]').forEach((button) => button.addEventListener('click', () => moveImage(Number(button.dataset.mediaRight), 1)))
    manager.querySelectorAll('[data-media-remove]').forEach((button) => button.addEventListener('click', () => removeImage(Number(button.dataset.mediaRemove))))

    manager.querySelectorAll('.np-media-card').forEach((card) => {
      card.addEventListener('dragstart', (event) => {
        dragIndex = Number(card.dataset.mediaIndex)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
      })
      card.addEventListener('dragover', (event) => {
        event.preventDefault()
        card.classList.add('drag-target')
      })
      card.addEventListener('dragleave', () => card.classList.remove('drag-target'))
      card.addEventListener('drop', (event) => {
        event.preventDefault()
        card.classList.remove('drag-target')
        const targetIndex = Number(card.dataset.mediaIndex)
        if (!Number.isInteger(dragIndex) || dragIndex === targetIndex) return
        const product = currentProduct()
        const urls = imageUrls(product)
        const next = [...urls]
        const [moved] = next.splice(dragIndex, 1)
        next.splice(targetIndex, 0, moved)
        dragIndex = null
        const cover = product.thumbnail && next.includes(product.thumbnail) ? product.thumbnail : next[0]
        applyOrder(next, cover, 'Image order saved')
      })
      card.addEventListener('dragend', () => {
        dragIndex = null
        manager.querySelectorAll('.drag-target').forEach((node) => node.classList.remove('drag-target'))
      })
    })
  }

  function enhanceVisualStep() {
    if (root.hidden) return
    const form = root.querySelector('#np-form')
    const visualNotes = form?.elements?.visual_notes
    const product = currentProduct()
    if (!form || !visualNotes || !product?.id) return

    const intro = root.querySelector('.new-piece-intro>p')
    if (intro) intro.textContent = 'Upload, order and choose the cover from COQUETTE managed storage, then keep a private note for the visual direction.'

    const safety = form.querySelector('.new-piece-safety')
    if (safety) {
      safety.innerHTML = '<strong>Media is governed.</strong><p>Files receive a short-lived permission for this exact draft, upload directly to managed S3-compatible storage, and are verified again before Medusa can attach them. No external image URL field exists.</p>'
    }

    let manager = form.querySelector('.np-media-manager')
    if (!manager) {
      const anchor = form.querySelector('.np-field')
      if (anchor) anchor.insertAdjacentHTML('beforebegin', managerMarkup(product))
      manager = form.querySelector('.np-media-manager')
    }
    if (manager) bindManager()
  }

  const observer = new MutationObserver(() => queueMicrotask(enhanceVisualStep))
  observer.observe(root, { childList: true, subtree: true })
  document.addEventListener('DOMContentLoaded', enhanceVisualStep)
  enhanceVisualStep()
})()
