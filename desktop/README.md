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

## Manual GitHub Releases

Build locally, copy the finished files into the root `release-builds/` folder, then manually upload the files you want to a GitHub Release.

The current local release folder layout is:

```text
release-builds/
  Windows/
    x64/
    x86/
    x32/
    ARM64/
  Linux/
    x64/
    ARM64/
  macOS/
    Intel/
    Apple-Silicon/
```

The GitHub Actions desktop workflow is manual-only and does not publish release assets automatically.

Windows is the primary target. Local Windows builds currently produce:

- Windows x64 NSIS installer, MSI installer, and portable `.exe`
- Windows x86 32-bit NSIS installer, MSI installer, and portable `.exe`

Linux and macOS builds depend on platform-specific runner support and Tauri platform requirements.
