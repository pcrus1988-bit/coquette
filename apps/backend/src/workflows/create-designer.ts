import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { BRAND_MODULE } from "../modules/brand"
import type BrandModuleService from "../modules/brand/service"

type CreateDesignerInput = {
  name: string
  handle: string
  description?: string | null
  logo_url?: string | null
}

const createDesignerStep = createStep(
  "create-designer",
  async (input: CreateDesignerInput, { container }) => {
    const brandService = container.resolve<BrandModuleService>(BRAND_MODULE)
    const designer = await brandService.createBrands(input)

    return new StepResponse(designer, designer.id)
  },
  async (designerId: string | undefined, { container }) => {
    if (!designerId) {
      return
    }

    const brandService = container.resolve<BrandModuleService>(BRAND_MODULE)
    await brandService.deleteBrands(designerId)
  }
)

const createDesignerWorkflow = createWorkflow(
  "create-designer",
  function (input: CreateDesignerInput) {
    return new WorkflowResponse(createDesignerStep(input))
  }
)

export default createDesignerWorkflow
