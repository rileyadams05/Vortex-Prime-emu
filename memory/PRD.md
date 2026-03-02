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

## Top Row: Recently Played (5 unique game tiles)
- Shows 5 unique games seeded from mockGames[0-4]
- First 3 have Quick Resume badges
- No duplicates between tiles

## Guide Overlay (3 tabs)
### Friends and Parties (default):
- Friends item with Xbox Live / Discord platform toggle
- Dynamic search (Search Gamertag... / Search Discord Username...)
- Unified friends list via Tauri `fetch_unified_friends_list`

### Messages:
- Previous chats with friends via Tauri `fetch_chat_history`
- Shows conversation list with unread badges

### Home:
- Home button, Settings button
- Shutdown System (Exit App)
- Recently Played (5 games matching dashboard, with Quick Resume badges on first 3)

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
- Dashboard: 5 unique Recently Played game tiles at top (no overlap)
- 3-tab Guide: Friends & Parties, Messages, Home (with 5 games)

## Testing: 100% (16/16, iteration_11.json)

## Backlog
### P0: Wire Controller to On-Screen Keyboard
### P1: Functional Marketplace (GitHub repo integration)
### P1: Tauri Backend Port
### P1: Real Xbox Live MSAL Auth, Discord linked accounts
### P2: x360db Game Database (6000+ real games)
### P2: Game Patches (TOML from xenia-canary/game-patches)
### P3: Volvo Pack Auto-Update System
### P4: Quick Resume Emulator Hooks
