import {
  createWorkflow,
  WorkflowResponse,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"

export type ApplyStudioVariantIdentifiersInput = {
  product_variants: Array<{
    id: string
    sku: string | null
    ean: string | null
    upc: string | null
    barcode: string | null
  }>
}

export const applyStudioVariantIdentifiersWorkflowId =
  "apply-studio-variant-identifiers"

const applyStudioVariantIdentifiersWorkflow = createWorkflow(
  applyStudioVariantIdentifiersWorkflowId,
  (input: WorkflowData<ApplyStudioVariantIdentifiersInput>) => {
    const variants = updateProductVariantsWorkflow.runAsStep({
      input: {
        product_variants: input.product_variants,
      },
    })

    return new WorkflowResponse(variants)
  }
)

export default applyStudioVariantIdentifiersWorkflow
