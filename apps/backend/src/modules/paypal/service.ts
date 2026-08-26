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
import {
  Client,
  CheckoutPaymentIntent,
  Environment,
  OrderApplicationContextLandingPage,
  OrderApplicationContextUserAction,
  OrderRequest,
  OrdersController,
  OrderStatus,
  PatchOp,
  PaymentsController,
} from "@paypal/paypal-server-sdk"

type Options = {
  client_id: string
  client_secret: string
  environment?: "sandbox" | "production"
  autoCapture?: boolean
  webhook_id?: string
  brand_name?: string
}

type InjectedDependencies = {
  logger: Logger
}

type PayPalWebhookVerificationResponse = {
  verification_status?: string
}

type PayPalOAuthResponse = {
  access_token?: string
}

class PayPalPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "paypal"

  protected logger_: Logger
  protected options_: Options
  protected client_: Client
  protected ordersController_: OrdersController
  protected paymentsController_: PaymentsController

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)

    this.logger_ = container.logger
    this.options_ = {
      environment: "sandbox",
      autoCapture: false,
      brand_name: "COQUETTE",
      ...options,
    }

    this.client_ = new Client({
      environment:
        this.options_.environment === "production"
          ? Environment.Production
          : Environment.Sandbox,
      clientCredentialsAuthCredentials: {
        oAuthClientId: this.options_.client_id,
        oAuthClientSecret: this.options_.client_secret,
      },
    })

    this.ordersController_ = new OrdersController(this.client_)
    this.paymentsController_ = new PaymentsController(this.client_)
  }

  static validateOptions(options: Record<string, unknown>): void | never {
    if (!options.client_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayPal client ID is required"
      )
    }

    if (!options.client_secret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "PayPal client secret is required"
      )
    }
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    try {
      const { amount, currency_code } = input
      const intent = this.options_.autoCapture
        ? CheckoutPaymentIntent.Capture
        : CheckoutPaymentIntent.Authorize

      const orderRequest: OrderRequest = {
        intent,
        purchaseUnits: [
          {
            amount: {
              currencyCode: currency_code.toUpperCase(),
              value: new BigNumber(amount).numeric.toString(),
            },
            description: "COQUETTE order payment",
            customId: input.data?.session_id as string | undefined,
          },
        ],
        applicationContext: {
          brandName: this.options_.brand_name,
          landingPage: OrderApplicationContextLandingPage.NoPreference,
          userAction: OrderApplicationContextUserAction.PayNow,
        },
      }

      const response = await this.ordersController_.createOrder({
        body: orderRequest,
        prefer: "return=representation",
      })
      const order = response.result

      if (!order?.id) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Failed to create PayPal order"
        )
      }

      const approvalUrl = order.links?.find((link) => link.rel === "approve")?.href

      return {
        id: order.id,
        data: {
          order_id: order.id,
          intent,
          status: order.status,
          approval_url: approvalUrl,
          session_id: input.data?.session_id,
          currency_code,
        },
      }
    } catch (error: any) {
      throw this.providerError("initiate PayPal payment", error)
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    try {
      const orderId = input.data?.order_id as string | undefined
      if (!orderId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "PayPal order ID is required"
        )
      }

      if (this.options_.autoCapture) {
        const response = await this.ordersController_.captureOrder({
          id: orderId,
          prefer: "return=representation",
        })
        const order = response.result
        const captureId =
          order.purchaseUnits?.[0]?.payments?.captures?.[0]?.id

        if (!captureId) {
          throw new MedusaError(
            MedusaError.Types.UNEXPECTED_STATE,
            "PayPal capture ID was not returned"
          )
        }

        return {
          data: {
            ...input.data,
            order_id: orderId,
            capture_id: captureId,
            intent: "CAPTURE",
          },
          status: "captured" as PaymentSessionStatus,
        }
      }

      const response = await this.ordersController_.authorizeOrder({
        id: orderId,
        prefer: "return=representation",
      })
      const order = response.result
      const authorizationId =
        order.purchaseUnits?.[0]?.payments?.authorizations?.[0]?.id

      if (!authorizationId) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "PayPal authorization ID was not returned"
        )
      }

      return {
        data: {
          ...input.data,
          order_id: orderId,
          authorization_id: authorizationId,
          intent: "AUTHORIZE",
          currency_code: input.data?.currency_code,
        },
        status: "authorized" as PaymentSessionStatus,
      }
    } catch (error: any) {
      throw this.providerError("authorize PayPal payment", error)
    }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    try {
      const authorizationId = input.data?.authorization_id as string | undefined
      if (!authorizationId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "PayPal authorization ID is required for capture"
        )
      }

      const response =
        await this.paymentsController_.captureAuthorizedPayment({
          authorizationId,
          prefer: "return=representation",
        })
      const capture = response.result

      if (!capture?.id) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Failed to capture PayPal payment"
        )
      }

      return {
        data: {
          ...input.data,
          capture_id: capture.id,
        },
      }
    } catch (error: any) {
      throw this.providerError("capture PayPal payment", error)
    }
  }

  async refundPayment(
    input: RefundPaymentInput
  ): Promise<RefundPaymentOutput> {
    try {
      const captureId = input.data?.capture_id as string | undefined
      const currencyCode = input.data?.currency_code as string | undefined

      if (!captureId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "PayPal capture ID is required for refund"
        )
      }

      if (!currencyCode) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "PayPal payment currency is required for refund"
        )
      }

      const response = await this.paymentsController_.refundCapturedPayment({
        captureId,
        body: {
          amount: {
            currencyCode: currencyCode.toUpperCase(),
            value: new BigNumber(input.amount).numeric.toString(),
          },
        },
        prefer: "return=representation",
      })
      const refund = response.result

      if (!refund?.id) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Failed to refund PayPal payment"
        )
      }

      return {
        data: {
          ...input.data,
          refund_id: refund.id,
        },
      }
    } catch (error: any) {
      throw this.providerError("refund PayPal payment", error)
    }
  }

  async updatePayment(
    input: UpdatePaymentInput
  ): Promise<UpdatePaymentOutput> {
    try {
      const orderId = input.data?.order_id as string | undefined
      if (!orderId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "PayPal order ID is required"
        )
      }

      await this.ordersController_.patchOrder({
        id: orderId,
        body: [
          {
            op: PatchOp.Replace,
            path: "/purchase_units/@reference_id=='default'/amount/value",
            value: new BigNumber(input.amount).numeric.toString(),
          },
        ],
      })

      return {
        data: {
          ...input.data,
          currency_code: input.currency_code,
        },
      }
    } catch (error: any) {
      throw this.providerError("update PayPal payment", error)
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
      const orderId = input.data?.order_id as string | undefined
      if (!orderId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "PayPal order ID is required"
        )
      }

      const response = await this.ordersController_.getOrder({ id: orderId })
      const order = response.result

      if (!order?.id) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "PayPal order not found"
        )
      }

      return {
        data: {
          ...input.data,
          order_id: order.id,
          status: order.status,
          intent: order.intent,
        },
      }
    } catch (error: any) {
      throw this.providerError("retrieve PayPal payment", error)
    }
  }

  async cancelPayment(
    input: CancelPaymentInput
  ): Promise<CancelPaymentOutput> {
    try {
      const authorizationId = input.data?.authorization_id as string | undefined
      if (!authorizationId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "PayPal authorization ID is required for cancellation"
        )
      }

      await this.paymentsController_.voidPayment({ authorizationId })
      return { data: input.data }
    } catch (error: any) {
      throw this.providerError("cancel PayPal payment", error)
    }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const orderId = input.data?.order_id as string | undefined
    if (!orderId) {
      return { status: "pending" as PaymentSessionStatus }
    }

    try {
      const response = await this.ordersController_.getOrder({ id: orderId })
      const status = response.result?.status

      switch (status) {
        case OrderStatus.Approved:
          return { status: "authorized" as PaymentSessionStatus }
        case OrderStatus.Completed:
          return {
            status: this.options_.autoCapture
              ? ("captured" as PaymentSessionStatus)
              : ("authorized" as PaymentSessionStatus),
          }
        case OrderStatus.Voided:
          return { status: "canceled" as PaymentSessionStatus }
        case OrderStatus.Created:
        case OrderStatus.Saved:
        default:
          return { status: "pending" as PaymentSessionStatus }
      }
    } catch (error) {
      this.logger_.warn(`PayPal payment-status lookup failed for ${orderId}`)
      return { status: "pending" as PaymentSessionStatus }
    }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    try {
      const { data, rawData, headers } = payload
      const valid = await this.verifyWebhookSignature(
        (headers || {}) as Record<string, unknown>,
        data,
        rawData
      )

      if (!valid) {
        return this.emptyWebhookResult(PaymentActions.FAILED)
      }

      const event = data as Record<string, any>
      const eventType = event?.event_type as string | undefined
      const resource = event?.resource as Record<string, any> | undefined
      const sessionId = resource?.custom_id as string | undefined

      if (!eventType || !sessionId) {
        return this.emptyWebhookResult(PaymentActions.NOT_SUPPORTED)
      }

      const amountValue =
        resource?.amount?.value ||
        resource?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ||
        resource?.purchase_units?.[0]?.payments?.authorizations?.[0]?.amount
          ?.value ||
        0

      const webhookData = {
        session_id: sessionId,
        amount: new BigNumber(amountValue),
      }

      switch (eventType) {
        case "PAYMENT.AUTHORIZATION.CREATED":
          return { action: PaymentActions.AUTHORIZED, data: webhookData }
        case "PAYMENT.CAPTURE.DENIED":
          return { action: PaymentActions.FAILED, data: webhookData }
        case "PAYMENT.AUTHORIZATION.VOIDED":
          return { action: PaymentActions.CANCELED, data: webhookData }
        case "PAYMENT.CAPTURE.COMPLETED":
          return { action: PaymentActions.SUCCESSFUL, data: webhookData }
        default:
          this.logger_.info(`Unhandled PayPal webhook event: ${eventType}`)
          return { action: PaymentActions.NOT_SUPPORTED, data: webhookData }
      }
    } catch (error: any) {
      this.logger_.error(
        `PayPal webhook handling failed: ${this.errorMessage(error)}`
      )
      return this.emptyWebhookResult(PaymentActions.FAILED)
    }
  }

  private async verifyWebhookSignature(
    headers: Record<string, unknown>,
    body: unknown,
    rawBody: string | Buffer | undefined
  ) {
    if (!this.options_.webhook_id) {
      this.logger_.error("PAYPAL_WEBHOOK_ID is not configured")
      return false
    }

    try {
      const transmissionId = this.header(headers, "paypal-transmission-id")
      const transmissionTime = this.header(headers, "paypal-transmission-time")
      const certUrl = this.header(headers, "paypal-cert-url")
      const authAlgo = this.header(headers, "paypal-auth-algo")
      const transmissionSig = this.header(headers, "paypal-transmission-sig")

      if (
        !transmissionId ||
        !transmissionTime ||
        !certUrl ||
        !authAlgo ||
        !transmissionSig
      ) {
        this.logger_.error("Missing required PayPal webhook headers")
        return false
      }

      const baseUrl =
        this.options_.environment === "production"
          ? "https://api.paypal.com"
          : "https://api.sandbox.paypal.com"

      const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${this.options_.client_id}:${this.options_.client_secret}`
          ).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
      })

      if (!tokenResponse.ok) {
        this.logger_.error("Failed to get PayPal webhook verification token")
        return false
      }

      const token = (await tokenResponse.json()) as PayPalOAuthResponse
      if (!token.access_token) {
        this.logger_.error("PayPal webhook verification token was empty")
        return false
      }

      let webhookEvent = body
      if (rawBody) {
        try {
          const raw =
            typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")
          webhookEvent = JSON.parse(raw)
        } catch {
          this.logger_.warn(
            "PayPal raw webhook body was not JSON; using parsed payload"
          )
        }
      }

      const verificationResponse = await fetch(
        `${baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token.access_token}`,
          },
          body: JSON.stringify({
            transmission_id: transmissionId,
            transmission_time: transmissionTime,
            cert_url: certUrl,
            auth_algo: authAlgo,
            transmission_sig: transmissionSig,
            webhook_id: this.options_.webhook_id,
            webhook_event: webhookEvent,
          }),
        }
      )

      if (!verificationResponse.ok) {
        this.logger_.error("PayPal webhook verification API call failed")
        return false
      }

      const verification =
        (await verificationResponse.json()) as PayPalWebhookVerificationResponse
      return verification.verification_status === "SUCCESS"
    } catch (error: any) {
      this.logger_.error(
        `PayPal webhook signature verification failed: ${this.errorMessage(error)}`
      )
      return false
    }
  }

  private header(headers: Record<string, unknown>, name: string) {
    const match = Object.entries(headers).find(
      ([key]) => key.toLowerCase() === name
    )?.[1]

    if (Array.isArray(match)) {
      return match[0] ? String(match[0]) : undefined
    }

    return match == null ? undefined : String(match)
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
      `Failed to ${operation}: ${this.errorMessage(error)}`
    )
  }

  private errorMessage(error: any) {
    return error?.result?.message || error?.message || String(error)
  }
}

export default PayPalPaymentProviderService
