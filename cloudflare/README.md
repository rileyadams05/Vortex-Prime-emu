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
```

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — The email for the service account that has Drive access.
- `GOOGLE_PRIVATE_KEY` — The PEM private key for that service account (copy it from the JSON key file; do **not** commit the JSON to git).
- `DRIVE_DATABASE_FILE_ID` — The file ID of `store-db.json` in Drive (copy from the file's URL).
- `DRIVE_*_FOLDER_ID` — Folder IDs for each upload bucket (create folders once in Drive, copy the ID from the URL, and make sure the service account has at least writer access).

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
