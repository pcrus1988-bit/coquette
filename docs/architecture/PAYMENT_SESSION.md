# COQUETTE — Payment Session Foundation

**Status:** implemented on `feature/payment-session-foundation`  
**Scope:** Storefront payment-provider discovery and Medusa payment-session initialization only.

## Goal

Add the final provider-selection stage of checkout without coupling checkout state to PayPal, Klarna or a card acquirer and without allowing the storefront to place an order before real provider authorization is implemented.

## Medusa authority

The storefront follows the Medusa Store API payment flow:

1. cart already contains customer email, shipping/billing address and a selected shipping method;
2. payment providers are discovered for the cart's `region_id`;
3. the customer selects a provider;
4. `store.payment.initiatePaymentSession(cart, { provider_id })` creates/updates the cart payment collection and initializes the provider session;
5. the cart is re-fetched and the returned `payment_collection.payment_sessions` state becomes authoritative.

The JS SDK combines payment-collection creation and payment-session initialization in the `initiatePaymentSession` call.

## Storefront implementation

`apps/storefront/src/components/checkout-payment-step.tsx`:

- lists region-enabled payment providers;
- activates only after shipping address + shipping method are present;
- refuses to initialize an online payment session for zero-total carts;
- hides Medusa's `pp_system_default` manual provider by default;
- allows the manual provider only when `NEXT_PUBLIC_ALLOW_MANUAL_PAYMENT=true` is explicitly configured;
- shows the selected/initialized provider using the cart's authoritative payment-session state;
- contains no order-completion action.

`apps/storefront/src/providers/cart.tsx`:

- includes payment collection/session fields in cart retrieval;
- exposes a typed `initiatePaymentSession` operation derived from the installed Medusa SDK signature;
- re-fetches the cart after session initialization so React state does not rely on a locally fabricated payment object.

## Safety boundary

This phase does **not**:

- call `completeCart`;
- authorize, capture or refund money;
- store PayPal, Klarna or card-acquirer credentials;
- create a fake success state;
- expose the manual/system payment provider by default;
- assume that an initialized payment session means the customer has paid.

Provider-specific authorization UI and redirects remain separate workstreams.

## Provider-specific next steps

### PayPal

Implement a Medusa Payment Module Provider using the official PayPal integration pattern, configure its backend secrets only in runtime hosting, enable it on the intended region, and add the storefront PayPal SDK/approval UI. Completion must only follow successful provider authorization.

### Klarna

Implement or select a maintained Medusa-compatible Klarna Payment Module Provider, define the exact Klarna checkout/authorization data contract, enable it per region, and render the provider-specific authorization UI. No generic fallback behavior should impersonate Klarna.

### Card acquirer

Choose the real COQUETTE card acquirer first. Its Payment Module Provider and browser SDK/UI should be implemented independently from PayPal/Klarna.

## Production gate

A provider becomes production-eligible only after all of the following are verified in staging:

- provider installed and enabled on the intended Medusa region;
- sandbox/test credentials stored outside Git;
- customer authorization flow works end to end;
- cancellations/failures do not create successful orders;
- webhook/idempotency behavior is tested;
- amount/currency match the authoritative cart total;
- cart completion occurs only after the provider-specific payment preconditions are satisfied;
- Admin order/payment state matches the external provider;
- refund/cancel operational path is documented and tested.
