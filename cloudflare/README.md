# Vortex Prime Store API

This Cloudflare Worker provides the live `/api` used by the Vortex Prime Store Creator Portal.

It stores uploaded packages, icons, previews, and README files in Cloudflare R2, then serves the live store catalog from the same API.

Required Cloudflare resources:

- R2 bucket: `vortex-prime-store-uploads`
- Worker route: `vortex-prime-emu.com/api/*`

Required GitHub Actions secrets:

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`

After those secrets exist, pushing to `main` deploys the Worker automatically.
