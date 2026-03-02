# Vortex Prime EMU - PRD

## Original Problem Statement
Replicate and surpass the Xbox 360 Dashboard experience (NXE/Blades) as a Tauri desktop application. High-fidelity UI with controller support, Guide overlay, sound effects, custom font, and Xbox 360 aesthetics.

## Architecture
- **Frontend**: React + Tailwind + custom CSS
- **Backend**: FastAPI + MongoDB + Permissions-Policy header
- **Controller**: GamepadProvider (React Context) -> useGamepad() hook -> direct component subscription
- **Tauri**: Compatible (conditional imports for @tauri-apps/*)
- **Audio**: 8 Xenia-Dashboard WAV sounds
- **Font**: MC360.ttf (Blade)
- **Storage**: localStorage (recently played)

## Controller Architecture
```
GamepadProvider (React Context)
  Polls navigator.getGamepads() at 60fps via requestAnimationFrame
  Listens for gamepadconnected / gamepaddisconnected browser events
  Edge-detects button presses (fires on press, not hold)
  Supports all 4 gamepad slots
  Maps left stick as virtual D-pad (0.4 deadzone)
  Shows connection notification popup

  XeniaDashboard (useGamepad hook)
    Guide/Start -> toggle Guide overlay
    A -> select card / launch game
    B -> go back
    D-pad/Stick L/R -> navigate cards
    LB/RB -> fast navigate
    D-pad Up/Down -> carousel

  GuideOverlay (useGamepad hook)
    D-pad/Stick Up/Down -> navigate menu items
    A -> select item
    B -> close guide

  NXESettings (useGamepad hook)
    D-pad/Stick Up/Down -> navigate settings list
    A -> select item (opens Controller Diagnostic)
    B -> back to dashboard / back from panel
```

## Implemented Features
- Session 1: Guide overlay, blur, keyboard nav
- Session 2: MC360 font, sounds, sign-in, gamerscore
- Session 3: Tab-based guide (later removed)
- Session 4: Single-panel guide (Games inside panel), controller rewrite #1
- Session 5: Professional GamepadContext, useGamepad() hook, Permissions-Policy header, GamepadDiagnostic tool
- Session 6 (current): P0 cleanup - deleted unused GlobalControllerListener.jsx, fixed all React dependency warnings, wrapped functions in useCallback/useMemo, zero compilation warnings

## What's Mocked
- Xbox Live sign-in (xboxAuthService.js)
- All game data (xeniaData.js)
- Recently Played / Quick Resume (UI-only)
- Backend /api/xbox/profile returns 500 (not implemented)

## Testing: 95% overall (100% frontend, 87% backend - only Xbox Live API unconfigured)

## Backlog
### P0 (DONE): Cleanup, dependency warnings, controller nav wiring
### P1: Xbox MSAL auth, Tauri exit/save-state wiring, native input (Microsoft.GameInput)
### P2: Friends system, save management

## MASTER PROJECT BRIEF (Upcoming)
Large scope expansion including:
- Theme management system (Play/Disabled folder architecture)
- SteamGridDB API integration for game assets
- Auto-update "Volvo Pack" system
- In-app marketplace for community themes
- Integration with x360db, abgx360, tomlkit, game-patches repos
- Native Tauri input (Microsoft.GameInput + DisableSystemButtonConsumption)
