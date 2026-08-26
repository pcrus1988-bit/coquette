import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { BRAND_MODULE } from "../../../../modules/brand"
import type BrandModuleService from "../../../../modules/brand/service"
import updateDesignerWorkflow from "../../../../workflows/update-designer"

const DesignerUpdatePayload = z.object({
  name: z.string().trim().min(1),
  handle: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  logo_url: z.string().trim().nullable().optional(),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const brandService = req.scope.resolve<BrandModuleService>(BRAND_MODULE)
  const designer = await brandService.retrieveBrand(req.params.id)

  return res.json({ designer })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = DesignerUpdatePayload.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid designer payload.",
      issues: parsed.error.issues,
    })
  }

  const { result: designer } = await updateDesignerWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      ...parsed.data,
      description: parsed.data.description || null,
      logo_url: parsed.data.logo_url || null,
    },
  })

  return res.json({ designer })
}
