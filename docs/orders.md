# Test order history and administration

Related: #5. This PR stacks on the checkout/payment PR (#4). It is an operational **demo/test** workflow, not authorization to accept live orders.

## Customer flow

After creating a demo order, use **View order status**, or **Your test orders** from the basket. `/orders.html` shows up to 100 most recent orders owned by the current browser session, with item snapshots, totals, test delivery details, server-confirmed payment state, fulfillment status and tracking.

Access uses the checkout HttpOnly cookie; knowing an order ID does not grant access. Cookies last 30 days. Clearing them, using another browser or expiration prevents access; email-based recovery, customer accounts and cross-device history are not implemented. Do not promise customers permanent history until those product decisions are implemented. Refresh updates asynchronous payment status; browser redirect parameters never count as payment confirmation.

## Administrator setup

Start the API from the repository root as described in [checkout.md](checkout.md). Generate a strong random `ADMIN_ACCESS_KEY` of at least 32 characters (for example `openssl rand -hex 32`), store it in ignored `.env`, and start with `node --env-file=.env server/start.js`. Never use a `VITE_` prefix or add this secret to frontend configuration.

Open `/admin.html` and sign in. The key is sent only to the same-origin API and cleared from the form. It is never put in localStorage, URLs or the page source. Successful authentication creates a one-hour, HttpOnly, SameSite=Strict cookie (Secure under HTTPS); only its hash is stored in SQLite. Sign out revokes that session. Admin endpoints are disabled when the key is absent. Wrong login attempts are rate-limited (5 per minute per peer IP); a deployment behind a proxy needs an explicitly reviewed trusted-proxy configuration, not blind forwarding of client IP headers.

Admin can view the newest 100 test orders and update fulfillment in forward order: `unfulfilled → processing → shipped → delivered`. Only demo or confirmed-paid test orders may be fulfilled. Shipping requires a tracking number. Tracking URLs must be HTTPS without embedded credentials and are rendered with safe external-link attributes. Pending/failed payment records cannot be manually marked paid or fulfilled by this UI.

## Persistence and security scope

Existing SQLite databases are migrated additively; checkout orders and sessions remain intact. No private order data is embedded in static HTML. The customer and administrator APIs enforce separate ownership/authentication, and mutations enforce the configured exact origin. UI content is inserted via text nodes, not interpolated HTML.

This deliberately simple admin-key flow is suitable for local review, not a substitute for production operator accounts, MFA, roles, audit logs, credential rotation/revocation design or operational rate limiting. Order history is browser-session-based, not a customer account. These limitations, real product/policy/shipping approvals, payment credentials, provider sandbox verification and deployment infrastructure remain launch requirements. No real data, secrets or live payment credentials belong in this test environment.

## Verification

- `npm run test:api`: checkout tests plus customer isolation, administrator checks, tracking validation, fulfillment transitions, restart persistence, disabled admin mode and login throttling.
- `npm run build`: storefront and static order/admin assets.
- Browser integration (fresh demo database; local API configured to same origin):

```sh
SITE_URL=http://localhost:5173 TEST_ADMIN_KEY='<same local test key>' npx playwright test tests/checkout-orders.spec.js
```

The browser test creates one demo order, confirms private history, checks a separate browser cannot read it, signs into admin, updates fulfillment, logs out and checks 320px layout. It skips unless the explicit test key is set; do not target a live store.
