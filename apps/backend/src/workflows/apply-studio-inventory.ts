import type { LinkDefinition } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk"
import {
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  createLinksWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"

export type ApplyStudioInventoryWorkflowInput = {
  product_id: string
  location_id: string
  variants: Array<{
    variant_id: string
    title: string
    sku: string | null
    inventory_item_id: string | null
    inventory_level_id: string | null
    stocked_quantity: number
  }>
}

export const applyStudioInventoryWorkflowId = "apply-studio-inventory"

const applyStudioInventoryWorkflow = createWorkflow(
  applyStudioInventoryWorkflowId,
  (input: WorkflowData<ApplyStudioInventoryWorkflowInput>) => {
    const missingItems = transform(input, (data) =>
      data.variants.filter((line) => !line.inventory_item_id)
    )

    const createdItems = createInventoryItemsWorkflow.runAsStep({
      input: {
        items: transform(
          { missingItems, input },
          ({ missingItems, input: workflowInput }) =>
            missingItems.map((line) => ({
              sku: line.sku || undefined,
              title: line.title,
              description: `COQUETTE Studio inventory for ${line.title}`,
              requires_shipping: true,
              location_levels: [
                {
                  location_id: workflowInput.location_id,
                  stocked_quantity: line.stocked_quantity,
                },
              ],
            }))
        ),
      },
    })

    const links = transform(
      { missingItems, createdItems },
      ({ missingItems, createdItems }) =>
        missingItems.map((line, index): LinkDefinition => ({
          [Modules.PRODUCT]: { variant_id: line.variant_id },
          [Modules.INVENTORY]: {
            inventory_item_id: createdItems[index].id,
          },
          data: { required_quantity: 1 },
        }))
    )

    createLinksWorkflow.runAsStep({ input: links })

    const missingLevels = transform(input, (data) =>
      data.variants
        .filter(
          (line) =>
            Boolean(line.inventory_item_id) && !line.inventory_level_id
        )
        .map((line) => ({
          inventory_item_id: line.inventory_item_id!,
          location_id: data.location_id,
          stocked_quantity: line.stocked_quantity,
        }))
    )

    createInventoryLevelsWorkflow.runAsStep({
      input: { inventory_levels: missingLevels },
    })

    const levelUpdates = transform(input, (data) =>
      data.variants
        .filter((line) => Boolean(line.inventory_level_id))
        .map((line) => ({
          id: line.inventory_level_id!,
          inventory_item_id: line.inventory_item_id!,
          location_id: data.location_id,
          stocked_quantity: line.stocked_quantity,
        }))
    )

    updateInventoryLevelsWorkflow.runAsStep({
      input: { updates: levelUpdates },
    })

    const variants = updateProductVariantsWorkflow.runAsStep({
      input: {
        product_variants: transform(input, (data) =>
          data.variants.map((line) => ({
            id: line.variant_id,
            manage_inventory: true,
            allow_backorder: false,
          }))
        ),
      },
    })

    return new WorkflowResponse(variants)
  }
)

export default applyStudioInventoryWorkflow
