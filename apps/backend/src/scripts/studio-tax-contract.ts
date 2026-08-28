import type { ExecArgs, ITaxModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import assert from "node:assert/strict"
import {
  applyStudioTaxPlan,
  buildStudioTaxPlan,
  readStudioTaxState,
  type StudioTaxRequest,
} from "../lib/studio-tax"

export default async function studioTaxContract({ container }: ExecArgs) {
  const initial = await readStudioTaxState(container)
  assert.equal(initial.ready, true)
  assert.equal(initial.region.name, "Greece")
  assert.equal(initial.region.currency_code, "eur")
  assert.equal(initial.configured, false)
  assert.equal(initial.default_rate, null)
  assert.equal(initial.blocked, false)

  const first: StudioTaxRequest = {
    default_rate: "19.5",
    name: "COQUETTE Test VAT",
    code: "TEST-VAT",
    prices_include_tax: true,
  }
  const firstPlan = await buildStudioTaxPlan(container, initial.state_hash, first)
  assert.equal(firstPlan.tax_action, "create_region")
  assert.equal(firstPlan.rate_action, "create")
  assert.equal(firstPlan.inclusivity_action, "update")
  assert.equal(firstPlan.change_count, 2)
  assert.match(firstPlan.tax_hash, /^[a-f0-9]{64}$/)

  await applyStudioTaxPlan(container, initial.state_hash, first, firstPlan.tax_hash)
  let state = await readStudioTaxState(container)
  assert.equal(state.configured, true)
  assert.equal(state.blocked, false)
  assert.equal(state.default_rate?.rate, "19.5")
  assert.equal(state.default_rate?.name, "COQUETTE Test VAT")
  assert.equal(state.default_rate?.code, "TEST-VAT")
  assert.equal(state.prices_include_tax, true)

  const idempotentPlan = await buildStudioTaxPlan(container, state.state_hash, first)
  assert.equal(idempotentPlan.change_count, 0)
  await applyStudioTaxPlan(
    container,
    state.state_hash,
    first,
    idempotentPlan.tax_hash
  )

  state = await readStudioTaxState(container)
  const update: StudioTaxRequest = {
    default_rate: "21.25",
    name: "COQUETTE Revised Test VAT",
    code: null,
    prices_include_tax: false,
  }
  const updatePlan = await buildStudioTaxPlan(container, state.state_hash, update)
  assert.equal(updatePlan.tax_action, "update_rate")
  assert.equal(updatePlan.rate_action, "update")
  assert.equal(updatePlan.inclusivity_action, "update")
  assert.equal(updatePlan.change_count, 2)

  await applyStudioTaxPlan(container, state.state_hash, update, updatePlan.tax_hash)
  state = await readStudioTaxState(container)
  assert.equal(state.default_rate?.rate, "21.25")
  assert.equal(state.default_rate?.name, "COQUETTE Revised Test VAT")
  assert.equal(state.default_rate?.code, null)
  assert.equal(state.prices_include_tax, false)

  assert.ok(state.tax_region?.id)
  const tax = container.resolve<ITaxModuleService>(Modules.TAX)
  await tax.createTaxRates({
    tax_region_id: state.tax_region.id,
    name: "Foreign override sentinel",
    rate: 7.75,
    is_default: false,
  })

  const blocked = await readStudioTaxState(container)
  assert.equal(blocked.blocked, true)
  assert.ok(blocked.blockers.includes("foreign_tax_overrides_present"))
  await assert.rejects(
    () => buildStudioTaxPlan(container, blocked.state_hash, update),
    /tax_state_blocked:foreign_tax_overrides_present/
  )

  console.log(
    "COQUETTE Studio guarded store-tax create/idempotency/update/override-blocking contract passed"
  )
}
