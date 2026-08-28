import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { ILockingModule } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  applyStudioTaxPlan,
  type StudioTaxRequest,
} from "../../../../../lib/studio-tax"

const ApplyPayload = z
  .object({
    expected_state_hash: z.string().regex(/^[a-f0-9]{64}$/),
    tax_hash: z.string().regex(/^[a-f0-9]{64}$/),
    tax: z
      .object({
        default_rate: z.string().trim().min(1).max(20),
        name: z.string().trim().min(2).max(80),
        code: z.union([z.string().trim().max(40), z.null()]).optional(),
        prices_include_tax: z.boolean(),
      })
      .strict(),
  })
  .strict()

function domainError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "stale_tax_state") {
    return {
      status: 409,
      code: "stale_tax_state",
      message: "Store tax settings changed in another session. Reload before applying.",
    }
  }
  if (message === "stale_tax_plan") {
    return {
      status: 409,
      code: "stale_tax_plan",
      message: "The live tax configuration changed after review. Review it again before applying.",
    }
  }
  if (message.startsWith("tax_state_blocked:")) {
    return {
      status: 409,
      code: "tax_state_blocked",
      message: "Existing advanced tax configuration is outside this guarded Studio workflow. Review it in technical Medusa Admin.",
    }
  }
  return { status: 409, code: "tax_apply_blocked", message }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = ApplyPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid guarded tax apply request.",
      issues: parsed.error.issues,
    })
  }

  const locking = req.scope.resolve<ILockingModule>(Modules.LOCKING)
  try {
    const plan = await locking.execute(
      "coquette-studio-tax",
      async () =>
        applyStudioTaxPlan(
          req.scope,
          parsed.data.expected_state_hash,
          parsed.data.tax as StudioTaxRequest,
          parsed.data.tax_hash
        ),
      { timeout: 15 }
    )
    return res.status(200).json({ applied: true, plan })
  } catch (error) {
    console.error("COQUETTE Studio guarded tax apply failed", error)
    const mapped = domainError(error)
    return res.status(mapped.status).json({ message: mapped.message, code: mapped.code })
  }
}
