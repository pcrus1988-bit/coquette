(() => {
  const root = document.getElementById('operations-tax-panel')
  if (!root) return

  let state = null
  let reviewed = null

  const esc = (value) => String(value == null ? '' : value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;')

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      ...options,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload.message || `Request failed (${response.status})`)
      error.code = payload.code || 'request_failed'
      throw error
    }
    return payload
  }

  const statusMarkup = (current) => current.configured
    ? '<span class="ops-tax-status ready">Configured</span>'
    : '<span class="ops-tax-status">Not configured</span>'

  const blockerCopy = {
    multiple_default_tax_rates: 'More than one default tax rate exists.',
    foreign_tax_overrides_present: 'Additional tax rates exist outside this Studio workflow.',
    foreign_tax_rules_present: 'Tax rules or product/shipping overrides already exist.',
    external_tax_provider_present: 'An external tax provider is configured.',
    foreign_tax_subregions_present: 'Province or subregion tax configuration already exists.',
  }

  const render = () => {
    if (!state) {
      root.innerHTML = '<div class="ops-tax-loading">Loading store tax settings…</div>'
      return
    }

    if (state.blocked) {
      root.innerHTML = `
        <article class="ops-tax-card blocked">
          <div class="ops-tax-head"><div><p class="eyebrow">Store tax</p><h2>Needs technical review.</h2></div>${statusMarkup(state)}</div>
          <p>Studio found advanced tax configuration that it does not own. Nothing will be flattened, deleted or guessed.</p>
          <ul>${state.blockers.map((code) => `<li>${esc(blockerCopy[code] || code)}</li>`).join('')}</ul>
          <p class="ops-tax-footnote">Review this configuration in technical Medusa Admin before returning to the guarded Studio tax flow.</p>
        </article>`
      return
    }

    const rate = state.default_rate?.rate || ''
    const name = state.default_rate?.name || ''
    const code = state.default_rate?.code || ''
    root.innerHTML = `
      <article class="ops-tax-card">
        <div class="ops-tax-head">
          <div><p class="eyebrow">Store tax</p><h2>Greece · EUR</h2></div>${statusMarkup(state)}
        </div>
        <p class="ops-tax-intro">Set the explicit default checkout tax rate for the Greece tax region. Studio never assumes a VAT percentage.</p>
        <form id="ops-tax-form" class="ops-tax-form">
          <label><span>Default tax rate</span><div class="ops-tax-rate"><input id="ops-tax-rate" name="rate" inputmode="decimal" placeholder="Enter percentage" value="${esc(rate)}" required /><strong>%</strong></div></label>
          <label><span>Tax rate name</span><input id="ops-tax-name" name="name" maxlength="80" placeholder="e.g. Standard VAT" value="${esc(name)}" required /></label>
          <label><span>Code <small>optional</small></span><input id="ops-tax-code" name="code" maxlength="40" placeholder="Internal tax code" value="${esc(code)}" /></label>
          <label class="ops-tax-toggle"><input id="ops-tax-inclusive" type="checkbox" ${state.prices_include_tax ? 'checked' : ''}/><span><strong>Prices already include tax</strong><small>Controls Medusa price interpretation for the Greece region.</small></span></label>
          <div class="ops-tax-separation"><strong>Separate from AADE / myDATA</strong><span>This setting controls Medusa checkout tax calculation only. It does not decide invoice type, VAT/revenue classification, MARK/UID or any other fiscal-document treatment.</span></div>
          <div id="ops-tax-message" class="ops-tax-message" aria-live="polite"></div>
          <button class="primary ops-tax-review" type="submit">Review tax changes</button>
        </form>
        <div id="ops-tax-review" class="ops-tax-review-panel" hidden></div>
      </article>`

    document.getElementById('ops-tax-form')?.addEventListener('submit', review)
  }

  const values = () => ({
    default_rate: document.getElementById('ops-tax-rate')?.value?.trim() || '',
    name: document.getElementById('ops-tax-name')?.value?.trim() || '',
    code: document.getElementById('ops-tax-code')?.value?.trim() || null,
    prices_include_tax: Boolean(document.getElementById('ops-tax-inclusive')?.checked),
  })

  const message = (text, isError = false) => {
    const el = document.getElementById('ops-tax-message')
    if (!el) return
    el.textContent = text || ''
    el.classList.toggle('error', isError)
  }

  async function review(event) {
    event.preventDefault()
    reviewed = null
    const tax = values()
    if (!tax.default_rate || !tax.name) {
      message('Enter an explicit tax percentage and name before review.', true)
      return
    }
    message('Preparing a locked review…')
    try {
      const payload = await request('/api/studio/tax-plan', {
        method: 'POST',
        body: JSON.stringify({ expected_state_hash: state.state_hash, tax }),
      })
      reviewed = { plan: payload.plan, tax }
      const plan = payload.plan
      const panel = document.getElementById('ops-tax-review')
      if (!panel) return
      panel.hidden = false
      panel.innerHTML = `
        <p class="eyebrow">Review</p>
        <h3>${plan.change_count === 0 ? 'No changes needed.' : `${plan.change_count} guarded change${plan.change_count === 1 ? '' : 's'}`}</h3>
        <div class="ops-tax-diff">
          <div><span>Default rate</span><strong>${esc(plan.current.default_rate ?? 'Not configured')} → ${esc(plan.desired.default_rate)}%</strong></div>
          <div><span>Name</span><strong>${esc(plan.current.name ?? '—')} → ${esc(plan.desired.name)}</strong></div>
          <div><span>Code</span><strong>${esc(plan.current.code ?? '—')} → ${esc(plan.desired.code ?? '—')}</strong></div>
          <div><span>Prices include tax</span><strong>${plan.current.prices_include_tax ? 'Yes' : 'No'} → ${plan.desired.prices_include_tax ? 'Yes' : 'No'}</strong></div>
        </div>
        ${plan.change_count === 0 ? '<p class="ops-tax-footnote">The live configuration already matches this review.</p>' : `
          <label class="ops-tax-confirm"><input id="ops-tax-confirm" type="checkbox"/><span>I reviewed the percentage and understand this changes Medusa checkout tax settings for Greece.</span></label>
          <button id="ops-tax-apply" class="primary" type="button">Apply reviewed tax settings</button>`}
      `
      document.getElementById('ops-tax-apply')?.addEventListener('click', apply)
      message('')
    } catch (error) {
      message(error.message || 'Tax review failed.', true)
      if (error.code === 'stale_tax_state') await load()
    }
  }

  async function apply() {
    if (!reviewed) return
    const confirmed = document.getElementById('ops-tax-confirm')
    if (!confirmed?.checked) {
      message('Confirm that you reviewed the tax percentage before applying.', true)
      return
    }
    const button = document.getElementById('ops-tax-apply')
    if (button) button.disabled = true
    message('Applying the reviewed tax configuration…')
    try {
      await request('/api/studio/tax-apply', {
        method: 'POST',
        body: JSON.stringify({
          expected_state_hash: reviewed.plan.state_hash,
          tax_hash: reviewed.plan.tax_hash,
          tax: reviewed.tax,
        }),
      })
      await load()
      message('Tax settings applied and verified.')
    } catch (error) {
      message(error.message || 'Tax apply failed.', true)
      if (error.code === 'stale_tax_state' || error.code === 'stale_tax_plan') await load()
      if (button) button.disabled = false
    }
  }

  async function load() {
    root.innerHTML = '<div class="ops-tax-loading">Loading store tax settings…</div>'
    reviewed = null
    try {
      state = await request('/api/studio/tax-state')
      render()
    } catch (error) {
      state = null
      root.innerHTML = `<article class="ops-tax-card blocked"><p class="eyebrow">Store tax</p><h2>Tax settings unavailable.</h2><p>${esc(error.message || 'Unable to read live tax state.')}</p></article>`
    }
  }

  window.addEventListener('coquette:refresh', load)
  load()
})()
