import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  buildStudioInventoryPlan,
  cleanStudioInventoryProductId,
  type StudioInventoryRequest,
} from "../../../../../lib/studio-inventory"

const PlanPayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    expected_updated_at: z.string().trim().min(1).max(100),
    inventory: z
      .object({
        variants: z
          .array(
            z
              .object({
                variant_id: z.string().trim().min(3).max(160),
                stocked_quantity: z.number().int().min(0).max(1_000_000),
              })
              .strict()
          )
          .min(1)
          .max(120),
      })
      .strict(),
  })
  .strict()

function domainError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "stale_draft") {
    return {
      status: 409,
      code: "stale_draft",
      message: "This draft changed in another session. Reload it before reviewing stock.",
    }
  }
  if (message.includes("not_studio_draft")) {
    return {
      status: 403,
      code: "not_studio_draft",
      message: "This product is outside the guarded COQUETTE Studio draft flow.",
    }
  }
  if (message.includes("variant_graph_required") || message.includes("variants_required")) {
    return {
      status: 409,
      code: "variant_graph_required",
      message: "Build the product choices before reviewing stock.",
    }
  }
  return { status: 409, code: "inventory_plan_blocked", message }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = PlanPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid guarded inventory review request.",
      issues: parsed.error.issues,
    })
  }

  const productId = cleanStudioInventoryProductId(parsed.data.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  try {
    const plan = await buildStudioInventoryPlan(
      req.scope,
      productId,
      parsed.data.expected_updated_at,
      parsed.data.inventory as StudioInventoryRequest
    )
    return res.status(200).json({ ready: true, plan })
  } catch (error) {
    console.error("COQUETTE Studio guarded inventory review failed", error)
    const mapped = domainError(error)
    return res.status(mapped.status).json({
      message: mapped.message,
      code: mapped.code,
    })
  }
}
