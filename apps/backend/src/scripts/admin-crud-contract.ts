import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import { BRAND_MODULE } from "../modules/brand"
import type BrandModuleService from "../modules/brand/service"
import { CONTENT_MODULE } from "../modules/content"
import type ContentModuleService from "../modules/content/service"

export default async function adminCrudContract({ container }: ExecArgs) {
  const brandService = container.resolve<BrandModuleService>(BRAND_MODULE)
  const contentService = container.resolve<ContentModuleService>(CONTENT_MODULE)
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const designer = await brandService.createBrands({
    name: "CI Phase 3 Designer",
    handle: `ci-phase3-designer-${suffix}`,
    description: "Synthetic record used only to verify COQUETTE Admin CRUD.",
    logo_url: null,
  })

  try {
    const fetchedDesigner = await brandService.retrieveBrand(designer.id)
    assert.equal(fetchedDesigner.name, "CI Phase 3 Designer")

    const updatedDesigner = await brandService.updateBrands({
      id: designer.id,
      name: "CI Phase 3 Designer Updated",
    })
    assert.equal(updatedDesigner.name, "CI Phase 3 Designer Updated")
  } finally {
    await brandService.deleteBrands(designer.id)
  }

  const contentPage = await contentService.createContentPages({
    handle: `ci-phase3-page-${suffix}`,
    locale: "el",
    title: "CI Phase 3 Page",
    status: "draft",
    sections: [],
    seo_title: null,
    seo_description: null,
  })

  try {
    const fetchedPage = await contentService.retrieveContentPage(contentPage.id)
    assert.equal(fetchedPage.title, "CI Phase 3 Page")
    assert.equal(fetchedPage.locale, "el")

    const updatedPage = await contentService.updateContentPages({
      id: contentPage.id,
      title: "CI Phase 3 Page Updated",
      status: "published",
    })
    assert.equal(updatedPage.title, "CI Phase 3 Page Updated")
    assert.equal(updatedPage.status, "published")
  } finally {
    await contentService.deleteContentPages(contentPage.id)
  }

  console.log("COQUETTE Phase 3 Admin CRUD contract passed")
}
