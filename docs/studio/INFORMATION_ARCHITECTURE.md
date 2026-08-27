# COQUETTE Studio — Information Architecture & Screen Sitemap

**Status:** Foundation proposal  
**Date:** 2026-08-26

## 1. Navigation model

The merchant should think in business moments, not Medusa entities. The primary navigation is grouped into meaningful workspaces. Groups are collapsible, individually remember their open/closed state, and can accept future extension items without changing the shell.

### Global shell

Persistent capabilities available from every authenticated screen:

- COQUETTE wordmark / return to `Today`
- collapsible workspace navigation
- universal search / command palette
- quick-create action
- notifications
- contextual help
- user menu
- environment indicator in non-production deployments

The shell should support a narrow icon rail when the full navigation is collapsed.

---

# 2. Full screen sitemap

## TODAY

The default landing workspace and personal-assistant surface.

### `/today` — Today
Primary merchant home.

Sections:

- personal greeting
- since-your-last-visit narrative
- `Needs your attention` focus queue
- business pulse
- order/fulfillment snapshot
- merchandising radar
- client moments
- campaign/content calendar
- suggested next actions
- recent activity

### `/today/activity` — Activity
Chronological business history with filters by orders, products, content, customers, payments and integrations.

### `/today/tasks` — Tasks
Action queue generated from explicit tasks, operational exceptions and assistant recommendations. Tasks can be assigned, snoozed, completed or opened in context.

### `/today/notifications` — Notifications
Persistent notification inbox; supports read/unread state, filtering and deep links.

---

## BOUTIQUE

The merchandising workspace. This should be image-first and feel like curating a designer boutique.

### `/boutique/products` — Products
Views:

- editorial card grid
- compact list
- drafts
- published
- sold out
- low stock
- scheduled

Actions:

- create new piece
- bulk status changes
- collection assignment
- pricing/status review
- duplicate product

### `/boutique/products/new` — New Piece
Guided product onboarding wizard.

Proposed steps:

1. Identity
2. Visual story
3. Description & details
4. Variants
5. Price & availability
6. Boutique placement
7. Search & SEO
8. Review & publish

The flow auto-saves after every meaningful change, supports back/forward navigation, and presents a live product-card/page preview where useful.

### `/boutique/products/:id` — Product Studio
Product detail workspace with a visual summary first and advanced commerce controls progressively disclosed.

Tabs/sections:

- Overview
- Story & media
- Variants
- Price
- Inventory
- Placement
- SEO
- History

### `/boutique/collections` — Collections
Editorial collection cards, merchandising order and visibility.

### `/boutique/collections/new` — Create Collection
Guided flow: concept -> imagery -> included pieces -> merchandising order -> storefront placement -> schedule -> preview/publish.

### `/boutique/designers` — Designers
Designer/brand profiles, content, associated products and storefront presentation.

### `/boutique/categories` — Categories
Visual category tree plus storefront navigation relationship.

### `/boutique/inventory` — Inventory
Exception-first inventory view: low stock, sold out, incoming/manual adjustments, then full inventory table.

### `/boutique/pricing` — Pricing
Price review, sale prices, scheduled changes and price-history visibility where retained.

---

## ORDERS

A client-and-fulfillment workspace, not a warehouse console.

### `/orders` — Orders
Smart views:

- needs action
- new
- paid
- preparing
- ready to ship
- shipped
- completed
- cancelled

### `/orders/:id` — Order Story
A clear timeline of the order from placement through payment, preparation, fulfillment and post-purchase events.

Primary sections:

- client
- items
- payment
- fulfillment
- communication
- documents
- timeline

### `/orders/returns` — Returns
Return requests and in-progress returns.

### `/orders/returns/:id` — Return Decision
Guided resolution: reason -> evidence/condition -> policy context -> exchange/refund choice -> logistics -> confirmation.

### `/orders/shipments` — Shipments
Fulfillment exceptions first, then all shipments/tracking.

### `/orders/drafts` — Draft Orders
Create or continue assisted/manual orders.

---

## CLIENTS

A boutique relationship book rather than a CRM spreadsheet.

### `/clients` — Clients
Searchable client cards with order value, recency and useful relationship context.

### `/clients/:id` — Client Profile
Sections:

- overview
- purchase history
- returns
- saved preferences/notes
- communication history
- consent/marketing state

### `/clients/segments` — Client Groups
VIP, returning clients, high-value, dormant and custom saved segments.

### `/clients/inquiries` — Inquiries
Customer-service queue if/when support channels are integrated.

### `/clients/notes` — Notes
Cross-client notes and follow-ups, permission controlled.

---

## STUDIO

The public brand/editorial workspace.

### `/studio/homepage` — Homepage
Visual page composer with structured sections, live preview and scheduling.

### `/studio/pages` — Pages
Editorial pages and policy/content pages.

### `/studio/navigation` — Navigation
Visual menu editor with Greek/English presentation.

### `/studio/banners` — Banners & Announcements
Create, schedule and preview promotional/editorial banners.

### `/studio/lookbooks` — Lookbooks
Optional editorial storytelling surface for designer fashion campaigns.

### `/studio/media` — Media Library
Image/video library with search, usage references, metadata and safe deletion rules.

### `/studio/seo` — Search Presence
SEO workspace covering titles, descriptions, indexability, redirects, canonical concerns and storefront preview.

---

## GROWTH

Commercial growth without exposing technical promotion machinery first.

### `/growth/campaigns` — Campaigns
A campaign can coordinate promotion, featured collection, homepage placement, dates and reporting.

### `/growth/discounts` — Discounts
Guided discount creation with plain-language eligibility and customer preview.

### `/growth/gift-cards` — Gift Cards
Issue, review and manage gift cards when enabled.

### `/growth/insights` — Insights
Business performance presented narratively first, with detailed metrics available beneath.

### `/growth/abandoned` — Abandoned Checkouts
Optional recovery workflow when consent/provider setup permits.

---

## OPERATIONS

Necessary commerce infrastructure, deliberately visually quieter than the creative workspaces.

### `/operations/payments` — Payments
Payment status, exceptions, refunds and provider health.

### `/operations/shipping` — Shipping
Shipping methods, providers, fulfillment settings and exceptions.

### `/operations/tax` — Tax & Fiscal
Tax configuration and fiscal status.

### `/operations/aade` — AADE / myDATA
COQUETTE-specific fiscal integration status, document history, errors and controlled retry/escalation workflows.

### `/operations/locations` — Stock Locations
Physical stock locations and fulfillment relationship.

### `/operations/order-settings` — Order Rules
Store-level operational rules that genuinely need merchant control.

---

## SETTINGS

Configuration that should not occupy everyday attention.

### `/settings/store` — Store Identity
Business/store identity, currency, locale and safe public settings.

### `/settings/users` — People & Access
Users, roles and permissions.

### `/settings/integrations` — Integrations
Installed providers and connection state.

### `/settings/extensions` — Extensions
Extension catalogue/registry for COQUETTE modules.

### `/settings/preferences` — Studio Preferences
Per-user UI preferences, pinned actions and notification preferences.

### `/settings/audit` — Audit History
Permission-controlled record of sensitive administrative changes.

---

# 3. Global interaction surfaces

## Command palette

Opened by keyboard or search button. It should accept both navigation and action intent:

- `New product`
- `Find order 1042`
- `Open low stock`
- `Create campaign`
- `Go to AADE`

Later, an assistant extension can add natural-language interpretation without changing the palette UI.

## Quick Create

One elegant action opens a lightweight chooser:

- New piece
- New collection
- New campaign
- New discount
- Draft order
- Page/banner

## Focus drawer

Non-blocking side drawer for short tasks such as adding a note, checking a notification or confirming a small change without losing the current workspace.

## Preview mode

Content and merchandising flows should expose storefront previews without forcing a separate browser journey whenever practical.

---

# 4. Progressive-disclosure rules

1. The first screen answers the business question; it does not expose every field.
2. Rare settings live under `More` / `Advanced` sections.
3. Destructive actions require context-aware confirmation and explain the consequence.
4. Tables are used when density is valuable, not by default.
5. Visual cards are preferred for products, collections, designers and campaigns.
6. Status should be understandable in words before raw provider codes are shown.
7. Every exception should propose a next action when one is safely known.

---

# 5. Extension seams

Extensions may add pages under an existing workspace or, if materially distinct, register a new collapsible group. They must not inject arbitrary top-level clutter.

Each extension manifest should declare:

- id
- display name
- routes
- navigation placement
- permission scopes
- optional dashboard widgets
- optional assistant events
- optional quick actions
- optional guided flows
- settings route

The shell determines final placement and visual consistency.
