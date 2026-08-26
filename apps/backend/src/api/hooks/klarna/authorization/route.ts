import { createHmac, timingSafeEqual } from "node:crypto"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

type KlarnaAuthorizationBody = {
  authorization_token?: string
  session_id?: string
}

function queryValue(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] == null ? undefined : String(value[0])
  }
  return value == null ? undefined : String(value)
}

function validSignature(paymentSessionId: string, provided: string) {
  const secret = process.env.KLARNA_CALLBACK_SECRET
  if (!secret) {
    return false
  }

  const expected = createHmac("sha256", secret)
    .update(paymentSessionId)
    .digest("hex")

  if (provided.length !== expected.length) {
    return false
  }

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const paymentSessionId = queryValue(req.query.payment_session_id)
  const signature = queryValue(req.query.signature)
  const body = (req.body || {}) as KlarnaAuthorizationBody

  if (!paymentSessionId || !signature || !validSignature(paymentSessionId, signature)) {
    res.status(401).json({ message: "Invalid Klarna authorization callback signature" })
    return
  }

  if (!body.authorization_token || !body.session_id) {
    res.status(400).json({ message: "Missing Klarna authorization callback data" })
    return
  }

  const paymentModuleService = req.scope.resolve(Modules.PAYMENT)
  const sessions = await paymentModuleService.listPaymentSessions({
    id: paymentSessionId,
  })
  const session = sessions[0]

  if (!session) {
    res.status(404).json({ message: "Payment session not found" })
    return
  }

  const data = (session.data || {}) as Record<string, unknown>
  if (data.klarna_session_id !== body.session_id) {
    res.status(409).json({ message: "Klarna session mismatch" })
    return
  }

  // Klarna delivers authorization callbacks with at-least-once semantics.
  // Repeating the same token is idempotent; a conflicting token is rejected.
  const existingToken = data.authorization_token
  if (
    existingToken &&
    typeof existingToken === "string" &&
    existingToken !== body.authorization_token
  ) {
    res.status(409).json({ message: "Conflicting Klarna authorization token" })
    return
  }

  await paymentModuleService.updatePaymentSession({
    id: session.id,
    status: session.status,
    currency_code: session.currency_code,
    amount: session.amount,
    data: {
      ...data,
      authorization_token: body.authorization_token,
      klarna_authorized_at: new Date().toISOString(),
    },
  })

  res.status(204).send()
}
