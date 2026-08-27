import type { InventoryTypes } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import {
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  createRemoteLinkStep,
  updateInventoryLevelsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"

export type StudioInventoryCreateItem = {
  variant_id: string
  title: string
  sku: string | null
  location_levels: Array<{
    location_id: string
    stocked_quantity: number
  }>
}

export type ApplyStudioInventoryInput = {
  create_items: StudioInventoryCreateItem[]
  create_levels: InventoryTypes.CreateInventoryLevelInput[]
  update_levels: InventoryTypes.UpdateInventoryLevelInput[]
  enable_variant_ids: string[]
}

export const applyStudioInventoryWorkflowId = "coquette-apply-studio-inventory"

/**
 * Applies one reviewed COQUETTE Studio inventory plan through Medusa-native
 * inventory, link and product-variant workflows. Every nested workflow/step
 * participates in the parent workflow compensation chain.
 */
const applyStudioInventoryWorkflow = createWorkflow(
  applyStudioInventoryWorkflowId,
  (input: WorkflowData<ApplyStudioInventoryInput>) => {
    const itemInput = transform({ input }, ({ input }) => ({
      items: input.create_items.map((item) => ({
        title: item.title,
        sku: item.sku,
        location_levels: item.location_levels,
      })),
    }))

    const createdItems = createInventoryItemsWorkflow.runAsStep({
      input: itemInput,
    })

    const links = transform(
      { createdItems, input },
      ({ createdItems, input }) =>
        createdItems.map((item, index) => ({
          [Modules.PRODUCT]: {
            product_variant_id: input.create_items[index].variant_id,
          },
          [Modules.INVENTORY]: {
            inventory_item_id: item.id,
          },
        }))
    )

    createRemoteLinkStep(links)

    const levelsToCreate = transform({ input }, ({ input }) => ({
      inventory_levels: input.create_levels,
    }))
    createInventoryLevelsWorkflow.runAsStep({ input: levelsToCreate })

    const levelsToUpdate = transform({ input }, ({ input }) => ({
      updates: input.update_levels,
    }))
    updateInventoryLevelsWorkflow.runAsStep({ input: levelsToUpdate })

    const variantsToEnable = transform({ input }, ({ input }) => ({
      product_variants: input.enable_variant_ids.map((id) => ({
        id,
        manage_inventory: true,
      })),
    }))
    updateProductVariantsWorkflow.runAsStep({ input: variantsToEnable })

    return new WorkflowResponse({
      created_inventory_items: createdItems,
    })
  }
)

export default applyStudioInventoryWorkflow
