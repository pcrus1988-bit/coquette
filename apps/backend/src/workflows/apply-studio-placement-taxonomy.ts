import type { LinkDefinition } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import {
  createLinksWorkflow,
  dismissLinksWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { BRAND_MODULE } from "../modules/brand"

export type ApplyStudioPlacementTaxonomyWorkflowInput = {
  product_id: string
  category_ids: string[]
  current_designer_id: string | null
  desired_designer_id: string | null
}

export const applyStudioPlacementTaxonomyWorkflowId =
  "apply-studio-placement-taxonomy"

const applyStudioPlacementTaxonomyWorkflow = createWorkflow(
  applyStudioPlacementTaxonomyWorkflowId,
  (input: WorkflowData<ApplyStudioPlacementTaxonomyWorkflowInput>) => {
    const products = updateProductsWorkflow.runAsStep({
      input: {
        products: transform(input, (data) => [
          {
            id: data.product_id,
            category_ids: data.category_ids,
          },
        ]),
      },
    })

    const linksToDismiss = transform(input, (data) => {
      if (
        !data.current_designer_id ||
        data.current_designer_id === data.desired_designer_id
      ) {
        return [] as LinkDefinition[]
      }
      return [
        {
          [Modules.PRODUCT]: { product_id: data.product_id },
          [BRAND_MODULE]: { brand_id: data.current_designer_id },
        },
      ] as LinkDefinition[]
    })

    const linksToCreate = transform(input, (data) => {
      if (
        !data.desired_designer_id ||
        data.current_designer_id === data.desired_designer_id
      ) {
        return [] as LinkDefinition[]
      }
      return [
        {
          [Modules.PRODUCT]: { product_id: data.product_id },
          [BRAND_MODULE]: { brand_id: data.desired_designer_id },
        },
      ] as LinkDefinition[]
    })

    dismissLinksWorkflow.runAsStep({ input: linksToDismiss })
    createLinksWorkflow.runAsStep({ input: linksToCreate })

    return new WorkflowResponse(products)
  }
)

export default applyStudioPlacementTaxonomyWorkflow
