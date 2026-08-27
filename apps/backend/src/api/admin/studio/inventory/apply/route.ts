import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  applyStudioInventoryPlan,
  cleanStudioInventoryProductId,
  type StudioInventoryRequest,
} from "../../../../../lib/studio-inventory"

const ApplyPayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    expected_updated_at: z.string().trim().min(1).max(100),
    inventory_hash: z.string().regex(/^[a-f0-9]{64}$/),
    inventory: z
      .object({
        variants: z
          .array(
            z
              .object({
                variant_id: z.string().trim().min(3).max(160),
                locations: z
                  .array(
                    z
                      .object({
                        location_id: z.string().trim().min(3).max(160),
                        stocked_quantity: z.number().int().min(0).max(1_000_000_000),
                      })
                      .strict()
                  )
                  .max(100),
              })
              .strict()
          )
          .max(120),
      })
      .strict(),
  })
  .strict()

function domainError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "stale_draft") {
    return { status: 409, code: "stale_draft", message: "This draft changed in another session. Reload it before applying stock." }
  }
  if (message === "stale_inventory_plan") {
    return { status: 409, code: "stale_inventory_plan", message: "The live inventory state changed after review. Refresh the stock plan before applying it." }
  }
  if (message.includes("not_studio_draft")) {
    return { status: 403, code: "not_studio_draft", message: "This product is outside the guarded COQUETTE Studio draft flow." }
  }
  if (message.includes("variant_graph_required")) {
    return { status: 409, code: "variant_graph_required", message: "Build the product choices before applying stock." }
  }
  return { status: 409, code: "inventory_apply_blocked", message }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = ApplyPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid guarded inventory apply request.",
      issues: parsed.error.issues,
    })
  }

  const productId = cleanStudioInventoryProductId(parsed.data.product_id)
  if (!productId) {
    return res.status(400).json({ message: "A valid Studio product id is required." })
  }

  const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)

  try {
    const result = await locking.execute(
      "coquette-studio-inventory",
      async () =>
        applyStudioInventoryPlan(
          req.scope,
          productId,
          parsed.data.expected_updated_at,
          parsed.data.inventory as StudioInventoryRequest,
          parsed.data.inventory_hash
        ),
      { timeout: 20 }
    )
    return res.status(200).json(result)
  } catch (error) {
    console.error("COQUETTE Studio guarded inventory apply failed", error)
    const mapped = domainError(error)
    return res.status(mapped.status).json({ message: mapped.message, code: mapped.code })
  }
}
