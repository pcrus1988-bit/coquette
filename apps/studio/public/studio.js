(() => {
  const boot = document.querySelector('#boot')
  const studio = document.querySelector('#studio')
  const body = document.body
  const overlay = document.querySelector('#overlay')
  const workspaceDrawer = document.querySelector('#workspace-drawer')
  const workspaceBody = document.querySelector('#workspace-body')
  const workspaceTitle = document.querySelector('#workspace-title')
  const workspaceEyebrow = document.querySelector('#workspace-eyebrow')
  let summary = null
  let currentView = 'today'

  const productState = { limit: 24, offset: 0, count: 0, q: '', status: '', loaded: false, mode: 'grid', timer: null }
  const orderState = { limit: 25, offset: 0, count: 0, q: '', filter: 'all', loaded: false, items: [], timer: null }

  const commands = [
    { label: 'Σήμερα', detail: 'Your assistant-first dashboard', view: 'today' },
    { label: 'Η Boutique', detail: 'Live products and merchandising', view: 'boutique' },
    { label: 'Νέο κομμάτι', detail: 'Create a safe unpublished product draft', action: 'new-piece' },
    { label: 'Παραγγελίες', detail: 'Live order stories', view: 'orders' },
    { label: 'Client Book', detail: 'Relationship-first customer workspace', view: 'clients' },
    { label: 'Website', detail: 'Homepage, media and SEO', view: 'website' },
    { label: 'Operations', detail: 'Payments, shipping and fiscal', view: 'operations' },
  ]

  const paymentLabels = {
    captured: 'Πληρωμένη', paid: 'Πληρωμένη', authorized: 'Εγκεκριμένη πληρωμή',
    awaiting: 'Αναμονή πληρωμής', not_paid: 'Δεν έχει πληρωθεί', partially_refunded: 'Μερική επιστροφή',
    refunded: 'Επιστροφή χρημάτων', canceled: 'Ακυρωμένη πληρωμή', requires_action: 'Χρειάζεται ενέργεια',
  }
  const fulfillmentLabels = {
    not_fulfilled: 'Νέα · προς προετοιμασία', partially_fulfilled: 'Μερικώς προετοιμασμένη',
    fulfilled: 'Εκπληρωμένη', partially_shipped: 'Μερικώς απεσταλμένη', shipped: 'Απεσταλμένη',
    partially_delivered: 'Μερικώς παραδομένη', delivered: 'Παραδομένη', canceled: 'Ακυρωμένη εκπλήρωση',
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  function humanize(value) {
    if (!value) return '—'
    return String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  function paymentLabel(value) { return paymentLabels[value] || humanize(value) }
  function fulfillmentLabel(value) { return fulfillmentLabels[value] || humanize(value) }
  function productStatusLabel(value) {
    if (value === 'published') return 'Δημοσιευμένο'
    if (value === 'draft') return 'Draft'
    if (value === 'proposed') return 'Προτεινόμενο'
    if (value === 'rejected') return 'Μη ενεργό'
    return humanize(value)
  }

  function formatMoney(value, currency = 'eur') {
    if (typeof value !== 'number') return '—'
    try {
      return new Intl.NumberFormat('el-GR', { style: 'currency', currency: String(currency || 'eur').toUpperCase() }).format(value)
    } catch {
      return `${value} ${String(currency || '').toUpperCase()}`.trim()
    }
  }

  function formatDate(value, withTime = true) {
    if (!value) return '—'
    const options = withTime
      ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
    try { return new Intl.DateTimeFormat('el-GR', options).format(new Date(value)) } catch { return '—' }
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options })
    if (response.status === 401) {
      window.location.replace('/')
      throw new Error('Unauthorized')
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.message || 'Request failed')
    return payload
  }

  function setView(name) {
    currentView = name
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('active', screen.id === `view-${name}`))
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === name))
    document.querySelector('#drawer')?.classList.remove('open')
    closeWorkspace()
    if (name === 'boutique' && !productState.loaded) loadProducts()
    if (name === 'orders' && !orderState.loaded) loadOrders()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function recentOrderMarkup(orders) {
    if (!orders?.length) return '<p class="empty">Δεν υπάρχουν παραγγελίες ακόμη.</p>'
    return orders.map((order) => `
      <button class="order-row interactive" data-order-id="${escapeHtml(order.id)}">
        <div><strong>#${escapeHtml(order.display_id ?? order.id)}</strong><span>${escapeHtml(formatDate(order.created_at))}</span></div>
        <div><span>${escapeHtml(order.email || 'Client')}</span><small>${escapeHtml(fulfillmentLabel(order.fulfillment_status))} · ${escapeHtml(paymentLabel(order.payment_status))}</small></div>
        <b>${escapeHtml(formatMoney(order.total, order.currency_code))}</b>
      </button>`).join('')
  }

  async function loadSummary() {
    const state = document.querySelector('#live-state')
    state.textContent = 'Refreshing'
    try {
      summary = await requestJson('/api/studio/summary')
      document.querySelector('#metric-products').textContent = String(summary.products?.count ?? 0)
      document.querySelector('#metric-orders').textContent = String(summary.orders?.count ?? 0)
      const latest = summary.orders?.items?.[0]
      document.querySelector('#metric-latest').textContent = latest ? `#${latest.display_id ?? latest.id}` : '—'
      document.querySelector('#metric-latest-time').textContent = latest ? formatDate(latest.created_at) : 'Καμία παραγγελία ακόμη'
      document.querySelector('#recent-orders').innerHTML = recentOrderMarkup(summary.orders?.items)
      document.querySelector('#assistant-copy').innerHTML = summary.orders?.count
        ? `Το κατάστημά σας είναι συνδεδεμένο. Βλέπω <strong>${escapeHtml(summary.orders.count)}</strong> παραγγελίες και <strong>${escapeHtml(summary.products?.count ?? 0)}</strong> προϊόντα χωρίς να σας δείχνω τεχνικό θόρυβο.`
        : 'Το κατάστημά σας είναι συνδεδεμένο. Δεν υπάρχουν ακόμη παραγγελίες που να απαιτούν αφήγηση ή προτεραιοποίηση.'
      document.querySelector('#assistant-note').textContent = latest
        ? `Η πιο πρόσφατη παραγγελία είναι #${latest.display_id ?? latest.id}, ${formatDate(latest.created_at)}. Μπορείτε πλέον να ανοίξετε ολόκληρο το Order Story της μέσα από το Studio.`
        : 'Δεν υπάρχουν πραγματικές παραγγελίες ακόμη. Το Studio δεν δημιουργεί demo activity στην production προβολή.'
      state.textContent = summary.partial ? 'Live · partial' : 'Live'
    } catch {
      state.textContent = 'Connection issue'
      document.querySelector('#assistant-copy').textContent = 'Η σύνδεση με το commerce backend δεν απάντησε. Καμία πληροφορία δεν μαντεύτηκε.'
    }
  }

  function renderProducts(products) {
    const grid = document.querySelector('#product-grid')
    if (!products.length) {
      grid.innerHTML = `<div class="catalogue-empty"><div><strong>Δεν βρέθηκαν κομμάτια.</strong><span>${productState.q ? 'Δοκιμάστε διαφορετική αναζήτηση.' : 'Η boutique δεν έχει προϊόντα σε αυτή την προβολή.'}</span></div></div>`
      return
    }
    grid.innerHTML = products.map((product) => `
      <button class="product-card" data-product-id="${escapeHtml(product.id)}">
        <div class="product-media">${product.thumbnail ? `<img src="${escapeHtml(product.thumbnail)}" alt="" loading="lazy" />` : '<span class="media-placeholder">COQUETTE</span>'}</div>
        <div class="product-copy">
          <div class="product-meta"><span>${escapeHtml(product.primary_sku || 'COQUETTE catalogue')}</span><b class="status-pill ${escapeHtml(product.status)}">${escapeHtml(productStatusLabel(product.status))}</b></div>
          <h3>${escapeHtml(product.title || 'Untitled piece')}</h3>
          <p>${escapeHtml(product.variant_count ? `${product.variant_count} επιλογές` : 'Χωρίς επιλογές ακόμη')} · ενημ. ${escapeHtml(formatDate(product.updated_at, false))}</p>
        </div>
      </button>`).join('')
  }

  function updateProductPager() {
    const start = productState.count ? productState.offset + 1 : 0
    const end = Math.min(productState.offset + productState.limit, productState.count)
    document.querySelector('#products-page').textContent = `${start}–${end} / ${productState.count}`
    document.querySelector('#products-prev').disabled = productState.offset <= 0
    document.querySelector('#products-next').disabled = productState.offset + productState.limit >= productState.count
    document.querySelector('#product-count').textContent = `${productState.count} ${productState.count === 1 ? 'κομμάτι' : 'κομμάτια'}`
  }

  async function loadProducts(reset = false) {
    if (reset) productState.offset = 0
    const grid = document.querySelector('#product-grid')
    grid.innerHTML = '<div class="catalogue-empty"><div><strong>Φόρτωση boutique…</strong><span>Ανακτώ το live catalogue.</span></div></div>'
    const params = new URLSearchParams({ limit: String(productState.limit), offset: String(productState.offset) })
    if (productState.q) params.set('q', productState.q)
    if (productState.status) params.set('status', productState.status)
    try {
      const payload = await requestJson(`/api/studio/products?${params.toString()}`)
      productState.count = payload.count || 0
      productState.loaded = true
      renderProducts(payload.products || [])
      updateProductPager()
    } catch (error) {
      grid.innerHTML = `<div class="catalogue-empty"><div><strong>Η boutique δεν απάντησε.</strong><span>${escapeHtml(error.message)}</span></div></div>`
    }
  }

  function orderNeedsAttention(order) {
    const payment = order.payment_status
    const fulfillment = order.fulfillment_status
    return ['requires_action', 'not_paid', 'awaiting'].includes(payment) || ['not_fulfilled', 'partially_fulfilled'].includes(fulfillment)
  }

  function filterOrders(orders) {
    if (orderState.filter === 'attention') return orders.filter(orderNeedsAttention)
    if (orderState.filter === 'paid') return orders.filter((order) => ['paid', 'captured', 'authorized'].includes(order.payment_status))
    if (orderState.filter === 'shipped') return orders.filter((order) => ['shipped', 'partially_shipped', 'delivered', 'fulfilled'].includes(order.fulfillment_status))
    return orders
  }

  function renderOrders() {
    const orders = filterOrders(orderState.items)
    const list = document.querySelector('#orders-view')
    if (!orders.length) {
      list.innerHTML = '<p class="empty">Δεν υπάρχουν παραγγελίες σε αυτή την προβολή.</p>'
      return
    }
    list.innerHTML = orders.map((order) => `
      <button class="order-row interactive" data-order-id="${escapeHtml(order.id)}">
        <div><strong>#${escapeHtml(order.display_id ?? order.id)}</strong><span>${escapeHtml(formatDate(order.created_at))}</span></div>
        <div><span>${escapeHtml(order.email || 'Client')}</span><small>${escapeHtml(fulfillmentLabel(order.fulfillment_status))}</small><em class="order-state">${escapeHtml(paymentLabel(order.payment_status))}</em></div>
        <b>${escapeHtml(formatMoney(order.total, order.currency_code))}</b>
      </button>`).join('')
  }

  function updateOrderPager() {
    const start = orderState.count ? orderState.offset + 1 : 0
    const end = Math.min(orderState.offset + orderState.limit, orderState.count)
    document.querySelector('#orders-page').textContent = `${start}–${end} / ${orderState.count}`
    document.querySelector('#orders-prev').disabled = orderState.offset <= 0
    document.querySelector('#orders-next').disabled = orderState.offset + orderState.limit >= orderState.count
    document.querySelector('#order-count').textContent = `${orderState.count} ${orderState.count === 1 ? 'παραγγελία' : 'παραγγελίες'}`
  }

  async function loadOrders(reset = false) {
    if (reset) orderState.offset = 0
    document.querySelector('#orders-view').innerHTML = '<p class="empty">Φόρτωση παραγγελιών…</p>'
    const params = new URLSearchParams({ limit: String(orderState.limit), offset: String(orderState.offset) })
    if (orderState.q) params.set('q', orderState.q)
    try {
      const payload = await requestJson(`/api/studio/orders?${params.toString()}`)
      orderState.items = payload.orders || []
      orderState.count = payload.count || 0
      orderState.loaded = true
      renderOrders()
      updateOrderPager()
    } catch (error) {
      document.querySelector('#orders-view').innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`
    }
  }

  function openWorkspace(eyebrow, title, markup = '<div class="drawer-loading">Loading…</div>') {
    workspaceEyebrow.textContent = eyebrow
    workspaceTitle.textContent = title
    workspaceBody.innerHTML = markup
    workspaceDrawer.classList.add('open')
    workspaceDrawer.setAttribute('aria-hidden', 'false')
    overlay.hidden = false
    overlay.classList.add('workspace-open')
  }

  function closeWorkspace() {
    workspaceDrawer?.classList.remove('open')
    workspaceDrawer?.setAttribute('aria-hidden', 'true')
    overlay?.classList.remove('workspace-open')
    if (overlay) overlay.hidden = true
  }

  function variantPrice(variant) {
    const price = variant?.prices?.find((candidate) => candidate?.currency_code === 'eur') || variant?.prices?.[0]
    return price ? formatMoney(price.amount, price.currency_code) : 'Τιμή δεν έχει οριστεί'
  }

  async function openProduct(productId) {
    openWorkspace('Product Studio', 'Το κομμάτι')
    try {
      const payload = await requestJson(`/api/studio/product?id=${encodeURIComponent(productId)}`)
      const product = payload.product
      workspaceTitle.textContent = product.title || 'Product Studio'
      const variants = product.variants?.length
        ? product.variants.map((variant) => `<div class="variant-row"><div><strong>${escapeHtml(variant.title)}</strong><small>${escapeHtml(variant.sku || variant.barcode || 'Δεν έχει SKU/barcode')}</small></div><b>${escapeHtml(variantPrice(variant))}</b></div>`).join('')
        : '<p class="empty">Δεν υπάρχουν επιλογές ακόμη.</p>'
      const description = product.description ? escapeHtml(product.description) : 'Δεν έχει προστεθεί ακόμη περιγραφή.'
      workspaceBody.innerHTML = `
        ${product.thumbnail ? `<img class="workspace-cover" src="${escapeHtml(product.thumbnail)}" alt="" />` : ''}
        <span class="status-pill ${escapeHtml(product.status)}">${escapeHtml(productStatusLabel(product.status))}</span>
        <div class="detail-grid">
          <div class="detail-cell"><span>Επιλογές</span><strong>${escapeHtml(product.variants?.length || 0)}</strong></div>
          <div class="detail-cell"><span>Handle</span><strong>${escapeHtml(product.handle || '—')}</strong></div>
          <div class="detail-cell"><span>Collection</span><strong>${escapeHtml(product.collection?.title || '—')}</strong></div>
          <div class="detail-cell"><span>Τελευταία αλλαγή</span><strong>${escapeHtml(formatDate(product.updated_at, false))}</strong></div>
        </div>
        <section class="detail-section"><h3>Η ιστορία του κομματιού</h3><p>${description}</p></section>
        <section class="detail-section"><h3>Επιλογές & τιμές</h3><div class="variant-list">${variants}</div></section>
        <div class="safe-boundary"><b></b><span>Αυτή η προβολή είναι live. Publishing, price changes και inventory mutations παραμένουν ρητές ενέργειες και δεν εκτελούνται από το detail drawer.</span></div>`
    } catch (error) {
      workspaceBody.innerHTML = `<div class="catalogue-empty"><div><strong>Το προϊόν δεν άνοιξε.</strong><span>${escapeHtml(error.message)}</span></div></div>`
    }
  }

  function addressMarkup(address) {
    if (!address) return 'Δεν υπάρχει διεύθυνση.'
    const name = [address.first_name, address.last_name].filter(Boolean).join(' ')
    const parts = [address.address_1, address.address_2, address.postal_code, address.city, address.country_code?.toUpperCase()].filter(Boolean)
    return [name, parts.join(', '), address.phone].filter(Boolean).map(escapeHtml).join('<br>') || 'Δεν υπάρχει διεύθυνση.'
  }

  async function openOrder(orderId) {
    openWorkspace('Order Story', 'Παραγγελία')
    try {
      const payload = await requestJson(`/api/studio/order?id=${encodeURIComponent(orderId)}`)
      const order = payload.order
      workspaceTitle.textContent = `Παραγγελία #${order.display_id ?? order.id}`
      const items = order.items?.length
        ? order.items.map((item) => `<div class="item-row"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml([item.variant_title, item.sku, `× ${item.quantity}`].filter(Boolean).join(' · '))}</small></div><b>${escapeHtml(formatMoney(item.total ?? (typeof item.unit_price === 'number' ? item.unit_price * item.quantity : null), order.currency_code))}</b></div>`).join('')
        : '<p class="empty">Δεν βρέθηκαν γραμμές παραγγελίας.</p>'
      const clientName = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ') || order.email || 'Client'
      workspaceBody.innerHTML = `
        <div class="detail-grid">
          <div class="detail-cell"><span>Client</span><strong>${escapeHtml(clientName)}</strong></div>
          <div class="detail-cell"><span>Σύνολο</span><strong>${escapeHtml(formatMoney(order.total, order.currency_code))}</strong></div>
          <div class="detail-cell"><span>Πληρωμή</span><strong>${escapeHtml(paymentLabel(order.payment_status))}</strong></div>
          <div class="detail-cell"><span>Εκπλήρωση</span><strong>${escapeHtml(fulfillmentLabel(order.fulfillment_status))}</strong></div>
        </div>
        <section class="detail-section"><h3>Τα κομμάτια</h3><div class="item-list">${items}</div></section>
        <section class="detail-section"><h3>Order Story</h3>
          <div class="story-line"><strong>Η παραγγελία δημιουργήθηκε</strong><span>${escapeHtml(formatDate(order.created_at))}</span></div>
          <div class="story-line"><strong>${escapeHtml(paymentLabel(order.payment_status))}</strong><span>Τρέχουσα κατάσταση πληρωμής. Δεν αποδίδεται τεχνητό timestamp.</span></div>
          <div class="story-line"><strong>${escapeHtml(fulfillmentLabel(order.fulfillment_status))}</strong><span>Τρέχουσα κατάσταση εκπλήρωσης από το live commerce record.</span></div>
        </section>
        <section class="detail-section"><h3>Αποστολή</h3><p>${addressMarkup(order.shipping_address)}</p></section>
        <section class="detail-section"><h3>Σύνοψη</h3><div class="detail-grid">
          <div class="detail-cell"><span>Υποσύνολο</span><strong>${escapeHtml(formatMoney(order.subtotal, order.currency_code))}</strong></div>
          <div class="detail-cell"><span>Μεταφορικά</span><strong>${escapeHtml(formatMoney(order.shipping_total, order.currency_code))}</strong></div>
          <div class="detail-cell"><span>Φόρος</span><strong>${escapeHtml(formatMoney(order.tax_total, order.currency_code))}</strong></div>
          <div class="detail-cell"><span>Σύνολο</span><strong>${escapeHtml(formatMoney(order.total, order.currency_code))}</strong></div>
        </div></section>`
    } catch (error) {
      workspaceBody.innerHTML = `<div class="catalogue-empty"><div><strong>Η παραγγελία δεν άνοιξε.</strong><span>${escapeHtml(error.message)}</span></div></div>`
    }
  }

  function openQuickDraft() {
    openWorkspace('New Piece', 'Ξεκινήστε ένα νέο κομμάτι', `
      <form class="quick-draft" id="quick-draft-form">
        <p class="quick-draft-note">Το Quick Draft δημιουργεί μόνο ένα <strong>μη δημοσιευμένο</strong> προϊόν. Δεν ορίζει τιμή, stock ή sales-channel visibility και δεν μπορεί να το δημοσιεύσει.</p>
        <label class="field"><span>Όνομα κομματιού</span><input name="title" maxlength="160" required autocomplete="off" placeholder="π.χ. Satin draped dress" /></label>
        <label class="field"><span>Πρώτη περιγραφή · προαιρετική</span><textarea name="description" maxlength="5000" placeholder="Μπορείτε να την ολοκληρώσετε αργότερα στο Product Studio."></textarea></label>
        <div class="draft-actions"><button class="primary" type="submit">Create draft</button><button class="text-action" type="button" id="draft-cancel">Ακύρωση</button></div>
        <p class="draft-feedback" id="draft-feedback"></p>
      </form>`)
    setTimeout(() => workspaceBody.querySelector('input[name="title"]')?.focus(), 20)
    workspaceBody.querySelector('#draft-cancel')?.addEventListener('click', closeWorkspace)
    workspaceBody.querySelector('#quick-draft-form')?.addEventListener('submit', createQuickDraft)
  }

  async function createQuickDraft(event) {
    event.preventDefault()
    const form = event.currentTarget
    const submit = form.querySelector('button[type="submit"]')
    const feedback = form.querySelector('#draft-feedback')
    const formData = new FormData(form)
    const title = String(formData.get('title') || '').trim()
    const description = String(formData.get('description') || '').trim()
    if (!title) return
    submit.disabled = true
    submit.textContent = 'Creating…'
    feedback.textContent = 'Δημιουργώ ασφαλές draft στο Medusa…'
    const requestId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-studio`
    try {
      const payload = await requestJson('/api/studio/product-drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, description, request_id: requestId }),
      })
      feedback.textContent = 'Το draft δημιουργήθηκε.'
      productState.loaded = false
      await Promise.all([loadSummary(), loadProducts(true)])
      await openProduct(payload.product.id)
    } catch (error) {
      feedback.textContent = error.message
      submit.disabled = false
      submit.textContent = 'Create draft'
    }
  }

  async function init() {
    try {
      const payload = await requestJson('/api/auth/me')
      document.querySelector('#user-email').textContent = payload.user?.email || 'COQUETTE Studio'
      const date = new Intl.DateTimeFormat('el-GR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
      document.querySelector('#today-date').textContent = date.charAt(0).toUpperCase() + date.slice(1)
      const hour = new Date().getHours()
      document.querySelector('#greeting').textContent = hour < 12 ? 'Καλημέρα.' : hour < 18 ? 'Καλό απόγευμα.' : 'Καλησπέρα.'
      boot.hidden = true
      studio.hidden = false
      loadSummary()
    } catch {
      window.location.replace('/')
    }
  }

  document.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-view]')
    if (viewButton) setView(viewButton.dataset.view)
    const productCard = event.target.closest('[data-product-id]')
    if (productCard) openProduct(productCard.dataset.productId)
    const orderRow = event.target.closest('[data-order-id]')
    if (orderRow) openOrder(orderRow.dataset.orderId)
  })

  document.querySelector('#collapse')?.addEventListener('click', () => body.classList.toggle('rail'))
  document.querySelector('#focus')?.addEventListener('click', () => body.classList.toggle('focus'))
  document.querySelector('#refresh')?.addEventListener('click', () => {
    loadSummary()
    if (currentView === 'boutique') loadProducts()
    if (currentView === 'orders') loadOrders()
  })
  document.querySelector('#new-piece')?.addEventListener('click', openQuickDraft)
  document.querySelector('#logout')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
    window.location.replace('/')
  })

  document.querySelectorAll('[data-product-view]').forEach((button) => button.addEventListener('click', () => {
    productState.mode = button.dataset.productView
    document.querySelectorAll('[data-product-view]').forEach((item) => item.classList.toggle('active', item === button))
    document.querySelector('#product-grid').classList.toggle('list-mode', productState.mode === 'list')
  }))
  document.querySelectorAll('[data-product-status]').forEach((button) => button.addEventListener('click', () => {
    productState.status = button.dataset.productStatus
    document.querySelectorAll('[data-product-status]').forEach((item) => item.classList.toggle('active', item === button))
    loadProducts(true)
  }))
  document.querySelector('#product-search')?.addEventListener('input', (event) => {
    clearTimeout(productState.timer)
    productState.timer = setTimeout(() => { productState.q = event.target.value.trim(); loadProducts(true) }, 280)
  })
  document.querySelector('#products-prev')?.addEventListener('click', () => { productState.offset = Math.max(0, productState.offset - productState.limit); loadProducts() })
  document.querySelector('#products-next')?.addEventListener('click', () => { productState.offset += productState.limit; loadProducts() })

  document.querySelectorAll('[data-order-filter]').forEach((button) => button.addEventListener('click', () => {
    orderState.filter = button.dataset.orderFilter
    document.querySelectorAll('[data-order-filter]').forEach((item) => item.classList.toggle('active', item === button))
    renderOrders()
  }))
  document.querySelector('#order-search')?.addEventListener('input', (event) => {
    clearTimeout(orderState.timer)
    orderState.timer = setTimeout(() => { orderState.q = event.target.value.trim(); loadOrders(true) }, 280)
  })
  document.querySelector('#orders-prev')?.addEventListener('click', () => { orderState.offset = Math.max(0, orderState.offset - orderState.limit); loadOrders() })
  document.querySelector('#orders-next')?.addEventListener('click', () => { orderState.offset += orderState.limit; loadOrders() })

  document.querySelector('#workspace-close')?.addEventListener('click', closeWorkspace)
  overlay?.addEventListener('click', closeWorkspace)

  const drawer = document.querySelector('#drawer')
  document.querySelector('#assistant-tab')?.addEventListener('click', () => drawer.classList.add('open'))
  document.querySelector('#drawer-close')?.addEventListener('click', () => drawer.classList.remove('open'))

  const palette = document.querySelector('#palette')
  const paletteInput = document.querySelector('#palette-input')
  const paletteResults = document.querySelector('#palette-results')
  function renderPalette() {
    const q = paletteInput.value.trim().toLowerCase()
    const items = commands.filter((item) => !q || `${item.label} ${item.detail}`.toLowerCase().includes(q))
    paletteResults.innerHTML = items.map((item) => {
      const index = commands.indexOf(item)
      return `<button data-command-index="${index}"><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span><b>→</b></button>`
    }).join('')
  }
  function openPalette() { palette.hidden = false; renderPalette(); setTimeout(() => paletteInput.focus(), 10) }
  function closePalette() { palette.hidden = true }
  document.querySelector('#command')?.addEventListener('click', openPalette)
  palette?.addEventListener('click', (event) => {
    if (event.target === palette) return closePalette()
    const choice = event.target.closest('[data-command-index]')
    if (!choice) return
    const command = commands[Number(choice.dataset.commandIndex)]
    closePalette()
    if (command?.view) setView(command.view)
    if (command?.action === 'new-piece') openQuickDraft()
  })
  paletteInput?.addEventListener('input', renderPalette)
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette() }
    if (event.key === 'Escape') { closePalette(); drawer.classList.remove('open'); closeWorkspace() }
  })

  init()
})()
