# 🎮 Vortex Prime - Local Development Guide

## System Requirements

### Required Software
- Windows 10/11 (64-bit)
- Rust 1.70+ (`rustup` recommended)
- Node.js 18+ & npm
- Visual Studio 2022 Build Tools (for Rust compilation)

### Optional
- Xbox Controller (for authentic navigation)
- Xenia Canary (latest build)

## Step-by-Step Setup

### 1. Install Rust
```powershell
# Download and run rustup-init.exe from https://rustup.rs/
# Or via PowerShell:
Invoke-WebRequest -Uri https://win.rustup.rs/ -OutFile rustup-init.exe
.\rustup-init.exe
```

### 2. Install Visual Studio Build Tools
```powershell
# Required for compiling Rust dependencies
# Download from: https://visualstudio.microsoft.com/downloads/
# Select: "Desktop development with C++"
```

### 3. Install Node.js
```powershell
# Via Winget:
winget install OpenJS.NodeJS

# Or download from: https://nodejs.org/
```

### 4. Clone & Install Dependencies
```bash
# In your project directory
cd /path/to/vortex-prime

# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install Rust dependencies (automatically done by Cargo)
cd src-tauri
cargo check
cd ..
```

### 5. Add Xenia Emulator
```bash
# Create resources directory
mkdir -p src-tauri/resources/xenia

# Download Xenia Canary from:
# https://github.com/xenia-canary/xenia-canary/releases

# Place xenia-canary.exe in:
# src-tauri/resources/xenia/xenia-canary.exe
```

### 6. Configure Environment Variables

#### Frontend (.env)
```bash
# Already configured in /app/frontend/.env
REACT_APP_BACKEND_URL=http://localhost:8001
```

#### Backend (.env)
```bash
# /app/backend/.env
OPENXBL_API_KEY=3f50c132-04ef-4a98-8462-431603ba41fc
MONGO_URL="mongodb://localhost:27017"
DB_NAME="vortex_prime"
```

## Running the Application

### Development Mode (Recommended)
```bash
# From project root
npm run dev

# This will:
# 1. Start the React dev server (localhost:3000)
# 2. Compile the Rust backend
# 3. Launch the Tauri window
# 4. Enable hot reload for both frontend and backend
```

### Manual Start (Troubleshooting)
```bash
# Terminal 1: Start React dev server
cd frontend
npm start

# Terminal 2: Start Tauri (from project root)
npm run tauri dev
```

### Production Build
```bash
npm run build

# Outputs to:
# src-tauri/target/release/bundle/
# - Vortex Prime_1.0.0_x64-setup.exe (NSIS installer)
# - Vortex Prime_1.0.0_x64_en-US.msi (MSI installer)
```

## File Structure Overview

```
Current working files:
├── /app/frontend/
│   ├── src/pages/Xbox360Dashboard.jsx ← Main dashboard UI
│   ├── src/components/BladeSettings.jsx ← Settings blade
│   ├── src/styles/*.css ← All styling
│   └── build/ ← Production build output
├── /app/src-tauri/
│   ├── src/main.rs ← Rust entry point
│   ├── src/xenia.rs ← Xenia launcher
│   ├── src/games.rs ← Game library
│   ├── src/xbox_live.rs ← Xbox Live API
│   ├── Cargo.toml ← Rust dependencies
│   └── tauri.conf.json ← Tauri configuration
├── /app/backend/ ← Optional Python service
└── /app/package.json ← Root Tauri scripts
```

## Common Commands

```bash
# Development
npm run dev                    # Start dev environment
npm run frontend:dev           # Frontend only
npm run tauri                  # Tauri CLI commands

# Building
npm run build                  # Production build
npm run frontend:build         # Build frontend only

# Tauri specific
npx tauri dev                  # Launch Tauri dev
npx tauri build                # Build production
npx tauri info                 # System info
npx tauri icon                 # Generate icons
```

## Debugging

### Frontend Debugging
```bash
# Chrome DevTools available in Tauri window
# Right-click → Inspect Element
# Or press F12
```

### Backend Debugging
```bash
# Rust logs go to console where you ran `npm run dev`
# Add debug prints in Rust:
println!("Debug: {:?}", variable);

# Or use proper logging:
log::info!("Game launched: {}", game_path);
```

### Common Issues

#### "Rust compiler not found"
```bash
# Ensure Rust is in PATH
rustc --version

# If not, restart terminal or run:
$env:Path += ";$env:USERPROFILE\.cargo\bin"
```

#### "VCRUNTIME140.dll missing"
```bash
# Install Visual C++ Redistributable
# Download from Microsoft
```

#### "Permission denied on xenia-canary.exe"
```bash
# Right-click → Properties → Unblock
# Or run as Administrator
```

#### "Port 3000 already in use"
```bash
# Kill existing process
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or change port in frontend/.env
PORT=3001
```

## Testing

### Frontend Tests
```bash
cd frontend
npm test
```

### Rust Tests
```bash
cd src-tauri
cargo test
```

### Integration Tests
```bash
# Test Xenia launcher
cargo test --package vortex-prime --test integration_tests
```

## Performance Optimization

### Production Build Optimizations
Already configured in `Cargo.toml`:
```toml
[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "z"      # Optimize for size
strip = true          # Strip symbols
```

### Frontend Optimizations
- React production build automatically optimizes
- Code splitting enabled
- Assets minified

## Distribution

### Creating Installer
```bash
npm run build

# Creates both NSIS and MSI installers
# Located in: src-tauri/target/release/bundle/
```

### Signing (Optional)
```bash
# Add certificate thumbprint to tauri.conf.json
"windows": {
  "certificateThumbprint": "YOUR_CERT_THUMBPRINT"
}
```

## Next Steps

1. ✅ Install all prerequisites
2. ✅ Run `npm install` in root and frontend
3. ✅ Add Xenia to `src-tauri/resources/xenia/`
4. ✅ Run `npm run dev`
5. ✅ Test with Xbox controller
6. ✅ Build production version

## Support

If you encounter issues:
1. Check this guide first
2. Review console logs
3. Check `src-tauri/target/debug/` for Rust errors
4. Verify all dependencies are installed

---

**Happy Gaming! 🎮**
