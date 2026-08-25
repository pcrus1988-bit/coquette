# COQUETTE Storefront Parity Map

Status: implementation reference

## Live Magento surfaces audited

The current storefront exposes these customer-facing capabilities and they are migration requirements, not optional redesign ideas:

- EL / EN language switching
- Clothing navigation with category hierarchy
- Designers directory and designer-filtered catalogue pages
- Accessories category hierarchy
- Sale collection
- Our Story editorial page
- Global search
- Customer account / registration / password recovery
- Wishlist
- Cart
- Product listing pages with price, designer, color and size filtering
- Sorting and pagination
- New / sale / out-of-stock merchandising states
- Product detail pages with variants and add-to-cart
- Free-shipping threshold messaging
- 14-day returns messaging
- Customer-service/contact surface
- Shipping, payment, terms, privacy and cookies content

## Current category parity

### Clothing

- New arrivals
- Dresses
- Tops
- Trousers
- Outerwear
- Jeans
- Leggings
- Skirts
- Activewear
- Jumpsuits
- Knitwear
- Swimwear

### Accessories

- Bags
- Belts
- Jewellery
- Hats
- Sunglasses
- Hair accessories

### Designers observed on the live site

- Arpyes
- Combos Knitwear
- Cutcuutur
- Individual Art Leather
- Mallory the Label
- Milkwhite
- Nashbyna
- Nazezhda
- Salt & Pepper Jeans
- Sun.Set.Go!
- Urban Owl
- 4Tailors
- Zografos Concept
- Elena Athanasiou bags
- AV Sunglasses
- Ciel Concept
- Mind Matter
- Nidodileda
- Mix&Match
- EVERY OTHER

The migration must use the database as authority. This list is only the audited navigation baseline.

## Target route model

| Surface | Target route |
| --- | --- |
| Home | `/` |
| Clothing | `/clothing` |
| Clothing category | `/clothing/{category}` |
| Accessories | `/accessories` |
| Accessory category | `/accessories/{category}` |
| Designers | `/designers` |
| Designer | `/designers/{designer}` |
| Sale | `/sale` |
| Product | `/products/{handle}` |
| Story | `/our-story` |
| Search | `/search` |
| Account | `/account` |
| Cart | `/cart` |

English localization will retain equivalent semantic routes under `/en` unless the final SEO inventory demonstrates a stronger reason to preserve a different path.

## Magento URL preservation

The live Magento installation currently exposes URLs such as:

- `/default/clothing/clothing-categories/knitwear.html`
- `/en/clothing/clothing-categories/sweemwear.html`
- `/default/accessories/accessories-category/bags.html`
- `/en/designers/ciel-concept.html`
- `/default/our-story`
- `/default/{product-handle}.html`

Do **not** deploy broad wildcard redirects yet. Before cutover:

1. Crawl the complete Magento URL inventory.
2. Classify every indexable URL as product, category, designer, content, system or obsolete.
3. Map each old URL to one canonical target URL.
4. Generate explicit permanent redirects from that mapping.
5. Test for redirect chains, loops and 404 targets.
6. Preserve query-string behavior where filters/pagination have SEO value.
7. Generate the new XML sitemap only after target records exist.
8. Keep a post-cutover 404 report so missed legacy URLs can be repaired immediately.

A generic `/default/:path* -> /:path*` rule is intentionally not enabled because Magento category/product paths do not map one-to-one to the new route model.

## Current implementation state

`feature/storefront-parity-foundation` introduces:

- COQUETTE site header and utility navigation
- primary taxonomy matching the current storefront
- service/trust strip and footer
- homepage parity foundation
- clothing/accessory listing shells
- designer directory and designer collection shells
- sale collection shell
- product-detail shell
- story page

The shells deliberately show migration placeholders until the dedicated COQUETTE database is provisioned and Magento catalogue data is imported.
