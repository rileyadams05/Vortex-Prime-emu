# Vortex Prime Emu - Development Quick Start

## Running the Application

Simply run this command:
```powershell
cargo tauri dev
```

**That's it!** The app will:
- ✅ Start the Python backend (port 8000) - runs silently in background
- ✅ Start the React frontend (port 3005) - you'll see build output
- ✅ Open your Vortex Prime Emu app window - the only visible UI

## What Happens Automatically

1. **Backend server** starts hidden on `http://localhost:8000` (takes ~5 seconds)
2. **Frontend dev server** starts on port 3005 (takes ~20-30 seconds for first build)
3. **Tauri app window** opens showing your Xbox 360 dashboard

## No Extra Windows!

- ❌ No separate terminal windows
- ❌ No PowerShell popups  
- ❌ No Notepad/VS Code opening
- ✅ Just your app and the build output in your terminal!

## First Time Setup

Make sure dependencies are installed:
```powershell
# Backend dependencies
pip install -r backend/requirements.txt

# Frontend dependencies  
cd frontend
npm install
```

## Troubleshooting

**If you see API errors in F12 console:**
- Wait 30 seconds for servers to fully start
- Backend takes ~5 seconds to start
- Frontend first build takes ~20-30 seconds

**If frontend won't start:**
- Make sure port 3005 is not in use
- Try: `netstat -ano | findstr :3005` to check

**If backend won't start:**
- Make sure port 8000 is not in use
- Make sure Python 3.x is installed
- MongoDB is optional (status checks will be disabled if not running)

## Architecture

| Component | Port | Auto-Started? | Startup Time |
|-----------|------|---------------|--------------|
| Python Backend (FastAPI) | 8000 | ✅ Yes (hidden) | ~5 seconds |
| React Frontend (Dev) | 3005 | ✅ Yes (visible output) | ~20-30 seconds |
| Tauri App | - | ✅ Yes (opens when ready) | After frontend ready |

## Technical Details

- Uses `start-dev-servers.js` Node.js script to orchestrate startup
- Backend runs with `windowsHide: true` (no console window)
- Frontend runs with `npm.cmd` (avoids PowerShell file association issues)
- All API errors appear in F12 DevTools console
- MongoDB is optional - app works without it

---

**Note:** First run takes longer due to frontend compilation. Subsequent runs are faster with hot-reload.
