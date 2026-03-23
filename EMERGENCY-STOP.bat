@echo off
echo ========================================
echo EMERGENCY STOP - KILLING ALL PROCESSES
echo ========================================
echo.

echo Step 1: Killing Python (Backend)...
taskkill /F /IM python.exe /T 2>nul
if %errorlevel% equ 0 (
    echo   - Python processes killed
) else (
    echo   - No Python processes found
)

echo.
echo Step 2: Killing Node.js (Frontend)...
taskkill /F /IM node.exe /T 2>nul
if %errorlevel% equ 0 (
    echo   - Node.js processes killed
) else (
    echo   - No Node.js processes found
)

echo.
echo Step 3: Killing any auto-opened browsers...
taskkill /IM chrome.exe /F /FI "WINDOWTITLE eq *localhost:3005*" 2>nul
taskkill /IM msedge.exe /F /FI "WINDOWTITLE eq *localhost:3005*" 2>nul
taskkill /IM firefox.exe /F /FI "WINDOWTITLE eq *localhost:3005*" 2>nul

echo.
echo Step 4: Cleaning up ports...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3005') do taskkill /F /PID %%a 2>nul

echo.
echo Step 5: Waiting for cleanup...
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo ✅ ALL PROCESSES STOPPED
echo ========================================
echo.
echo The app should be fully stopped now.
echo.
echo To start again (without browser auto-open):
echo   start-no-browser.bat
echo.
echo Or manually:
echo   node start-dev-servers.js
echo.
pause
