# COQUETTE Checkout — Contact, Address and Shipping

## Scope

This slice implements the checkout stages that can be completed without payment-provider credentials:

1. customer email
2. shipping/billing address
3. available shipping-option discovery
4. calculated shipping-rate retrieval when required
5. selected shipping method on the Medusa cart

Payment initialization, payment-provider UI and order completion are intentionally outside this slice.

## Authoritative state

Medusa remains authoritative for the entire checkout cart. The Next.js storefront does not persist a duplicate checkout object in Supabase, cookies or server actions.

The existing `CartProvider` is extended with:

- generic cart update
- checkout contact/address update
- add shipping method

Every operation replaces rendered cart state with the cart returned by the Store API.

## Email and address

The customer submits:

- email
- first name
- last name
- phone
- company (optional)
- address line 1
- address line 2 (optional)
- city
- postal code
- province/region (optional)
- country

The same address is used for shipping and billing in this first checkout slice. Separate billing-address UX can be added later without changing the Medusa data model.

The cart is updated through the normal Store Cart Update API with:

- `email`
- `shipping_address`
- `billing_address`

The country selector is restricted to countries configured in the cart's Medusa region. The storefront never sends an arbitrary unsupported country code.

## Shipping option discovery

After a valid address is saved, the storefront calls the Medusa Fulfillment Store API:

`store.fulfillment.listCartOptions({ cart_id })`

Only options Medusa considers available for the current cart/address are shown.

No courier name, shipping charge, free-shipping threshold or historical Magento rule is fabricated by the storefront.

## Calculated shipping

For shipping options whose `price_type` is `calculated`, COQUETTE uses Medusa's documented Calculate Shipping Option Price route:

`POST /store/shipping-options/{option_id}/calculate`

with:

- `cart_id`
- provider `data` object (currently empty until a provider requires explicit input)

The returned calculated amount is shown to the customer. If a calculated provider fails to produce a rate, that option is not selectable rather than being assigned a guessed fallback price in storefront code.

Any future fallback behavior belongs inside the fulfillment provider implementation where it can be provider-specific and observable.

## Selecting shipping

A customer selects a shipping option through Medusa's cart `addShippingMethod` operation.

The returned cart becomes authoritative state and drives:

- selected shipping option UI
- shipping total
- cart total

The storefront does not calculate cart totals itself.

## Bilingual routes

The shared checkout component is exposed as:

- Greek: `/checkout`
- English: `/en/checkout`

The same persisted Medusa cart is used across both languages; the CartProvider already aligns cart locale with `el-GR` / `en-GB`.

## Payment boundary

The payment section remains visibly disabled until real provider configuration exists.

The next payment slice must:

1. list payment providers available for the cart's region
2. create/reuse a Medusa payment collection
3. initialize the selected provider's payment session
4. render provider-specific UI/actions
5. handle authorization/failure/retry safely
6. complete the cart only after the payment workflow permits completion

Klarna and PayPal credentials must remain runtime-only and must never be committed to Git.

## Production boundary

This checkout implementation is not production-ready until staging has:

- a real Greece-serving Medusa region
- valid service zones
- real shipping options
- any required fulfillment provider(s)
- product shipping profiles
- storefront publishable API key
- real backend/worker/Redis deployment

Magento continues serving production checkout until the full migration/cutover gates pass.

## Acceptance gate

Merge requires the standard COQUETTE CI:

- frozen install
- Compose validation
- backend type-check
- Magento migration contract
- clean Medusa migrations on PostgreSQL + Redis
- Sale pricing graph contract
- Medusa production build
- Next.js production storefront build

Live shipping UAT remains a staging gate because clean CI intentionally contains no production courier credentials or shipping-option data.
