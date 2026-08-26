import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import createWebsiteContentWorkflow from "../../../workflows/create-website-content"

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

const ContentPagePayload = z.object({
  handle: z.string().trim().min(1),
  locale: z.enum(["el", "en"]),
  title: z.string().trim().min(1),
  status: z.enum(["draft", "published"]),
  sections: z.array(ContentSectionPayload),
  seo_title: z.string().trim().nullable().optional(),
  seo_description: z.string().trim().nullable().optional(),
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
  const contentService = req.scope.resolve<ContentModuleService>(CONTENT_MODULE)
  const [pages, count] = await contentService.listAndCountContentPages(
    {},
    { skip: offset, take: limit }
  )

  pages.sort((left, right) =>
    `${left.handle}:${left.locale}`.localeCompare(`${right.handle}:${right.locale}`)
  )

  return res.json({ pages, count, limit, offset })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = ContentPagePayload.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid website content payload.",
      issues: parsed.error.issues,
    })
  }

  const { result: page } = await createWebsiteContentWorkflow(req.scope).run({
    input: {
      ...parsed.data,
      seo_title: parsed.data.seo_title || null,
      seo_description: parsed.data.seo_description || null,
    },
  })

  return res.status(201).json({ page })
}
