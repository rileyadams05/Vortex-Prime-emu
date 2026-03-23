# Vortex Prime EMU - PRD

## Original Problem Statement
Replicate and surpass the Xbox 360 Dashboard experience (NXE/Blades) as a Tauri desktop application named "Vortex-Prime-emu". Web preview development uses React frontend + mocked FastAPI backend.

## Architecture
- **Frontend**: React + custom CSS (functional components, hooks)
- **Backend**: FastAPI (fully mocked, placeholder for Tauri)
- **Controller**: GamepadProvider (React Context) -> useGamepad() hook
- **AI**: Open WebUI plug-and-play panel (localhost:8080 in Tauri)
- **Social**: Xbox Live + Discord (Coming Soon until real auth)
- **Audio**: Xbox-authentic WAV sounds via soundManager.js
- **Font**: MC360.ttf (Blade)
- **Storage**: Game groups + recent games in localStorage

## Dashboard Layout (4 cards)
Games -> Favorites -> System Settings -> Achievements

## Header
- **Open WebUI** button (custom SVG: black circle, white OI letters)
- Static avatar circle (no "Sign In" text)

## Settings (Xbox 360 Two-Pane Layout)
- Sidebar: Core Configuration, Sunshine, Sound Settings, Language (EN)
- Green gradient highlight on active selection
- Semi-transparent black content pane

## Guide Overlay (3 tabs)
### Friends and Parties: Coming Soon (awaits Xbox account)
### Messages: Coming Soon (awaits Xbox account)
### Home: Home, My Groups, Settings, Shutdown, Recently Played

## Controller Mapping
- B button: close overlays
- Z-index: Keyboard (20001) > Guide (10001) > Dashboard (base)
- Tab/Home key toggles Guide

## Completed Work
- Full Xbox 360 NXE dashboard UI replica
- Guide overlay with 3-tab layout
- On-screen Xbox 360 keyboard
- System Settings two-pane menu (Core Config, Sunshine, Sound, Language)
- Favorites/Groups system (localStorage persistence)
- Open WebUI button with custom SVG
- Dashboard cleanup: all mock data removed, empty states implemented
- Friends & Messages tabs set to "Coming Soon"
- Empty game library with "Create Games Folder" button
- Bug fixes: ReferenceError for onOpenKeyboard and setFriendsSection

## Backlog
### P0: Full Controller Navigation in Guide & Keyboard (focus trapping)
### P1: Tauri Backend Port (filesystem dialog, ROM scanning)
### P1: Real Xbox Live MSAL Auth + Discord linked accounts
### P1: Real Social Data (friends, messages)
### P2: Quick Resume Emulator Hooks
### P2: PC Game Invites (Steam/emulator)
