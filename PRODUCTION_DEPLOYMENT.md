# Production Deployment Guide

This project is designed to run publicly with GitHub Pages serving the frontend and a Cloudflare Worker handling the `/api` Companion backend (catalogue + uploads). Follow the steps below to deploy everything without relying on a local machine.

## 1. Repository layout

- `docs/` — static frontend published to GitHub Pages.
- `cloudflare/worker.js` — Cloudflare Worker implementing the production API.
- `cloudflare/wrangler.toml` — Worker configuration (routes + R2 bindings).
- `.github/workflows/pages.yml` — publishes `docs/` to GitHub Pages whenever `main` changes.
- `.github/workflows/cloudflare-worker.yml` — deploys the Worker + R2 bucket.

## 2. Required infrastructure

1. **Cloudflare Pages custom domain**: `vortex-prime-emu.com` should point to the GitHub Pages site (already configured).
2. **Cloudflare R2 bucket**: `vortex-prime-store-uploads`. The GitHub Action creates it automatically on the first run if it does not exist.
3. **Cloudflare Worker route**: `vortex-prime-emu.com/api/*` mapped to the Worker defined in `cloudflare/worker.js`.

## 3. Cloudflare account secrets

Add these repository secrets under **GitHub → Settings → Secrets and variables → Actions**:

- `CF_ACCOUNT_ID` — Cloudflare Account ID.
- `CF_API_TOKEN` — API token with **Workers Scripts**, **Workers Routes**, and **R2 Storage (Read/Write)** permissions.

The `cloudflare-worker.yml` workflow uses these secrets to create the R2 bucket and deploy the Worker automatically.

## 4. Frontend configuration

The frontend reads the production API base URL from the `<meta name="vortex-companion-base-url">` tag in `docs/index.html` and `docs/admin/index.html`. Both are already set to:

```
https://vortex-prime-emu.com
```

You should not change these unless you move the backend.

## 5. Worker environment

The Worker (`cloudflare/worker.js`):

- Serves `/api/status`, `/api/catalogue/:mode`, `/api/uploads/:type`, `/api/assets/*`, and `/api/public/catalogue`.
- Stores catalogue JSON and uploaded files in Cloudflare R2 (`vortex-prime-store-uploads`).
- Enforces CORS for:
  - `https://vortex-prime-emu.com`
  - `https://rileyadams05.github.io`

If you expose the site on additional domains, add them to `ALLOWED_ORIGINS`.

## 6. Deployment workflow

After pushing to `main`:

1. **Deploy GitHub Pages** (`.github/workflows/pages.yml`) uploads `docs/` and updates the public site.
2. **Deploy Cloudflare API** (`.github/workflows/cloudflare-worker.yml`) ensures the R2 bucket exists, then deploys the Worker using Wrangler.

Both workflows run automatically on every push to `main` (and can be triggered manually via the Actions tab).

## 7. Manual Worker deployment (optional for debugging)

```powershell
cd cloudflare
wrangler login
wrangler deploy
```

This requires the same Cloudflare account and token permissions. The GitHub Actions workflow remains the source of record.

## 8. Verifying production

Once the workflows finish:

1. Visit `https://vortex-prime-emu.com` and ensure the frontend loads without console errors.
2. Confirm the API status endpoint returns JSON:
   - `https://vortex-prime-emu.com/api/status`
3. Confirm catalogue endpoints return JSON arrays:
   - `https://vortex-prime-emu.com/api/catalogue/store`
   - `https://vortex-prime-emu.com/api/catalogue/mods`
4. Test uploads through the admin portal (`https://vortex-prime-emu.com/admin/`):
   - Uploading packages stores files in R2 (`uploads/packages/...`).
   - Preview/icon uploads appear under `uploads/previews` and `uploads/icons`.
   - README uploads become `uploads/readmes` objects.
5. Verify catalogue changes appear in the public store after refresh.

## 9. Storage considerations

Cloudflare R2 provides persistent object storage. Uploaded files remain available across Worker restarts. Catalogue JSON is also stored in R2, so Worker deployments do not wipe content.

## 10. Local development (optional)

For local testing you can still run the Companion Express server (`companion-server/`), set `window.localStorage.setItem('vortex-companion-base-url', 'http://localhost:4100')`, and reload the page. Production does not rely on this.

## 11. Troubleshooting

- **Missing secrets**: the Worker deploy workflow will fail with `Failed to fetch auth token` or `No such binding`. Ensure `CF_ACCOUNT_ID` and `CF_API_TOKEN` are defined and the token has R2 + Workers permissions.
- **CORS errors**: add the new frontend domain to `ALLOWED_ORIGINS` inside `cloudflare/worker.js` and redeploy.
- **Uploads returning 404**: confirm the R2 bucket name is `vortex-prime-store-uploads` and the Worker route includes `/api/assets/*`.
- **Frontend still calling localhost**: ensure your production build of `docs/index.html` includes `<meta name="vortex-companion-base-url" content="https://vortex-prime-emu.com">`.

With these pieces in place, the site runs entirely online. You can remove the local repository after verifying the public deployment.
