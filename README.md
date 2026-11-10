# Vortex Prime

Vortex Prime currently maintains three projects:

- **NXE** — an Aurora-inspired Xbox dashboard for Developer Mode.
- **ModX** — a Windows desktop trainer library for discovering games and saving running-process selections. Community table execution is not connected yet.
- **FPKG Builder** — Linux tooling for building PS4 fPKGs.

The static website is published from `docs/` by GitHub Pages. Cloudflare Workers provide the retained API and ModX integrations. The ModX homepage card retrieves its latest public release and installer assets from the GitHub Releases API.

## Development

Install dependencies and run the active-project regression suite:

```powershell
npm ci
npm test
```

GitHub Pages deploys when relevant website files change on `main`. Cloudflare Workers deploy from the existing Cloudflare workflow when `cloudflare/` changes.
