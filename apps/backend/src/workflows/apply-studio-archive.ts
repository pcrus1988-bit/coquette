import {
  createWorkflow,
  transform,
  WorkflowResponse,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

export type ApplyStudioArchiveWorkflowInput = {
  product_id: string
  target_status: "draft"
  metadata: Record<string, unknown>
}

export const applyStudioArchiveWorkflowId = "apply-studio-archive"

const applyStudioArchiveWorkflow = createWorkflow(
  applyStudioArchiveWorkflowId,
  (input: WorkflowData<ApplyStudioArchiveWorkflowInput>) => {
    const productUpdates = transform(input, (data) => ({
      products: [
        {
          id: data.product_id,
          status: data.target_status,
          metadata: data.metadata,
        },
      ],
    }))

    const products = updateProductsWorkflow.runAsStep({ input: productUpdates })
    return new WorkflowResponse(products)
  }
)

export default applyStudioArchiveWorkflow
