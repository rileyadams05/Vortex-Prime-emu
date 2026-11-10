# Production deployment and hosting

## Current architecture

- GitHub Pages serves the public website from `docs/`.
- Cloudflare Worker `vortex-prime-store-api` handles the retained API endpoints.
- The production Worker retains the configured API routes and NXE pairing Durable Object. The `/api*` route catches API requests with query strings as well as path segments.
- GitHub Pages publishes the current project site directly from `docs/`; deployment has no BGFT repository checkout or BGFT asset generation.
- The public site is focused on NXE, ModX, and FPKG Builder. The legacy `/bgft/` path displays a retirement notice and clears only BGFT-scoped application caches.
- Cloudflare DNS, Worker secrets, Durable Object namespaces, and stored records are managed in Cloudflare and are not recreated by the site cleanup.

## Cloudflare Worker deployment

The GitHub Actions workflow in `.github/workflows/cloudflare-worker.yml` deploys the `vortex-prime-store-api` Worker. It uploads a version with Wrangler, then promotes that version to 100% using the existing route attachment. This avoids changing Cloudflare zone routes during a normal code deployment.

Both Wrangler configurations identify the same Worker, entry point, compatibility date, route patterns, and Durable Object migration. The CI workflow uses `wrangler.ci.toml` and `--keep-vars` so dashboard-managed variables remain intact. Secrets are preserved by Cloudflare deployments.

Route changes are infrastructure changes: review the current Cloudflare attachment first. A normal Worker code update should not need to modify routes.

## Preserved Cloudflare configuration

The cleanup does not change the domain, DNS, SSL/TLS settings, Worker bindings, required secrets, or stored records. Both Wrangler files preserve the production Worker name, entry point, API routes, and NXE Durable Object migration. The historical `/privacy-policy` route redirects to `/privacy/`.

## Verification

After each production deployment, confirm the Actions run completes Pages deployment and Cloudflare cache purge. For Worker changes, confirm version upload and promotion, then inspect Cloudflare to verify the current version serves traffic. Verify the project cards, the FPKG and ModX latest-release dialogs, and the ModX Cheat Tables route on desktop and mobile.
