import { createHmac, randomUUID } from "node:crypto"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  PaymentSessionStatus,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  AbstractPaymentProvider,
  BigNumber,
  MedusaError,
  PaymentActions,
} from "@medusajs/framework/utils"

type Options = {
  username: string
  password: string
  environment?: "playground" | "production"
  api_region?: "eu" | "na" | "oc"
  callback_base_url: string
  callback_secret: string
  purchase_country?: string
  locale?: string
}

type InjectedDependencies = {
  logger: Logger
}

type KlarnaOrderLine = {
  type?: string
  reference?: string
  name: string
  quantity: number
  quantity_unit?: string
  unit_price?: number
  tax_rate?: number
  total_amount: number
  total_discount_amount?: number
  total_tax_amount?: number
  image_url?: string
  product_url?: string
  product_identifiers?: Record<string, unknown>
}

type KlarnaSessionResponse = {
  session_id?: string
  client_token?: string
  payment_method_categories?: Array<Record<string, unknown>>
}

type KlarnaSessionDetails = KlarnaSessionResponse & {
  status?: string
  order_amount?: number
  order_tax_amount?: number
  purchase_country?: string
  purchase_currency?: string
}

type KlarnaOrderResponse = {
  order_id?: string
  fraud_status?: string
  redirect_url?: string
  authorized_payment_method?: Record<string, unknown>
}

type KlarnaOrderDetails = {
  order_id?: string
  status?: string
  order_amount?: number
  captured_amount?: number
  refunded_amount?: number
  purchase_currency?: string
}

type KlarnaCaptureResponse = {
  capture_id?: string
}

type KlarnaRefundResponse = {
  refund_id?: string
}

type KlarnaErrorResponse = {
  correlation_id?: string
  error_code?: string
  error_messages?: string[]
}

type SessionData = Record<string, unknown> & {
  session_id?: string
  klarna_session_id?: string
  authorization_token?: string
  order_id?: string
  client_token?: string
  purchase_country?: string
  locale?: string
  purchase_currency?: string
  order_amount?: number
  order_tax_amount?: number
  order_lines?: KlarnaOrderLine[]
  create_order_idempotency_key?: string
}

class KlarnaPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "klarna"

  protected logger_: Logger
  protected options_: Required<Options>

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)

    this.logger_ = container.logger
    this.options_ = {
      environment: "playground",
      api_region: "eu",
      purchase_country: "GR",
      locale: "el-GR",
      ...options,
    }
  }

  static validateOptions(options: Record<string, unknown>): void | never {
    const required = [
      "username",
      "password",
      "callback_base_url",
      "callback_secret",
    ]

    for (const field of required) {
      if (!options[field]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Klarna ${field} is required`
        )
      }
    }
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    try {
      const inputData = this.sessionData(input.data)
      const medusaSessionId = inputData.session_id
      if (!medusaSessionId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Medusa payment session ID is required for Klarna"
        )
      }

      const orderAmount = this.toMinorUnits(input.amount)
      const orderLines = this.validatedOrderLines(
        inputData.order_lines,
        orderAmount
      )
      const orderTaxAmount = this.validatedOrderTaxAmount(
        inputData.order_tax_amount,
        orderLines
      )
      const purchaseCountry = String(
        inputData.purchase_country || this.options_.purchase_country
      ).toUpperCase()
      const locale = String(inputData.locale || this.options_.locale)
      const purchaseCurrency = input.currency_code.toUpperCase()
      const createOrderIdempotencyKey = randomUUID()

      const callbackUrl = this.authorizationCallbackUrl(medusaSessionId)
      const response = await this.request<KlarnaSessionResponse>(
        "/payments/v1/sessions",
        {
          method: "POST",
          body: {
            purchase_country: purchaseCountry,
            purchase_currency: purchaseCurrency,
            locale,
            order_amount: orderAmount,
            order_tax_amount: orderTaxAmount,
            order_lines: orderLines,
            intent: "buy",
            merchant_urls: {
              authorization: callbackUrl,
            },
          },
        }
      )

      if (!response.session_id || !response.client_token) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Klarna did not return a session ID and client token"
        )
      }

      return {
        id: response.session_id,
        data: {
          ...inputData,
          klarna_session_id: response.session_id,
          client_token: response.client_token,
          payment_method_categories: response.payment_method_categories,
          purchase_country: purchaseCountry,
          purchase_currency: purchaseCurrency,
          locale,
          order_amount: orderAmount,
          order_tax_amount: orderTaxAmount,
          order_lines: orderLines,
          create_order_idempotency_key: createOrderIdempotencyKey,
        },
      }
    } catch (error: any) {
      throw this.providerError("initiate Klarna payment", error)
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    try {
      const data = this.sessionData(input.data)
      const authorizationToken = data.authorization_token
      if (!authorizationToken) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Klarna authorization token is required before cart completion"
        )
      }

      const orderAmount = this.requiredNumber(data.order_amount, "order_amount")
      const orderLines = this.validatedOrderLines(data.order_lines, orderAmount)
      const orderTaxAmount = this.validatedOrderTaxAmount(
        data.order_tax_amount,
        orderLines
      )
      const purchaseCountry = String(
        data.purchase_country || this.options_.purchase_country
      ).toUpperCase()
      const purchaseCurrency = String(
        data.purchase_currency || "EUR"
      ).toUpperCase()
      const locale = String(data.locale || this.options_.locale)
      const idempotencyKey =
        data.create_order_idempotency_key || randomUUID()

      const response = await this.request<KlarnaOrderResponse>(
        `/payments/v1/authorizations/${encodeURIComponent(
          authorizationToken
        )}/order`,
        {
          method: "POST",
          idempotencyKey,
          body: {
            purchase_country: purchaseCountry,
            purchase_currency: purchaseCurrency,
            locale,
            order_amount: orderAmount,
            order_tax_amount: orderTaxAmount,
            order_lines: orderLines,
            merchant_reference1: data.session_id,
          },
        }
      )

      if (!response.order_id) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Klarna did not return an order ID"
        )
      }

      const fraudStatus = String(response.fraud_status || "ACCEPTED").toUpperCase()
      if (fraudStatus === "REJECTED") {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Klarna rejected the order during fraud assessment"
        )
      }

      return {
        data: {
          ...data,
          order_id: response.order_id,
          fraud_status: fraudStatus,
          redirect_url: response.redirect_url,
          authorized_payment_method: response.authorized_payment_method,
          create_order_idempotency_key: idempotencyKey,
        },
        status:
          fraudStatus === "PENDING"
            ? ("pending_authorization" as PaymentSessionStatus)
            : ("authorized" as PaymentSessionStatus),
      }
    } catch (error: any) {
      throw this.providerError("authorize Klarna payment", error)
    }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    try {
      const data = this.sessionData(input.data)
      const orderId = this.requiredString(data.order_id, "Klarna order ID")
      const capturedAmount = this.requiredNumber(data.order_amount, "order_amount")
      const response = await this.request<KlarnaCaptureResponse>(
        `/ordermanagement/v1/orders/${encodeURIComponent(orderId)}/captures`,
        {
          method: "POST",
          idempotencyKey: randomUUID(),
          body: {
            captured_amount: capturedAmount,
            description: "COQUETTE capture",
          },
        }
      )

      return {
        data: {
          ...data,
          ...(response.capture_id ? { capture_id: response.capture_id } : {}),
          captured_amount: capturedAmount,
        },
      }
    } catch (error: any) {
      throw this.providerError("capture Klarna payment", error)
    }
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    try {
      const data = this.sessionData(input.data)
      const orderId = this.requiredString(data.order_id, "Klarna order ID")
      const refundedAmount = this.toMinorUnits(input.amount)
      const response = await this.request<KlarnaRefundResponse>(
        `/ordermanagement/v1/orders/${encodeURIComponent(orderId)}/refunds`,
        {
          method: "POST",
          idempotencyKey: randomUUID(),
          body: {
            refunded_amount: refundedAmount,
            description: "COQUETTE refund",
          },
        }
      )

      return {
        data: {
          ...data,
          ...(response.refund_id ? { refund_id: response.refund_id } : {}),
          refunded_amount: refundedAmount,
        },
      }
    } catch (error: any) {
      throw this.providerError("refund Klarna payment", error)
    }
  }

  async updatePayment(
    input: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    try {
      const data = this.sessionData(input.data)
      const klarnaSessionId = this.requiredString(
        data.klarna_session_id,
        "Klarna session ID"
      )

      if (data.order_id || data.authorization_token) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Klarna session totals cannot be changed after authorization"
        )
      }

      const orderAmount = this.toMinorUnits(input.amount)
      const orderLines = this.validatedOrderLines(data.order_lines, orderAmount)
      const orderTaxAmount = this.validatedOrderTaxAmount(
        data.order_tax_amount,
        orderLines
      )

      await this.request<void>(
        `/payments/v1/sessions/${encodeURIComponent(klarnaSessionId)}`,
        {
          method: "POST",
          body: {
            order_amount: orderAmount,
            order_tax_amount: orderTaxAmount,
            order_lines: orderLines,
          },
        }
      )

      return {
        data: {
          ...data,
          order_amount: orderAmount,
          order_tax_amount: orderTaxAmount,
          order_lines: orderLines,
          purchase_currency: input.currency_code.toUpperCase(),
        },
      }
    } catch (error: any) {
      throw this.providerError("update Klarna payment", error)
    }
  }

  async deletePayment(
    input: DeletePaymentInput
  ): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    try {
      const data = this.sessionData(input.data)

      if (data.order_id) {
        const order = await this.request<KlarnaOrderDetails>(
          `/ordermanagement/v1/orders/${encodeURIComponent(data.order_id)}`
        )
        return {
          data: {
            ...data,
            status: order.status,
            captured_amount: order.captured_amount,
            refunded_amount: order.refunded_amount,
          },
        }
      }

      const klarnaSessionId = this.requiredString(
        data.klarna_session_id,
        "Klarna session ID"
      )
      const session = await this.request<KlarnaSessionDetails>(
        `/payments/v1/sessions/${encodeURIComponent(klarnaSessionId)}`
      )

      return {
        data: {
          ...data,
          status: session.status,
          client_token: session.client_token || data.client_token,
        },
      }
    } catch (error: any) {
      throw this.providerError("retrieve Klarna payment", error)
    }
  }

  async cancelPayment(
    input: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    try {
      const data = this.sessionData(input.data)

      if (data.order_id) {
        await this.request<void>(
          `/ordermanagement/v1/orders/${encodeURIComponent(data.order_id)}/cancel`,
          {
            method: "POST",
            idempotencyKey: randomUUID(),
          }
        )
        return { data }
      }

      if (data.authorization_token) {
        await this.request<void>(
          `/payments/v1/authorizations/${encodeURIComponent(
            data.authorization_token
          )}`,
          { method: "DELETE" }
        )
      }

      return { data }
    } catch (error: any) {
      throw this.providerError("cancel Klarna payment", error)
    }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const data = this.sessionData(input.data)

    if (!data.order_id) {
      return {
        status: data.authorization_token
          ? ("requires_more" as PaymentSessionStatus)
          : ("pending" as PaymentSessionStatus),
      }
    }

    try {
      const order = await this.request<KlarnaOrderDetails>(
        `/ordermanagement/v1/orders/${encodeURIComponent(data.order_id)}`
      )
      const status = String(order.status || "").toUpperCase()

      if (status.includes("CANCEL")) {
        return { status: "canceled" as PaymentSessionStatus }
      }
      if (status.includes("CAPTURE")) {
        return { status: "captured" as PaymentSessionStatus }
      }
      if (status.includes("AUTHORIZED") || status.includes("PART_CAPTURED")) {
        return { status: "authorized" as PaymentSessionStatus }
      }

      return { status: "pending" as PaymentSessionStatus }
    } catch (error) {
      this.logger_.warn(`Klarna status lookup failed for ${data.order_id}`)
      return { status: "pending" as PaymentSessionStatus }
    }
  }

  async getWebhookActionAndData(
    _payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    // Klarna Payments authorization is handled by the dedicated signed
    // /hooks/klarna/authorization callback. Order-management push notifications
    // require a separate acknowledgment/reconciliation workflow and are not
    // treated as Medusa Payment Module webhook events in this foundation.
    return this.emptyWebhookResult(PaymentActions.NOT_SUPPORTED)
  }

  private authorizationCallbackUrl(paymentSessionId: string) {
    const baseUrl = this.options_.callback_base_url.replace(/\/$/, "")
    const signature = createHmac("sha256", this.options_.callback_secret)
      .update(paymentSessionId)
      .digest("hex")
    const query = new URLSearchParams({
      payment_session_id: paymentSessionId,
      signature,
    })
    return `${baseUrl}/hooks/klarna/authorization?${query.toString()}`
  }

  private validatedOrderLines(value: unknown, expectedTotal: number) {
    if (!Array.isArray(value) || value.length === 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Klarna order_lines are required; COQUETTE will not guess product, shipping, discount, or VAT lines"
      )
    }

    const lines = value as KlarnaOrderLine[]
    for (const line of lines) {
      if (
        !line ||
        typeof line.name !== "string" ||
        !Number.isInteger(line.quantity) ||
        line.quantity <= 0 ||
        !Number.isInteger(line.total_amount)
      ) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Each Klarna order line requires name, positive integer quantity, and integer total_amount"
        )
      }
    }

    const lineTotal = lines.reduce((sum, line) => sum + line.total_amount, 0)
    if (lineTotal !== expectedTotal) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Klarna order line total ${lineTotal} does not match payment amount ${expectedTotal}`
      )
    }

    return lines
  }

  private validatedOrderTaxAmount(value: unknown, lines: KlarnaOrderLine[]) {
    const calculated = lines.reduce(
      (sum, line) => sum + Number(line.total_tax_amount || 0),
      0
    )

    if (value == null) {
      return calculated
    }

    const provided = Number(value)
    if (!Number.isInteger(provided) || provided !== calculated) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Klarna order_tax_amount must equal the sum of line total_tax_amount values (${calculated})`
      )
    }

    return provided
  }

  private sessionData(value: unknown): SessionData {
    return value && typeof value === "object"
      ? (value as SessionData)
      : {}
  }

  private requiredString(value: unknown, label: string) {
    if (typeof value !== "string" || !value) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `${label} is required`)
    }
    return value
  }

  private requiredNumber(value: unknown, label: string) {
    const result = Number(value)
    if (!Number.isInteger(result) || result < 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Klarna ${label} must be a non-negative integer in minor units`
      )
    }
    return result
  }

  private toMinorUnits(amount: unknown) {
    const numeric = Number(new BigNumber(amount as any).numeric)
    if (!Number.isFinite(numeric)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Klarna payment amount is invalid"
      )
    }
    return Math.round(numeric * 100)
  }

  private apiBaseUrl() {
    const regionPrefix =
      this.options_.api_region === "na"
        ? "api-na"
        : this.options_.api_region === "oc"
          ? "api-oc"
          : "api"
    return this.options_.environment === "production"
      ? `https://${regionPrefix}.klarna.com`
      : `https://${regionPrefix}.playground.klarna.com`
  }

  private async request<T>(
    path: string,
    options: {
      method?: string
      body?: unknown
      idempotencyKey?: string
    } = {}
  ): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl()}${path}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Basic ${Buffer.from(
          `${this.options_.username}:${this.options_.password}`
        ).toString("base64")}`,
        "Klarna-Integrator": "COQUETTE/0.1 Medusa/2.19.0",
        ...(options.idempotencyKey
          ? { "Klarna-Idempotency-Key": options.idempotencyKey }
          : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    })

    if (!response.ok) {
      let details: KlarnaErrorResponse | undefined
      try {
        details = (await response.json()) as KlarnaErrorResponse
      } catch {
        // Keep the HTTP error as the authoritative fallback.
      }

      const message = [
        details?.error_code,
        ...(details?.error_messages || []),
        details?.correlation_id ? `correlation ${details.correlation_id}` : undefined,
      ]
        .filter(Boolean)
        .join(": ")

      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Klarna API ${response.status}${message ? `: ${message}` : ""}`
      )
    }

    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return undefined as T
    }

    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  private emptyWebhookResult(action: WebhookActionResult["action"]) {
    return {
      action,
      data: {
        session_id: "",
        amount: new BigNumber(0),
      },
    }
  }

  private providerError(operation: string, error: any) {
    if (error instanceof MedusaError) {
      return error
    }

    return new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Failed to ${operation}: ${error?.message || String(error)}`
    )
  }
}

export default KlarnaPaymentProviderService
