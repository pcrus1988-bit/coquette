import { createHmac, timingSafeEqual } from "node:crypto"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import recordKlarnaAuthorizationWorkflow from "../../../../workflows/record-klarna-authorization"

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

  const { result } = await recordKlarnaAuthorizationWorkflow(req.scope).run({
    input: {
      payment_session_id: paymentSessionId,
      klarna_session_id: body.session_id,
      authorization_token: body.authorization_token,
    },
  })

  if (result.outcome === "not_found") {
    res.status(404).json({ message: "Payment session not found" })
    return
  }

  if (result.outcome === "session_mismatch") {
    res.status(409).json({ message: "Klarna session mismatch" })
    return
  }

  if (result.outcome === "conflicting_token") {
    res.status(409).json({ message: "Conflicting Klarna authorization token" })
    return
  }

  res.status(204).send()
}
