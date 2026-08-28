import { createHash } from "crypto"
import type {
  IPricingModuleService,
  IRegionModuleService,
  ITaxModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import applyStudioTaxWorkflow, {
  type ApplyStudioTaxWorkflowInput,
  type StudioTaxMutationAction,
} from "../workflows/apply-studio-tax"

export const STUDIO_TAX_VERSION = "1"
export const STUDIO_TAX_COUNTRY_CODE = "gr" as const
export const STUDIO_TAX_REGION_NAME = "Greece"

export type StudioTaxRequest = {
  default_rate: string
  name: string
  code?: string | null
  prices_include_tax: boolean
}

type RegionRecord = {
  id: string
  name?: string | null
  currency_code?: string | null
}

type PricePreferenceRecord = {
  id: string
  attribute?: string | null
  value?: string | null
  is_tax_inclusive?: boolean | null
  updated_at?: Date | string | null
}

type TaxRegionRecord = {
  id: string
  country_code?: string | null
  province_code?: string | null
  parent_id?: string | null
  provider_id?: string | null
  updated_at?: Date | string | null
}

type TaxRateRecord = {
  id: string
  tax_region_id?: string | null
  rate?: number | null
  code?: string | null
  name?: string | null
  is_default?: boolean | null
  updated_at?: Date | string | null
  rules?: Array<{ id?: string | null }> | null
}

export type StudioTaxState = {
  ready: true
  configured: boolean
  region: {
    id: string
    name: string
    currency_code: "eur"
  }
  prices_include_tax: boolean
  tax_region: null | {
    id: string
    country_code: "gr"
    provider_id: string | null
  }
  default_rate: null | {
    id: string
    rate: string
    name: string
    code: string | null
  }
  blocked: boolean
  blockers: string[]
  state_hash: string
}

export type StudioTaxPlan = {
  version: string
  state_hash: string
  region_id: string
  country_code: "gr"
  desired: {
    default_rate: string
    name: string
    code: string | null
    prices_include_tax: boolean
  }
  current: {
    configured: boolean
    default_rate: string | null
    name: string | null
    code: string | null
    prices_include_tax: boolean
  }
  tax_action: StudioTaxMutationAction
  tax_region_id: string | null
  tax_rate_id: string | null
  rate_action: "create" | "update" | "unchanged"
  inclusivity_action: "update" | "unchanged"
  change_count: number
  tax_hash: string
}

function unexpectedState(message: string) {
  return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, message)
}

function stableHash(value: object) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function canonicalTimestamp(value: unknown) {
  if (value == null || value === "") return ""
  const date = value instanceof Date ? value : new Date(String(value))
  const time = date.getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : ""
}

function canonicalRate(value: unknown) {
  if (typeof value !== "string") {
    throw unexpectedState("Tax rate must be entered explicitly as a percentage")
  }
  const raw = value.trim()
  if (!/^(?:0|[1-9]\d?|100)(?:\.\d{1,4})?$/.test(raw)) {
    throw unexpectedState("Tax rate must be between 0 and 100 with at most four decimals")
  }
  const rate = Number(raw)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw unexpectedState("Tax rate must be between 0 and 100")
  }
  return String(rate)
}

function canonicalStoredRate(value: unknown) {
  if (value == null || value === "") return null
  const rate = Number(value)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw unexpectedState("Existing default tax rate is outside the supported percentage range")
  }
  return String(rate)
}

function canonicalName(value: unknown) {
  if (typeof value !== "string") throw unexpectedState("Tax rate name is required")
  const name = value.trim()
  if (name.length < 2 || name.length > 80) {
    throw unexpectedState("Tax rate name must contain between 2 and 80 characters")
  }
  return name
}

function canonicalCode(value: unknown) {
  if (value == null || value === "") return null
  if (typeof value !== "string") throw unexpectedState("Tax rate code must be text")
  const code = value.trim()
  if (!code) return null
  if (code.length > 40) throw unexpectedState("Tax rate code must contain at most 40 characters")
  return code
}

function normalizeRequest(request: StudioTaxRequest) {
  return {
    default_rate: canonicalRate(request.default_rate),
    name: canonicalName(request.name),
    code: canonicalCode(request.code),
    prices_include_tax: request.prices_include_tax === true,
  }
}

async function loadRegion(container: MedusaContainer) {
  const regionModule = container.resolve<IRegionModuleService>(Modules.REGION)
  const regions = (await regionModule.listRegions(
    { name: STUDIO_TAX_REGION_NAME },
    { take: 3 }
  )) as RegionRecord[]
  if (regions.length !== 1) {
    throw unexpectedState(
      `Expected exactly one ${STUDIO_TAX_REGION_NAME} commerce region; found ${regions.length}.`
    )
  }
  const region = regions[0]
  if (region.currency_code?.toLowerCase() !== "eur") {
    throw unexpectedState("Greece commerce region must use EUR before Studio tax settings can be managed")
  }
  return region
}

async function loadTaxInclusivePreference(container: MedusaContainer, regionId: string) {
  const pricing = container.resolve<IPricingModuleService>(Modules.PRICING)
  const preferences = (await pricing.listPricePreferences(
    { attribute: "region_id", value: regionId },
    { take: 3 }
  )) as PricePreferenceRecord[]
  if (preferences.length > 1) {
    throw unexpectedState("Multiple region tax-inclusive price preferences exist; Studio tax settings are blocked")
  }
  return preferences[0]
}

async function loadTaxGraph(container: MedusaContainer) {
  const tax = container.resolve<ITaxModuleService>(Modules.TAX)
  const countryRegions = (await tax.listTaxRegions(
    { country_code: STUDIO_TAX_COUNTRY_CODE },
    { take: 100 }
  )) as TaxRegionRecord[]
  const topLevel = countryRegions.filter(
    (record) => !record.parent_id && !record.province_code
  )
  if (topLevel.length > 1) {
    throw unexpectedState("Multiple top-level Greece tax regions exist; Studio tax settings are blocked")
  }
  const taxRegion = topLevel[0]
  if (!taxRegion) {
    return { taxRegion: undefined, rates: [] as TaxRateRecord[], countryRegions }
  }
  const rates = (await tax.listTaxRates(
    { tax_region_id: taxRegion.id },
    { relations: ["rules"], take: 100 }
  )) as TaxRateRecord[]
  return { taxRegion, rates, countryRegions }
}

export async function readStudioTaxState(container: MedusaContainer): Promise<StudioTaxState> {
  const region = await loadRegion(container)
  const preference = await loadTaxInclusivePreference(container, region.id)
  const { taxRegion, rates, countryRegions } = await loadTaxGraph(container)

  const blockers: string[] = []
  const defaults = rates.filter((rate) => Boolean(rate.is_default))
  const nonDefaults = rates.filter((rate) => !rate.is_default)
  if (defaults.length > 1) blockers.push("multiple_default_tax_rates")
  if (nonDefaults.length > 0) blockers.push("foreign_tax_overrides_present")
  if (rates.some((rate) => (rate.rules?.length || 0) > 0)) {
    blockers.push("foreign_tax_rules_present")
  }
  if (taxRegion?.provider_id) blockers.push("external_tax_provider_present")
  if (taxRegion && countryRegions.some((record) => record.id !== taxRegion.id)) {
    blockers.push("foreign_tax_subregions_present")
  }

  const defaultRate = defaults[0]
  const defaultRateValue = defaultRate ? canonicalStoredRate(defaultRate.rate) : null
  const pricesIncludeTax = Boolean(preference?.is_tax_inclusive)

  const stateCore = {
    version: STUDIO_TAX_VERSION,
    region: {
      id: region.id,
      name: region.name || STUDIO_TAX_REGION_NAME,
      currency_code: "eur" as const,
    },
    preference: preference
      ? {
          id: preference.id,
          is_tax_inclusive: pricesIncludeTax,
          updated_at: canonicalTimestamp(preference.updated_at),
        }
      : null,
    tax_region: taxRegion
      ? {
          id: taxRegion.id,
          provider_id: taxRegion.provider_id || null,
          updated_at: canonicalTimestamp(taxRegion.updated_at),
        }
      : null,
    default_rate: defaultRate
      ? {
          id: defaultRate.id,
          rate: defaultRateValue,
          name: defaultRate.name || "",
          code: defaultRate.code || null,
          updated_at: canonicalTimestamp(defaultRate.updated_at),
        }
      : null,
    blockers: [...blockers].sort(),
  }

  return {
    ready: true,
    configured: Boolean(taxRegion && defaultRate),
    region: stateCore.region,
    prices_include_tax: pricesIncludeTax,
    tax_region: taxRegion
      ? {
          id: taxRegion.id,
          country_code: STUDIO_TAX_COUNTRY_CODE,
          provider_id: taxRegion.provider_id || null,
        }
      : null,
    default_rate: defaultRate
      ? {
          id: defaultRate.id,
          rate: defaultRateValue || "0",
          name: defaultRate.name || "",
          code: defaultRate.code || null,
        }
      : null,
    blocked: blockers.length > 0,
    blockers,
    state_hash: stableHash(stateCore),
  }
}

export async function buildStudioTaxPlan(
  container: MedusaContainer,
  expectedStateHash: string,
  request: StudioTaxRequest
): Promise<StudioTaxPlan> {
  const state = await readStudioTaxState(container)
  if (state.state_hash !== expectedStateHash) throw new Error("stale_tax_state")
  if (state.blocked) throw new Error(`tax_state_blocked:${state.blockers.join(",")}`)

  const desired = normalizeRequest(request)
  let taxAction: StudioTaxMutationAction = "none"
  let rateAction: StudioTaxPlan["rate_action"] = "unchanged"

  if (!state.tax_region) {
    taxAction = "create_region"
    rateAction = "create"
  } else if (!state.default_rate) {
    taxAction = "create_rate"
    rateAction = "create"
  } else if (
    state.default_rate.rate !== desired.default_rate ||
    state.default_rate.name !== desired.name ||
    state.default_rate.code !== desired.code
  ) {
    taxAction = "update_rate"
    rateAction = "update"
  }

  const inclusivityAction =
    state.prices_include_tax === desired.prices_include_tax ? "unchanged" : "update"
  const changeCount = (rateAction === "unchanged" ? 0 : 1) +
    (inclusivityAction === "unchanged" ? 0 : 1)

  const planWithoutHash = {
    version: STUDIO_TAX_VERSION,
    state_hash: state.state_hash,
    region_id: state.region.id,
    country_code: STUDIO_TAX_COUNTRY_CODE,
    desired,
    current: {
      configured: state.configured,
      default_rate: state.default_rate?.rate || null,
      name: state.default_rate?.name || null,
      code: state.default_rate?.code || null,
      prices_include_tax: state.prices_include_tax,
    },
    tax_action: taxAction,
    tax_region_id: state.tax_region?.id || null,
    tax_rate_id: state.default_rate?.id || null,
    rate_action: rateAction,
    inclusivity_action: inclusivityAction as StudioTaxPlan["inclusivity_action"],
    change_count: changeCount,
  }

  return {
    ...planWithoutHash,
    tax_hash: stableHash(planWithoutHash),
  }
}

export async function applyStudioTaxPlan(
  container: MedusaContainer,
  expectedStateHash: string,
  request: StudioTaxRequest,
  expectedTaxHash: string
) {
  const plan = await buildStudioTaxPlan(container, expectedStateHash, request)
  if (plan.tax_hash !== expectedTaxHash) throw new Error("stale_tax_plan")
  if (plan.change_count === 0) return plan

  const input: ApplyStudioTaxWorkflowInput = {
    region_id: plan.region_id,
    country_code: STUDIO_TAX_COUNTRY_CODE,
    prices_include_tax: plan.desired.prices_include_tax,
    tax_action: plan.tax_action,
    tax_region_id: plan.tax_region_id,
    tax_rate_id: plan.tax_rate_id,
    rate: Number(plan.desired.default_rate),
    name: plan.desired.name,
    code: plan.desired.code,
  }
  await applyStudioTaxWorkflow(container).run({ input })

  const applied = await readStudioTaxState(container)
  if (
    !applied.configured ||
    applied.blocked ||
    applied.default_rate?.rate !== plan.desired.default_rate ||
    applied.default_rate?.name !== plan.desired.name ||
    applied.default_rate?.code !== plan.desired.code ||
    applied.prices_include_tax !== plan.desired.prices_include_tax
  ) {
    throw unexpectedState("Studio tax post-apply verification failed")
  }

  return plan
}
