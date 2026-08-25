# Current Magento Storefront Surface

Observed reference: `https://coquetteconcept.gr/`

This is a migration-surface inventory, not a requirement to preserve Magento implementation details.

## Customer-facing capabilities visible today
- Greek storefront with English language option.
- Customer login/registration and password recovery.
- Newsletter opt-in.
- Global search.
- Cart.
- Wishlist.
- Clothing categories and accessory categories.
- Designer/brand navigation.
- Mega-menu style navigation with featured/new products.
- New-arrival state.
- Sale state and strike-through pricing.
- Out-of-stock state.
- Product cards with imagery, title and price.
- Free-shipping threshold messaging (currently €100).
- 14-day return messaging.
- customer-service/contact information.
- informational pages including shipping, payment methods, terms, privacy and cookies.
- card/payment branding and courier branding.
- accessibility/WCAG presentation claim.

## Migration requirement
All business-relevant capabilities above must be explicitly classified during implementation as one of:
1. preserve exactly;
2. preserve with UX improvement;
3. replace with a superior equivalent;
4. retire with merchant approval.

No visible customer capability should disappear accidentally because it was previously supplied by a Magento theme or extension.

## High-priority design preservation
- premium fashion presentation;
- brand/designer discovery;
- category browsing;
- prominent new-arrival and sale merchandising;
- strong product imagery;
- low-friction account/cart/checkout journey;
- bilingual structure;
- trust messages around shipping, returns, payment security and support.

## Implementation note
The new storefront is not a Magento-theme port. It will reproduce approved behavior and visual identity in COQUETTE-owned Next.js components and design tokens.
