import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  buildStudioLifecyclePlan,
  cleanStudioLifecycleProductId,
  STUDIO_LIFECYCLE_ACTIONS,
  type StudioLifecycleAction,
} from "../../../../../lib/studio-lifecycle"

const PlanPayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    expected_updated_at: z.string().trim().min(1).max(100),
    action: z.enum(STUDIO_LIFECYCLE_ACTIONS),
  })
  .strict()

function domainError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "stale_product") {
    return {
      status: 409,
      code: "stale_product",
      message: "This product changed in another session. Reload it before reviewing visibility.",
    }
  }
  if (message.includes("not_studio_product")) {
    return {
      status: 403,
      code: "not_studio_product",
      message: "This product is outside the guarded COQUETTE Studio product flow.",
    }
  }
  if (message.includes("unsupported_status")) {
    return {
      status: 409,
      code: "unsupported_status",
      message: "This Medusa lifecycle state cannot be managed by COQUETTE Studio.",
    }
  }
  if (message.includes("publish_not_ready")) {
    return {
      status: 409,
      code: "publish_not_ready",
      message: message.replace(/^publish_not_ready:\s*/, ""),
    }
  }
  if (message.includes("foreign_sales_channel")) {
    return {
      status: 409,
      code: "foreign_sales_channel",
      message: "Publication is blocked because this product is linked to a non-canonical sales channel.",
    }
  }
  if (message.includes("invalid_transition")) {
    return {
      status: 409,
      code: "invalid_transition",
      message: message.replace(/^invalid_transition:\s*/, ""),
    }
  }
  return { status: 409, code: "lifecycle_plan_blocked", message }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = PlanPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid guarded lifecycle review request.",
      issues: parsed.error.issues,
    })
  }

  const productId = cleanStudioLifecycleProductId(parsed.data.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  try {
    const plan = await buildStudioLifecyclePlan(
      req.scope,
      productId,
      parsed.data.expected_updated_at,
      parsed.data.action as StudioLifecycleAction
    )
    return res.status(200).json({ ready: true, plan })
  } catch (error) {
    console.error("COQUETTE Studio guarded lifecycle review failed", error)
    const mapped = domainError(error)
    return res.status(mapped.status).json({
      message: mapped.message,
      code: mapped.code,
    })
  }
}
