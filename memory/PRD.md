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
- **Open WebUI** button (user's exact SVG: black circle, white OI letters), clean transparent style
- Static avatar circle (no "Sign In" text)

## Settings (Xbox 360 Two-Pane Layout)
- Sidebar: Core Configuration, **Moonlight**, Sound Settings, Language (EN)
- Green gradient highlight (#91C300 → #5F8200) on active selection
- Semi-transparent black content pane on right
- **Moonlight sub-menu**: Sunshine (PC streaming host) + Moonlight (console client)
- Keyboard/controller nav: D-pad up/down, A select, B back

## Guide Overlay (3 tabs)

### Friends and Parties:
- Friends → Xbox Live / Discord → click friend → Xbox 360 profile card
  - Invite to Party (X), Invite to Game Coming Soon (Y)
- Parties: Create → solo → Invite More (Xbox/Discord split)

### Messages:
- Xbox Live / Discord split → conversations → chat with keyboard trigger
- Invite to Party + Invite to Game (Coming Soon)

### Home:
- Home, My Groups (count), Settings, Shutdown
- Recently Played (5 games, Quick Resume badges)

## Controller Mapping
- B button: lowercase 'b' from gamepad API (fixed for keyboard + Guide)
- Z-index: Keyboard (20001) > Guide (10001) > Dashboard (base)
- Focus trap: keyboard events stop propagation to Guide

## Testing: Visual verification passed on all 4 fix areas

## Backlog
### P1: Tauri Backend Port
### P1: Real Xbox Live MSAL Auth + Discord linked accounts
### P2: x360db Game Database (6000+ real games)
### P3: Volvo Pack Auto-Update System
### P4: Quick Resume Emulator Hooks
### P4: PC Game Invites (Steam/emulator)
