# Production deployment and hosting

## Current architecture

- GitHub Pages serves the website from `docs/`.
- Cloudflare Worker `vortex-prime-store-api` handles the remaining API features.
- Cloudflare routes for `vortex-prime-emu.com/api`, `/api/*`, and `/privacy-policy` remain attached to that Worker. More specific routes, such as Turnstile verification, continue to use their own Workers.
- The community catalogue is the static file `docs/mods/mods.json`. The website does not use Google Drive or another external storage service for catalogue data.
- The catalogue currently contains no entries. Add published catalogue data to that JSON file through the normal repository review and deployment process.
- Community tutorial submissions and the old Drive-backed admin upload page are retired. Their Worker endpoints return HTTP 410.

## Cloudflare Worker deployment

The GitHub Actions workflow in `.github/workflows/cloudflare-worker.yml` deploys the `vortex-prime-store-api` Worker. It uploads a version with Wrangler, then promotes that version to 100% using the existing route attachment. This avoids changing Cloudflare zone routes during a normal code deployment.

Both Wrangler configurations identify the same Worker, entry point, compatibility date, existing route patterns, and Durable Object migration. The CI workflow uses `wrangler.ci.toml` and `--keep-vars` so dashboard-managed variables remain intact. Secrets are preserved by Cloudflare deployments.

Route changes are infrastructure changes: review the current Cloudflare attachment first and grant the deployment token Workers Routes Write only if automation must create or change routes. A normal Worker code update should not need to modify routes.

## Preserved legacy configuration

The Worker still contains and exposes account, Streamz, and ModX operations that use the same Drive-backed database. Catalogue and upload endpoints return HTTP 410, but the broader API has not been disabled because that could break sign-in and Streamz features. Until those routes are separately retired or migrated, do not describe the whole website API as Drive-free. Existing Cloudflare secrets, Workers, Durable Object namespaces, and stored records have deliberately not been deleted.

## Verification

After each production deployment, confirm the Actions run completes both the upload and promotion steps, then inspect the Worker Deployments page to confirm the new version serves 100% of traffic. Verify `/api` returns the Worker health response, the website loads `/mods/mods.json`, and retired storage endpoints return HTTP 410. A successful upload alone does not confirm production deployment.
