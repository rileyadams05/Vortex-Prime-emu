# Vortex Prime EMU - PRD

## Original Problem Statement
Build Xbox 360 Guide overlay for Vortex-Prime-emu. Iterative refinements: single clean panel layout, Games/Recently Played inside panel, Xenia Guide header inside, controller support, MC360 Blade font, Xbox NXE sounds.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + custom CSS
- **Backend**: FastAPI + MongoDB
- **Tauri**: Compatible (conditional imports)
- **Input**: Web Gamepad API (4 slots, left stick, gamepadconnected events) + keyboard + Tauri events
- **Audio**: 8 Xenia-Dashboard sounds
- **Font**: MC360.ttf (Blade)
- **Storage**: localStorage (recently played games)

## Current Layout (Session 4)
### Guide Overlay (single clean panel):
- XENIA GUIDE header (top)
- Sign In / Profile + Clock
- Divider
- Home (navigate to dashboard)
- Shutdown System (Exit App)
- GAMES section divider
- Recently Played (up to 5 games with Quick Resume badges)
- Footer: A Select / B Close

### Dashboard:
- VORTEX PRIME EMU title + gamerscore (when signed in)
- 5 main cards: Games, System Settings, Achievements, Themes, Startup
- Footer: LB/RB Tabs, Home, A Select, B Back

## Implemented Features
- Session 1: Guide overlay, blur, keyboard nav
- Session 2: Rename, MC360 font, sounds, sign-in, gamerscore
- Session 3: Tab system (Friends & Parties / Games)
- **Session 4**: Single panel redesign, Games inside panel, Xenia Guide header inside, controller rewrite with gamepadconnected events + 4 slots + left stick + status indicator

## Testing: 100% pass (iterations 3 & 4)

## Backlog
### P1
- Wire Quick Resume to Tauri save-state
- Wire Shutdown to Tauri exit
- Xbox MSAL auth with real credentials
### P2
- Microsoft.GameInput (NuGet) for native Guide button
- Party/friends integration
- Save-state management
