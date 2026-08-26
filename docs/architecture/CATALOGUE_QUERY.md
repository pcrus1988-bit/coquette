# COQUETTE Catalogue Query Contract

**Status:** Phase 7 foundation  
**Scope:** storefront product search, sorting, Color/Size filtering, Designer filtering and pagination

## Principle

COQUETTE must not implement catalogue controls that look functional but produce incorrect membership, counts, prices or pagination.

Normal catalogue, category and search surfaces use Medusa Store API query semantics directly. Specialized merchandising surfaces such as Sale and a dedicated Designer page keep their own verified pipelines.

## URL contract

Query-safe storefront routes use GET parameters so catalogue state is bookmarkable, shareable and compatible with browser back/forward navigation:

- `q=<term>` — keyword search
- `sort=<allowed-sort>` — product ordering
- `option=<option-value-id>` — repeated Medusa Product Option value IDs
- `designer=<brand-handle>` — COQUETTE Brand filter
- `page=<positive-integer>` — server-side pagination

Unknown sort values, malformed option IDs and malformed Designer handles are ignored by the central parser.

## Search

Keyword search is passed to Medusa's native product-list `q` parameter. Search is combined in the same Store API query with category membership, option-value filters, Designer product IDs and sorting where applicable.

## Sorting

The storefront currently permits only a controlled allowlist:

- default / recommended ordering
- `-created_at` — newest first
- `created_at` — oldest first
- `title` — title ascending
- `-title` — title descending

The URL parser rejects arbitrary order fields.

## Color and Size

Color and Size are backed by Medusa **global Product Options** and their real option-value IDs.

The storefront discovers global options through the Store API, recognises the canonical Color/Colour and Size dimensions, and submits selected values as repeated `option` URL parameters. Those IDs become Medusa's native `option_value_id` product filter.

Migration must therefore normalize Magento Color and Size attributes into shared global Product Options rather than creating unrelated per-product option vocabularies.

## Designer filter

Designer is not stored in product metadata. COQUETTE's first-class Brand module is linked to products through the Medusa module-link table.

For a selected `designer` handle:

1. the storefront resolves the Brand's complete linked product-ID set through the safe Brand Store API;
2. the ID set is supplied to the normal Medusa product-list query;
3. Medusa then intersects those IDs with category, `q`, `option_value_id`, locale and ordering in a single product query;
4. returned `count`, offset and pagination therefore describe the filtered result rather than an after-the-fact approximation.

A Brand with no linked products yields an empty result. Backend/Brand lookup unavailability does not silently fall back to all products.

## Query-safe surfaces

Native combined controls are enabled on:

- Greek Clothing and nested Clothing categories
- Greek Accessories and nested Accessories categories
- Greek `/search`
- English Clothing and nested Clothing categories
- English Accessories and nested Accessories categories
- English `/en/search`

## Specialized surfaces

### Dedicated Designer PLP

`/designers/<handle>` and `/en/designers/<handle>` already use the Brand relation directly and retain their specialized Brand pagination pipeline.

### Sale PLP

`/sale` and `/en/sale` retain the verified Sale pricing pipeline documented in `SALE_MERCHANDISING.md`. Generic product filtering is not injected into that pipeline until Sale-specific count/pagination semantics are explicitly extended and tested.

## Price filter — deliberately deferred

Price is intentionally not enabled yet.

The customer-visible price is a **calculated Medusa price** that depends on storefront pricing context (country/region, price lists, sale applicability and potentially customer-specific rules). A naive static numeric product-field filter could disagree with the price shown on cards and produce incorrect pagination.

Price filtering may only be activated after a context-aware implementation can guarantee that:

1. the filtered numeric range uses the same calculated price context shown to the customer;
2. private/customer-group pricing cannot leak into public results;
3. counts and pagination are exact;
4. Sale and override price semantics remain correct;
5. the query path is covered by an executable CI contract or equivalent integration test.

## Pagination

Pagination links preserve all active query-safe filters and reset naturally when the user submits a changed GET form without a `page` field.

The page size remains 24 products.

## Localization

English product/category queries pass the configured English BCP-47 locale to Medusa. The filter identities themselves remain stable IDs/handles; translated labels do not create duplicate commerce entities.

## Failure policy

COQUETTE never replaces an unavailable filtered query with an unfiltered product list. Failure states stay visible and non-deceptive until the Store API is available again.
