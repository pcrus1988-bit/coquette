import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { CONTENT_MODULE } from "../../../../modules/content"
import type ContentModuleService from "../../../../modules/content/service"

const ContentSectionPayload = z.object({
  id: z.string().trim().min(1),
  type: z.enum([
    "hero",
    "rich_text",
    "image_text",
    "product_collection",
    "banner",
    "spacer",
  ]),
  enabled: z.boolean(),
  data: z.record(z.string(), z.unknown()),
})

const ContentPageUpdatePayload = z.object({
  handle: z.string().trim().min(1),
  locale: z.enum(["el", "en"]),
  title: z.string().trim().min(1),
  status: z.enum(["draft", "published"]),
  sections: z.array(ContentSectionPayload),
  seo_title: z.string().trim().nullable().optional(),
  seo_description: z.string().trim().nullable().optional(),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const contentService = req.scope.resolve<ContentModuleService>(CONTENT_MODULE)
  const page = await contentService.retrieveContentPage(req.params.id)

  return res.json({ page })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = ContentPageUpdatePayload.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid website content payload.",
      issues: parsed.error.issues,
    })
  }

  const contentService = req.scope.resolve<ContentModuleService>(CONTENT_MODULE)
  const page = await contentService.updateContentPages({
    id: req.params.id,
    ...parsed.data,
    seo_title: parsed.data.seo_title || null,
    seo_description: parsed.data.seo_description || null,
  })

  return res.json({ page })
}
