# Vortex Prime EMU - PRD

## Original Problem Statement
Replicate and surpass the Xbox 360 Dashboard experience (NXE/Blades) as a Tauri desktop application.

## Architecture
- **Frontend**: React + custom CSS
- **Backend**: FastAPI (mocked, placeholder for Tauri)
- **Controller**: GamepadProvider (React Context) -> useGamepad() hook
- **AI**: Open WebUI plug-and-play panel (localhost:8080 in Tauri)
- **Social**: Unified Xbox Live + Discord (Discord connects through Xbox account)
- **Audio**: Xbox-authentic WAV sounds via soundManager.js
- **Font**: MC360.ttf (Blade)
- **Storage**: Game groups in localStorage

## Dashboard Layout (4 cards)
Games -> Favorites -> System Settings -> Achievements

## Header
- **Open WebUI** button (custom SVG icon)
- Static avatar circle (no "Sign In" text) — shows real profile pic when logged into Xbox

## Guide Overlay (3 tabs)

### Friends and Parties:
- **Friends**: Xbox Live / Discord → click friend → **Xbox 360 profile card popup**
  - Shows name, platform, status, activity
  - **Invite to Party** (X button on controller)
  - **Invite to Game** — **Coming Soon** (Y button, PC/Steam/emulator)
- **Parties**: Create Party → solo → **Invite More** (Xbox Live / Discord split) → invite friends

### Messages:
- Xbox Live / Discord split → conversations list → chat detail
- **Chat input opens Xbox 360 on-screen keyboard** (press A / click)
- Sent messages appear in chat bubbles
- **Invite to Party** + **Invite to Game (Coming Soon)**

### Home:
- Home, **My Groups** (count), Settings, Shutdown
- My Groups sub-view: Create (keyboard) + list groups
- Recently Played (5 games, Quick Resume badges)

## Favorites / Groups
- Dashboard "FAVORITES" card → groups management
- Create unlimited groups via Xbox 360 keyboard
- Add/remove games, delete groups
- Persist in localStorage

## Testing: 100% (20/20, iteration_14.json)

## Backlog
### P1: Tauri Backend Port
### P1: Real Xbox Live MSAL Auth + Discord linked accounts
### P2: x360db Game Database (6000+ real games)
### P3: Volvo Pack Auto-Update System
### P4: Quick Resume Emulator Hooks
### P4: PC Game Invites (Steam/emulator)
