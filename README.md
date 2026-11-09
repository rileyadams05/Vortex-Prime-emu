# Vortex Prime

Vortex Prime currently maintains four projects:

- **NXE** — an Aurora-inspired Xbox dashboard for Developer Mode.
- **ModX** — cheat tables and their publishing integrations.
- **FPKG Builder** — Linux tooling for building PS4 fPKGs.
- **BGFT Service** — a browser/PWA interface for installing user-supplied PS4 packages through BGFT.

The static website is published from `docs/` by GitHub Pages. The Pages workflow vendors the pinned PWA install component and fetches the BGFT web app from its official repository at deploy time. Cloudflare Workers provide the retained API and ModX integrations.

## Development

Install dependencies and run the active-project regression suite:

```powershell
npm ci
npm test
```

GitHub Pages deploys when relevant website files change on `main`. Cloudflare Workers deploy from the existing Cloudflare workflow when `cloudflare/` changes.