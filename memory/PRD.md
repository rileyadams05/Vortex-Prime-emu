# Vortex Prime EMU - PRD

## Architecture
- **Frontend**: React + Tailwind + custom CSS
- **Backend**: FastAPI + MongoDB + Permissions-Policy header
- **Controller**: GamepadProvider (React Context) → useGamepad() hook → direct component subscription
- **Tauri**: Compatible (conditional imports for @tauri-apps/*)
- **Audio**: 8 Xenia-Dashboard WAV sounds
- **Font**: MC360.ttf (Blade)
- **Storage**: localStorage (recently played)

## Controller Architecture (Session 5 - Current)
```
GamepadProvider (React Context)
├── Polls navigator.getGamepads() at 60fps via requestAnimationFrame
├── Listens for gamepadconnected / gamepaddisconnected browser events
├── Edge-detects button presses (fires on press, not hold)
├── Supports all 4 gamepad slots
├── Maps left stick as virtual D-pad (0.4 deadzone)
├── Shows connection notification popup
│
├── XeniaDashboard (useGamepad hook)
│   ├── Guide/Start → toggle Guide overlay
│   ├── A → select card
│   ├── B → go back
│   ├── D-pad/Stick L/R → navigate cards
│   ├── LB/RB → fast navigate
│   └── D-pad Up/Down → carousel
│
└── GuideOverlay (useGamepad hook)
    ├── D-pad/Stick Up/Down → navigate menu items
    ├── A → select item
    └── B → close guide
```

## Implemented Features
- Session 1: Guide overlay, blur, keyboard nav
- Session 2: MC360 font, sounds, sign-in, gamerscore
- Session 3: Tab-based guide (later removed)
- Session 4: Single-panel guide (Games inside panel), controller rewrite #1
- **Session 5**: Professional GamepadContext, useGamepad() hook, Permissions-Policy header, alternative Guide button mappings (Start + Guide)

## Testing: 95% overall (100% frontend, 87% backend - only Xbox Live API unconfigured)

## Backlog
### P1: Xbox MSAL auth, Tauri exit/save-state wiring
### P2: Microsoft.GameInput (NuGet), friends, save management
