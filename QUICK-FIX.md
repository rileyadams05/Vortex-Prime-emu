# 🎯 Quick Reference: Server Restart

## THE PROBLEM
```
❌ :3005/api/config/external-apis:1   Failed to load resource: 404
❌ RetroAchievements fetch failed: Failed to fetch external API configuration
```

## THE SOLUTION
```bash
# Stop current servers (Ctrl+C), then:
node start-dev-servers.js
```

## TEST IT WORKS
```bash
node test-api-config.js
```

## EXPECTED OUTPUT
```
✅ SUCCESS! Endpoint is working
✅ RetroAchievements data loaded successfully
```

## HELPFUL COMMANDS

| Command | What It Does |
|---------|-------------|
| `restart-servers.bat` | Kills old processes & restarts cleanly |
| `test-api.bat` | Tests if API endpoint is working |
| `node test-api-config.js` | Tests API configuration manually |

## FILES CREATED FOR YOU

📄 **`RESTART-REQUIRED.md`** - Why you need to restart
📄 **`RESTART-GUIDE.md`** - Detailed troubleshooting  
📄 **`API_SETUP.md`** - API configuration guide
📄 **`restart-servers.bat`** - Automated restart script
📄 **`test-api-config.js`** - API testing script
📄 **`test-api.bat`** - Windows-friendly test runner

## YOUR API CREDENTIALS

✅ Already configured in `backend/.env`:
- RetroAchievements Username: `Budm4n`
- RetroAchievements API Key: `kPlV07kCeSlUZmIaRN5US4OdL01zO5Z8`
- TMDB API Key: `3b8df06dd26ade9055cc8aa9aee03ec5`

## WHAT'S NORMAL

### These messages are EXPECTED and CORRECT:
```
Starting Universal Achievement Listener (Tauri Shell Engine)...
Achievement listener stopped
Starting Universal Achievement Listener (Tauri Shell Engine)...
```
☑️ React StrictMode causes this in development
☑️ It's intentional for debugging
☑️ Won't happen in production build

## QUICK FIX (3 STEPS)

1. **Stop** servers (Ctrl+C)
2. **Start** servers (`node start-dev-servers.js`)
3. **Verify** it works (`node test-api-config.js`)

**Done!** 🎉
