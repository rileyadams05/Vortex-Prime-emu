# Vortex Prime Store API

This Cloudflare Worker serves the production `/api` backend for the Vortex Prime Store using Cloudflare Workers + R2.

## Why Uploads 404 Right Now

GitHub Pages can host the website files, but it cannot receive package uploads or save files.

If `https://vortex-prime-emu.com/api/status` returns anything other than JSON, the Worker or R2 storage is not deployed yet.

The Creator Portal becomes a proper live store only after this Worker is deployed.

## What You Need

- A Cloudflare account with `vortex-prime-emu.com` added as a website.
- Cloudflare Workers enabled.
- Cloudflare R2 enabled.
- A Cloudflare API token for deployment.
- The GitHub repository secrets listed below.

You do not need users to download anything. This is only for deploying the website backend.

Required Cloudflare resources:

- Worker route: `vortex-prime-emu.com/api/*`
- R2 bucket: `vortex-prime-store-uploads`

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

`CF_API_TOKEN` must allow Workers Scripts deploy, Workers Routes edit, and R2 read/write access.

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
