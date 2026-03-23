@echo off
REM Vortex Prime - Stealth Auto-Git Sync Engine Launcher
REM This launcher runs completely invisibly in the background.

start /b powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File scripts\auto_git_sync.ps1
exit
