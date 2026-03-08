@echo off
REM Vortex Prime - 100% Guaranteed Auto-Git Sync Engine Launcher

echo.
echo ========================================
echo   Auto-Git Sync Engine
echo ========================================
echo.
echo Starting the background synchronizer...
echo This will automatically upload your code to GitHub every time you save a file.

start "Vortex Prime - Auto-Git Sync Engine" powershell -NoExit -ExecutionPolicy Bypass -File scripts\auto_git_sync.ps1

echo [OK] Synchronizer is now running in a new window!
timeout /t 3
exit
