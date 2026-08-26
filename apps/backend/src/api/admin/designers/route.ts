import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { BRAND_MODULE } from "../../../modules/brand"
import type BrandModuleService from "../../../modules/brand/service"
import createDesignerWorkflow from "../../../workflows/create-designer"

const DesignerPayload = z.object({
  name: z.string().trim().min(1),
  handle: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  logo_url: z.string().trim().nullable().optional(),
})

const parseBoundedInteger = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
) => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)))
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const limit = parseBoundedInteger(req.query.limit, 100, 1, 200)
  const offset = parseBoundedInteger(req.query.offset, 0, 0, 100_000)
  const brandService = req.scope.resolve<BrandModuleService>(BRAND_MODULE)
  const [designers, count] = await brandService.listAndCountBrands(
    {},
    { skip: offset, take: limit, order: { name: "ASC" } }
  )

  res.json({ designers, count, limit, offset })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = DesignerPayload.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid designer payload.",
      issues: parsed.error.issues,
    })
  }

  const { result: designer } = await createDesignerWorkflow(req.scope).run({
    input: {
      ...parsed.data,
      description: parsed.data.description || null,
      logo_url: parsed.data.logo_url || null,
    },
  })

  return res.status(201).json({ designer })
}
