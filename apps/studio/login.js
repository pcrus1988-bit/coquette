(() => {
  const form = document.querySelector('#login-form')
  const email = document.querySelector('#email')
  const password = document.querySelector('#password')
  const error = document.querySelector('#login-error')
  const button = document.querySelector('#login-button')
  const reveal = document.querySelector('#reveal')

  fetch('/api/auth/me', { credentials: 'same-origin' }).then((response) => {
    if (response.ok) window.location.replace('/studio')
  }).catch(() => {})

  reveal?.addEventListener('click', () => {
    const hidden = password.type === 'password'
    password.type = hidden ? 'text' : 'password'
    reveal.textContent = hidden ? 'Hide' : 'Show'
  })

  form?.addEventListener('submit', async (event) => {
    event.preventDefault()
    error.textContent = ''
    if (!email.value.trim() || !password.value) {
      error.textContent = 'Συμπληρώστε email και password για να συνεχίσετε.'
      return
    }

    button.disabled = true
    button.textContent = 'Entering Studio…'
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email.value.trim(), password: password.value }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || 'Δεν ήταν δυνατή η σύνδεση.')
      window.location.replace('/studio')
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : 'Δεν ήταν δυνατή η σύνδεση.'
      button.disabled = false
      button.textContent = 'Enter Studio'
    }
  })
})()
