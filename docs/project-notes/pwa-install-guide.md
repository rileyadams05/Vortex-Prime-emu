# Vortex Prime — PWA Install Guide

This document explains how to install the Vortex Prime app on any device and platform.

Vortex Prime is a **Progressive Web App (PWA)**. It installs directly from the website — no app store, no download file, no installer. After installation, the app updates itself automatically whenever a new version is deployed. You never need to reinstall it for a normal update.

---

## What you get after installing

- The app appears on your home screen or taskbar like a native app
- It launches in full-screen standalone mode (no browser chrome)
- It works offline for previously visited pages
- Updates arrive silently and automatically in the background
- No manual reinstall required for updates

---

## Platform instructions

### Windows — Chrome or Edge

1. Open **https://vortex-prime-emu.com** in Chrome or Edge
2. Look for the **install icon (⊕)** in the address bar on the right side
3. Click it and select **Install**
4. The app appears in your Start menu and taskbar

Alternatively: click the browser menu (⋮ or …) → **Cast, save and share** → **Install page as app**

---

### Linux — Chrome / Chromium / Edge

1. Open **https://vortex-prime-emu.com** in Chrome, Chromium, or Edge
2. Click the **install icon (⊕)** in the address bar, or open the browser menu → **Install Vortex Prime**
3. The app installs to your application launcher

> **Note:** Firefox on Linux does not support PWA installation.

---

### macOS — Chrome or Edge

1. Open **https://vortex-prime-emu.com** in Chrome or Edge
2. Click the **install icon (⊕)** in the address bar
3. Select **Install**
4. The app appears in your Applications folder and Dock

> **Note:** Safari on macOS does not support full standalone PWA installation. Use Chrome or Edge on macOS for the best experience.

---

### Android — Chrome

1. Open **https://vortex-prime-emu.com** in **Chrome**
2. Tap the browser menu (⋮) → **Add to Home screen** or **Install app**
3. Confirm by tapping **Install**
4. The app icon appears on your home screen and launches in full-screen standalone mode

> **Note:** The install option may also appear as a banner at the bottom of the screen automatically.

---

### iPhone / iPad — Safari only

> ⚠️ **Important:** On iPhone and iPad, only **Safari** can install PWAs. Chrome, Firefox, and other browsers on iOS cannot install home screen apps due to an Apple platform restriction.

1. Open **https://vortex-prime-emu.com** in **Safari**
2. Tap the **Share button** (the square with an arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Optionally change the app name, then tap **Add**
5. The Vortex Prime icon appears on your home screen

Tap the icon to open the app in full-screen mode without the Safari browser interface.

> **iOS version note:** Full standalone PWA features (including service worker offline support) work best on iOS 16.4 and later.

---

## Updates

You **do not need to reinstall** when a new version is released.

The app uses a service worker to manage caching. When a new version is deployed:

- The service worker detects the change automatically
- Old cached files are removed
- New files are loaded on the next open or navigation

**The update happens silently.** You will see the new version the next time you open the app or navigate within it. No action required from you.

### If the app seems stuck on an old version

1. **Close and reopen** the app fully (swipe it away from your app switcher and reopen)
2. If that doesn't work: open the site in your browser → Settings → Site settings → **Clear storage** for `vortex-prime-emu.com`

This should be rare. The service worker is designed to update automatically without intervention.

---

## Frequently asked questions

**Do I need to download anything from GitHub Releases?**  
No. Normal updates happen automatically through the service worker. GitHub Releases contains install instructions, release notes, and changelogs — not files you need to download for the app to work.

**Can I install it on multiple devices?**  
Yes. Install from the website on each device independently.

**Does it work offline?**  
Partially. Previously visited pages are cached and available offline. Live data (store catalogue, user accounts) requires a connection.

**Will I lose my data if I reinstall?**  
Local profile data is stored in your browser's storage for that device. Uninstalling and reinstalling the PWA (clearing site data) will clear local preferences. Account data stored on the server is not affected.

**Is there a version number I can check?**  
The deployed version is visible in the page source as `<meta name="version">`. The active service worker cache name contains the build timestamp and is visible in browser DevTools under Application → Service Workers.

---

## Reporting issues

If the app is broken or not updating correctly:

- **Reddit:** [r/Vortex_Prime_HB_store](https://www.reddit.com/r/Vortex_Prime_HB_store/)
- **Discord:** [discord.gg/TwMsbb97Mm](https://discord.gg/TwMsbb97Mm)
- **Email:** vortex.prime.team@outlook.com
- **GitHub Issues:** [github.com/rileyadams05/Vortex-Prime-emu/issues](https://github.com/rileyadams05/Vortex-Prime-emu/issues)
