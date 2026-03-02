# Vortex Prime EMU - PRD

## Original Problem Statement
Replicate and surpass the Xbox 360 Dashboard experience (NXE/Blades) as a Tauri desktop application. High-fidelity UI with controller support, Guide overlay, sound effects, custom font, and Xbox 360 aesthetics. Extended with a Master Project Brief adding Theme Management, SteamGridDB Asset Engine, x360db Game Database, Game Patches, and Auto-Update system.

## Architecture
- **Frontend**: React + Tailwind + custom CSS
- **Backend**: FastAPI + MongoDB + Theme filesystem + SteamGridDB proxy
- **Controller**: GamepadProvider (React Context) -> useGamepad() hook
- **Theme System**: JSON files in /Themes/Play (active) and /Themes/Disabled (inactive)
- **SteamGridDB**: Backend proxy at /api/steamgriddb/* -> SteamGridDB API v2
- **Audio**: 8 Xenia-Dashboard WAV sounds
- **Font**: MC360.ttf (Blade)
- **Storage**: localStorage (recently played) + filesystem (themes)

## Implemented Features

### Session 1-5 (Previous):
- Xbox 360 Guide overlay with Gaussian blur
- MC360 custom font integration
- Xbox-authentic sound effects
- Controller support (GamepadContext, useGamepad hook)
- Recently Played games, Quick Resume UI
- System Settings with Controller Diagnostic
- Sign-in flow (mocked)

### Session 6 (Current - P0 Cleanup):
- Deleted unused GlobalControllerListener.jsx
- Fixed all React dependency warnings (useCallback/useMemo)
- Zero compilation warnings

### Session 6 (Current - Phase 3: Theme Management):
- Backend: `/api/themes` CRUD endpoints
- Theme Play/Disabled folder architecture (/assets/Themes/Play, /assets/Themes/Disabled)
- Swap mechanism: only 1 active theme at a time
- 5 seeded default themes (Classic Xbox 360, Midnight Blue, Crimson Red, Halo Green, Gears Gray)
- Theme creation with custom name, description, accent color, background
- Active theme dynamically sets CSS --xenia-green variable (global accent recoloring)
- Active theme hero URL used as dashboard background

### Session 6 (Current - Phase 2: SteamGridDB Asset Engine):
- Backend proxy: /api/steamgriddb/search, /grids, /heroes, /logos, /assets
- Real 4K art from SteamGridDB API (key: 4b66ee...)
- Asset Studio UI: search games, browse Heroes/Grids/Logos
- Select assets with checkmarks, apply to new themes
- Full theme creation flow with SteamGridDB art integration

## Testing: 100% (27/27 tests pass, iteration_6.json)

## What's Mocked
- Xbox Live sign-in (xboxAuthService.js)
- All game data (xeniaData.js) - NEXT TO REPLACE with x360db
- Recently Played / Quick Resume (UI-only)
- Backend /api/xbox/profile returns 500 (not implemented)

## Backlog (Master Project Brief)
### P0 (DONE): Theme Management + SteamGridDB Asset Engine
### P1 (NEXT): x360db Game Database Integration (6000+ real games replacing mock data)
### P2: Game Patches Integration (xenia-canary/game-patches TOML parsing)
### P3: Volvo Pack Auto-Update System (silent GitHub-based updates)
### P4: Native Tauri integration (Microsoft.GameInput, tauri-plugin-fs)
### P5: Real Xbox Live Authentication
### P6: Functional Quick Resume, Friends & Parties, Marketplace Hub

## Key API Endpoints
- `/api/themes` - List all themes
- `/api/themes/active` - Get active theme
- `/api/themes/create` - Create theme
- `/api/themes/activate` - Swap active theme
- `/api/themes/deactivate` - Deactivate theme
- `/api/steamgriddb/search/{term}` - Search games
- `/api/steamgriddb/assets/{game_id}` - Get all assets
- `/api/steamgriddb/grids/{game_id}` - Get grid art
- `/api/steamgriddb/heroes/{game_id}` - Get hero art
- `/api/steamgriddb/logos/{game_id}` - Get logo art
