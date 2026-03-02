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
- **Storage**: Game groups stored in localStorage

## Dashboard Layout (6 cards)
Games -> Favorites -> System Settings -> Achievements -> Marketplace -> Themes

## Top Row: Recently Played (5 unique game tiles)

## Header
- **Open WebUI** button (custom SVG icon)
- Static avatar circle (shows real profile pic when logged into Xbox account)
- No "Sign In" text — avatar is static placeholder until Xbox auth

## Guide Overlay (3 tabs)

### Friends and Parties (default):
- **Friends**: Xbox Live / Discord sub-sections with individual friend lists
- **Parties**: Create Party (solo) → Invite More → Leave Party

### Messages:
- Xbox Live / Discord sub-sections (same split as Friends)
- Conversation detail with chat input (type and send messages)
- **Invite to Party** (functional)
- **Invite to Game** — **Coming Soon** (PC/Steam/emulator)

### Home:
- Home, **My Groups** (with count), Settings, Shutdown System
- **My Groups sub-view**: Create New Group (opens Xbox 360 keyboard) + list existing groups
- Recently Played (5 games with Quick Resume badges)

## Favorites / Groups System
- Dashboard "FAVORITES" card opens groups management
- Create unlimited custom groups (e.g., "My Favorites", "Halo Series")
- Xbox 360 on-screen keyboard for naming groups
- Add/remove games from groups
- Delete groups
- Groups persist in localStorage
- Accessible from both dashboard and Guide

## All Implemented Features
- Xbox 360 Guide overlay with Gaussian blur, 3 tabs
- MC360 custom font, Xbox sound effects
- Controller support (GamepadContext, full button mapping)
- System Settings with Controller Diagnostic
- Layout-based theme system (Play/Disabled folders)
- SteamGridDB Asset Engine (4K grids, heroes, logos)
- Marketplace (community layouts)
- Open WebUI button (custom SVG icon, plug-and-play panel)
- Xbox 360 on-screen keyboard (controller + keyboard input)
- Dashboard: 5 unique Recently Played game tiles
- Friends & Parties (hierarchy with Xbox Live / Discord split)
- Messages with Xbox Live / Discord split + chat input + send
- Party system: Create/Invite/Leave
- Favorites: Game groups with full CRUD
- Static profile avatar (no Sign In text)

## Testing: 100% (26/26, iteration_13.json)

## Backlog
### P1: Functional Marketplace (GitHub repo integration)
### P1: Tauri Backend Port
### P1: Real Xbox Live MSAL Auth + Discord linked accounts
### P2: x360db Game Database (6000+ real games)
### P2: Game Patches (TOML from xenia-canary/game-patches)
### P3: Volvo Pack Auto-Update System
### P4: Quick Resume Emulator Hooks
### P4: PC Game Invites (Steam/emulator)
