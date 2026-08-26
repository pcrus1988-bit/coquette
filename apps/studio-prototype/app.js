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
      if (previousLogin) {
        window.localStorage.setItem('coquette-previous-login', previousLogin)
      }
      window.localStorage.setItem('coquette-last-login', now)

      loginButton.disabled = true
      loginButton.textContent = 'Entering Studio…'

      window.setTimeout(() => {
        window.location.assign('/today')
      }, 520)
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
    })
  }

  if (shell && mobileMenu) {
    mobileMenu.addEventListener('click', () => {
      shell.classList.toggle('mobile-nav-open')
    })
  }

  document.querySelectorAll('.nav-group-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const group = button.closest('.nav-group')
      if (!group) return
      group.classList.toggle('open')
      button.setAttribute('aria-expanded', String(group.classList.contains('open')))
    })
  })

  const dateNode = document.querySelector('#today-date')
  if (dateNode) {
    const date = new Intl.DateTimeFormat('el-GR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date())
    dateNode.textContent = date.charAt(0).toUpperCase() + date.slice(1)
  }

  window.addEventListener('resize', () => {
    if (!shell) return
    if (!window.matchMedia('(max-width: 820px)').matches) {
      shell.classList.remove('mobile-nav-open')
    }
  })
})()
