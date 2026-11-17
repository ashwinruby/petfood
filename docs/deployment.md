# Combined demo deployment

Deployed 2026-11-17 at https://13.207.211.164/ from the combined catalogue, details, support, checkout and orders branches. GitHub feature PRs remain unmerged. Live sales remain disabled.

## Runtime

- Frontend: `/var/www/petfood/current` -> `/opt/petfood/releases/20261117-all-features-f0e1054-r2/dist`.
- API source: `/opt/petfood/current` -> the same release directory.
- Runtime: Node v24.22.3, official linux-x64 archive verified against published SHA-256, `/opt/petfood-node/bin/node`.
- Service: `petfood-api.service`, dedicated unprivileged `petfood` user, restart-on-failure, loopback port 3001.
- HTTPS Nginx proxies `/api/` to loopback. Existing certificate paths and renewal timer were preserved.
- Persistent SQLite: `/var/lib/petfood/goodbowl.sqlite`, outside releases, directory mode 0700 and service umask 0077.
- Server environment: `/etc/petfood/api.env`, root-only mode 0600. Contains demo mode, public origin, database path and a generated random administrator key. No credentials are committed or embedded in static assets.
- Administrator UI: `/admin.html`. The server owner can retrieve the generated key over authenticated SSH with `sudo cat /etc/petfood/api.env`; do not paste it into issues or logs. This remains a demo key-authenticated admin, not production operator accounts/MFA.

## Operations

`sudo systemctl status petfood-api` and `sudo journalctl -u petfood-api` inspect API health. `curl https://13.207.211.164/api/config` must report demo mode and liveSalesEnabled=false.

Future full releases must package `dist/`, `server/`, `public/catalogue.json`, package files and deployment configs together outside the public webroot. Install production dependencies, preserve the environment/database, switch the API release symlink, restart the service, switch the frontend symlink, validate/reload Nginx and retry health checks across worker reload. Never place server source, the database or environment files in the public frontend directory. The old `deploy/update.sh` is frontend-only and is not a full API rollout.

## Rollback

Previous static release: `/var/www/petfood/releases/20261117T112507Z-6a37957`.
Original Nginx backup: `/etc/nginx/sites-available/petfood.before-20261117-all-features-f0e1054-r2`.
To restore the old static-only site, atomically repoint `/var/www/petfood/current` to that previous release, restore the Nginx backup, validate and reload Nginx, then stop the API. Preserve `/var/lib/petfood` and `/etc/petfood` for recovery. Future rollbacks must restore matched API/frontend releases and maintain database migration compatibility.

Real product data, approved business policies, actual merchant sandbox verification, customer-account recovery and production operator authentication remain launch requirements. Use fictional customer details only.
