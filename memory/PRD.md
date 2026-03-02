# Xenia Guide Overlay - PRD

## Original Problem Statement
Replicate the Xbox 360 Guide overlay exactly as shown in the provided screenshot for the Vortex-Prime-emu project based on the logic from ALHROOBIX/Xenia-Dashboard.

## Architecture
- **Frontend**: React (CRA with Craco) + Tailwind CSS + custom CSS
- **Backend**: FastAPI + MongoDB (Motor)
- **Tauri**: Code structured for Tauri webview compatibility (uses `@tauri-apps/plugin-process`, `@tauri-apps/plugin-shell`, event listeners)
- **Input**: Web Gamepad API + keyboard listeners + Tauri Rust backend events

## User Personas
- Xbox 360 emulation enthusiasts using Vortex-Prime-emu
- Users who want a console-grade UI experience on desktop

## Core Requirements (Static)
1. Centered "Mini-Blade" Guide menu overlay
2. Real-time Gaussian blur on dashboard background when Guide opens
3. Xbox 360 "Green/Grey" color palette with gloss finish
4. Left vertical tabs: "Xenia Guide" (secondary) + "HOME" (primary)
5. Right vertical tab: "Games" (blue)
6. Footer: "A Select" and "B Close" button icons
7. Keyboard navigation (ArrowUp/Down, Enter, Escape, Tab/Home to toggle)
8. Gamepad support (D-pad, A/B buttons, Guide button)
9. Component rendered outside blur container to stay sharp

## What's Been Implemented (2026-03-02)
- ✅ GuideOverlay.jsx - Complete rewrite with pixel-perfect Xbox 360 NXE styling
- ✅ GuideOverlay.css - Xbox green/grey palette, gloss gradients, vertical tabs
- ✅ Dashboard background updated to NXE green gradient
- ✅ Tab key and Home key toggle the Guide
- ✅ ArrowUp/Down navigation with green highlight animation
- ✅ Escape/Backspace closes Guide
- ✅ Gamepad polling for D-pad, A, B buttons
- ✅ Guide button and Home button re-enabled in GlobalControllerListener
- ✅ Tauri event listener re-enabled for 'toggle-guide' events
- ✅ Real-time Gaussian blur (12px + brightness reduction) on dashboard
- ✅ Dashboard title set to "MY XENIA"
- ✅ All data-testid attributes added

## Testing Results
- Frontend: 95% pass (all core features working)
- Tab toggle: Consistent open/close/reopen
- Navigation: ArrowUp/Down moves green highlight correctly
- Blur: Applied on open, removed on close
- Visual: Matches reference screenshot closely

## Prioritized Backlog
### P0 (Done)
- Guide overlay visual fidelity
- Keyboard & gamepad navigation
- Blur effect on dashboard

### P1 (Next)
- Hook up Shutdown System to Tauri `exit(0)` (visual only for now)
- Hook up Quick Launch functionality
- Connect XENIA Dashboard item to navigate to dashboard view

### P2 (Future)
- Microsoft.GameInput via NuGet for native Guide button detection
- DisableSystemButtonConsumption policy for Windows
- Sound effects for navigation and selection
- Guide button animation (press state)
- Per-game configuration from Guide

## Next Tasks
1. Implement actual menu item actions (when user requests)
2. Add sound effects to Guide navigation
3. Integrate with Tauri backend for Shutdown/Exit
