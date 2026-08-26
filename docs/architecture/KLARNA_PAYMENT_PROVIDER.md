# COQUETTE Klarna Payment Provider Foundation

**Status:** backend foundation implemented on `feature/klarna-provider-foundation`  
**Production activation:** prohibited until dedicated COQUETTE Klarna credentials, staging integration, browser authorization, merchant-market enablement and end-to-end tests are complete.

## Purpose

COQUETTE integrates Klarna as a first-class Medusa Payment Module Provider without coupling the storefront or order model to Klarna-specific state.

The provider is registered only when all required Klarna backend configuration is present. Normal local development and ordinary CI therefore remain credential-free, while CI has a dedicated registration path using inert dummy credentials that does not call Klarna.

## Market defaults

The foundation targets the Greek storefront:

- purchase country: `GR`
- purchase currency: Medusa cart currency, expected `EUR` for the Greece region
- default locale: `el-GR`
- English storefront may pass `en-GR`
- API region: EU
- default environment: Klarna Playground

Merchant account enablement for Greece remains an account-level prerequisite. Code support does not imply commercial activation.

## Payment lifecycle

### 1. Medusa creates the payment session

`initiatePayment` receives the authoritative Medusa payment amount/currency and Klarna order payload from payment-session data.

The provider validates:

- Medusa payment session ID
- order amount
- order lines
- order tax amount
- purchase country / locale / currency

It then creates a Klarna Payments session and stores the returned:

- Klarna session ID
- client token
- payment method categories
- normalized order totals and lines
- purchase country/currency/locale
- create-order idempotency key

No customer order exists at this stage.

### 2. Klarna browser authorization

The storefront must use the Klarna client token and Klarna's current browser SDK to obtain customer authorization.

The backend supplies a signed authorization callback URL in `merchant_urls.authorization`.

The callback is:

`POST /hooks/klarna/authorization?payment_session_id=...&signature=...`

The HMAC signature is generated from the Medusa payment-session ID using `KLARNA_CALLBACK_SECRET`.

### 3. Server-side authorization callback

The callback is intentionally authoritative for persisting the Klarna authorization token. It:

1. verifies the HMAC signature with timing-safe comparison;
2. requires both Klarna `authorization_token` and Klarna `session_id`;
3. resolves the Medusa Payment Module session;
4. verifies that the callback Klarna session matches the session stored by COQUETTE;
5. accepts a repeated identical token idempotently;
6. rejects a conflicting token;
7. stores the authorization token and authorization timestamp in payment-session data.

This avoids treating a browser-only callback as sufficient authorization state.

### 4. Medusa cart completion / Klarna order creation

`authorizePayment` refuses to continue without the stored Klarna authorization token.

It creates the Klarna order through the authorization-token endpoint using the saved authoritative totals and a stable idempotency key. The Medusa payment session becomes:

- `authorized` for accepted Klarna fraud status;
- `pending_authorization` for pending fraud assessment;
- failed with a Medusa error for rejected fraud status.

The Klarna order ID, fraud status, redirect URL and authorized payment method are persisted in payment data.

### 5. Capture

Medusa 2.19 `CapturePaymentInput` represents full capture and does not carry an amount. Therefore COQUETTE captures the stored authorized `order_amount` instead of inventing a partial-capture amount.

Partial capture is not claimed by this foundation.

### 6. Refund

Medusa refund amounts are converted to Klarna minor units and sent to the order-management refund endpoint with a fresh idempotency key.

### 7. Cancel

- If a Klarna order exists, the provider cancels the Klarna order.
- If authorization exists but no order exists, the authorization token is released.
- If neither exists, cancellation is a no-op from Klarna's perspective.

### 8. Retrieve and status

Before order creation the provider retrieves the Klarna Payments session. After order creation it retrieves Klarna order-management state and maps it conservatively into Medusa payment-session status.

## Totals and tax safety

The provider does not guess product tax, line totals or discount allocation. Klarna `order_lines` and `order_tax_amount` must be supplied from authoritative checkout/cart data and are validated against the payment amount before API submission.

This is deliberate: fiscal/tax treatment belongs to COQUETTE commerce/fiscal logic, not to the payment provider.

## Configuration

Backend-only secrets/configuration:

- `KLARNA_USERNAME`
- `KLARNA_PASSWORD`
- `KLARNA_ENVIRONMENT=playground|production`
- `KLARNA_API_REGION=eu|na|oc`
- `KLARNA_CALLBACK_BASE_URL`
- `KLARNA_CALLBACK_SECRET`
- `KLARNA_PURCHASE_COUNTRY=GR`
- `KLARNA_LOCALE=el-GR`

`KLARNA_CALLBACK_BASE_URL` must be the externally reachable Medusa backend URL in staging/production. `KLARNA_CALLBACK_SECRET` must be an independent high-entropy secret and must never be exposed to the storefront.

## Medusa module composition

PayPal and Klarna are configured as providers of a single `@medusajs/medusa/payment` module instance. The application must not register multiple Payment Module instances merely to add providers.

Each provider remains independently credential-gated.

## CI contract

CI validates:

- frozen dependency installation
- backend TypeScript
- clean Medusa migrations
- Magento migration contract
- simultaneous PayPal + Klarna provider registration using inert dummy credentials
- Sale pricing graph contract
- Medusa production build
- storefront production build

The registration test validates application loading/configuration only. It never performs a network request to Klarna.

## Explicitly not complete

This backend foundation does **not** yet mean Klarna checkout is customer-ready. Remaining gates include:

1. dedicated COQUETTE Klarna Playground merchant credentials;
2. confirmation that the merchant agreement enables Greece/EUR and desired payment categories;
3. staging backend with externally reachable HTTPS callback URL;
4. storefront Klarna SDK/client-token rendering;
5. browser authorize/cancel/error UX;
6. browser/server callback race and retry testing;
7. successful Medusa cart completion and Klarna order creation;
8. pending/rejected fraud-state testing;
9. capture/cancel/refund testing;
10. order-management reconciliation/notifications where required;
11. only after all staging gates pass, a separately approved production-credential rollout.

## Production boundary

Magento remains the production storefront. No Klarna production credentials, merchant activation or live traffic switch is part of this foundation.
