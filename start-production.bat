@echo off
echo ========================================
echo Starting Vortex Prime Emu (PRODUCTION)
echo Website: vortex-prime-emu.com
echo ========================================
echo.

echo Step 1: Starting local servers...
echo   - Backend: http://localhost:8000
echo   - Frontend: http://localhost:3005
echo.

REM Start the local development servers in background
start /B node start-dev-servers.js

echo Waiting for servers to be ready...
timeout /t 10 /nobreak >nul

echo.
echo Step 2: Starting Cloudflare Tunnel...
echo   - Tunnel ID: 1fad916c-1f3f-4e41-ac61-2b088b1c3c4c
echo   - Public URL: https://vortex-prime-emu.com
echo   - Discord Webhook: https://discord.vortex-prime-emu.com
echo.

REM Start Cloudflare tunnel with explicit config path (this will run in foreground)
cloudflared tunnel --config "%~dp0cloudflared.yml" run vortex

echo.
echo ========================================
echo If tunnel fails, make sure cloudflared is installed:
echo   winget install cloudflare.cloudflared
echo ========================================
pause
