# Vortex Prime EMU - PRD

## Original Problem Statement
Build a Professional Xenia Guide Implementation for the Vortex-Prime-emu project. Replicate Xbox 360 Guide overlay with full tab switching, recently played games with Quick Resume, controller support, custom Blade font, and Xbox NXE sounds.

## Architecture
- **Frontend**: React (CRA with Craco) + Tailwind CSS + custom CSS
- **Backend**: FastAPI + MongoDB (Motor)
- **Tauri**: Code structured for Tauri webview compatibility
- **Input**: Web Gamepad API + keyboard listeners + Tauri Rust backend events
- **Audio**: 8 sounds from ALHROOBIX/Xenia-Dashboard
- **Font**: MC360.ttf (Blade font)
- **Storage**: localStorage for recently played games tracking

## What's Been Implemented

### Session 1 (2026-03-02)
- GuideOverlay.jsx - Pixel-perfect Xbox 360 NXE Guide overlay
- Tab/Home toggle, ArrowUp/Down navigation, Escape close
- Real-time Gaussian blur on dashboard

### Session 2 (2026-03-02)
- Renamed "MY XENIA" → "VORTEX PRIME EMU"
- MC360.ttf (Blade font) applied to all text
- Sound system: 8 sounds from Xenia-Dashboard repo
- Guide header: Sign-in button + avatar
- Home dashboard: Real gamerscore when signed in

### Session 3 (2026-03-02) - Current
- HOME tab renamed to **"Friends & Parties"**
- Removed all "coming soon" badges
- **Full tab switching**: LB/RB (q/e), ArrowLeft/Right switch between Friends & Games tabs
- **Friends & Parties tab**: "Home" (navigate to dashboard) + "Shutdown System (Exit App)"
- **Games tab**: "Recently Played" with last 5 games, thumbnails, Quick Resume badges
- **Quick Resume UI**: Visual badges on recently played games
- **Recently played tracking**: Persisted to localStorage, auto-seeds 3 games on first load
- **Snappy tab animations**: Horizontal slide (slideFromLeft/slideFromRight)
- **Footer updated**: LB/RB Tabs + A Select + B Close hints
- Controller support: LB/RB map to q/e via GlobalControllerListener
- Tab switching resets selection to first item

## Testing Results
- Session 1: 95% pass
- Session 2: 95% pass
- Session 3: **100% pass** (21/21 features verified)

## Prioritized Backlog
### P1 (Next)
- Wire Quick Resume to Tauri save-state commands
- Wire Shutdown System to Tauri exit(0)
- Full Xbox MSAL auth testing with real credentials
- Friends list integration in Friends & Parties tab

### P2 (Future)
- Microsoft.GameInput via NuGet for native Guide button
- Party chat/voice integration
- Per-game Quick Resume state management
- Notification system for friend activity
