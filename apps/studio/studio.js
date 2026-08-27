(() => {
  const boot = document.querySelector('#boot')
  const studio = document.querySelector('#studio')
  const body = document.body
  let summary = null

  const commands = [
    ['Σήμερα', 'Your assistant-first dashboard', 'today'],
    ['Η Boutique', 'Products, stock and merchandising', 'boutique'],
    ['Παραγγελίες', 'Recent live Medusa orders', 'orders'],
    ['Client Book', 'Relationship-first customer workspace', 'clients'],
    ['Website', 'Homepage, media and SEO', 'website'],
    ['Operations', 'Payments, shipping and fiscal', 'operations'],
  ]

  function setView(name) {
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('active', screen.id === `view-${name}`))
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === name))
    document.querySelector('#drawer')?.classList.remove('open')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function formatMoney(value, currency = 'eur') {
    if (typeof value !== 'number') return '—'
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: String(currency).toUpperCase() }).format(value)
  }

  function formatDate(value) {
    if (!value) return ''
    return new Intl.DateTimeFormat('el-GR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  }

  function orderMarkup(orders) {
    if (!orders?.length) return '<p class="empty">Δεν υπάρχουν παραγγελίες ακόμη.</p>'
    return orders.map((order) => `<article class="order-row"><div><strong>#${order.display_id ?? order.id}</strong><span>${formatDate(order.created_at)}</span></div><div><span>${order.email || 'Client'}</span><small>${order.fulfillment_status || '—'} · ${order.payment_status || '—'}</small></div><b>${formatMoney(order.total, order.currency_code)}</b></article>`).join('')
  }

  async function loadSummary() {
    const state = document.querySelector('#live-state')
    state.textContent = 'Refreshing'
    try {
      const response = await fetch('/api/studio/summary', { credentials: 'same-origin' })
      if (response.status === 401) return window.location.replace('/')
      if (!response.ok) throw new Error('summary unavailable')
      summary = await response.json()
      document.querySelector('#metric-products').textContent = String(summary.products?.count ?? 0)
      document.querySelector('#metric-orders').textContent = String(summary.orders?.count ?? 0)
      const latest = summary.orders?.items?.[0]
      document.querySelector('#metric-latest').textContent = latest ? `#${latest.display_id ?? latest.id}` : '—'
      document.querySelector('#metric-latest-time').textContent = latest ? formatDate(latest.created_at) : 'Καμία παραγγελία ακόμη'
      const markup = orderMarkup(summary.orders?.items)
      document.querySelector('#recent-orders').innerHTML = markup
      document.querySelector('#orders-view').innerHTML = markup
      document.querySelector('#assistant-copy').innerHTML = summary.orders?.count
        ? `Το κατάστημά σας είναι συνδεδεμένο. Βλέπω <strong>${summary.orders.count}</strong> παραγγελίες και <strong>${summary.products?.count ?? 0}</strong> προϊόντα χωρίς να σας δείχνω τεχνικό θόρυβο.`
        : `Το κατάστημά σας είναι συνδεδεμένο. Δεν υπάρχουν ακόμη παραγγελίες που να απαιτούν αφήγηση ή προτεραιοποίηση.`
      document.querySelector('#assistant-note').textContent = latest
        ? `Η πιο πρόσφατη παραγγελία είναι #${latest.display_id ?? latest.id}, ${formatDate(latest.created_at)}. Το επόμενο βήμα είναι να συνδέσουμε ασφαλείς operational actions πάνω σε αυτά τα live δεδομένα.`
        : 'Δεν υπάρχουν πραγματικές παραγγελίες ακόμη. Το Studio δεν δημιουργεί demo activity στην production προβολή.'
      state.textContent = summary.partial ? 'Live · partial' : 'Live'
    } catch {
      state.textContent = 'Connection issue'
      document.querySelector('#assistant-copy').textContent = 'Η σύνδεση με το commerce backend δεν απάντησε. Καμία πληροφορία δεν μαντεύτηκε.'
    }
  }

  async function init() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' })
      if (!response.ok) return window.location.replace('/')
      const payload = await response.json()
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
  })
  document.querySelector('#collapse')?.addEventListener('click', () => body.classList.toggle('rail'))
  document.querySelector('#focus')?.addEventListener('click', () => body.classList.toggle('focus'))
  document.querySelector('#refresh')?.addEventListener('click', loadSummary)
  document.querySelector('#new-piece')?.addEventListener('click', () => setView('boutique'))
  document.querySelector('#logout')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
    window.location.replace('/')
  })

  const drawer = document.querySelector('#drawer')
  document.querySelector('#assistant-tab')?.addEventListener('click', () => drawer.classList.add('open'))
  document.querySelector('#drawer-close')?.addEventListener('click', () => drawer.classList.remove('open'))

  const palette = document.querySelector('#palette')
  const paletteInput = document.querySelector('#palette-input')
  const paletteResults = document.querySelector('#palette-results')
  function renderPalette() {
    const q = paletteInput.value.trim().toLowerCase()
    const items = commands.filter(([a,b]) => !q || `${a} ${b}`.toLowerCase().includes(q))
    paletteResults.innerHTML = items.map(([label, detail, view]) => `<button data-view="${view}"><span><strong>${label}</strong><small>${detail}</small></span><b>→</b></button>`).join('')
  }
  function openPalette() { palette.hidden = false; renderPalette(); setTimeout(() => paletteInput.focus(), 10) }
  function closePalette() { palette.hidden = true }
  document.querySelector('#command')?.addEventListener('click', openPalette)
  palette?.addEventListener('click', (event) => { if (event.target === palette || event.target.closest('[data-view]')) closePalette() })
  paletteInput?.addEventListener('input', renderPalette)
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette() }
    if (event.key === 'Escape') { closePalette(); drawer.classList.remove('open') }
  })

  init()
})()
