# COQUETTE Cart Architecture

## Purpose

The storefront cart is a real Medusa Store API cart. It is not a browser-only basket and does not duplicate cart/order state in Supabase or Next.js.

## Ownership

Medusa is authoritative for:

- cart identity
- region
- locale
- line items
- quantities
- calculated prices/taxes/totals exposed by the Store API
- later shipping/payment/checkout state

The browser stores only the Medusa cart ID and selected region ID in local storage. No database credential is exposed to the storefront.

## Provider hierarchy

`RootLayout` wraps the customer storefront with:

1. `RegionProvider`
2. `CartProvider`
3. site header / route content / footer

`CartProvider` depends on the resolved Medusa Region so a cart is never created without an explicit commerce region.

## Region resolution

The default storefront country is configured by `NEXT_PUBLIC_DEFAULT_COUNTRY_CODE` and defaults to `gr`.

`RegionProvider`:

- retrieves Store API regions
- restores a previously selected valid region when possible
- otherwise selects the region containing Greece
- persists only the Medusa region ID locally

A persisted cart is updated if its region differs from the current storefront region.

## Persistence

The Medusa cart ID is stored under:

`coquette_cart_id`

On storefront load the provider attempts to retrieve that cart. If Medusa reports that it is no longer valid, the local cart ID is discarded rather than fabricating cart content.

A cart is created lazily when the customer first needs one.

## Localization

Cart locale is explicit and follows the storefront language:

- Greek: `NEXT_PUBLIC_GREEK_LOCALE`, default `el-GR`
- English: `NEXT_PUBLIC_ENGLISH_LOCALE`, default `en-GB`

Both locales must be enabled in the Medusa staging/production store configuration.

When a persisted cart is restored or the customer changes storefront language, the cart is idempotently updated to the current locale. The Medusa Store API response type does not expose a `locale` property, so COQUETTE does not infer or inspect undocumented response fields.

If a Greek translation record is absent, Medusa may fall back to the original migrated Greek commerce field. English uses the Translation Module data when available, with Medusa fallback behavior for missing translations.

## Product-to-cart contract

The product detail page never adds an arbitrary/default SKU.

The purchase panel:

1. renders actual Medusa product options
2. records selected option-value IDs
3. resolves the exact variant whose option values match the selection
4. derives stock and calculated price from that selected variant
5. requires a resolvable purchasable variant before enabling Add to Cart
6. sends the selected variant ID and quantity to the Store API

## Cart operations

The shared cart provider exposes:

- add line item
- update line-item quantity
- remove line item
- refresh cart
- item count

The site header shows the live quantity total from the Medusa cart.

Greek `/cart` and English `/en/cart` use the same underlying cart and render localized storefront copy.

## Cart page

The cart page displays real Store API state including:

- product thumbnail
- product / variant labels
- quantity
- remove action
- subtotal
- cart total

Quantity and removal controls call Medusa immediately and replace local rendered state with the returned authoritative cart.

## Checkout boundary

This slice deliberately stops before checkout.

The checkout CTA remains disabled until the following are implemented and validated as one workflow:

1. email/customer identity handling
2. shipping/billing address
3. available shipping options for the current cart/address
4. selected shipping method
5. payment collection/session
6. payment-provider-specific completion
7. order completion and failure/retry handling

No provisional courier fee, payment method, Klarna/PayPal credential, or fiscal rule is hard-coded into the cart.

## Security boundary

The storefront receives only public Store API configuration:

- Medusa backend URL
- publishable API key
- country/locale settings

It never receives:

- PostgreSQL credentials
- Supabase service credentials
- payment private keys
- AADE credentials
- courier secrets

## Acceptance gate

A cart change is mergeable only when the standard COQUETTE CI passes:

- frozen dependency install
- local Compose validation
- backend type-check
- Magento migration contract
- clean Medusa migrations on PostgreSQL + Redis
- Sale pricing graph contract
- Medusa production build
- Next.js production storefront build

Live cart UAT still requires the dedicated staging backend, region, sales channel, publishable API key and migrated products/variants.
