# Checkout and test payments

Related: #4. This is a reviewable test checkout, **not a live store**. No deployment is performed by this change.

## Existing solutions / scope

The storefront is a small Vite app, not a commerce platform. This change uses maintained Fastify for HTTP validation/transport, Stripe's official Node SDK and hosted Checkout for payment details, and Node's built-in SQLite for a single-instance persistence layer. It does not implement card collection. A full commerce platform (for example Medusa) would require migrating the catalogue, storefront and deployment; that is outside these issue-sized changes.

## Local demo

Requires Node **22.13+** for built-in `node:sqlite` (tested on Node 26). Run from the repository root:

```sh
npm ci
npm run start:api
# second terminal
npm run dev
```

Use `http://localhost:5173` (not the IP or another port; origin checking is strict). Add an item, open Bag, then Try demo checkout. Use fictional address/contact details such as `demo@example.com`. SQLite data is stored in ignored `data/`, and survives restarts. Demo orders are explicitly marked `demo`, never `paid`. Sample shipping is ₹99 below ₹1,500; no claim is made that these are approved rates. Inventory reservations include saved demo orders; use a fresh `DATABASE_PATH` for a clean test dataset.

The API defaults to loopback port 3001. Vite proxies `/api`. A production/static build does **not** include a running API. Existing static deployment remains a concept site, and checkout reports unavailable when no API is routed. A future server deployment needs a separately managed API process, same-origin reverse proxy, HTTPS, protected persistent storage, backups and operational monitoring; do not simply expose port 3001 publicly.

## Stripe sandbox

Create `.env` from `.env.example`; never commit secrets. Set `PAYMENT_MODE=stripe-test`, `STRIPE_SECRET_KEY=sk_test_…` and `STRIPE_WEBHOOK_SECRET=whsec_…`, then run `node --env-file=.env server/start.js`. Live keys and live payment events are rejected, and no mode enables live sales.

Use a verified **test fixture** catalogue for sandbox testing. Server reads `public/catalogue.json` using the issue #2 contract: `{products:[{id,name,verified,variants:[{id,weight,price,stock}]}]}`. Prices are INR rupees, stock is a nonnegative integer. Existing illustrative products remain `verified:false`; do not mark real product claims verified just to bypass the gate. With no catalogue file, only demo mode has a clearly illustrative fallback matching the original three sample products. Invalid catalogue files fail closed.

Forward Stripe test webhooks to `/api/payments/webhook`, using Stripe CLI or a properly secured test endpoint. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Verify a complete flow with Stripe test cards and your merchant account before any release. No actual provider call was verified without credentials.

Server recomputes prices, shipping and inventory. The idempotency key binds to the browser session and exact checkout content. Pending orders reserve stock; signed expiry/failure events release it. Stripe expiry defaults apply. Browser redirects **never** mark payment successful. Signed webhook amount, currency, session, live/test mode and event duplication are checked. On a provider timeout, retry the same request key; the provider's idempotency key resumes the same session instead of creating a duplicate charge. Pending orders require webhook delivery/reconciliation; do not delete them merely because the return page says cancelled.

## Privacy / limitations / launch blockers

- Thirty-day, HttpOnly, SameSite=Strict session cookie restricts order access to the browser that created it. Cookies are Secure under HTTPS. No email recovery or cross-device account access yet.
- Database stores test contact/address details; use fictional data. The SQLite directory and host require appropriate access controls and retention before any real use.
- Request sizes, quantity/field validation, exact-origin mutation checks, server totals, stock reservations and order ownership checks are implemented. Production rate limits, account authentication/recovery, retention jobs, operational observability and tax/commercial rules remain deployment requirements.
- Real verified product data, approved policies/shipping/tax rules, merchant configuration and live-sales approval remain missing. This PR therefore references but does not auto-close issue #4.
- Support links become available with the separate issue #6 support PR.

## Checks

`npm run test:api` covers server pricing, shipping, persistence retrieval, idempotency conflicts, stock exhaustion, malformed/oversized input, origin checks, session isolation, forged/signed webhook handling, duplicate events and live/unverified gating. `npm run build` checks frontend bundling. Test provider behavior is mocked; real Stripe sandbox verification remains pending credentials.
