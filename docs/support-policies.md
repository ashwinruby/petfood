# Support and policy publishing

`/support.html` is a standalone, accessible help page. Vite copies the `public/` assets into the production build; no framework, hosted support service or additional dependency is needed. Native `<details>` provides keyboard-accessible FAQs. All links work on the existing static hosting setup, including direct section links.

## Before a real launch

Edit `public/support-config.json` with **confirmed** business details. Empty contacts are intentional: the preview must not send customer requests to an invented inbox. Email/phone links are only rendered for usable values. No support form or submission endpoint is provided.

For each policy (`shipping`, `returns`, `privacy`, `terms`):

1. Obtain approved plain-text content reflecting the actual business, checkout and hosting practices. Include shipping regions/prices/times, returns/refunds conditions, privacy handling and business terms as appropriate.
2. Set `text`, an ISO `YYYY-MM-DD` `updated` date and `approved: true`.
3. Build and review the rendered policy page and checkout links before deployment.

Unapproved or incomplete entries display an explicit **Not published** notice. Partial publication does not claim the store is ready for sales. Configuration is public: never put credentials, private customer details or internal notes here. Content is rendered with `textContent`, not HTML. If configuration cannot load or JavaScript is disabled, the page fails safely to preview notices rather than presenting draft text as binding terms.

The FAQ describes the current demo; update its purchase/data-handling answers when live checkout is enabled. The privacy preview only identifies the existing basket storage and help-page behavior; it is not a complete production privacy policy. Business details, approved terms and real operating rules remain owner-supplied launch requirements for issue #6.

## Verification

With `npm run dev` running: `npx playwright test tests/support.spec.js`. The same checks can target the production build using `SITE_URL=http://127.0.0.1:4173` and `npm run preview`.
