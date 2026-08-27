# COQUETTE Studio — Login & `Today` Experience

**Status:** Foundation proposal  
**Date:** 2026-08-26

# 1. Experience objective

The first two screens establish the character of the entire merchant product.

The sign-in screen should feel like entering a private luxury workspace. The first authenticated screen should feel like meeting a capable personal assistant who has already organized the business since the merchant was last present.

The emotional target is **quiet confidence**, not visual spectacle.

---

# 2. Login screen

## Composition

The page contains only the elements needed to enter the Studio and establish COQUETTE identity:

1. COQUETTE CONCEPT STORE wordmark
2. email field
3. password field
4. primary sign-in action
5. discreet password-recovery link
6. the quotation at the bottom
7. a handwritten-style `Coco Chanel` attribution treatment

No photography, dashboard preview, marketing headline, feature list or technical environment copy belongs on the production login screen.

## Quotation

Greek primary display:

> «Ένα κορίτσι πρέπει να είναι δύο πράγματα: όποια θέλει και ό,τι θέλει.»

Attribution beneath: `Coco Chanel` in an elegant handwritten-style type treatment. It should **not** be a facsimile or reproduction of a historical signature.

## Layout

Desktop/tablet:

- full viewport, warm off-white/alabaster canvas
- wordmark centered in the upper-middle breathing area
- form centered below with narrow luxury proportions
- quotation anchored visually near the bottom, not crowded against the edge
- generous empty space is intentional

Mobile:

- same hierarchy, not a separate compact theme
- wordmark scales down without losing letter spacing
- fields retain comfortable touch height
- quotation remains readable and does not collide with keyboard-safe areas

## Field treatment

- label/value treatment should be quiet and editorial
- no heavy rounded SaaS boxes
- thin borders or underline-based fields
- visible keyboard focus state
- password reveal control should be visually restrained
- errors appear immediately below the relevant field in human language

## Sign-in action

- dark charcoal/black solid button
- generous horizontal width
- subtle hover/focus transition
- no neon loading indicators
- on submit, the label can transition to `Entering Studio…` with a refined progress treatment

## Authentication feedback

Wrong credentials:

- concise message
- never expose whether the email exists
- preserve entered email
- return focus appropriately

Connection/backend unavailable:

- explain that the Studio cannot connect right now
- provide retry action
- do not leak infrastructure/provider details to normal merchant users

## Motion

Motion should be nearly imperceptible:

- 150–250ms opacity/translate transitions
- no bouncing, springy cards or decorative looping animation
- optional gentle wordmark fade on first load only

---

# 3. `Today` — personal assistant dashboard

## Core question

The screen must answer, in this order:

1. **What happened since I was last here?**
2. **What genuinely needs my attention?**
3. **How is the boutique doing?**
4. **What should I do next?**

Raw totals are secondary.

## Header

Example tone:

> Καλησπέρα.  
> Από την τελευταία σας σύνδεση, η boutique είχε 8 νέες παραγγελίες και υπάρχουν 3 πράγματα που αξίζουν την προσοχή σας.

The greeting can adapt to time of day. Personal names may be used when known from the authenticated account, but the experience must work elegantly without them.

The header also contains:

- current date
- command/search trigger
- discreet notifications entry
- optional `Quick create` action

---

# 4. Dashboard modules

## A. Since your last visit

A narrative summary produced from deterministic event data first; an AI summarizer may later enhance phrasing but must not invent facts.

Example events:

- 8 orders placed
- 2 orders fulfilled
- one high-value returning client ordered again
- one product sold out
- three pieces entered low-stock state
- one campaign/page schedule changed
- one payment/AADE exception appeared

The merchant can expand `See everything` into the Activity screen.

## B. Needs your attention

This is the highest-priority module and should rarely show more than 3–5 cards initially.

Each card contains:

- plain-language issue
- why it matters
- age/time context
- one strong primary action
- optional secondary action such as snooze or review later

Examples:

- `2 orders are ready to ship` -> **Prepare shipment**
- `Black satin blazer is down to one piece` -> **Review stock**
- `AADE document needs review` -> **Open fiscal item**
- `Weekend homepage banner expires tomorrow` -> **Replace banner**

Priority rules must be deterministic, auditable and configurable before any AI ranking is allowed to influence operational decisions.

## C. Boutique pulse

A compact, beautiful performance strip rather than a wall of KPI cards.

Possible metrics:

- revenue since last visit / today
- orders
- average order value
- returning-client share
- top-performing product or collection

Trend language should accompany numbers where useful.

## D. Merchandising radar

Fashion-specific commercial attention:

- low stock
- sold out
- product drafts waiting for completion
- missing imagery/details
- collections with weak availability
- pieces receiving unusually high views relative to stock (once analytics exists)

Use product imagery where possible.

## E. Client moments

A luxury boutique should notice people, not only transactions.

Examples:

- returning VIP client placed an order
- first order above a configured value
- inquiry awaiting response
- repeated return/size pattern needing human attention

This module must respect data-minimization and role permissions.

## F. Order movement

A visual flow summary showing where orders currently are:

`New -> Preparing -> Ready -> Shipped -> Completed`

Only exceptions or bottlenecks should become prominent.

## G. Calendar / brand rhythm

Upcoming items such as:

- scheduled homepage changes
- campaign start/end
- collection launch
- discount expiry
- operational deadlines

This turns the dashboard into a forward-looking assistant, not just a rear-view mirror.

## H. Suggested next actions

The Studio can propose a small number of safe next actions based on clear rules:

- complete a product draft
- reorder/review low stock
- replace expiring homepage content
- respond to an inquiry
- review a failed integration item

Recommendations should always reveal enough context for the merchant to decide, never silently perform consequential actions.

---

# 5. Visual hierarchy

The dashboard should avoid the classic four-colored-stat-card layout.

Preferred structure:

1. large calm greeting and summary
2. attention queue
3. boutique pulse
4. two-column editorial modules on wider screens
5. timeline/calendar/recent activity beneath

Cards should use subtle borders, soft surfaces and generous internal spacing. Color is reserved for semantic states and selected brand moments; it should not be used decoratively everywhere.

---

# 6. Interaction behavior

## Context without losing place

Short actions open in a right-side focus drawer where possible. Full workflows navigate to their dedicated Studio page.

## Completion feedback

When a task is completed:

- card resolves gracefully
- dashboard re-ranks remaining attention items
- lightweight confirmation appears
- no celebratory confetti or gamification

## Empty states

Empty should feel reassuring, for example:

> Όλα είναι τακτοποιημένα προς το παρόν.

Then show useful optional work such as creating a new piece or reviewing insights.

---

# 7. Assistant data model (implementation direction)

The dashboard should be built on explicit normalized events and derived attention items.

Suggested event envelope:

```ts
type StudioEvent = {
  id: string
  occurredAt: string
  domain: "order" | "product" | "inventory" | "client" | "content" | "payment" | "fiscal" | "integration"
  eventType: string
  entityId?: string
  severity: "info" | "attention" | "urgent"
  summaryKey: string
  metadata: Record<string, unknown>
}
```

Suggested attention item:

```ts
type AttentionItem = {
  id: string
  createdAt: string
  priority: number
  domain: string
  title: string
  explanation: string
  primaryAction: StudioAction
  secondaryActions?: StudioAction[]
  resolvedAt?: string
  snoozedUntil?: string
}
```

The first implementation can derive these from Medusa order/product/inventory events and custom COQUETTE module events. A later assistant layer may summarize or prioritize within safe constraints.

---

# 8. Responsive behavior

Desktop is the richest workspace, but tablet must be first-class because boutique operators may work away from a desk.

- sidebar becomes collapsible rail
- dashboard modules reflow without horizontal table dependence
- priority cards remain first
- quick actions remain reachable
- dense tables switch to cards or horizontal detail drawers where appropriate

Mobile supports monitoring and short actions well; complex merchandising flows may remain more comfortable on tablet/desktop while still being technically usable.

---

# 9. Foundation acceptance criteria

Login concept is accepted when:

- the page contains no unnecessary technical or marketing clutter
- brand wordmark dominates appropriately
- form is fully keyboard accessible
- responsive behavior is clean
- quote attribution is typographic rather than a historical signature reproduction

`Today` concept is accepted when:

- a merchant can understand business state within roughly 10 seconds
- actions are prioritized before analytics detail
- the screen communicates what changed since the previous login
- no critical action depends on interpreting provider codes
- each attention item can deep-link into its actual workflow
- modules can be extended without redesigning the page shell
