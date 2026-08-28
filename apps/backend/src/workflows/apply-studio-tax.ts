import type { ITaxModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows"

export type StudioTaxMutationAction =
  | "create_region"
  | "create_rate"
  | "update_rate"
  | "none"

export type ApplyStudioTaxWorkflowInput = {
  region_id: string
  country_code: "gr"
  prices_include_tax: boolean
  tax_action: StudioTaxMutationAction
  tax_region_id?: string | null
  tax_rate_id?: string | null
  rate: number
  name: string
  code: string | null
}

type TaxCompensation =
  | { kind: "created_region"; id: string }
  | { kind: "created_rate"; id: string }
  | {
      kind: "updated_rate"
      id: string
      previous: {
        rate: number | null
        name: string
        code: string | null
        is_default: boolean
      }
    }
  | { kind: "none" }

const mutateTaxStep = createStep(
  "apply-studio-tax-default-rate",
  async (input: ApplyStudioTaxWorkflowInput, { container }) => {
    const tax = container.resolve<ITaxModuleService>(Modules.TAX)

    if (input.tax_action === "create_region") {
      const created = await tax.createTaxRegions({
        country_code: input.country_code,
        metadata: { coquette_studio_tax: "store-default-v1" },
        default_tax_rate: {
          rate: input.rate,
          name: input.name,
          code: input.code,
          metadata: { coquette_studio_tax: "store-default-v1" },
        },
      })
      return new StepResponse(
        { tax_region_id: created.id },
        { kind: "created_region", id: created.id } satisfies TaxCompensation
      )
    }

    if (input.tax_action === "create_rate") {
      if (!input.tax_region_id) {
        throw new Error("tax_region_required")
      }
      const created = await tax.createTaxRates({
        tax_region_id: input.tax_region_id,
        rate: input.rate,
        name: input.name,
        code: input.code,
        is_default: true,
        metadata: { coquette_studio_tax: "store-default-v1" },
      })
      return new StepResponse(
        { tax_region_id: input.tax_region_id, tax_rate_id: created.id },
        { kind: "created_rate", id: created.id } satisfies TaxCompensation
      )
    }

    if (input.tax_action === "update_rate") {
      if (!input.tax_rate_id) {
        throw new Error("tax_rate_required")
      }
      const previous = await tax.retrieveTaxRate(input.tax_rate_id)
      await tax.updateTaxRates(input.tax_rate_id, {
        rate: input.rate,
        name: input.name,
        code: input.code,
        is_default: true,
      })
      return new StepResponse(
        { tax_region_id: input.tax_region_id, tax_rate_id: input.tax_rate_id },
        {
          kind: "updated_rate",
          id: input.tax_rate_id,
          previous: {
            rate: previous.rate ?? null,
            name: previous.name,
            code: previous.code ?? null,
            is_default: Boolean(previous.is_default),
          },
        } satisfies TaxCompensation
      )
    }

    return new StepResponse(
      { tax_region_id: input.tax_region_id, tax_rate_id: input.tax_rate_id },
      { kind: "none" } satisfies TaxCompensation
    )
  },
  async (compensation: TaxCompensation | undefined, { container }) => {
    if (!compensation || compensation.kind === "none") return
    const tax = container.resolve<ITaxModuleService>(Modules.TAX)

    if (compensation.kind === "created_region") {
      await tax.deleteTaxRegions(compensation.id)
      return
    }
    if (compensation.kind === "created_rate") {
      await tax.deleteTaxRates(compensation.id)
      return
    }
    await tax.updateTaxRates(compensation.id, compensation.previous)
  }
)

export const applyStudioTaxWorkflowId = "apply-studio-tax"

const applyStudioTaxWorkflow = createWorkflow(
  applyStudioTaxWorkflowId,
  (input: WorkflowData<ApplyStudioTaxWorkflowInput>) => {
    mutateTaxStep(input)
    updateRegionsWorkflow.runAsStep({
      input: {
        selector: { id: input.region_id },
        update: { is_tax_inclusive: input.prices_include_tax },
      },
    })
    return new WorkflowResponse({ applied: true })
  }
)

export default applyStudioTaxWorkflow
