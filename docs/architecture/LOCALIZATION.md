# COQUETTE Localization Architecture

## Decision

COQUETTE uses **one commerce catalogue** with Medusa's Translation Module for translated commerce fields. Greek and English do not get separate product databases or duplicated product/variant records.

## Commerce data

Medusa Translation Module is enabled in `apps/backend/medusa-config.ts` with:

- `@medusajs/medusa/translation`
- `featureFlags.translation = true`

The module supports translated product-related resources such as:

- products
- product variants
- product categories
- product options
- product option values
- collections, tags and types where used

The normal/original Medusa value remains the fallback. A localized Store API request returns the translated value when one exists and otherwise falls back to the original value.

## Storefront locale model

### Greek

Greek is the primary/default storefront surface. Current Greek commerce routes do not force a Store API locale, so they consume the original Medusa commerce fields.

### English

English commerce routes use the BCP-47 locale configured through:

`NEXT_PUBLIC_ENGLISH_LOCALE`

Default:

`en-GB`

The locale is passed to Store API queries for products and categories. Cache tags also include locale context to avoid mixing localized response caches.

Current localized commerce routes include:

- `/en/clothing`
- `/en/clothing/<category>`
- `/en/accessories`
- `/en/accessories/<category>`
- `/en/products/<handle>`

Sale and Designer product feeds remain deliberately source-specific until their real merchandising/Brand query semantics are implemented.

## Editorial Website Content

The custom COQUETTE Website Content module already stores explicit `el` / `en` content records. It remains separate from Medusa commerce translations because editorial page composition and publishing are different concerns from translating a Product or ProductCategory field.

Do not duplicate Product records inside the Website Content module.

## Magento migration rule

The authoritative mapping must come from Magento store-view/export data.

Expected migration pattern:

1. migrate the primary product/category/variant record once
2. retain stable Magento source identifiers in the migration manifest
3. map English store-view field overrides to Translation Module records
4. preserve untranslated fields through Medusa fallback rather than copying guessed translations
5. reconcile translated-resource counts separately from base-record counts

Public HTML is useful for parity verification but is not the source of truth for translated commerce data.

## Admin workflow

Once the Translation Module migrations have run, merchant users can manage enabled translatable resources and translated values through Medusa Admin's translation settings/workflows.

The merchant should not need code changes to edit ordinary translated product/category copy.

## Database migration requirement

Translation is a schema-bearing Medusa feature. CI therefore starts clean PostgreSQL + Redis services and runs `medusa db:migrate` before the production builds. This verifies core Medusa migrations, Translation Module migrations and COQUETTE custom module migrations together.

The same rule applies to staging/production: database migrations run before the new backend release becomes active.

## SEO implications

Localization work must later be completed by Phase 13 with:

- EL/EN canonical strategy
- `hreflang`
- localized metadata
- localized sitemaps where applicable
- explicit redirects from Magento `/default/...` and `/en/...` `.html` URLs
- no duplicate-indexing caused by locale fallback

Translation availability does not by itself define canonical or hreflang behavior; that remains an SEO routing responsibility.
