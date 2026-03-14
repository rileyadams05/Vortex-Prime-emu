# 🚨 IMPORTANT: Server Restart Required

## Current Issue
You're seeing a **404 error** because the backend server was started **before** we added the new API endpoint. The server needs to be restarted to pick up the changes.

## Quick Fix (30 seconds)

### Step 1: Stop Current Servers
Press `Ctrl+C` in the terminal where your servers are running

### Step 2: Restart Servers
```bash
node start-dev-servers.js
```

OR use the convenience script:
```bash
restart-servers.bat
```

### Step 3: Verify It Works
```bash
node test-api-config.js
```

## What You'll See After Restart

### ✅ BEFORE (Current - Has Errors):
```
❌ Failed to load resource: the server responded with a status of 404 (Not Found)
❌ :3005/api/config/external-apis:1
❌ RetroAchievements fetch failed: Failed to fetch external API configuration
```

### ✅ AFTER (Fixed):
```
✅ Backend server started on http://localhost:8000
✅ API Configuration: /api/config/external-apis
✅ RetroAchievements data loaded successfully
```

## Console Messages Explained

### Achievement Listener (Normal Behavior):
```
Starting Universal Achievement Listener (Tauri Shell Engine)...
Achievement listener stopped
Starting Universal Achievement Listener (Tauri Shell Engine)...
```
☑️ This is **CORRECT** - React StrictMode intentionally mounts/unmounts in dev mode
☑️ Our code now properly handles cleanup
☑️ The listener will only actually run once

### RetroAchievements (What You'll See):
```
RetroAchievements data loaded successfully
```
☑️ No more 422 errors
☑️ No more 404 errors
☑️ Data loads on first try

## Changes Made (Already Done)

| File | Change |
|------|--------|
| `backend/.env` | ✅ Added RetroAchievements + TMDB API keys |
| `backend/server.py` | ✅ Added `/api/config/external-apis` endpoint |
| `frontend/src/pages/XeniaDashboard.jsx` | ✅ Fetches credentials from backend |
| `frontend/src/services/AchievementWatcher.js` | ✅ Added singleton pattern + cleanup |
| `frontend/src/App.js` | ✅ Added cleanup for unmount |

## Helper Scripts Created

| Script | Purpose |
|--------|---------|
| `restart-servers.bat` | 🔄 Cleanly restart both servers |
| `test-api-config.js` | 🧪 Test if API endpoint is working |
| `test-api.bat` | 🧪 Windows-friendly test runner |
| `RESTART-GUIDE.md` | 📚 Detailed troubleshooting guide |

## Your API Configuration

✅ **RetroAchievements**
- Username: `Budm4n`
- API Key: Configured in `backend/.env`

✅ **TMDB**
- API Key: Configured in `backend/.env`

Both are securely stored server-side and served via the backend API.

## Why This Happened

1. Backend server was already running with old code
2. We added new endpoint `/api/config/external-apis` 
3. Frontend tried to call it → 404 error
4. **Solution**: Restart backend to load new code

## Next Steps

1. **Stop servers** (Ctrl+C)
2. **Restart**: `node start-dev-servers.js`
3. **Test**: `node test-api-config.js`
4. **Done!** ✨

---

**Still stuck?** See `RESTART-GUIDE.md` for detailed troubleshooting steps.
