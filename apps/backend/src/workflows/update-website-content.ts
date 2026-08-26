import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { CONTENT_MODULE } from "../modules/content"
import type ContentModuleService from "../modules/content/service"
import type { ContentSection } from "../modules/content/models/content-page"

type UpdateWebsiteContentInput = {
  id: string
  handle: string
  locale: "el" | "en"
  title: string
  status: "draft" | "published"
  sections: ContentSection[]
  seo_title?: string | null
  seo_description?: string | null
}

const updateWebsiteContentStep = createStep(
  "update-website-content",
  async (input: UpdateWebsiteContentInput, { container }) => {
    const contentService = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const page = await contentService.updateContentPages(input)

    return new StepResponse(page)
  }
)

const updateWebsiteContentWorkflow = createWorkflow(
  "update-website-content",
  function (input: UpdateWebsiteContentInput) {
    return new WorkflowResponse(updateWebsiteContentStep(input))
  }
)

export default updateWebsiteContentWorkflow
