@echo off
setlocal

echo ========================================
echo Starting Vortex Prime Emu
echo (Browser Auto-Open DISABLED)
echo ========================================
echo.

REM Set environment variables to prevent browser opening
set BROWSER=none
set SKIP_PREFLIGHT_CHECK=true

echo Starting servers...
echo.

node start-dev-servers.js

endlocal
