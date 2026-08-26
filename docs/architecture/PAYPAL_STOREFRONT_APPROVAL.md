# PayPal Storefront Approval and Order Completion

## Purpose

This document defines the COQUETTE customer-facing PayPal checkout boundary that sits on top of the provider-agnostic payment-session foundation and the Medusa PayPal backend provider.

The browser must never create a second PayPal order, fabricate a successful payment, or treat PayPal approval alone as a completed COQUETTE order.

## Current SDK baseline

- Medusa JS SDK: `2.19.0`
- PayPal React SDK: `@paypal/react-paypal-js@10.3.0`
- PayPal React SDK API generation: v6 (`@paypal/react-paypal-js/sdk-v6`)
- Next.js: `15.5.21`
- React: `19.0.5`

The PayPal v6 React API uses `PayPalProvider` and `PayPalOneTimePaymentButton`. COQUETTE intentionally does not introduce the legacy `PayPalScriptProvider` / `PayPalButtons` v5 integration.

## Authoritative flow

1. Customer has a valid Medusa cart with email/address and shipping method.
2. Storefront lists the payment providers enabled on the cart's Medusa region.
3. Customer selects `pp_paypal_paypal`.
4. Storefront calls Medusa `initiatePaymentSession`.
5. The COQUETTE backend PayPal provider creates the PayPal order and stores its `order_id` in the Medusa payment session data.
6. Storefront re-fetches the authoritative cart/payment collection.
7. The PayPal v6 button receives the already-created PayPal `order_id` directly through its `orderId` prop.
8. Customer approves the order in PayPal's browser flow.
9. PayPal `onApprove` returns the approved order ID to the storefront.
10. Storefront verifies that this order ID matches the Medusa payment-session `order_id`.
11. Storefront calls Medusa `store.cart.complete(cart.id)`.
12. Medusa/payment module performs the backend authorization/capture behavior required by the configured provider intent and creates the commerce order.
13. Only a Medusa response with `type === "order"` is accepted as a successful COQUETTE order.
14. On success, the persisted cart ID is removed and the customer is redirected to the language-correct order-confirmation route.

## Failure and cancellation rules

- PayPal `onCancel` does not call cart completion.
- PayPal SDK/browser errors do not call cart completion.
- An approval callback whose PayPal order ID does not match the Medusa session is rejected.
- A Medusa `type === "cart"` completion response is treated as a failed order.
- The storefront does not issue its own refund when Medusa completion fails. Medusa's complete-cart workflow is responsible for reverting an authorized/captured payment where required.
- The persisted cart is removed only after Medusa returns an order.
- A failed/cancelled checkout therefore remains recoverable from the existing cart.

## PayPal intent

The backend provider remains authoritative for PayPal intent.

Default:

```text
PAYPAL_AUTO_CAPTURE=false
```

This means the PayPal order is created with `AUTHORIZE`. Browser approval approves the PayPal order; Medusa's backend authorization path runs during cart completion.

`PAYPAL_AUTO_CAPTURE=true` remains a separately controlled backend behavior and must be tested in Sandbox before any production use.

## Storefront environment

The browser requires only the public PayPal Client ID:

```text
NEXT_PUBLIC_PAYPAL_CLIENT_ID=<public COQUETTE PayPal app client id>
NEXT_PUBLIC_PAYPAL_ENVIRONMENT=sandbox
```

Rules:

- PayPal Client ID is public and may be exposed to the browser.
- PayPal Client Secret and webhook credentials are backend-only and must never be prefixed with `NEXT_PUBLIC_`.
- Sandbox is the default environment.
- Production must be selected explicitly with `NEXT_PUBLIC_PAYPAL_ENVIRONMENT=production` and must use the same dedicated COQUETTE PayPal application identity as the backend environment.
- No credential from another project may be reused.

## Order confirmation boundary

Successful completion redirects to:

- Greek: `/order-confirmation/[order-id]`
- English: `/en/order-confirmation/[order-id]`

The initial public confirmation page deliberately displays only the opaque order identifier and generic confirmation text. It does not retrieve or expose customer/order detail without an authenticated or otherwise verified order-access design.

## Staging acceptance gate

The code path is not production-ready merely because CI builds it. Staging must prove all of the following with a dedicated COQUETTE PayPal Sandbox app:

1. `pp_paypal_paypal` is enabled on the intended Medusa region.
2. Storefront has the matching public Sandbox Client ID.
3. Backend has matching Sandbox Client ID/Secret.
4. Backend has the PayPal Sandbox webhook ID.
5. A real non-zero cart can initialize a PayPal payment session.
6. The payment-session `order_id` renders through the PayPal v6 button.
7. Buyer cancel leaves the cart intact and creates no order.
8. PayPal approval followed by Medusa completion creates exactly one order.
9. Persisted cart ID is cleared only after successful completion.
10. Failed Medusa completion does not leave an unreconciled customer charge/authorization.
11. Medusa Admin displays the resulting PayPal payment state.
12. Capture/void/refund behavior is verified against Sandbox.
13. PayPal webhook events are verified and processed by the backend.
14. Duplicate callbacks/retries do not create duplicate Medusa orders.

## Production boundary

No Live PayPal credential, production client ID, or `NEXT_PUBLIC_PAYPAL_ENVIRONMENT=production` should be activated until the staging acceptance gate and the broader COQUETTE production/cutover roadmap gates are complete.
