# Vortex Prime EMU - PRD

## Original Problem Statement
Replicate and surpass the Xbox 360 Dashboard experience (NXE/Blades) as a Tauri desktop application.

## Architecture
- **Frontend**: React + Tailwind + custom CSS
- **Backend**: FastAPI + MongoDB + Theme filesystem + SteamGridDB proxy
- **Controller**: GamepadProvider (React Context) -> useGamepad() hook
- **Theme System**: Folder-based with layout.json in /Themes/Play and /Themes/Disabled
- **SteamGridDB**: Backend proxy -> SteamGridDB API v2
- **AI**: Open WebUI plug-and-play panel (localhost:8080 in Tauri)
- **Social**: Unified Xbox Live + Discord friends via Tauri commands
- **Audio**: Xbox-authentic WAV sounds via soundManager.js
- **Font**: MC360.ttf (Blade)

## Dashboard Layout (6 cards)
Games -> System Settings -> Achievements -> Marketplace -> Themes -> Startup

## Guide Overlay (4 tabs)
### Home (default):
- Home button, Settings button
- Recently Played (last 5 games with Quick Resume)
- Shutdown System (Exit App)

### Friends and Parties:
- Friends item with Xbox Live / Discord platform toggle
- Dynamic search (Search Gamertag... / Search Discord Username...)
- Unified friends list via Tauri `fetch_unified_friends_list`

### Games:
- Last 5 recently played with Quick Resume badges
- Wired to Tauri `quick_resume_load`

### Messages:
- Previous chats with friends via Tauri `fetch_chat_history`
- Shows conversation list with unread badges

### Navigation:
- LB/RB: Switch tabs (horizontal transition)
- D-pad: Navigate zones (tabs -> toggle -> search -> menu)
- A: Select | B: Close

## All Implemented Features
- Xbox 360 Guide overlay with Gaussian blur
- MC360 custom font, Xbox sound effects
- Controller support (GamepadContext, full button mapping)
- System Settings with Controller Diagnostic
- Layout-based theme system (Play/Disabled folders)
- SteamGridDB Asset Engine (4K grids, heroes, logos)
- Marketplace (community layouts)
- AI box (plug-and-play Open WebUI panel)
- Xbox 360 on-screen keyboard
- Dashboard: Recently Played + extra game slots at top
- 4-tab Guide: Home, Friends & Parties, Games, Messages

## Testing: 100% (20/20, iteration_10.json)

## Backlog
### P1: x360db Game Database (6000+ real games)
### P2: Game Patches (TOML from xenia-canary/game-patches)
### P3: Volvo Pack Auto-Update System
### P4: Native Tauri (Microsoft.GameInput, tauri-plugin-fs)
### P5: Real Xbox Live MSAL Auth, Discord linked accounts
