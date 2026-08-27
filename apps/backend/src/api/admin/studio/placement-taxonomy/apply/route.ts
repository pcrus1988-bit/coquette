import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  applyStudioPlacementTaxonomyPlan,
  cleanStudioPlacementProductId,
  type StudioPlacementTaxonomyRequest,
} from "../../../../../lib/studio-placement-taxonomy"

const ApplyPayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    expected_updated_at: z.string().trim().min(1).max(100),
    placement_hash: z.string().regex(/^[a-f0-9]{64}$/),
    placement: z
      .object({
        category_ids: z.array(z.string().trim().min(3).max(160)).max(100),
        designer_id: z.string().trim().min(3).max(160).nullable(),
      })
      .strict(),
  })
  .strict()

function domainError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes("stale_draft")) {
    return {
      status: 409,
      code: "stale_draft",
      message: "This draft changed in another session. Reload it before applying placement.",
    }
  }
  if (message.includes("stale_placement_plan")) {
    return {
      status: 409,
      code: "stale_placement_plan",
      message: "The live category/designer state changed after review. Refresh the placement plan.",
    }
  }
  if (message.includes("not_studio_draft")) {
    return {
      status: 403,
      code: "not_studio_draft",
      message: "This product is outside the guarded COQUETTE Studio draft flow.",
    }
  }
  return { status: 409, code: "placement_apply_blocked", message }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = ApplyPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid guarded placement apply request.",
      issues: parsed.error.issues,
    })
  }

  const productId = cleanStudioPlacementProductId(parsed.data.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)
  try {
    const plan = await locking.execute(
      `coquette-studio-placement:${productId}`,
      async () =>
        applyStudioPlacementTaxonomyPlan(
          req.scope,
          productId,
          parsed.data.expected_updated_at,
          parsed.data.placement as StudioPlacementTaxonomyRequest,
          parsed.data.placement_hash
        ),
      { timeout: 20 }
    )
    return res.status(200).json({ applied: true, plan })
  } catch (error) {
    console.error("COQUETTE Studio guarded placement apply failed", error)
    const mapped = domainError(error)
    return res.status(mapped.status).json({
      message: mapped.message,
      code: mapped.code,
    })
  }
}
