# Vortex Prime API

The Cloudflare Worker in this folder serves the production API for Vortex Prime.

It supports:

- Mods catalogue and uploads
- Authentication and user sessions
- NXE pairing/session APIs
- ModX publishing, authentication, catalogue, and submission APIs
- Compatibility redirects for established public routes

## Configuration

Use `wrangler.toml` for local development and `wrangler.ci.toml` for automated deployment. Copy `.env.example` when preparing local secrets; do not commit real credentials.

Deployments run through `.github/workflows/cloudflare-worker.yml`.
