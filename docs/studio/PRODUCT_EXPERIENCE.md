# COQUETTE Studio — Product Experience

**Status:** Interactive prototype direction  
**Date:** 2026-08-27

## Purpose

Product management must feel like curating a designer boutique, not maintaining a database. The normal merchant should never need to understand Medusa entities, technical variant models or provider terminology just to introduce a new piece.

The experience therefore has two primary surfaces:

1. **The Boutique** — a visual, editorial product workspace.
2. **New Piece** — a guided, autosaved onboarding flow.

Medusa remains the system of record underneath these experiences.

---

## 1. The Boutique product workspace

The first question is not “which database rows exist?” but “what is happening with the collection?”

The page opens with a quiet editorial header, natural-language search and a small exception summary:

- pieces needing attention
- low stock
- sold out
- drafts waiting to be completed
- scheduled pieces

The default view is image-first. Dense list/table views remain available for advanced work but are not the emotional center of the page.

### Product card

Each product card can communicate at a glance:

- image
- designer
- product name
- price / sale state
- key availability signal
- publication state
- one contextual next action

Examples:

- `1 left · selling quickly` -> Review stock
- `Draft · description missing` -> Continue
- `Scheduled · 01 Sep, 10:00` -> Preview
- `Sold out · 6 wishlist saves` -> Review availability

### Search

Search should tolerate how humans actually remember fashion products. A single field should search across:

- title
- SKU
- barcode / GTIN
- designer
- collection
- category
- color
- size where relevant

The interface can later support natural-language intent such as `black dresses low stock` without changing the page structure.

---

## 2. “New Piece” guided flow

The wizard is intentionally conversational. It asks one meaningful business question at a time and progressively reveals complexity.

### Step 1 — Identity

Prompt: **What are we introducing?**

- product name
- designer / brand
- category
- optional SKU / barcode
- optional fast route for a minimal draft

The user should be able to continue after only the genuinely required information.

### Step 2 — Visual story

Prompt: **Show the piece at its best.**

- drag/drop media
- choose cover image
- reorder images
- label detail / campaign imagery if useful
- optional video later

The cover preview is visible immediately.

### Step 3 — Story & details

Prompt: **What should the client know?**

- editorial description
- materials / composition
- fit
- care
- model notes
- country/manufacture detail when applicable

AI assistance may draft or refine copy only when explicitly requested. It must never silently invent material, fit or care facts.

### Step 4 — Choices

Prompt: **How can the client choose it?**

Instead of opening with a technical variant matrix, the merchant selects dimensions such as:

- size
- color
- one-size

The Studio then presents the generated combinations visually and exposes SKU/barcode details only where needed.

### Step 5 — Price & availability

Prompt: **How will we sell it?**

- price
- optional compare-at / sale price
- stock by size/color combination
- continue selling / preorder only when enabled

Tax, region and underlying Medusa price-list mechanics remain behind safe defaults unless advanced configuration is required.

### Step 6 — Boutique placement

Prompt: **Where should clients discover it?**

- New In
- collections
- categories
- featured placement
- homepage candidate
- publish now / schedule / keep draft

This is merchandising language rather than system configuration.

### Step 7 — Search presence

Prompt: **How should it appear in search?**

- URL handle
- SEO title
- meta description
- search preview
- Greek/English content status

Safe suggestions may be offered from the actual product data already entered.

### Step 8 — Review & publish

The final screen looks like a boutique proof, not a validation report.

It shows:

- product-card preview
- imagery
- price
- choices
- stock summary
- placement
- publication timing
- any missing non-blocking enhancements

Primary actions:

- Publish
- Schedule
- Save as draft

Blocking issues are phrased in plain language and take the merchant directly to the step that needs correction.

---

## 3. Interaction principles

### Autosave

Every meaningful change is saved as a draft. The interface shows a quiet `Saved` / `Saving…` state. Losing a browser tab should not mean losing work.

### Progressive disclosure

Advanced commerce fields are available but never dominate the default path.

### Live preview

Desktop/tablet can show a live product-card preview beside the wizard. Mobile prioritizes the form and opens preview on demand.

### Resume later

An unfinished product appears in `Drafts` with the exact next meaningful step, for example `Continue · add price` rather than merely `Incomplete`.

### Safe shortcuts

A merchant in a hurry can create a minimal draft with name, designer, price and SKU, then complete the editorial steps later. The shortcut never bypasses publication requirements.

### No irreversible surprises

Publishing, deleting, changing live price and destructive inventory operations remain explicit, contextual and auditable.

---

## 4. Medusa mapping

The Studio translates the merchant experience into Medusa concepts:

- New Piece -> product + variants + options
- Designer -> COQUETTE Designer module/link
- Price & availability -> Medusa pricing/inventory
- Placement -> collections/categories/sales channel visibility/custom content links
- Media -> Medusa file provider / COQUETTE media storage
- Publish state -> product status plus COQUETTE scheduling layer where needed

The merchant-facing contract must not leak implementation details merely because Medusa exposes them.

---

## 5. Prototype acceptance criteria

The product experience is directionally accepted when:

- a non-technical boutique operator can understand what to do without documentation
- the first screen feels like merchandising, not inventory software
- creating a basic product can be completed without encountering technical terminology
- unfinished work always explains the next meaningful step
- advanced information remains reachable without cluttering the main path
- the experience works comfortably on laptop and tablet
- extension points can add product capabilities without redesigning the wizard
