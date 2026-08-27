import {
  createWorkflow,
  transform,
  WorkflowResponse,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import {
  createAndLinkProductOptionsToProductWorkflow,
  createProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

export type GenerateStudioProductVariantsInput = {
  product_id: string
  blueprint_hash: string
  options: Array<{
    title: string
    values: string[]
    is_exclusive: true
    metadata: Record<string, unknown>
  }>
  variants: Array<{
    product_id: string
    title: string
    manage_inventory: false
    allow_backorder: false
    options: Record<string, string>
    metadata: Record<string, unknown>
  }>
  product_metadata: Record<string, unknown>
}

export const generateStudioProductVariantsWorkflowId =
  "generate-studio-product-variants"

const generateStudioProductVariantsWorkflow = createWorkflow(
  generateStudioProductVariantsWorkflowId,
  (input: WorkflowData<GenerateStudioProductVariantsInput>) => {
    const linkedOptions = createAndLinkProductOptionsToProductWorkflow.runAsStep({
      input: {
        product_id: input.product_id,
        add: input.options,
      },
    })

    const variantWorkflowInput = transform(
      { input, linkedOptions },
      ({ input, linkedOptions }) => {
        void linkedOptions
        return { product_variants: input.variants }
      }
    )

    const variants = createProductVariantsWorkflow.runAsStep({
      input: variantWorkflowInput,
    })

    const productUpdateInput = transform(
      { input, variants },
      ({ input, variants }) => {
        void variants
        return {
          products: [
            {
              id: input.product_id,
              metadata: input.product_metadata,
            },
          ],
        }
      }
    )

    updateProductsWorkflow.runAsStep({ input: productUpdateInput })

    return new WorkflowResponse(variants)
  }
)

export default generateStudioProductVariantsWorkflow
