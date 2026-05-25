# Vortex Prime Store API

This Cloudflare Worker provides the live `/api` used by the Vortex Prime Store Creator Portal.

It stores uploaded packages, icons, previews, and README files in Cloudflare R2, then serves the live store catalog from the same API.

## Why Uploads 404 Right Now

GitHub Pages can host the website files, but it cannot receive package uploads or save files.

If `https://vortex-prime-emu.com/api/store/themes` returns 404, the Worker API has not been deployed or the route is not connected to the domain yet.

The Creator Portal becomes a proper live store only after this Worker is deployed.

## What You Need

- A Cloudflare account with `vortex-prime-emu.com` added as a website.
- Cloudflare Workers enabled.
- Cloudflare R2 enabled.
- A Cloudflare API token for deployment.
- The GitHub repository secrets listed below.

You do not need users to download anything. This is only for deploying the website backend.

Required Cloudflare resources:

- R2 bucket: `vortex-prime-store-uploads`
- Worker route: `vortex-prime-emu.com/api/*`

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

`CF_API_TOKEN` should allow:

- Workers Scripts edit/deploy.
- Workers Routes edit.
- R2 bucket read/write.

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

When it works, this URL should return JSON instead of 404:

```text
https://vortex-prime-emu.com/api/store/themes
```

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

Create the R2 bucket:

```powershell
cd "D:\PROJECTS\Vortex-Prime-emu\cloudflare"
wrangler r2 bucket create vortex-prime-store-uploads
```

Deploy the API:

```powershell
wrangler deploy
```

Then test:

```powershell
curl https://vortex-prime-emu.com/api/store/themes
```
