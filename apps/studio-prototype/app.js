(() => {
  const loginForm = document.querySelector('#login-form')
  const passwordInput = document.querySelector('#password')
  const revealButton = document.querySelector('#reveal-password')
  const loginButton = document.querySelector('#login-button')
  const loginError = document.querySelector('#login-error')

  if (revealButton && passwordInput) {
    revealButton.addEventListener('click', () => {
      const isHidden = passwordInput.type === 'password'
      passwordInput.type = isHidden ? 'text' : 'password'
      revealButton.textContent = isHidden ? 'Hide' : 'Show'
      revealButton.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password')
    })
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
      event.preventDefault()
      const email = document.querySelector('#email')
      const password = document.querySelector('#password')

      loginError.textContent = ''

      if (!email?.value.trim() || !password?.value.trim()) {
        loginError.textContent = 'Συμπληρώστε email και password για να συνεχίσετε.'
        ;(!email?.value.trim() ? email : password)?.focus()
        return
      }

      const now = new Date().toISOString()
      const previousLogin = window.localStorage.getItem('coquette-last-login')
      if (previousLogin) window.localStorage.setItem('coquette-previous-login', previousLogin)
      window.localStorage.setItem('coquette-last-login', now)

      loginButton.disabled = true
      loginButton.textContent = 'Entering Studio…'

      window.setTimeout(() => window.location.assign('/today'), 520)
    })
  }

  const shell = document.querySelector('#studio-shell')
  const collapseButton = document.querySelector('#sidebar-collapse')
  const mobileMenu = document.querySelector('#mobile-menu')

  if (shell && collapseButton) {
    collapseButton.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 820px)').matches) {
        shell.classList.remove('mobile-nav-open')
        return
      }

      shell.classList.toggle('sidebar-is-collapsed')
      const expanded = !shell.classList.contains('sidebar-is-collapsed')
      collapseButton.setAttribute('aria-expanded', String(expanded))
      collapseButton.setAttribute('aria-label', expanded ? 'Collapse navigation' : 'Expand navigation')
      window.localStorage.setItem('coquette-sidebar-collapsed', expanded ? '0' : '1')
    })

    if (window.localStorage.getItem('coquette-sidebar-collapsed') === '1' && !window.matchMedia('(max-width: 820px)').matches) {
      shell.classList.add('sidebar-is-collapsed')
      collapseButton.setAttribute('aria-expanded', 'false')
    }
  }

  if (shell && mobileMenu) {
    mobileMenu.addEventListener('click', () => shell.classList.toggle('mobile-nav-open'))
  }

  document.querySelectorAll('.nav-group-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const group = button.closest('.nav-group')
      if (!group) return
      group.classList.toggle('open')
      button.setAttribute('aria-expanded', String(group.classList.contains('open')))
    })
  })

  const routeByHash = {
    '#products': '/products',
  }

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    const target = routeByHash[anchor.getAttribute('href')]
    if (!target) return
    anchor.addEventListener('click', (event) => {
      event.preventDefault()
      window.location.assign(target)
    })
  })

  document.querySelectorAll('.quick-create').forEach((button) => {
    if (button.tagName === 'A') return
    button.addEventListener('click', () => window.location.assign('/products/new'))
  })

  const dateNode = document.querySelector('#today-date')
  if (dateNode) {
    const date = new Intl.DateTimeFormat('el-GR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
    dateNode.textContent = date.charAt(0).toUpperCase() + date.slice(1)
  }

  const commands = [
    { label: 'Νέο κομμάτι', detail: 'Ξεκινήστε guided product onboarding', href: '/products/new', keywords: 'new product piece νέο προϊόν κομμάτι' },
    { label: 'Η Boutique', detail: 'Προϊόντα, drafts, stock και merchandising', href: '/products', keywords: 'products boutique stock προϊόντα' },
    { label: 'Σήμερα', detail: 'Επιστροφή στον προσωπικό σας assistant', href: '/today', keywords: 'today dashboard σήμερα assistant' },
    { label: 'Παραγγελίες', detail: 'Coming next in the prototype', href: '#', keywords: 'orders παραγγελίες' },
    { label: 'Clients', detail: 'Coming next in the prototype', href: '#', keywords: 'clients customers πελάτες' },
    { label: 'AADE / myDATA', detail: 'Coming next in the prototype', href: '#', keywords: 'aade mydata fiscal' },
  ]

  function ensureCommandPalette() {
    let overlay = document.querySelector('#coquette-command-palette')
    if (overlay) return overlay

    overlay = document.createElement('div')
    overlay.id = 'coquette-command-palette'
    overlay.hidden = true
    overlay.innerHTML = `
      <div class="command-backdrop" data-command-close></div>
      <section class="command-panel" role="dialog" aria-modal="true" aria-label="COQUETTE command palette">
        <div class="command-input-row"><span>⌕</span><input id="command-input" type="search" placeholder="Τι θέλετε να κάνετε;" autocomplete="off" /><kbd>ESC</kbd></div>
        <div class="command-results" id="command-results"></div>
        <footer>COQUETTE Studio · type an action, product area or workspace</footer>
      </section>`
    document.body.appendChild(overlay)

    const style = document.createElement('style')
    style.textContent = `
      #coquette-command-palette{position:fixed;inset:0;z-index:1000}
      #coquette-command-palette[hidden]{display:none}
      .command-backdrop{position:absolute;inset:0;background:rgba(25,22,19,.28);backdrop-filter:blur(5px)}
      .command-panel{position:relative;width:min(92vw,650px);margin:12vh auto 0;border:1px solid rgba(23,22,20,.14);background:#f8f5f0;box-shadow:0 28px 90px rgba(32,27,22,.2)}
      .command-input-row{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:13px;min-height:66px;padding:0 20px;border-bottom:1px solid rgba(23,22,20,.12);color:#8e877e}
      .command-input-row input{width:100%;border:0;outline:0;background:transparent;color:#171614;font-family:Didot,'Bodoni MT','Times New Roman',serif;font-size:19px}
      .command-input-row kbd{font:9px 'Helvetica Neue',Arial,sans-serif;letter-spacing:.08em}
      .command-results{max-height:430px;overflow:auto;padding:8px}
      .command-item{display:flex;width:100%;align-items:center;justify-content:space-between;gap:25px;padding:15px 14px;border:0;background:transparent;color:#171614;cursor:pointer;text-align:left}
      .command-item:hover,.command-item.active{background:#eee8e0}
      .command-item strong{display:block;font-family:Didot,'Bodoni MT','Times New Roman',serif;font-size:17px;font-weight:400}
      .command-item small{display:block;margin-top:3px;color:#777169;font-size:9px}
      .command-item span:last-child{color:#9d968d;font-size:13px}
      .command-panel footer{padding:13px 20px;border-top:1px solid rgba(23,22,20,.12);color:#9d968d;font-size:8px;letter-spacing:.08em;text-transform:uppercase}
    `
    document.head.appendChild(style)

    overlay.querySelector('[data-command-close]').addEventListener('click', closePalette)
    overlay.querySelector('#command-input').addEventListener('input', renderCommands)
    return overlay
  }

  function renderCommands() {
    const overlay = ensureCommandPalette()
    const input = overlay.querySelector('#command-input')
    const results = overlay.querySelector('#command-results')
    const query = input.value.trim().toLowerCase()
    const shown = commands.filter((command) => !query || `${command.label} ${command.detail} ${command.keywords}`.toLowerCase().includes(query))
    results.innerHTML = shown.length ? shown.map((command, index) => `
      <button class="command-item${index === 0 ? ' active' : ''}" type="button" data-command-href="${command.href}">
        <span><strong>${command.label}</strong><small>${command.detail}</small></span><span>→</span>
      </button>`).join('') : '<div style="padding:28px 15px;color:#777169;font-family:Didot,serif">Δεν βρέθηκε κάτι — δοκιμάστε άλλη λέξη.</div>'
    results.querySelectorAll('[data-command-href]').forEach((button) => button.addEventListener('click', () => {
      const href = button.dataset.commandHref
      if (href && href !== '#') window.location.assign(href)
    }))
  }

  function openPalette() {
    const overlay = ensureCommandPalette()
    overlay.hidden = false
    renderCommands()
    window.setTimeout(() => overlay.querySelector('#command-input')?.focus(), 20)
  }

  function closePalette() {
    const overlay = document.querySelector('#coquette-command-palette')
    if (overlay) overlay.hidden = true
  }

  document.querySelectorAll('.command-trigger').forEach((button) => button.addEventListener('click', openPalette))
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      openPalette()
    }
    if (event.key === 'Escape') closePalette()
    if (event.key === 'Enter') {
      const overlay = document.querySelector('#coquette-command-palette:not([hidden])')
      const active = overlay?.querySelector('.command-item.active')
      if (active) active.click()
    }
  })

  window.addEventListener('resize', () => {
    if (!shell) return
    if (!window.matchMedia('(max-width: 820px)').matches) shell.classList.remove('mobile-nav-open')
  })
})()
