import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"

type RecordKlarnaAuthorizationInput = {
  payment_session_id: string
  klarna_session_id: string
  authorization_token: string
}

type RecordKlarnaAuthorizationResult = {
  outcome: "ok" | "not_found" | "session_mismatch" | "conflicting_token"
}

const recordKlarnaAuthorizationStep = createStep(
  "record-klarna-authorization",
  async (
    input: RecordKlarnaAuthorizationInput,
    { container }
  ): Promise<StepResponse<RecordKlarnaAuthorizationResult>> => {
    const paymentModuleService = container.resolve(Modules.PAYMENT)
    const sessions = await paymentModuleService.listPaymentSessions({
      id: input.payment_session_id,
    })
    const session = sessions[0]

    if (!session) {
      return new StepResponse({ outcome: "not_found" })
    }

    const data = (session.data || {}) as Record<string, unknown>

    if (data.klarna_session_id !== input.klarna_session_id) {
      return new StepResponse({ outcome: "session_mismatch" })
    }

    const existingToken = data.authorization_token
    if (
      existingToken &&
      typeof existingToken === "string" &&
      existingToken !== input.authorization_token
    ) {
      return new StepResponse({ outcome: "conflicting_token" })
    }

    // Klarna callbacks are delivered with at-least-once semantics. If the same
    // authorization token was already persisted, treat the callback as a
    // successful idempotent replay and avoid a second write.
    if (existingToken === input.authorization_token) {
      return new StepResponse({ outcome: "ok" })
    }

    await paymentModuleService.updatePaymentSession({
      id: session.id,
      status: session.status,
      currency_code: session.currency_code,
      amount: session.amount,
      data: {
        ...data,
        authorization_token: input.authorization_token,
        klarna_authorized_at: new Date().toISOString(),
      },
    })

    return new StepResponse({ outcome: "ok" })
  }
)

const recordKlarnaAuthorizationWorkflow = createWorkflow(
  "record-klarna-authorization-workflow",
  function (input: RecordKlarnaAuthorizationInput) {
    const result = recordKlarnaAuthorizationStep(input)
    return new WorkflowResponse(result)
  }
)

export default recordKlarnaAuthorizationWorkflow
