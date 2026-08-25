import { model } from "@medusajs/framework/utils"

export type ContentSection = {
  id: string
  type: "hero" | "rich_text" | "image_text" | "product_collection" | "banner" | "spacer"
  enabled: boolean
  data: Record<string, unknown>
}

const ContentPage = model
  .define("content_page", {
    id: model.id().primaryKey(),
    handle: model.text(),
    locale: model.enum(["el", "en"]),
    title: model.text(),
    status: model.enum(["draft", "published"]).default("draft"),
    sections: model.json<ContentSection[]>(),
    seo_title: model.text().nullable(),
    seo_description: model.text().nullable(),
    published_at: model.dateTime().nullable(),
    magento_source_id: model.text().nullable(),
  })
  .indexes([
    {
      on: ["handle", "locale"],
      unique: true,
    },
  ])

export default ContentPage
