# Vortex Prime Store

The official community dashboard store for **Vortex Prime EMU**.

🌐 **Live Site:** https://rileyadams05.github.io/Vortex-Prime-emu/store/

---

## How It Works

### For Players
1. Open **Vortex Prime UI** in the app → click the ⭐ star button
2. Choose **"View / Download Dashboards"** — the store opens in Chrome
3. Find a dashboard you like
4. Click **"Copy"** to copy the install code (e.g. `INSTALL_DASHBOARD:VP-STORE-CLASSIC-BLADES-4200`)
5. Paste it into the **Vortex Prime UI** chat
6. The AI automatically installs the dashboard and restarts

### For Creators
1. Open the store → click **"Upload Dashboard"**
2. Fill in your dashboard details and attach your `.zip`
3. Your submission goes to this repository first for review
4. Once approved, it appears in the store with its own unique install code

---

## Dashboard Package Format

Your `.zip` must contain:
```
my-dashboard/
  manifest.json       ← Required: metadata
  preview.png         ← Required: 1280×720 screenshot
  theme.css           ← Your dashboard styles
  config.json         ← Theme configuration
  assets/             ← Any images, fonts, sounds
```

### manifest.json
```json
{
  "id": "my-dashboard",
  "name": "My Dashboard Name",
  "author": "YourGamertag",
  "version": "1.0.0",
  "description": "Short description",
  "tags": ["Dark", "Sci-Fi"],
  "install_target": "themes/store/my-dashboard"
}
```

---

## Install Code Format

Every approved dashboard gets a unique code:
```
VP-STORE-[NAME]-[VERSION]
```
Example: `VP-STORE-CLASSIC-BLADES-4200`

The AI install command format:
```
INSTALL_DASHBOARD:VP-STORE-CLASSIC-BLADES-4200
```

---

## Folder Structure

```
store/
  index.html          ← Store website (GitHub Pages)
  dashboards/         ← Dashboard metadata JSON files
  packages/           ← Dashboard .zip packages
  thumbnails/         ← Preview images
  README.md           ← This file
```
