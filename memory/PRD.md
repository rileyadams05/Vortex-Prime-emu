# Vortex Prime EMU - PRD

## Original Problem Statement
Build a Professional Xenia Guide Implementation - replicate the Xbox 360 Guide overlay for the Vortex-Prime-emu project based on ALHROOBIX/Xenia-Dashboard logic. Then: rename to Vortex Prime EMU, fix controller support, add sign-in to guide, show real gamerscore on dashboard, add exact Xenia-Dashboard sounds, apply MC360 Blade font.

## Architecture
- **Frontend**: React (CRA with Craco) + Tailwind CSS + custom CSS
- **Backend**: FastAPI + MongoDB (Motor)
- **Tauri**: Code structured for Tauri webview compatibility
- **Input**: Web Gamepad API + keyboard listeners + Tauri Rust backend events
- **Audio**: 8 sound files from ALHROOBIX/Xenia-Dashboard (focus, select, back, panel-unfold, panel-left, panel-right, channel-up, channel-down)
- **Font**: MC360.ttf (Blade font) for all text

## User Personas
- Xbox 360 emulation enthusiasts using Vortex-Prime-emu
- Users who want console-grade UI on desktop with controller support

## Core Requirements (Static)
1. Centered "Mini-Blade" Guide menu overlay with Xbox NXE green/grey palette
2. Real-time Gaussian blur on dashboard when Guide opens
3. Keyboard + Gamepad navigation with exact Xenia-Dashboard sounds
4. Sign-in button in Guide header (shows profile pic when signed in)
5. Real gamerscore displayed on home dashboard when signed in
6. MC360 Blade font on all text elements
7. Controller support via GlobalControllerListener (Web Gamepad API + Tauri events)

## What's Been Implemented
### Session 1 (2026-03-02)
- ✅ GuideOverlay.jsx - Pixel-perfect Xbox 360 NXE Guide overlay
- ✅ Tab/Home toggle, ArrowUp/Down navigation, Escape close
- ✅ Real-time Gaussian blur (12px + brightness) on dashboard

### Session 2 (2026-03-02)
- ✅ Renamed "MY XENIA" → "VORTEX PRIME EMU"
- ✅ MC360.ttf (Blade font) applied to all text: title, cards, footer, guide, blades
- ✅ Sound system: 8 sounds from Xenia-Dashboard repo (focus, select, back, panelUnfold, panelLeft, panelRight, channelUp, channelDown)
- ✅ Guide header: Sign-in button + avatar (shows profile pic when signed in), removed fake gamerscore
- ✅ Home dashboard: Real gamerscore shown when signed in with Xbox account
- ✅ Controller support re-enabled: GlobalControllerListener + Tauri events
- ✅ All sound triggers matched to Xenia-Dashboard logic

## Testing Results
- Session 1: 95% pass (all core features)
- Session 2: 95% pass (18/19 features verified, only mock auth test limitation)

## Prioritized Backlog
### P0 (Done)
- Guide overlay, sounds, fonts, controller, sign-in, gamerscore

### P1 (Next)
- Hook up Shutdown System to Tauri exit(0)
- Hook up Quick Launch functionality
- Full Xbox MSAL authentication testing with real credentials

### P2 (Future)
- Microsoft.GameInput via NuGet for native Guide button detection
- DisableSystemButtonConsumption policy for Windows
- Per-game configuration from Guide

## Next Tasks
1. Test Xbox authentication with real Azure AD credentials
2. Implement actual menu item actions
3. Add sound effects for blade tab switching on main dashboard
