#!/usr/bin/env bash
# Run from the repository root. SSH authentication and sudo access are required.
set -euo pipefail
host=ubuntu@13.207.211.164
release="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"
npm ci
npm run build
ssh "$host" "sudo mkdir -p /var/www/petfood/releases/$release && sudo chown ubuntu:ubuntu /var/www/petfood/releases/$release"
scp -r dist/. "$host:/var/www/petfood/releases/$release/"
ssh "$host" "sudo ln -s /var/www/petfood/releases/$release /var/www/petfood/next-$release && sudo mv -Tf /var/www/petfood/next-$release /var/www/petfood/current"
curl --fail --silent --show-error --output /dev/null https://13.207.211.164/
printf 'Deployed %s\n' "$release"
