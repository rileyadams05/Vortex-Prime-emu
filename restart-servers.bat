@echo off
echo ========================================
echo Restarting Vortex Prime Emu Servers
echo ========================================
echo.

echo Stopping existing processes...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*" >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *npm*" >nul 2>&1
timeout /t 2 /nobreak >nul

echo Starting servers...
node start-dev-servers.js
