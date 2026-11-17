# Catalogue data and launch readiness

The catalogue is loaded from `public/catalogue.json` (no rebuild needed when replacing this deployed data file). The current records remain **samples**, not real products. Do not set `verified: true` until the business has supplied and approved the actual photos, descriptions, ingredients, nutrition, feeding guidance, prices and inventory.

Each product has a stable `id`, `pet` (`dog` or `cat`), `name`, optional `flavor`, `description`, `ingredients`, `nutrition`, `feedingGuidance`, local `image` path and `verified` flag. Display-only `color`, `label`, `tag`, `weight` and `price` preserve the existing packaging style. Each `variants` entry has a globally unique `id`, `weight`, INR `price` in rupees and integer `stock`. Variant prices and stock are authoritative for the UI. Product/variant IDs use lowercase letters, digits and hyphens. Avoid changing IDs once orders exist. Verified records must contain all required commercial information and a local photo path.

Basket storage remains `goodbowl-basket`: a map of variant IDs to integer quantities. Existing sample IDs are preserved. Unknown IDs are removed; quantities are clamped to available stock and 99. The UI emits `goodbowl:basket-updated` on `document`, with `detail.basket` holding the current map. Server checkout must independently validate prices, availability and product readiness: browser inventory checks are not a stock reservation system.

## Existing solutions preflight

This extends the existing Vite/native-JavaScript storefront with JSON and browser APIs, without introducing a framework or SaaS. A full commerce platform such as Medusa or Saleor can provide future inventory administration, but replacing this small existing POC is not needed to establish its catalogue contract. No paid service is selected.

## Still required for live sales

- Verified catalogue data and licensed real product photography supplied by the business.
- A selected inventory system and server-side stock reservation/reconciliation.
- Removal or approval of the original site's marketing claims as part of launch content review.
