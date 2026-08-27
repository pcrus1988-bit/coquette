import {
  createWorkflow,
  when,
  WorkflowResponse,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import {
  batchPriceListPricesWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"

export type ApplyStudioPricingWorkflowInput = {
  regular_updates: Array<{
    id: string
    prices: Array<{
      amount: number
      currency_code: "eur"
    }>
  }>
  apply_sale_batch: boolean
  sale_batch: {
    id: string
    create: Array<{
      amount: number
      currency_code: "eur"
      variant_id: string
    }>
    update: Array<{
      id: string
      amount: number
      currency_code: "eur"
      variant_id: string
    }>
    delete: string[]
  }
}

export const applyStudioPricingWorkflowId = "apply-studio-pricing"

const applyStudioPricingWorkflow = createWorkflow(
  applyStudioPricingWorkflowId,
  (input: WorkflowData<ApplyStudioPricingWorkflowInput>) => {
    when(input, ({ regular_updates }) => regular_updates.length > 0).then(() =>
      updateProductVariantsWorkflow.runAsStep({
        input: {
          product_variants: input.regular_updates,
        },
      })
    )

    when(input, ({ apply_sale_batch }) => apply_sale_batch).then(() =>
      batchPriceListPricesWorkflow.runAsStep({
        input: {
          data: input.sale_batch,
        },
      })
    )

    return new WorkflowResponse({ applied: true })
  }
)

export default applyStudioPricingWorkflow
