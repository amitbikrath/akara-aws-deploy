# Spec: Shop v2 — Deity aisles, live filters, trust strip, reviews

Status: **ready-for-agent**. Written 2026-09-07 from a grilling session. No issue tracker is
wired to this repo, so this file is the ticket. Build in a fresh session with `/implement`
or plain work; the handoff for that session is in project memory
(`project_shop_v2_handoff.md`).

Vocabulary is from repo `CONTEXT.md`. Use those names exactly.

## Problem Statement

The Shop has 11 live Products (10 tees, 1 mug) and gets new ones roughly weekly, but it was
built for one. A buyer today sees one flat row per Aisle, cannot narrow by the thing they
actually shop by (which deity, which colour), cannot sort, sees no reason to trust delivery
or replacement, sees no other buyer's word, and is offered nothing else when the cart opens.
Two of our colour dots are wrong because colour names are typed by hand in code. Competitor
shops (Nobero, Bluorng) solve all of this with noisy mass-market widgets that would break
the broadsheet register.

## Solution

Keep the broadsheet look. Add only what works with live Shopify data and needs no second
store of truth:

1. **Deity aisles first.** The first filter row is the deity (Shiva, Hanuman, Krishna,
   Ganesha, …) read from Product tags. Product type (Tee, Mug, …) is the second row. Colour
   is the third. All three rows are built from the live Product list, never typed in code.
2. **Sort.** Newest first (default), Price low→high, Price high→low.
3. **"New this week" ribbon** on any Product created in the last 7 days.
4. **Trust strip** under the cart / add-to-bag area and in the footer, with the real
   Qikink numbers, plus a WhatsApp link.
5. **Cart upsell.** The cart drawer shows up to 3 Products that share a deity tag with
   something in the cart.
6. **Reviews via Judge.me**, moderated by the owner in Judge.me. Until the store has 5
   approved reviews in total, each card shows the owner's **Founder's note** (a Shopify
   metafield) instead.
7. **Dynamic colour swatches** with a safe fallback for unknown names.

## User Stories

1. As a buyer, I want to tap "Shiva" and see only Shiva pieces, so that I find my deity in one tap.
2. As a buyer, I want to tap "Tee" or "Mug" inside a deity, so that I narrow to the thing I want to own.
3. As a buyer, I want to tap a colour dot and see only Products that come in that colour, so that I skip colours I never wear.
4. As a buyer, I want the filter rows to reflect what is actually for sale, so that I never tap a filter that shows nothing.
5. As a buyer, I want to sort by newest, so that I see this week's drop first.
6. As a buyer, I want to sort by price, so that I can find the cheapest or the premium piece once prices differ.
7. As a buyer, I want a small "New this week" mark on new Products, so that I know what changed since my last visit.
8. As a buyer, I want to read how many days delivery takes before I add to bag, so that I can decide if it arrives in time.
9. As a buyer, I want to know COD exists on most pin codes, so that I can buy without a card.
10. As a buyer, I want to know the replacement rule (7 days, damage or misprint only), so that I am not surprised later.
11. As a buyer, I want a WhatsApp link, so that I can ask a human before buying.
12. As a buyer, I want the cart to suggest pieces of the same deity, so that I complete a set in one order.
13. As a buyer, I want to read approved reviews with stars and words on a Product, so that I trust the print quality.
14. As a buyer, I want to leave a review after buying, so that my word helps the next buyer.
15. As a buyer, I want the colour dot to look like the colour it names (Mint, Grey Melange), so that I am not misled.
16. As a buyer, I want the Product's own name shown on hover or under an unknown colour dot, so that a fallback dot still tells me the colour.
17. As a buyer, I want the product page to show all Product images, whether 1 or 9, so that no card looks broken.
17a. As a buyer, I want each Product to have its own page and URL, so that I can share it and use the back button, as on every other shop.
17b. As a buyer, I want to swipe left and right through a Product's images on its card and on its page, so that I see the back print without opening anything.
18. As a buyer with `prefers-reduced-motion`, I want filters and ribbons to appear without animation, so that the page is calm.
19. As a buyer on a phone, I want filter rows to scroll sideways and stay tappable, so that I can filter with one thumb.
20. As a buyer, I want the URL to hold my chosen deity and type (e.g. `/shop?deity=shiva&type=tee`), so that I can share the view.
21. As the owner, I want to pause a Product by setting it to Draft in Shopify, so that it vanishes from the Shop on the next load with no code change.
22. As the owner, I want to tag a Product with a deity in Shopify and see it land in that aisle, so that I never edit code for a new drop.
23. As the owner, I want a Product with no deity tag to show only under "All", so that a missed tag is visible, not hidden.
24. As the owner, I want to write a Founder's note per Product in a Shopify metafield, so that I change a sentence without a developer.
25. As the owner, I want reviews to appear only after I approve them in Judge.me, so that spam and abuse never reach the page.
26. As the owner, I want reviews to stay hidden site-wide until 5 approved reviews exist in total, so that an empty "0 reviews" never shows.
27. As the owner, I want the trust strip text in one place, so that a new Qikink number is one edit.
28. As the owner, I want zero new servers, tables, or Lambdas for this, so that nothing else can break.
29. As the owner, I want the Shop to fall to the Dhyana state if Shopify is unreachable, so that no fake data is shown.
30. As the owner, I want the Shop to keep working if Judge.me is unreachable, so that reviews failing never hides Products.
31. As the owner, I want the Shop to load up to 100 Products, so that weekly drops do not fall off the end.
32. As a developer, I want the mapping from Shopify data to Shop data in pure functions, so that filters and sort can be tested without a browser.

## Implementation Decisions

**Product page (added 2026-09-07 after owner review, Jakob's Law).** A Product opens its own
page at `/shop/{handle}`, never a modal. The page has a sticky swipeable gallery with arrows,
dots, an image counter and a thumb strip; picking a colour jumps to that colour's image. Below
the buy block: trust strip, description with any Qikink size chart rendered as a table, a facts
list (cut, type, deity, colours, sizes, made), and a "More of {deity}" strip. Back, Escape and
the browser back button return to `/shop` with the filters intact. A direct load of an unknown
handle shows a calm "not on the shelf" state.

**Card galleries.** Every product card carries the same swipe gallery: touch swipes, mouse
arrows on hover, dots. Tapping the card opens the product page.

**Data source.** Shopify Storefront GraphQL stays the only source of Products, Variants,
prices, and the cart. Raise the page size to 100. Add `createdAt`, `compareAtPrice` and the
two metafields (`akara.founder_note`, Judge.me rating and count) to the query.

**Deity.** A Product's deity is the first tag that matches a known deity list
(Shiva, Hanuman, Krishna, Ganesha, Radha, Sadhu, Durga, Lakshmi, Rama, Sita, Kali, Saraswati,
Vishnu, Surya). The list is a small constant; the filter row shows only deities that at
least one live Product carries, with counts. A Product with no match has deity `null` and
appears only under "All". The mug today has no deity tag; the owner tags it.

**Type.** From Shopify `productType`, shown as-is (T-Shirt → "Tee", Mug → "Mug").
Built from live data; shown only when 2+ types exist.

**Colour.** From the `color` option values across all live Products, with per-colour Product
counts. Swatch colour resolves in order: (1) a small named map (White, Black, Beige, Navy
Blue, Lavender, Mint, Grey Melange, Maroon, Red, Indigo, Olive, Mustard, Sand, Charcoal),
(2) the CSS named colour of the first word if the browser accepts it, (3) a neutral dot with
the name written under it. Never a wrong-looking guess.

**Filter model.** Filters are AND across rows, OR within a row. Stored in URL query params
`deity`, `type`, `color`, `sort`. Existing Aisle (Clothing / Fine Prints / Merchandise)
layout stays as the section grouping under the filters; Coming Soon items still show in
their Aisle when no filter is active and hide when any filter is active.

**Sort.** `newest` (Shopify `createdAt` desc, default), `price-asc`, `price-desc`.

**Ribbon.** "New this week" if `createdAt` is within 7 × 24 h of now. Small italic dek in
gold, top-left of the card image. No pulse, no count-down, no promised drop day.

**Trust strip.** One constant, one component, rendered in the Peek modal under the
add-to-bag button, at the bottom of the cart drawer, and in the Shop footer. Copy, exact:

    Ships in 2–3 days · Delivered in 5–8 days across India · Cash on Delivery on most pin codes · 7-day replacement for damage or misprint · WhatsApp us

Rules: never "returns", never "free returns", never "COD everywhere". WhatsApp opens
`https://wa.me/919993518528?text=` with the Product title prefilled when opened from a
Product. No floating bubble.

**Cart upsell.** In the cart drawer, "Goes with this": up to 3 Products not in the cart
that share a deity with any cart line, newest first. If none share, show newest 3. Tapping
opens the Peek modal.

**Reviews.** Judge.me is installed on the Storefront with auto-publish OFF. Two feeds:
(a) star average and count per Product from the Judge.me-written Shopify metafields
(`reviews.rating`, `reviews.rating_count`) read through the Storefront API; (b) review text
from the Judge.me public API using the shop's public API token, which the owner pastes into
the same constants block as the Storefront token. Gate: if the store-wide approved review
count is below 5, show no stars and no review text anywhere; show the Founder's note
instead. Once 5 or more exist, every Product shows its own approved reviews, even one.
A review form is not built in our JSX; the Peek modal links to the Judge.me "write a
review" page for that Product. Judge.me failure is silent: the card falls back to the
Founder's note.

**Founder's note.** Shopify metafield `akara.founder_note` (single-line or multi-line
text, Storefront access on). Rendered as an italic dek with a drop cap, signed "— Amit,
AKARA". Empty metafield renders nothing.

**Pause a Product.** No code. Shopify Draft or unpublish from the Headless channel.

**Images.** Cards use `featuredImage`; the Peek modal shows every image, 1 to 20, with the
strip hidden when there is only one. Placeholder Qikink mockups are accepted for now; model
mockups are a later task.

**Motion.** All new elements follow the existing register: 0.9–1.7 s eases, staggered
reveal, honoured `prefers-reduced-motion`.

**Deploy.** Targeted `aws s3 cp` of changed JSX with `Content-Type: text/babel` and
`Cache-Control: public, max-age=300`, CloudFront invalidation, then curl the live URL and
grep for a new string. Local preview through the existing preview proxy first.

## Testing Decisions

- No test runner exists for the CDN-loaded JSX bundle. Pure mapping and filter logic
  (deity extraction, colour tally, filter AND/OR, sort, "new this week", review gate,
  swatch resolution) is written as plain functions with no React and no DOM, so a Node
  script can require them and assert on fixtures copied from the live Storefront response
  saved on 2026-09-07 (11 Products). Add that fixture and script under the docs/specs
  folder's sibling `tests` folder; run it before deploy.
- Good test: given the 11-product fixture, "Shiva" yields 4, "Hanuman" 2, colour "Mint" 1,
  untagged mug is absent from every deity but present in "All"; sort by price puts the mug
  first; review gate returns "hidden" for total 4 and "shown" for total 5.
- Browser checks in the preview proxy: filter taps update URL; empty result state shows a
  calm message, never a spinner; reduced-motion disables reveals; mobile 375 px filter
  rows scroll sideways; Judge.me blocked → Founder's note still shows.
- Prior art: none in repo. This is the first test script for the JSX bundle.

## Out of Scope

- Fake or seeded reviews. Refused: illegal under India's Consumer Protection Act 2019
  fake-review rules and a Shopify ToS breach.
- Sold-out badges and stock counts. Qikink is print-on-demand; stock is always available.
- Price filter. All tees are ₹1,499 today.
- Pincode delivery-date lookup. No carrier API on our side.
- Bundles / "pick any 3". Needs Shopify discount setup first.
- Wishlist. Needs accounts.
- Drop countdown or promised drop day.
- Model mockup renders (parked, separate task).
- Admin "Shop desk" writing through to Shopify (still pending from the previous spec).
- Any new AWS resource.

## Further Notes

- Judge.me metafield visibility on the Storefront API is `[assumed]`; the build must first
  query one Product's `metafield(namespace:"reviews", key:"rating")` and confirm a value.
  If null, the owner turns on Storefront access for that definition in Shopify → Settings →
  Custom data → Products, or the stars come from the Judge.me public API instead.
- Judge.me public API from the browser is `[assumed]` CORS-safe; if not, stars-only from
  metafields ships in batch 2 and text waits.
- Shipping in two batches: **Batch 1** filters, sort, ribbon, trust strip, upsell, swatches,
  100-product page size, image count fix. **Batch 2** reviews and Founder's note, once the
  owner pastes the Judge.me public token and creates the `akara.founder_note` metafield
  definition.
- Competitor features seen 2026-09-07 for reference: Nobero (filters, sort, strike price,
  "lowest in 30 days", stars, pincode, 3-packs, refund bar, app nudge); Bluorng (wishlist,
  blind-box drops, shop by colour, sold-out, cart "you may like", store locator).
