# Vortex Prime

The BGFT project card uses the pinned `@khmyznikov/pwa-install` 0.7.0 component for BGFT's device-aware PWA install flow. The GitHub Pages workflow vendors the package bundle and MIT licence into the generated site at deploy time. See [third-party notices](THIRD_PARTY_NOTICES.md).

Vortex Prime is a collection of console tools, PlayStation HEN hosts, mods, games, and related projects.

## Website

The production website is published from `docs/` through GitHub Pages.

Main areas include:

- PlayStation 3 HEN and PlayStation 4 GoldHEN hosts
- ModX Cheat Tables
- Xbox exploit resources
- Games and Vortex Prime projects
- Streamz project overview and support
- Help, privacy, and legal pages

## PlayStation shortcut links

The PlayStation HEN pages remain available for console testing through the existing Bitly shortcuts:

- PS4 GoldHEN: `bit.ly/PS4-hen`
- PS3 HEN: `bit.ly/PS3-hen`

## Development

Install dependencies and run the project tests with:

```powershell
npm install
npm test
```

The website is deployed automatically when changes reach the `main` branch.

