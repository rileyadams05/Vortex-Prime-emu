# Vortex Prime Store API

This Cloudflare Worker proxies the `/api` calls from the static site to the running Companion backend.

## Why Uploads 404 Right Now

GitHub Pages can host the website files, but it cannot receive package uploads or save files.

If `https://vortex-prime-emu.com/api/status` returns 502, the Worker is not able to reach the upstream Companion origin.

The Creator Portal becomes a proper live store only after this Worker is deployed.

## What You Need

- A Cloudflare account with `vortex-prime-emu.com` added as a website.
- Cloudflare Workers enabled.
- A Cloudflare API token for deployment.
- The GitHub repository secrets listed below.

You do not need users to download anything. This is only for deploying the website backend.

Required Cloudflare resources:

- Worker route: `vortex-prime-emu.com/api/*`

Required GitHub Actions secrets:

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`
- `CF_WORKER_COMPANION_ORIGIN`

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
CF_WORKER_COMPANION_ORIGIN
```

`CF_ACCOUNT_ID` is your Cloudflare Account ID.

`CF_API_TOKEN` should allow:

- Workers Scripts edit/deploy.
- Workers Routes edit.

`CF_WORKER_COMPANION_ORIGIN` should contain the full URL of the running Companion backend (for example `https://companion.vortex-prime-emu.com`). The GitHub workflow copies this secret into the Worker as `COMPANION_ORIGIN`.

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

Deploy the API:

```powershell
wrangler deploy
```

Then test:

```powershell
curl https://vortex-prime-emu.com/api/status
```
