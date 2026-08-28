import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  applyStudioArchivePlan,
  cleanStudioArchiveProductId,
  STUDIO_ARCHIVE_ACTIONS,
  type StudioArchiveAction,
} from "../../../../../lib/studio-archive"

const ApplyPayload = z
  .object({
    product_id: z.string().trim().min(3).max(160),
    expected_updated_at: z.string().trim().min(1).max(100),
    action: z.enum(STUDIO_ARCHIVE_ACTIONS),
    archive_hash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

function domainError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "stale_product") {
    return { status: 409, code: "stale_product", message: "This product changed in another session. Reload it before changing archive state." }
  }
  if (message === "stale_archive_plan") {
    return { status: 409, code: "stale_archive_plan", message: "The archive state changed after review. Review the plan again before applying it." }
  }
  if (message.includes("not_studio_product")) {
    return { status: 403, code: "not_studio_product", message: "This product is outside the guarded COQUETTE Studio product flow." }
  }
  if (message.includes("archived_visibility_violation")) {
    return { status: 409, code: "archived_visibility_violation", message: "Archived products must remain unpublished drafts." }
  }
  if (message.includes("invalid_transition")) {
    return { status: 409, code: "invalid_transition", message: message.replace(/^invalid_transition:\s*/, "") }
  }
  return { status: 409, code: "archive_apply_blocked", message }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = ApplyPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid guarded archive apply request.", issues: parsed.error.issues })
  }
  const productId = cleanStudioArchiveProductId(parsed.data.product_id)
  if (!productId) return res.status(400).json({ message: "A valid Studio product id is required." })

  const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)
  try {
    const result = await locking.execute(
      `coquette-studio-archive:${productId}`,
      async () =>
        applyStudioArchivePlan(
          req.scope,
          productId,
          parsed.data.expected_updated_at,
          parsed.data.action as StudioArchiveAction,
          parsed.data.archive_hash
        ),
      { timeout: 20 }
    )
    return res.status(200).json({ applied: true, ...result })
  } catch (error) {
    console.error("COQUETTE Studio guarded archive apply failed", error)
    const mapped = domainError(error)
    return res.status(mapped.status).json({ message: mapped.message, code: mapped.code })
  }
}
