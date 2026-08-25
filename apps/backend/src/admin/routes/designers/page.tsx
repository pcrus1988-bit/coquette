import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text } from "@medusajs/ui"

const DesignersPage = () => {
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h1">Designers</Heading>
        <Text className="mt-2 text-ui-fg-subtle">
          Manage the designer and brand catalogue used by COQUETTE products and navigation.
        </Text>
      </div>
      <div className="px-6 py-8">
        <Text className="text-ui-fg-subtle">
          The Designer domain is installed. CRUD controls and Magento-migration mapping are the next implementation step.
        </Text>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Designers",
})

export default DesignersPage
