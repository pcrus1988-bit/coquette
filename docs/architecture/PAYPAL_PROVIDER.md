# COQUETTE — PayPal Payment Provider

**Status:** backend provider foundation implemented on `feature/paypal-provider-foundation`  
**Provider ID when enabled:** `pp_paypal_paypal`  
**Server SDK:** `@paypal/paypal-server-sdk@2.5.0`

## Purpose

Implement PayPal as a first-class Medusa Payment Module Provider without making PayPal mandatory for local development/CI and without committing credentials.

This backend provider is the provider-specific layer below the already-shipped generic Storefront payment-session flow.

## Registration rule

The PayPal provider is registered only when both are present:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`

If either is absent, the PayPal Payment Module Provider is omitted from the Medusa configuration. This means:

- normal local development remains usable without PayPal credentials;
- ordinary CI does not require secrets;
- staging/production must opt in explicitly by supplying both credentials;
- Medusa Admin must still enable `pp_paypal_paypal` on each intended region before the Store API exposes it to customers.

## Runtime configuration

Backend variables:

- `PAYPAL_CLIENT_ID` — secret, required to enable provider
- `PAYPAL_CLIENT_SECRET` — secret, required to enable provider
- `PAYPAL_ENVIRONMENT` — `sandbox` or `production`; defaults to sandbox behavior
- `PAYPAL_AUTO_CAPTURE` — `true` to capture on authorization; defaults to false/authorize-only
- `PAYPAL_WEBHOOK_ID` — required for verified webhook processing
- `PAYPAL_BRAND_NAME` — defaults to `COQUETTE`

Secrets belong only in backend runtime secret storage and must never be exposed to the storefront or Git repository.

## Provider service

`apps/backend/src/modules/paypal/service.ts` implements the Medusa payment-provider contract:

- `initiatePayment`
  - creates a PayPal order;
  - uses the Medusa payment session ID as PayPal `custom_id`;
  - stores PayPal order ID, intent, status, approval URL and currency in Medusa payment-session data.
- `authorizePayment`
  - authorizes the PayPal order by default;
  - captures directly only when `PAYPAL_AUTO_CAPTURE=true`.
- `capturePayment`
  - captures a previously authorized payment.
- `refundPayment`
  - refunds a captured payment using the authoritative stored currency.
- `updatePayment`
  - updates the PayPal order amount when Medusa changes the payment session amount.
- `deletePayment`
  - leaves the PayPal order to expire because PayPal does not provide deletion for an unapproved order.
- `retrievePayment`
  - retrieves the current PayPal order state.
- `cancelPayment`
  - voids a PayPal authorization.
- `getPaymentStatus`
  - maps PayPal order state into Medusa payment-session state.
- `getWebhookActionAndData`
  - verifies the PayPal webhook signature before mapping supported events to Medusa payment actions.

## Webhook verification

The provider verifies signatures against PayPal's verification endpoint using:

- `paypal-transmission-id`
- `paypal-transmission-time`
- `paypal-cert-url`
- `paypal-auth-algo`
- `paypal-transmission-sig`
- configured `PAYPAL_WEBHOOK_ID`

Supported event mappings currently include:

- `PAYMENT.AUTHORIZATION.CREATED` → authorized
- `PAYMENT.AUTHORIZATION.VOIDED` → canceled
- `PAYMENT.CAPTURE.COMPLETED` → successful
- `PAYMENT.CAPTURE.DENIED` → failed

The Medusa webhook URL for this provider is expected to be:

`/hooks/payment/paypal_paypal`

A missing webhook ID or invalid signature results in a failed/not-supported action, never an accepted payment event.

## CI contract

COQUETTE CI now performs two relevant checks:

1. backend TypeScript compilation against the pinned PayPal SDK;
2. a second Medusa migration/load pass with dummy sandbox credentials.

The second check forces the conditional provider registration and constructor/validation path without making a PayPal transaction or requiring real credentials.

## Deliberate boundary

This branch does **not** yet:

- add the PayPal browser SDK to the storefront;
- render PayPal approval buttons;
- call `completeCart`;
- make a successful order possible through PayPal;
- contain Sandbox or Live credentials;
- enable PayPal on a Medusa region automatically.

The storefront authorization slice must use the PayPal order/session created by this provider and may only attempt Medusa order completion after PayPal buyer approval succeeds.

## Staging activation gate

Before PayPal can be exercised end to end in staging:

1. provision a PayPal Sandbox merchant application;
2. set backend `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` as hosting secrets;
3. keep `PAYPAL_ENVIRONMENT=sandbox`;
4. configure a PayPal webhook and set `PAYPAL_WEBHOOK_ID`;
5. enable `pp_paypal_paypal` on the intended Medusa region;
6. expose only the PayPal Client ID (never secret) to the storefront when the browser integration is added;
7. test approval, cancellation, denial, authorization, capture, refund and webhook idempotency;
8. verify Medusa payment/order amounts and currency match PayPal;
9. only then permit the PayPal storefront path to complete a cart/order.

Live credentials and `PAYPAL_ENVIRONMENT=production` remain a separate production gate.
