import Medusa from "@medusajs/js-sdk"

const backendUrl = (
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
).replace(/\/$/, "")

const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

export const isMedusaStoreConfigured = Boolean(
  publishableKey &&
    !publishableKey.startsWith("replace-") &&
    /^https?:\/\//.test(backendUrl)
)

export const medusa = new Medusa({
  baseUrl: backendUrl,
  debug: process.env.NODE_ENV === "development",
  publishableKey,
})

export const medusaBackendUrl = backendUrl
