import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"

const WebsitePage = () => {
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h1">Website</Heading>
        <Text className="mt-2 text-ui-fg-subtle">
          Manage COQUETTE storefront content without editing code.
        </Text>
      </div>
      <div className="grid gap-4 px-6 py-8 md:grid-cols-2">
        {[
          ["Pages", "Greek and English landing and information pages"],
          ["Homepage", "Hero, banners, editorial blocks and featured products"],
          ["Navigation", "Header, designer and category merchandising"],
          ["SEO", "Titles, descriptions, canonical and index settings"],
        ].map(([title, description]) => (
          <div className="rounded-lg border border-ui-border-base p-4" key={title}>
            <Heading level="h2">{title}</Heading>
            <Text className="mt-2 text-ui-fg-subtle">{description}</Text>
          </div>
        ))}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Website",
})

export default WebsitePage
