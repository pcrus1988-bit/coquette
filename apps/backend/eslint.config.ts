import { defineConfig } from "eslint/config"
import medusa from "@medusajs/eslint-plugin"

export default defineConfig([
  ...medusa.configs.recommended,
  {
    rules: {
      "@medusajs/no-service-mutations-in-api-route": "error",
      "@medusajs/use-medusa-error-not-generic-error": "error",
    },
  },
])
