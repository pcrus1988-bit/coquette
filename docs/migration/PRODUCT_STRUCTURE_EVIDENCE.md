# Public product structure evidence

## Purpose

Phase 4E reduces migration ambiguity by reparsing the raw HTML already preserved by Phase 4A. The goal is to recover public product structure without converting presentation clues into invented Magento data.

The structural parser runs during capture ingestion, so older Phase 4A archives benefit without being recaptured.

## Product gallery boundary

General page media and product media are different evidence domains.

A PDP can contain logos, footer graphics, editorial banners, related-product thumbnails and recommendation cards. Those assets remain useful preservation evidence, but they must not automatically become the current product's gallery.

`mediaSourceIds` may therefore be populated only from product-specific evidence:

- image URLs explicitly attached to the public Product JSON-LD record;
- same-host `og:image` only when it uses the Magento `/media/catalog/product/` path;
- media inside an explicit Magento gallery/product-media region such as `data-gallery-role="gallery-placeholder"`.

The resulting URLs are then intersected with media that the capture actually downloaded successfully. Related-product thumbnails elsewhere on the page do not satisfy product gallery evidence.

## Categories

Public BreadcrumbList JSON-LD and visible breadcrumb links can provide category relationship evidence.

The source key is the observed legacy category URL. No Magento numeric category ID is invented. Storefront locale roots and the current product URL are excluded. If no category relationship is directly observed, `categorySourceIds` remains unresolved rather than becoming an invented empty set.

## Options

Structured option groups are currently accepted only from visible HTML `<select>` controls with an explicit attribute/name/label and non-empty option values.

A group with exactly one observed value can contribute to the existing product-level `optionValues` shape. A multi-value group is retained as structural evidence but is not flattened into one product value.

Magento swatch presence may prove that a product is configurable, but nested swatch value grouping is not yet accepted automatically because regex-based grouping can cross attribute boundaries. Existing raw HTML and flattened capture evidence remain available for later review or a stronger parser.

## Product type

A product is marked `configurable` only when the public page exposes an explicit Magento configurable-product client signal, such as `spConfig`, `Magento_ConfigurableProduct`, `configurable.js`, or `data-role="swatch-options"`.

Absence of those signals does **not** prove `simple`. A page with no configurable markup therefore leaves product type unresolved.

## Status and visibility

A publicly reachable product page does not automatically prove Magento `status` or the exact Magento visibility mode (`catalog_search`, `catalog`, `search`, `not_visible`). These fields remain review-blocking unless stronger legitimate evidence is recovered.

## Brand/designer identity

A visible brand/designer name is retained as source evidence, but it does not become a fabricated source identifier. Brand/entity mapping is a separate reconciliation step.

## Readiness implication

Phase 4E may resolve category, gallery, singleton-option and explicit configurable-type blockers. It intentionally does not make a product `ready` merely because its page was publicly reachable. Candidate readiness continues to require every required field plus conflict-free, timestamped direct evidence under the Phase 4C candidate contract.
