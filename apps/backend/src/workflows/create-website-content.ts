import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { CONTENT_MODULE } from "../modules/content"
import type ContentModuleService from "../modules/content/service"
import type { ContentSection } from "../modules/content/models/content-page"

type CreateWebsiteContentInput = {
  handle: string
  locale: "el" | "en"
  title: string
  status: "draft" | "published"
  sections: ContentSection[]
  seo_title?: string | null
  seo_description?: string | null
}

const createWebsiteContentStep = createStep(
  "create-website-content",
  async (input: CreateWebsiteContentInput, { container }) => {
    const contentService = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const page = await contentService.createContentPages(input)

    return new StepResponse(page, page.id)
  },
  async (pageId: string | undefined, { container }) => {
    if (!pageId) {
      return
    }

    const contentService = container.resolve<ContentModuleService>(CONTENT_MODULE)
    await contentService.deleteContentPages(pageId)
  }
)

const createWebsiteContentWorkflow = createWorkflow(
  "create-website-content",
  function (input: CreateWebsiteContentInput) {
    return new WorkflowResponse(createWebsiteContentStep(input))
  }
)

export default createWebsiteContentWorkflow
