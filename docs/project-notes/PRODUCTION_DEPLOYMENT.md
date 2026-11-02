# Production deployment and hosting

## Current architecture

- GitHub Pages serves the public website from `docs/`.
- Cloudflare Worker `vortex-prime-store-api` handles the retained API endpoints.
- The production Worker has routes for `vortex-prime-emu.com/api`, `/api/*`, `/api*`, and `/privacy-policy`. The `/api*` route is needed because Cloudflare route matching includes the query string; the former exact `/api` route did not catch requests such as `/api?check=1`.
- The separate Community Mods catalogue page and its static JSON feed have been removed.
- Website account sign-in, Google identity, Drive-backed website storage, legacy catalogue/upload routes, and the old ModX API submission routes are retired. The Worker returns HTTP 410 for those endpoints.
- The ModX website submission experience is being rebuilt to use GitHub sign-in and a form that prepares a change for owner review. The form is not live until the required fields and submission behavior are finalized.
- Existing Cloudflare secrets, Workers, Durable Object namespaces, and stored records were left in place. This cleanup does not delete data or infrastructure.

## Cloudflare Worker deployment

The GitHub Actions workflow in `.github/workflows/cloudflare-worker.yml` deploys the `vortex-prime-store-api` Worker. It uploads a version with Wrangler, then promotes that version to 100% using the existing route attachment. This avoids changing Cloudflare zone routes during a normal code deployment.

Both Wrangler configurations identify the same Worker, entry point, compatibility date, route patterns, and Durable Object migration. The CI workflow uses `wrangler.ci.toml` and `--keep-vars` so dashboard-managed variables remain intact. Secrets are preserved by Cloudflare deployments.

Route changes are infrastructure changes: review the current Cloudflare attachment first. A normal Worker code update should not need to modify routes.

## Preserved legacy configuration

Historical account, Streamz, and ModX records and Cloudflare secrets remain untouched. The website no longer exposes sign-in or uses Google Drive for requests. Some older backend source remains in the repository for historical reference, but retired public routes return HTTP 410. No Cloudflare Worker, DNS record, database, or storage resource was deleted.

## Verification

After each production deployment, confirm the Actions run completes both version upload and promotion, then inspect the Worker Deployments page to confirm the current version serves 100% of traffic. Verify `/api` and `/api?check=1` reach the Worker, retired account/catalogue/ModX endpoints return HTTP 410, and the public site has no Community Mods page.
