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
2. **Google Drive storage**: your personal Google account with access to dedicated folders for packages, mods, icons, previews, readmes, and the catalogue JSON file.
3. **Cloudflare Worker route**: `vortex-prime-emu.com/api/*` mapped to the Worker defined in `cloudflare/worker.js`.

## 3. Cloudflare account secrets

Add these repository secrets under **GitHub → Settings → Secrets and variables → Actions**:

- `CF_ACCOUNT_ID` — Cloudflare Account ID.
- `CF_API_TOKEN` — API token with **Workers Scripts** and **Workers Routes** permissions.

The `cloudflare-worker.yml` workflow uses these secrets to deploy the Worker automatically.

### Cloudflare Worker secrets

In the Cloudflare dashboard (**Workers → `vortex-prime-store-api` → Settings → Variables → Add binding → Secret text**), add the following secrets:

```
GOOGLE_DRIVE_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET
GOOGLE_DRIVE_REFRESH_TOKEN
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

| Secret | Description |
|--------|-------------|
| `GOOGLE_DRIVE_CLIENT_ID` | OAuth 2.0 Web Client ID (from Google Cloud Console) used by the Worker to get Drive access tokens. |
| `GOOGLE_DRIVE_CLIENT_SECRET` | OAuth 2.0 Web Client Secret matching the above Client ID. |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Long-lived refresh token tied to the personal Google account that owns the 5 TB Drive. See section 4 below for how to obtain this. |
| `DRIVE_DATABASE_FILE_ID` | File ID of `store-db.json` (copy from the Drive file URL). |
| `DRIVE_PACKAGES_FOLDER_ID` | Folder ID for the Packages upload bucket. |
| `DRIVE_MODS_FOLDER_ID` | Folder ID for the Mods upload bucket. |
| `DRIVE_ICONS_FOLDER_ID` | Folder ID for the Icons upload bucket. |
| `DRIVE_PREVIEWS_FOLDER_ID` | Folder ID for the Previews upload bucket. |
| `DRIVE_READMES_FOLDER_ID` | Folder ID for the Readmes upload bucket. |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth 2.0 client ID used by the website for user sign-in (Google Identity Services). This can be the same or a different OAuth client from `GOOGLE_DRIVE_CLIENT_ID`. |
| `GOOGLE_ADMIN_EMAILS` | Comma-separated list of Google accounts (or domains prefixed with `@`) that have admin-level catalogue access. |
| `SESSION_SECRET` | Long random string for signing login cookies (minimum 32 characters). |

**Secrets you can delete** (no longer needed after switching to OAuth):

```
GOOGLE_SERVICE_ACCOUNT_EMAIL  ← remove from Worker secrets
GOOGLE_PRIVATE_KEY            ← remove from Worker secrets
```

## 4. Obtaining a Google Drive OAuth refresh token (one-time setup)

The Worker uses your personal Google account to upload files to Drive, which means you must authorise the OAuth client once and store the resulting refresh token as a Worker secret.

Before generating the token, open **Google Auth Platform → Audience** for the `vortex-prime` project. If the publishing status is **Testing**, click **Publish app** and confirm. Drive refresh tokens issued while an External app is still in Testing expire after 7 days.

### Step-by-step using Google OAuth 2.0 Playground

1. Open [https://developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
2. Click the **⚙️ gear icon** (top right) → enable **"Use your own OAuth credentials"**
3. Enter your **OAuth 2.0 Client ID** and **Client Secret** from Google Cloud Console
   - The OAuth client must be type **Web application**
   - `https://developers.google.com/oauthplayground` must be listed under **Authorised redirect URIs** in that client's settings
4. In the left-hand scope list, find **Drive API v3** and select: `https://www.googleapis.com/auth/drive`
5. Click **Authorize APIs** and sign in with the **personal Google account that owns the Drive folders** (the one with the 5 TB quota)
6. Click **Exchange authorization code for tokens**
7. Copy the value of `refresh_token` from the JSON response — this is your `GOOGLE_DRIVE_REFRESH_TOKEN`

> **Important**: the refresh token is only long-lived when the Google OAuth consent screen is in production. Google expires refresh tokens after 7 days for External apps left in Testing when they request Drive scopes. Publish the OAuth consent screen, then generate a new `GOOGLE_DRIVE_REFRESH_TOKEN`. Store it only in Cloudflare Worker Secrets, never in source code or environment files.

### Notes

- The OAuth client used for Drive uploads (`GOOGLE_DRIVE_CLIENT_ID`) does not need to be the same client used for website login (`GOOGLE_OAUTH_CLIENT_ID`), but it can be.
- Uploaded files will be owned by your personal Google account, not a service account, so they count against your 5 TB quota as intended.
- Folder IDs are unchanged — the Worker continues to use the existing `Packages`, `Mods`, `Icons`, `Previews`, `Readmes`, and `Database` folders.
- If `/api/status` reports that Google Drive authorization has expired or been revoked, check **Google Cloud Console → APIs & Services → OAuth consent screen → Publishing status**. If it says **Testing**, publish it before generating the replacement refresh token.

## 4a. Cross-Account Protection

The Worker exposes a Google Cross-Account Protection receiver at:

```text
https://vortex-prime-emu.com/api/risc/events
```

It validates Google security-event JWTs against Google's RISC discovery document and accepts valid events with HTTP 202. If a Cloudflare KV binding named `RISC_EVENTS_KV` is added later, the Worker also stores received event IDs and rejected Google subject IDs so matching sessions can be blocked.

To register the receiver after deploying the Worker:

```powershell
node register-risc-stream.mjs
```

The service account in `MY-google-ID/vortex-prime-drive-worker-key.json` must have the Google role `roles/riscconfigs.admin`, and the RISC API must be enabled for the same Google Cloud project.

## 5. Frontend configuration

The frontend reads the production API base URL from the `<meta name="vortex-companion-base-url">` tag in `docs/index.html` and `docs/admin/index.html`. Both are already set to:

```
https://vortex-prime-emu.com
```

You should not change these unless you move the backend.

## 6. Worker environment

The Worker (`cloudflare/worker.js`):

- Serves `/api/status`, `/api/catalogue/:mode`, `/api/uploads/:type`, `/api/auth/*`, and `/api/public/catalogue`.
- Stores catalogue JSON and uploaded files in Google Drive using your personal account's OAuth credentials.
- Enforces CORS for:
  - `https://vortex-prime-emu.com`
  - `https://rileyadams05.github.io`

If you expose the site on additional domains, add them to `PRODUCTION_ORIGINS` at the top of `cloudflare/worker.js`.

## 7. Deployment workflow

After pushing to `main`:

1. **Deploy GitHub Pages** (`.github/workflows/pages.yml`) uploads `docs/` and updates the public site.
2. **Deploy Cloudflare API** (`.github/workflows/cloudflare-worker.yml`) deploys the Worker using Wrangler.

Both workflows run automatically on every push to `main` (and can be triggered manually via the Actions tab).

## 8. Manual Worker deployment (optional for debugging)

```powershell
cd cloudflare
wrangler login
wrangler deploy
```

This requires the same Cloudflare account and token permissions. The GitHub Actions workflow remains the source of record.

## 9. Verifying production

Once the workflows finish:

1. Visit `https://vortex-prime-emu.com` and ensure the frontend loads without console errors.
2. Confirm the API status endpoint returns JSON with `configured: true` and `googleAuthorized: true`:
   - `https://vortex-prime-emu.com/api/status`
3. Confirm catalogue endpoints return JSON arrays:
   - `https://vortex-prime-emu.com/api/catalogue/store`
   - `https://vortex-prime-emu.com/api/catalogue/mods`
4. Test uploads through the admin portal (`https://vortex-prime-emu.com/admin/`):
   - Sign in with a Google account listed in `GOOGLE_ADMIN_EMAILS`.
   - Uploading packages creates files inside the Google Drive Packages folder, owned by your personal Google account.
   - Preview/icon uploads appear inside the Icons/Previews folders.
   - README uploads land in the Readmes folder and attach preview content to catalogue items.
5. Verify catalogue changes appear in the public store after refresh.

## 10. Storage considerations

Google Drive provides persistent storage. Uploaded files remain available across Worker restarts. Catalogue JSON is stored in Drive, so Worker deployments do not wipe content.

The permanent storage location is **My Drive → Vortex Prime Store**, which already contains the folders `Database`, `Icons`, `Mods`, `Packages`, `Previews`, and `Readmes`. Do not rename or recreate these folders — reference their existing IDs in the Worker secrets.

Files are uploaded using your personal Google account OAuth token, so they count against your personal storage quota (5 TB) and are owned by you, not a service account.

## 11. Production runtime

The frontend uses the production Companion and API routes under `https://vortex-prime-emu.com`. Do not configure browser storage overrides for alternate API hosts in the deployed site.

## 12. Troubleshooting

- **Missing secrets**: the Worker deploy workflow will fail if `CF_ACCOUNT_ID`/`CF_API_TOKEN` are missing. The Worker itself will report missing Google Drive secrets on `/api/status`.
- **CORS errors**: add the new frontend domain to `PRODUCTION_ORIGINS` inside `cloudflare/worker.js` and redeploy.
- **Uploads or catalogues failing with a token error**: verify `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and `GOOGLE_DRIVE_REFRESH_TOKEN` are set correctly in Cloudflare Worker Secrets. If the OAuth consent screen is still in Testing, publish it first; otherwise the replacement refresh token can expire again after 7 days.
- **Admin actions rejected**: confirm the Google account is listed in `GOOGLE_ADMIN_EMAILS`. You can set whole domains with entries like `@yourteam.com`.
- **Frontend API routing**: ensure the production build of `docs/index.html` includes `<meta name="vortex-companion-base-url" content="https://vortex-prime-emu.com">`.

With these pieces in place, the site runs entirely online. You can remove the local repository after verifying the public deployment.
