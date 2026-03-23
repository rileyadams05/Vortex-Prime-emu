# 🔄 Quick Fix: Restart Required

## What Happened?
The backend server was already running when we added the new `/api/config/external-apis` endpoint. The server needs to be restarted to load the new code.

## Quick Fix Steps

### Option 1: Use the Restart Script (Easiest)
1. **Stop the current servers** (Press `Ctrl+C` in the terminal where they're running)
2. **Run the restart script:**
   ```bash
   restart-servers.bat
   ```

### Option 2: Manual Restart
1. **Stop the servers:**
   - Press `Ctrl+C` in the terminal where `start-dev-servers.js` is running
   - Or run: `taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*"`
   - Or run: `taskkill /F /IM node.exe /FI "WINDOWTITLE eq *npm*"`

2. **Start again:**
   ```bash
   node start-dev-servers.js
   ```

## Verify Everything Works

After restarting, run this test:
```bash
node test-api-config.js
```

You should see:
```
✅ SUCCESS! Endpoint is working

RetroAchievements Config:
  Username: Budm4n
  API Key: ***configured***

TMDB Config:
  API Key: ***configured***

✅ All API credentials are configured correctly!
```

## What to Look For

### ✅ Good Signs (Console Output):
```
Starting Universal Achievement Listener (Tauri Shell Engine)...
Achievement listener stopped
Starting Universal Achievement Listener (Tauri Shell Engine)...
RetroAchievements data loaded successfully
```

### ❌ Bad Signs (These should be gone now):
```
Failed to load resource: the server responded with a status of 404 (Not Found)
RetroAchievements fetch failed: Failed to fetch external API configuration
```

## Expected Behavior

### Achievement Listener Messages:
- You'll see the listener start, stop, and start again - **this is normal!**
- React StrictMode in development mode intentionally mounts components twice
- Our code now handles this properly with cleanup

### API Calls:
- Should load RetroAchievements data without 422 errors
- Credentials are now securely fetched from backend
- No more 404 errors

## Still Having Issues?

### 404 Error Persists?
1. Make sure you fully stopped the old backend process
2. Check that `backend/.env` has the API keys
3. Try manually restarting: `cd backend && python -m uvicorn server:app --reload`

### 422 Error from RetroAchievements?
1. Verify your username at https://retroachievements.org
2. Check your API key at https://retroachievements.org/controlpanel.php
3. Update `backend/.env` with correct credentials

### Environment Variables Not Loading?
1. Make sure `backend/.env` exists
2. Check it has all required keys from `backend/.env.example`
3. Restart the backend server after editing `.env`

## Files Changed
- ✅ `backend/.env` - API credentials added
- ✅ `backend/server.py` - New endpoint added
- ✅ `frontend/src/services/AchievementWatcher.js` - Singleton pattern added
- ✅ `frontend/src/App.js` - Cleanup added
- ✅ `frontend/src/pages/XeniaDashboard.jsx` - Uses backend API for credentials

## Testing Checklist
- [ ] Backend starts without errors
- [ ] Frontend starts without errors  
- [ ] No 404 errors in console
- [ ] No 422 errors from RetroAchievements
- [ ] Achievement listener only logs startup once (then stop/start from StrictMode is OK)
- [ ] RetroAchievements data loads successfully

---

**Need more help?** Check `API_SETUP.md` for detailed API configuration instructions.
