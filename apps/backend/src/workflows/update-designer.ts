import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { BRAND_MODULE } from "../modules/brand"
import type BrandModuleService from "../modules/brand/service"

type UpdateDesignerInput = {
  id: string
  name: string
  handle: string
  description?: string | null
  logo_url?: string | null
}

const updateDesignerStep = createStep(
  "update-designer",
  async (input: UpdateDesignerInput, { container }) => {
    const brandService = container.resolve<BrandModuleService>(BRAND_MODULE)
    const designer = await brandService.updateBrands(input)

    return new StepResponse(designer)
  }
)

const updateDesignerWorkflow = createWorkflow(
  "update-designer",
  function (input: UpdateDesignerInput) {
    return new WorkflowResponse(updateDesignerStep(input))
  }
)

export default updateDesignerWorkflow
