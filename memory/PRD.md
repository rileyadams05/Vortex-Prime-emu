# Vortex Prime EMU - PRD

## Original Problem Statement
Replicate and surpass the Xbox 360 Dashboard experience (NXE/Blades) as a Tauri desktop application. High-fidelity UI with full controller support, Guide overlay, sound effects, custom font, and Xbox 360 aesthetics.

## Architecture
- **Frontend**: React + Tailwind + custom CSS
- **Backend**: FastAPI + MongoDB + Theme filesystem + SteamGridDB proxy
- **Controller**: GamepadProvider (React Context) -> useGamepad() hook
- **Theme System**: Folder-based with layout.json in /Themes/Play and /Themes/Disabled
- **SteamGridDB**: Backend proxy -> SteamGridDB API v2
- **AI**: Open WebUI integration (localhost:8080 in Tauri, plug-and-play panel)
- **Social**: Unified Xbox Live + Discord friends via Tauri commands
- **Audio**: Xbox-authentic WAV sounds via soundManager.js
- **Font**: MC360.ttf (Blade)

## Current Dashboard Layout (6 cards)
Games -> System Settings -> Achievements -> Marketplace -> Themes -> Startup

## Guide Overlay Structure (2 tabs)
### Friends and Parties Tab:
- Home (navigate to dashboard)
- Friends (unified list)
  - Platform toggle: Xbox Live | Discord
  - Search: dynamic placeholder ("Search Gamertag..." / "Search Discord Username...")
  - Unified scrolling list with category headers
  - Real data via Tauri `fetch_unified_friends_list` command
- Shutdown System (Exit App)

### Games Tab:
- Last 5 recently played games
- Cover art thumbnails
- Quick Resume badges (wired to Tauri `quick_resume_load` command)

### Navigation:
- LB/RB or Arrow Left/Right: Switch tabs (horizontal transition)
- D-pad Up/Down: Navigate between zones (tabs -> toggle -> search -> menu)
- A: Select | B: Close

## Implemented Features

### Core (Sessions 1-5): Guide overlay, MC360 font, sounds, controller support, settings, sign-in
### Session 6 - Cleanup: Deleted unused files, fixed all React warnings
### Session 6 - Themes: Layout-based system, Play/Disabled folders, react-dropzone import
### Session 6 - SteamGridDB: Backend proxy, 4K art fetching, Asset Studio
### Session 6 - Dashboard Restructure: Marketplace tab, AI box, Xbox 360 keyboard, extra game slots
### Session 6 - Guide Overlay: Two-tab structure, unified social integration, Quick Resume wiring

## Testing: 100% (19/19 tests pass, iteration_9.json)

## What's NOT Mocked (Real Integration Ready)
- Tauri commands: `fetch_unified_friends_list`, `quick_resume_load`, `launch_xenia`
- Xbox/Discord SSO: calls real Tauri backend, returns empty when not in Tauri
- SteamGridDB API: real 4K art via backend proxy

## What's Mocked/Placeholder
- Open WebUI AI panel (localhost:8080 not reachable in web preview)
- Marketplace downloads (shows alert, will use GitHub repo)
- Game data (xeniaData.js - will be replaced by x360db)

## Backlog
### P0 (DONE): Guide restructure, social integration, Quick Resume wiring
### P1 (NEXT): x360db Game Database (6000+ real games replacing mock data)
### P2: Game Patches Integration (TOML from xenia-canary/game-patches)
### P3: Volvo Pack Auto-Update System
### P4: Native Tauri (Microsoft.GameInput, tauri-plugin-fs, real file moves)
### P5: Real Xbox Live MSAL Auth, Discord linked account fetching
