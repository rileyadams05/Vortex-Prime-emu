# Vortex Prime Desktop

This is a small Tauri wrapper for the live Vortex Prime website:

https://vortex-prime-emu.com

It does not rebuild or bundle the website. The desktop app opens the live site in its own app-style window, so website changes are available automatically without releasing a new desktop build.

## Local Build

Install the Tauri prerequisites for your platform, then run:

```sh
cd desktop
npm ci
npm run build
```

Build outputs are written under:

```text
desktop/src-tauri/target/release/bundle/
```

## GitHub Releases

Push a tag named like `desktop-v0.1.0` to build release assets:

```sh
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

The release workflow builds:

- Windows NSIS `.exe` installer and MSI installer
- Linux AppImage
- macOS DMG

Windows is the primary target. Linux and macOS builds depend on GitHub runner support and Tauri platform requirements.
