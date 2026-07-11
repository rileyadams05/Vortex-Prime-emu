# Vortex Prime Store API

This Cloudflare Worker serves the production `/api` backend for the Vortex Prime Store using Cloudflare Workers + Google Drive storage.

## Why Uploads 404 Right Now

GitHub Pages can host the website files, but it cannot receive package uploads or save files.

If `https://vortex-prime-emu.com/api/status` returns anything other than JSON, the Worker configuration or Google Drive credentials are not deployed yet.

The Creator Portal becomes a proper live store only after this Worker is deployed.

## What You Need

- A Cloudflare account with `vortex-prime-emu.com` added as a website.
- Cloudflare Workers enabled.
- A Google Cloud Project with a service account that has access to the Drive folders you want to use.
- A Cloudflare API token for deployment.
- The GitHub repository secrets listed below.

You do not need users to download anything. This is only for deploying the website backend.

Required Cloudflare resources:

- Worker route: `vortex-prime-emu.com/api/*`
- Google Drive folders (IDs captured as secrets) for packages, mods, icons, previews, readmes, and the catalogue JSON file.

Required GitHub Actions secrets:

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`

After those secrets exist, pushing to `main` deploys the Worker automatically.

## GitHub Secrets

In GitHub:

1. Open the repository.
2. Go to `Settings`.
3. Go to `Secrets and variables`.
4. Open `Actions`.
5. Add these repository secrets:

```text
CF_ACCOUNT_ID
CF_API_TOKEN
```

`CF_ACCOUNT_ID` is your Cloudflare Account ID.

`CF_API_TOKEN` must allow Workers Scripts deploy and Workers Routes edit (R2 access is no longer required).

In Cloudflare, add these **Worker secrets** (Dashboard → Workers → your Worker → Settings → Variables → Add binding → Secret text):

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
STREAMZ_OAUTH_STATE_SECRET
STREAMZ_TWITCH_CLIENT_ID
STREAMZ_KICK_CLIENT_ID
STREAMZ_KICK_CLIENT_SECRET
```

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — The email for the service account that has Drive access.
- `GOOGLE_PRIVATE_KEY` — The PEM private key for that service account (copy it from the JSON key file; do **not** commit the JSON to git).
- `DRIVE_DATABASE_FILE_ID` — The file ID of `store-db.json` in Drive (copy from the file's URL).
- `DRIVE_*_FOLDER_ID` — Folder IDs for each upload bucket (create folders once in Drive, copy the ID from the URL, and make sure the service account has at least writer access).
- `GOOGLE_OAUTH_CLIENT_ID` — The OAuth 2.0 Web client ID used by Google Identity Services on the admin portal.
- `GOOGLE_ADMIN_EMAILS` — Comma-separated list of Google accounts (or domains prefixed with `@`) that should have admin rights for catalogue management.
- `SESSION_SECRET` — Random string used to sign auth cookies (at least 32 characters).
- `STREAMZ_OAUTH_STATE_SECRET` — Random string used to encrypt and validate Streamz OAuth state payloads (at least 32 characters).
- `STREAMZ_TWITCH_CLIENT_ID` — Twitch public client ID for Streamz. Twitch uses PKCE and does not require a client secret for this website callback flow.
- `STREAMZ_KICK_CLIENT_ID` / `STREAMZ_KICK_CLIENT_SECRET` — Kick app credentials for Streamz. Never commit the secret.

Optional Streamz OAuth Worker variables:

```
STREAMZ_TWITCH_REDIRECT_URI=https://vortex-prime-emu.com/projects/streamz/auth/twitch/callback
STREAMZ_KICK_REDIRECT_URI=https://vortex-prime-emu.com/projects/streamz/auth/kick/callback
STREAMZ_DEFAULT_DEEP_LINK=streamz://auth/callback
STREAMZ_ALLOWED_DEEP_LINK_SCHEMES=streamz
```

Set optional values in Cloudflare Worker variables if the defaults need to change. Do not put client secrets in website files, GitHub Pages files, or browser JavaScript.

## Deploy From GitHub

After the secrets are set:

```powershell
cd "D:\PROJECTS\Vortex-Prime-emu"
git push origin main
```

Then open GitHub Actions and run or re-run:

```text
Deploy Cloudflare API
```

When it works, these URLs should return JSON instead of 404:

```text
https://vortex-prime-emu.com/api/status
https://vortex-prime-emu.com/api/catalogue/store
https://vortex-prime-emu.com/api/catalogue/mods
```

## Google authentication setup

1. Create a Google Cloud OAuth 2.0 Web client ID for `https://vortex-prime-emu.com` (and `https://rileyadams05.github.io` if you preview from GitHub Pages).
2. Add the client ID value to the Worker secret `GOOGLE_OAUTH_CLIENT_ID`.
3. List every Google account (emails separated by commas) that should have full admin privileges in `GOOGLE_ADMIN_EMAILS`. You can include whole domains with entries like `@yourteam.com`.
4. Set `SESSION_SECRET` to a long random string so the Worker can sign authentication cookies securely.
5. The admin portal uses Google Identity Services. Users sign in from the portal; the Worker verifies the ID token server-side and issues a secure session cookie. Upload endpoints require a signed-in Google user, and catalogue mutations require the email to match `GOOGLE_ADMIN_EMAILS`.

## Streamz OAuth setup

The Streamz desktop app should start provider authorization through the Worker, then open the returned `authorizationUrl` in the user's browser.

Start endpoints:

```text
GET or POST https://vortex-prime-emu.com/api/streamz/auth/twitch/start
GET or POST https://vortex-prime-emu.com/api/streamz/auth/kick/start
```

Callback routes registered with the providers:

```text
https://vortex-prime-emu.com/projects/streamz/auth/twitch/callback
https://vortex-prime-emu.com/projects/streamz/auth/kick/callback
```

For Twitch and Kick, the Worker generates the PKCE verifier and challenge server-side and stores the verifier inside encrypted OAuth state. The browser callback page forwards only `code` and `state` to the Worker. The Worker validates state before exchanging authorization codes. Twitch uses public-client PKCE without a client secret. Kick uses server-side token exchange with `STREAMZ_KICK_CLIENT_SECRET`.

For secure desktop token handoff, Streamz can include a random 32-byte base64url `handoffKey` and a `returnTo` deep link when calling the `start` endpoint. The Worker encrypts the provider token response with that handoff key and sends only the encrypted payload back through the deep link.

## Google Drive preparation

1. Create a Google Cloud project (or reuse an existing one).
2. Create a service account and generate a JSON key. Keep this JSON file private.
3. In Google Drive, create a root folder for the store (e.g. `Vortex Prime Store`) and inside it create sub-folders for Packages, Mods, Icons, Previews, and Readmes plus a `store-db.json` file (copy the default from the repo).
4. Share each folder and the JSON file with the service account email (Editor access).
5. Copy each folder's ID from the URL and add it as the corresponding Worker secret listed above.
6. Copy the `store-db.json` file ID and set `DRIVE_DATABASE_FILE_ID` to that value.

## Manual Deploy From Your PC

This is optional. Use it only if you want to deploy without GitHub Actions.

Install Wrangler:

```powershell
npm install -g wrangler
```

Log in:

```powershell
wrangler login
```

Deploy the API:

```powershell
wrangler deploy
```

Then test:

```powershell
curl https://vortex-prime-emu.com/api/status
```
