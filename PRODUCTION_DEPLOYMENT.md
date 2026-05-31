# Production Deployment Guide

This project is designed to run publicly with GitHub Pages serving the frontend and a Cloudflare Worker handling the `/api` Companion backend (catalogue + uploads). Follow the steps below to deploy everything without relying on a local machine.

## 1. Repository layout

- `docs/` — static frontend published to GitHub Pages.
- `cloudflare/worker.js` — Cloudflare Worker implementing the production API.
- `cloudflare/wrangler.toml` — Worker configuration for the production API route.
- `.github/workflows/pages.yml` — publishes `docs/` to GitHub Pages whenever `main` changes.
- `.github/workflows/cloudflare-worker.yml` — deploys the Worker.

## 2. Required infrastructure

1. **Cloudflare Pages custom domain**: `vortex-prime-emu.com` should point to the GitHub Pages site (already configured).
2. **Google Drive storage**: a service account with access to dedicated folders for packages, mods, icons, previews, readmes, and the catalogue JSON file.
3. **Cloudflare Worker route**: `vortex-prime-emu.com/api/*` mapped to the Worker defined in `cloudflare/worker.js`.

## 3. Cloudflare account secrets

Add these repository secrets under **GitHub → Settings → Secrets and variables → Actions**:

- `CF_ACCOUNT_ID` — Cloudflare Account ID.
- `CF_API_TOKEN` — API token with **Workers Scripts** and **Workers Routes** permissions.

The `cloudflare-worker.yml` workflow uses these secrets to deploy the Worker automatically.

### Cloudflare Worker secrets

In the Cloudflare dashboard (Workers → `vortex-prime-store-api` → Settings → Variables → Add binding → Secret text), add the following secrets using the real IDs from your Google Drive setup:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
DRIVE_DATABASE_FILE_ID
DRIVE_PACKAGES_FOLDER_ID
DRIVE_MODS_FOLDER_ID
DRIVE_ICONS_FOLDER_ID
DRIVE_PREVIEWS_FOLDER_ID
DRIVE_READMES_FOLDER_ID
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_ADMIN_EMAILS
SESSION_SECRET
```

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — Service account email with access to your Drive folders/files.
- `GOOGLE_PRIVATE_KEY` — The PEM-formatted private key for that service account (copy it from the JSON key file; do **not** commit the JSON to git).
- `DRIVE_DATABASE_FILE_ID` — File ID of `store-db.json` (copy from the Drive file URL).
- `DRIVE_*_FOLDER_ID` — Folder IDs for each upload bucket (create the folders once, share them with the service account, and copy each ID from its URL).
- `GOOGLE_OAUTH_CLIENT_ID` — Google OAuth 2.0 Web client ID used by Google Identity Services on the admin portal.
- `GOOGLE_ADMIN_EMAILS` — Comma-separated Google accounts (or domains prefixed with `@`) that should have admin-level catalogue access. Anyone else who signs in can upload but cannot publish or delete catalogue entries.
- `SESSION_SECRET` — Long random string for signing login cookies (minimum 32 characters).

## 4. Frontend configuration

The frontend reads the production API base URL from the `<meta name="vortex-companion-base-url">` tag in `docs/index.html` and `docs/admin/index.html`. Both are already set to:

```
https://vortex-prime-emu.com
```

You should not change these unless you move the backend.

## 5. Worker environment

The Worker (`cloudflare/worker.js`):

- Serves `/api/status`, `/api/catalogue/:mode`, `/api/uploads/:type`, `/api/auth/*`, and `/api/public/catalogue`.
- Stores catalogue JSON and uploaded files in Google Drive via the service account.
- Enforces CORS for:
  - `https://vortex-prime-emu.com`
  - `https://rileyadams05.github.io`

If you expose the site on additional domains, add them to `ALLOWED_ORIGINS`.

## 6. Deployment workflow

After pushing to `main`:

1. **Deploy GitHub Pages** (`.github/workflows/pages.yml`) uploads `docs/` and updates the public site.
2. **Deploy Cloudflare API** (`.github/workflows/cloudflare-worker.yml`) deploys the Worker using Wrangler.

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
   - Uploading packages creates files inside the Google Drive Packages folder.
   - Preview/icon uploads appear inside the Icons/Previews folders.
   - README uploads land in the Readmes folder and attach preview content to catalogue items.
   - The portal requires a Google sign-in. Admin emails (from `GOOGLE_ADMIN_EMAILS`) can publish/delete catalogue entries. Other signed-in Google accounts can upload assets but cannot modify live catalogue data.
5. Verify catalogue changes appear in the public store after refresh.

## 9. Storage considerations

Google Drive provides persistent storage. Uploaded files remain available across Worker restarts. Catalogue JSON is stored in Drive, so Worker deployments do not wipe content.

The permanent storage location is **My Drive → Vortex Prime Store**, which already contains the folders `Database`, `Icons`, `Mods`, `Packages`, `Previews`, and `Readmes`. Do not rename or recreate these folders—reference their existing IDs in the Worker secrets.

## 10. Local development (optional)

For local testing you can still run the Companion Express server (`companion-server/`), set `window.localStorage.setItem('vortex-companion-base-url', 'http://localhost:4100')`, and reload the page. Production does not rely on this.

## 11. Troubleshooting

- **Missing secrets**: the Worker deploy workflow will fail if `CF_ACCOUNT_ID`/`CF_API_TOKEN` are missing. The Worker itself will report missing Google Drive secrets on `/api/status`.
- **CORS errors**: add the new frontend domain to `ALLOWED_ORIGINS` inside `cloudflare/worker.js` and redeploy.
- **Uploads failing**: open `/api/status` and confirm all Drive secret checks pass. Ensure the service account has Editor access to every folder and the database file. If uploads fail with 401, sign in with Google again or verify `GOOGLE_OAUTH_CLIENT_ID` is correct.
- **Admin actions rejected**: confirm the Google account is listed in `GOOGLE_ADMIN_EMAILS`. You can set whole domains with entries like `@yourteam.com`.
- **Frontend still calling localhost**: ensure your production build of `docs/index.html` includes `<meta name="vortex-companion-base-url" content="https://vortex-prime-emu.com">`.

With these pieces in place, the site runs entirely online. You can remove the local repository after verifying the public deployment.
