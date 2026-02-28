# Xbox 360 Dashboard - Tauri 2.0 + Xenia Integration Architecture

## Overview
This document outlines the architecture for embedding Xenia emulation into the Xbox 360 Dashboard Tauri application.

## Technology Stack
- **Frontend**: React 19 + TypeScript
- **Desktop Framework**: Tauri 2.0 (Rust backend)
- **Emulator**: Xenia Canary (embedded)
- **Xbox Live API**: OpenXBL for achievements/profile

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Xbox 360 Dashboard (React UI)               │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐   │
│  │   Home     │  │   Games    │  │   Achievements      │   │
│  │  Dashboard │  │  Library   │  │   (OpenXBL API)     │   │
│  └────────────┘  └────────────┘  └─────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ Tauri IPC
┌──────────────────────────▼──────────────────────────────────┐
│              Tauri Backend (Rust)                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Game Manager                                         │   │
│  │  - Scan game directories                             │   │
│  │  - Parse ISO/XEX metadata                            │   │
│  │  - Store game library                                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Xenia Process Manager                               │   │
│  │  - Launch xenia-canary.exe as child process         │   │
│  │  - Pass game path via CLI args                      │   │
│  │  - Monitor process status                           │   │
│  │  - Handle window embedding                          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Xbox Live Integration                               │   │
│  │  - OAuth authentication flow                        │   │
│  │  - Fetch achievements via OpenXBL                   │   │
│  │  - Sync profile data                                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Controller Input                                    │   │
│  │  - Detect Xbox controllers (XInput)                 │   │
│  │  - Forward input to Xenia process                   │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Xenia Canary (Bundled)                          │
│  - Launched with: xenia-canary.exe "game.iso" --fullscreen  │
│  - Runs in borderless fullscreen mode                       │
│  - Dashboard minimizes when game launches                   │
│  - Dashboard restores when game closes                      │
└──────────────────────────────────────────────────────────────┘
```

## Key Implementation Details

### 1. Xenia Integration
**Bundle Xenia Canary with the app:**
```
src-tauri/
  resources/
    xenia/
      xenia-canary.exe
      xenia-canary.config.toml
```

**Launch games from Rust:**
```rust
use std::process::Command;

#[tauri::command]
async fn launch_xenia(game_path: String) -> Result<String, String> {
    let xenia_path = get_bundled_xenia_path();
    
    Command::new(xenia_path)
        .arg(&game_path)
        .arg("--fullscreen")
        .arg("--gpu=vulkan")
        .spawn()
        .map_err(|e| e.to_string())?;
    
    Ok("Game launched".to_string())
}
```

### 2. Game Library Management
**Scan for Xbox 360 games:**
```rust
#[tauri::command]
async fn scan_game_library(directory: String) -> Result<Vec<Game>, String> {
    let mut games = Vec::new();
    
    for entry in std::fs::read_dir(directory)? {
        let path = entry?.path();
        if path.extension().and_then(|s| s.to_str()) == Some("iso") 
           || path.extension().and_then(|s| s.to_str()) == Some("xex") {
            // Parse game metadata
            let game = parse_game_info(&path)?;
            games.push(game);
        }
    }
    
    Ok(games)
}
```

### 3. Xbox Live Achievements
**Use OpenXBL API from Rust:**
```rust
use reqwest;

#[tauri::command]
async fn fetch_achievements(gamertag: String) -> Result<Vec<Achievement>, String> {
    let client = reqwest::Client::new();
    let api_key = "YOUR_OPENXBL_API_KEY";
    
    let response = client
        .get(format!("https://xbl.io/api/v2/{}/achievements", gamertag))
        .header("X-Authorization", api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let achievements: Vec<Achievement> = response
        .json()
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(achievements)
}
```

### 4. Controller Support
**XInput integration:**
```rust
use xinput;

#[tauri::command]
fn detect_controllers() -> Vec<u32> {
    (0..4)
        .filter(|&i| xinput::XInputGetState(i).is_ok())
        .collect()
}
```

## File Structure

```
xbox360-dashboard/
├── src/                        # React frontend
│   ├── pages/
│   │   └── Xbox360Dashboard.jsx
│   ├── styles/
│   │   └── Xbox360Dashboard.css
│   └── main.jsx
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── main.rs            # Tauri entry point
│   │   ├── xenia.rs           # Xenia process management
│   │   ├── games.rs           # Game library scanning
│   │   ├── xbox_live.rs       # Xbox Live API integration
│   │   └── controllers.rs     # Controller input handling
│   ├── resources/
│   │   └── xenia/
│   │       └── xenia-canary.exe
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── README.md
```

## Xenia Configuration

**Optimal settings for embedding:**
```toml
# xenia-canary.config.toml
[Display]
fullscreen = true
vsync = true

[GPU]
gpu = "vulkan"

[UI]
show_fps = false
show_profiler = false
```

## Launch Flow

1. User clicks game in dashboard
2. React calls Tauri command: `invoke('launch_xenia', { gamePath })`
3. Rust backend:
   - Minimizes dashboard window
   - Launches Xenia with game path
   - Monitors Xenia process
4. When game closes:
   - Dashboard window restores
   - Updates "Recent Games" list
   - Syncs playtime/achievements

## Benefits of This Approach

✅ **No Xenia modification needed** - Use official builds
✅ **Native performance** - Xenia runs as native process
✅ **Clean separation** - Dashboard UI + Emulator core separate
✅ **Easy updates** - Just replace xenia-canary.exe
✅ **Full controller support** - Native XInput
✅ **Xbox Live integration** - Real achievements via OpenXBL

## Next Steps

1. Set up Tauri 2.0 project structure
2. Implement Rust backend commands
3. Bundle Xenia Canary
4. Test game launching flow
5. Integrate OpenXBL achievements
6. Add controller detection
7. Build installers (.exe, .msi)
