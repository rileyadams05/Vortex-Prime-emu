# Vortex Prime EMU - PRD

## Original Problem Statement
Replicate and surpass the Xbox 360 Dashboard experience (NXE/Blades) as a Tauri desktop application. High-fidelity UI with full controller support, Guide overlay, sound effects, custom font, and Xbox 360 aesthetics.

## Architecture
- **Frontend**: React + Tailwind + custom CSS
- **Backend**: FastAPI + MongoDB + Theme filesystem + SteamGridDB proxy
- **Controller**: GamepadProvider (React Context) -> useGamepad() hook
- **Theme System**: Folder-based with layout.json in /Themes/Play and /Themes/Disabled
- **SteamGridDB**: Backend proxy -> SteamGridDB API v2 (key: 4b66ee...)
- **AI**: Open WebUI integration (localhost:8080 in Tauri, mock fallback in web)
- **Audio**: Xbox-authentic WAV sounds via soundManager.js
- **Font**: MC360.ttf (Blade)

## Current Dashboard Layout (6 cards)
Games -> System Settings -> Achievements -> Marketplace -> Themes -> Startup

## Implemented Features

### Core Dashboard (Sessions 1-5):
- Xbox 360 Guide overlay with Gaussian blur
- MC360 custom font, Xbox sound effects
- Controller support (GamepadContext, useGamepad hook, full button mapping)
- System Settings with Controller Diagnostic
- Sign-in flow (mocked)

### Session 6 - P0 Cleanup:
- Deleted unused GlobalControllerListener.jsx
- Fixed all React dependency warnings, zero compilation warnings

### Session 6 - Theme Management:
- Layout-based theme system (NOT color pickers)
- Play/Disabled folder architecture with layout.json blueprints
- Theme swap mechanism (only 1 active at a time)
- react-dropzone for importing layout.json files
- 3 seeded default layouts (Classic NXE, Games First, Minimal)

### Session 6 - SteamGridDB Asset Engine:
- Backend proxy for SteamGridDB API v2 (search, grids, heroes, logos)
- Real 4K art fetching for any game

### Session 6 - Major UI Restructure:
- Removed Vibe-Design bar (Describe your layout + Generate button)
- Moved Recently Played under "VORTEX PRIME EMU" title
- Added Marketplace card between Achievements and Themes
- AI box in top-right header next to Sign In (plug-and-play Open WebUI)
- AI panel shows connection status, iframe for Open WebUI
- 2 extra game slots at bottom of home dashboard
- Startup section now has Play/Disabled folder structure (matching Themes)
- Marketplace view with community themes grid
- Xbox 360 on-screen keyboard (full controller navigation: D-pad, A select, X backspace, Y space, LB/RB switch layout)

## Testing: 100% (19/19 tests pass, iteration_8.json)

## What's Mocked
- Open WebUI AI panel (localhost:8080 not reachable in preview)
- Xbox Live sign-in (xboxAuthService.js)
- Game data (xeniaData.js)
- Marketplace downloads (shows alert)
- Recently Played / Quick Resume (UI-only)

## Backlog
### P0 (DONE): Dashboard restructure, AI box, Marketplace, Xbox 360 keyboard
### P1 (NEXT): x360db Game Database (6000+ real games)
### P2: Game Patches Integration (TOML from xenia-canary/game-patches)
### P3: Volvo Pack Auto-Update System
### P4: Native Tauri (Microsoft.GameInput, tauri-plugin-fs)
### P5: Real Xbox Live Auth, Friends & Parties

## Key API Endpoints
- `/api/themes` - List layout themes
- `/api/themes/active` - Get active theme
- `/api/themes/create` - Create layout theme
- `/api/themes/activate` - Swap active theme
- `/api/steamgriddb/search/{term}` - Search games
- `/api/steamgriddb/assets/{game_id}` - Get all art assets
- `/api/vibe-design/generate` - Generate layout (Open WebUI + mock fallback)
- `/api/wallpapers` - Wallpapers list
- `/api/startup/videos` - Startup videos list
