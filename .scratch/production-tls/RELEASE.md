# Production HTTPS repair — 2026-11-12

Status: done

Certbot renewed its non-wildcard peebot.shop certificate at 14:09 +07, replacing
the shared certificate paths also used by acme.sh. The replacement covered only
peebot.shop, www.peebot.shop and web1.peebot.shop; other services failed hostname
validation. acme.sh still held a valid certificate for peebot.shop and *.peebot.shop.

## Applied repair

- Installed the existing acme.sh wildcard certificate into /etc/nginx/ssl/peebot.shop/.
- Updated all seven Nginx virtual-host configuration files to use this directory.
- Updated acme.sh installation destinations and its reload command to run
  `nginx -t && systemctl reload nginx` after renewal. The existing cron schedule remains active.
- Moved the two unused Certbot renewal configurations out of its renewal directory
  into /var/backups/nginx-tls-20261112/ to prevent competing deployments.
- Updated the Learning deployment template on the VPS and in this repository.
- Backed up original Nginx and acme.sh configuration under /var/backups/nginx-tls-20261112/.

## Validation

Nginx configuration validation passed. HTTPS certificate verification passed from
the Windows client for peebot.shop, www.peebot.shop, web1.peebot.shop,
9router.peebot.shop, attendance-sys.peebot.shop, cvbuilder.peebot.shop,
learning.peebot.shop, tagging-sys.peebot.shop and xray.peebot.shop.
Root pages returned HTTP 200 except 9router, which returned HTTP 307.
Learning /api/health returned HTTP 200 with status ok. An empty login request with
the correct browser Origin reached request validation and returned HTTP 422 for
missing username/password. No real account login was performed.

The wildcard certificate expires on 2027-01-16. Its saved acme.sh renewal date is
2026-12-18. External expiry monitoring has not been configured.
