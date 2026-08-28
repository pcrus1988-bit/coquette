import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  buildStudioTaxPlan,
  type StudioTaxRequest,
} from "../../../../../lib/studio-tax"

const TaxPayload = z
  .object({
    expected_state_hash: z.string().regex(/^[a-f0-9]{64}$/),
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
      message: "Store tax settings changed in another session. Reload before reviewing.",
    }
  }
  if (message.startsWith("tax_state_blocked:")) {
    return {
      status: 409,
      code: "tax_state_blocked",
      message: "Existing advanced tax configuration is outside this guarded Studio workflow. Review it in technical Medusa Admin.",
    }
  }
  return { status: 409, code: "tax_plan_blocked", message }
}

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = TaxPayload.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid guarded tax review request.",
      issues: parsed.error.issues,
    })
  }

  try {
    const plan = await buildStudioTaxPlan(
      req.scope,
      parsed.data.expected_state_hash,
      parsed.data.tax as StudioTaxRequest
    )
    return res.status(200).json({ ready: true, plan })
  } catch (error) {
    const mapped = domainError(error)
    return res.status(mapped.status).json({ message: mapped.message, code: mapped.code })
  }
}
