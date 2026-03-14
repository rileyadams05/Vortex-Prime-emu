# 🛑 EMERGENCY STOP GUIDE

## Your App Won't Stop?

### **SOLUTION: Run This Script**
```
EMERGENCY-STOP.bat
```

This will:
1. ✅ Kill all Python processes (backend)
2. ✅ Kill all Node.js processes (frontend)
3. ✅ Kill any auto-opened browsers
4. ✅ Free up ports 8000 and 3005
5. ✅ Wait for cleanup to complete

---

## Alternative Methods

### Method 1: PowerShell (Fast)
```powershell
Get-Process | Where-Object {$_.ProcessName -match "python|node"} | Stop-Process -Force
```

### Method 2: Task Manager (Manual)
1. Press `Ctrl+Shift+Esc`
2. Find **Python** processes → Right-click → End Task
3. Find **Node.js** processes → Right-click → End Task

### Method 3: Command Prompt
```cmd
taskkill /F /IM python.exe /T
taskkill /F /IM node.exe /T
```

---

## Prevent Browser Auto-Opening

After stopping, restart with:
```
start-no-browser.bat
```

This ensures the browser won't auto-open when React starts.

---

## What's Causing Auto-Open?

React's development server tries to open your default browser automatically. We've set `BROWSER=none`, but sometimes it's ignored. The new `start-no-browser.bat` script forces this setting.

---

## After Stopping

**Option 1: Start WITHOUT Browser Auto-Open (Recommended)**
```
start-no-browser.bat
```

**Option 2: Normal Start**
```
node start-dev-servers.js
```

**Option 3: Manual Access**
- Backend: http://localhost:8000
- Frontend: http://localhost:3005

---

## Quick Reference

| Script | Purpose |
|--------|---------|
| `EMERGENCY-STOP.bat` | 🛑 Kill everything forcefully |
| `FORCE-STOP.bat` | 🛑 Alternative force stop |
| `start-no-browser.bat` | ▶️ Start without auto-opening browser |
| `restart-servers.bat` | 🔄 Clean restart |
| `node start-dev-servers.js` | ▶️ Normal start |

---

## Still Can't Stop?

### Nuclear Option (Last Resort):
```powershell
# Run as Administrator
Get-Process | Where-Object {$_.ProcessName -like "*python*" -or $_.ProcessName -like "*node*" -or $_.ProcessName -like "*chrome*" -or $_.ProcessName -like "*msedge*"} | Stop-Process -Force
```

This kills **ALL** Python, Node, Chrome, and Edge processes on your system.

⚠️ **Warning**: This will close ALL browser windows and Node/Python programs!

---

## Need Help?

1. Run `EMERGENCY-STOP.bat`
2. Wait for it to finish
3. Close any remaining browser tabs manually
4. Restart with `start-no-browser.bat`

**That's it!** 🎉
