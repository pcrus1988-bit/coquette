import type { LinkDefinition } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import {
  createLinksWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

export type ApplyStudioLifecycleWorkflowInput = {
  product_id: string
  target_status: "draft" | "published"
  attach_canonical_sales_channel: boolean
  canonical_sales_channel_id: string
}

export const applyStudioLifecycleWorkflowId = "apply-studio-lifecycle"

const applyStudioLifecycleWorkflow = createWorkflow(
  applyStudioLifecycleWorkflowId,
  (input: WorkflowData<ApplyStudioLifecycleWorkflowInput>) => {
    const links = transform(input, (data) => [
      {
        [Modules.PRODUCT]: { product_id: data.product_id },
        [Modules.SALES_CHANNEL]: {
          sales_channel_id: data.canonical_sales_channel_id,
        },
      },
    ] as LinkDefinition[])

    const createdLinks = when(
      "studio-lifecycle-attach-canonical-channel",
      { input },
      ({ input: data }) => data.attach_canonical_sales_channel
    ).then(() => createLinksWorkflow.runAsStep({ input: links }))

    const productUpdates = transform(
      { input, createdLinks },
      ({ input: data }) => ({
        products: [
          {
            id: data.product_id,
            status: data.target_status,
          },
        ],
      })
    )

    const products = updateProductsWorkflow.runAsStep({ input: productUpdates })
    return new WorkflowResponse(products)
  }
)

export default applyStudioLifecycleWorkflow
