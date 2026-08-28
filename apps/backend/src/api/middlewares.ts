import {
  defineMiddlewares,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { studioProductIsArchived } from "../lib/studio-archive-policy"

const guardedStudioMutation =
  /^\/admin\/studio\/(?:media|variants|variant-identifiers|pricing|inventory|placement-taxonomy|lifecycle)(?:\/.*)?$/

function cleanProductId(value: unknown) {
  if (typeof value !== "string") return ""
  const id = value.trim()
  return /^[A-Za-z0-9_-]{3,160}$/.test(id) ? id : ""
}

function productIdFromRequest(req: MedusaRequest) {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {}
  const query =
    req.query && typeof req.query === "object"
      ? (req.query as Record<string, unknown>)
      : {}
  return cleanProductId(body.product_id ?? body.id ?? query.product_id)
}

async function enforceStudioArchiveBoundary(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const productId = productIdFromRequest(req)
  if (!productId) return next()

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "metadata"],
      filters: { id: productId },
    })
    const product = data?.[0] as
      | { id?: string; metadata?: Record<string, unknown> | null }
      | undefined

    if (product && studioProductIsArchived(product.metadata)) {
      return res.status(409).json({
        code: "product_archived",
        message:
          "This product is archived. Restore it to an editable draft before changing catalogue data or publication visibility.",
      })
    }
    return next()
  } catch (error) {
    console.error("COQUETTE Studio archive boundary failed", error)
    return res.status(503).json({
      code: "archive_guard_unavailable",
      message:
        "Studio could not verify the archive policy. The write was blocked safely; retry after refreshing the product state.",
    })
  }
}

export default defineMiddlewares({
  routes: [
    {
      matcher: guardedStudioMutation,
      method: ["POST", "PUT", "PATCH", "DELETE"],
      middlewares: [enforceStudioArchiveBoundary],
    },
  ],
})
