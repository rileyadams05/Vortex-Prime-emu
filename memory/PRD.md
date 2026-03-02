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

## Header
- **Open WebUI** button (custom SVG icon) → opens Open WebUI panel (localhost:8080)
- **Sign In** / Gamertag profile

## Guide Overlay (3 tabs)

### Friends and Parties (default):
- **Main view**: "Friends" (with online count) and "Parties" menu items
- **Friends → Platform picker**: Xbox Live (with online count) / Discord (with online count)
  - **Xbox Live**: Shows 6 mock friends with gamertags, statuses, activity
  - **Discord**: Shows 5 mock friends with usernames, statuses, activity
- **Parties → Create Party**: Solo party with "You" as Party Leader
  - **Invite More**: Shows online/away friends from both platforms with Invite/Invited buttons
  - **Leave Party**: Disbands the party

### Messages:
- Shows 5 mock conversations with friend names, last message, timestamps, unread badges, platform tags (XBL/DC)
- **Conversation detail**: Shows message bubble, and two action buttons:
  - **Invite to Party** (functional — creates party and adds friend)
  - **Invite to Game** — **Coming Soon** badge (PC games: Steam, emulator — not yet implemented)

### Home:
- Home button, Settings button
- Shutdown System (Exit App)
- Recently Played (5 games matching dashboard, with Quick Resume badges on first 3)

### Navigation:
- LB/RB: Switch tabs
- D-pad: Navigate zones (tabs -> menu items)
- A: Select | B: Back/Close (contextual)
- Hierarchical back navigation (B goes up one level in sub-views)

## All Implemented Features
- Xbox 360 Guide overlay with Gaussian blur
- MC360 custom font, Xbox sound effects
- Controller support (GamepadContext, full button mapping)
- System Settings with Controller Diagnostic
- Layout-based theme system (Play/Disabled folders)
- SteamGridDB Asset Engine (4K grids, heroes, logos)
- Marketplace (community layouts)
- Open WebUI button (plug-and-play panel with custom SVG)
- Xbox 360 on-screen keyboard
- Dashboard: 5 unique Recently Played game tiles (no overlap)
- 3-tab Guide: Friends & Parties (with hierarchy), Messages (with actions), Home
- Party system: Create/Join/Invite/Leave
- Unified friends: Xbox Live + Discord mock data
- Message conversations with Invite to Party and Invite to Game (Coming Soon)

## Testing: 100% (22/22, iteration_12.json)

## Backlog
### P0: Wire Controller to On-Screen Keyboard
### P1: Functional Marketplace (GitHub repo integration)
### P1: Tauri Backend Port
### P1: Real Xbox Live MSAL Auth, Discord linked accounts
### P2: x360db Game Database (6000+ real games)
### P2: Game Patches (TOML from xenia-canary/game-patches)
### P3: Volvo Pack Auto-Update System
### P4: Quick Resume Emulator Hooks
### P4: PC Game Invites (Steam/emulator integration)
