# GoodBowl — pet food homepage POC

Live: **https://13.207.211.164/**

A responsive pet food storefront concept built with vanilla JavaScript, CSS and Vite. Includes dog/cat product filters, an accessible modal basket, quantity removal, INR totals, local basket persistence and mobile layouts. The GoodBowl name, packaging, product descriptions, prices and ingredient claims are illustrative, not verified commercial offerings. No checkout, payment, customer data collection or real orders.

## Local development

Requires Node.js 22.12+ (built with Node 26).

```sh
npm ci
npm run dev
```

Production build: `npm run build`. Static output is in `dist/`.

## Browser checks

```sh
npx playwright install --with-deps chromium
# With the dev server running:
npx playwright test
# Or test the deployed site, including browser TLS validation:
SITE_URL=https://13.207.211.164 npx playwright test
```

Tests cover product filtering, basket totals, persistence and removal, keyboard dismissal, JavaScript errors, image loading and viewport overflow at ten widths from 320px to 1920px. Navigation checks verify the sticky header, visible mobile links, unobscured section anchors, return-to-top link and basket access at mobile, tablet and desktop widths.

## Deployment

Nginx serves static files on the Ubuntu server; no Node process is necessary in production. The initial release is `/var/www/petfood/releases/initial`, with `/var/www/petfood/current` pointing to the active release. Existing Nginx default configuration was preserved; the app uses a separate IP-specific server block.

- Site configuration: `/etc/nginx/sites-available/petfood` (source: `deploy/nginx.conf`).
- TLS: Let's Encrypt short-lived IP certificate, issued with Certbot 5.10 in `/opt/certbot`.
- Certificate: `/etc/letsencrypt/live/petfood-ip/` (private keys stay on server, never in Git).
- Renewal: `petfood-certbot.timer`, twice daily with randomized delay, invokes `certbot renew`; deployment hook validates/reloads Nginx.
- HTTP redirects to HTTPS, except ACME challenge paths served from `/var/www/html`.
- Nginx and the renewal timer start automatically after reboot.

To update after committing changes, run `bash deploy/update.sh`. It builds locally, uploads a timestamped release and atomically switches the live symlink. Previous releases are retained. Roll back by repointing `/var/www/petfood/current` to a previous release (using a temporary symlink and `mv -Tf`). Nginx need not restart for static file updates.

Useful server checks:

```sh
sudo nginx -t
sudo systemctl status nginx petfood-certbot.timer
sudo /opt/certbot/bin/certbot renew --dry-run
sudo journalctl -u petfood-certbot.service
```

## Assets

Dog photo downloaded from [Unsplash](https://images.unsplash.com/photo-1552053831-71594a27632d) via `https://images.unsplash.com/photo-1552053831-71594a27632d`; stored locally in `public/dog.jpg`. Typography uses DM Sans and Manrope via Google Fonts, with system fallbacks. Product packaging and illustrations are original HTML/CSS/SVG, not images of actual products.

## Checkout preview (issue #4)

A separately started local API now supports persisted **demo orders** and gated Stripe test checkout. Live sales remain disabled. See [checkout setup and limitations](docs/checkout.md). Run `npm run start:api` alongside `npm run dev`, then choose “Try demo checkout” in the basket. Use fictional data only. Existing static deployments need explicit API infrastructure before checkout can work.
