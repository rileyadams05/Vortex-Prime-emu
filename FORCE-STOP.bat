@echo off
echo ========================================
echo FORCE STOPPING ALL SERVERS
echo ========================================
echo.

echo Killing Python processes...
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM pythonw.exe /T >nul 2>&1

echo Killing Node.js processes...
taskkill /F /IM node.exe /T >nul 2>&1

echo Killing any browser processes spawned by React...
taskkill /F /IM chrome.exe /FI "WINDOWTITLE eq *localhost:3005*" >nul 2>&1
taskkill /F /IM msedge.exe /FI "WINDOWTITLE eq *localhost:3005*" >nul 2>&1
taskkill /F /IM firefox.exe /FI "WINDOWTITLE eq *localhost:3005*" >nul 2>&1

echo.
echo Waiting for processes to terminate...
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo All processes stopped!
echo ========================================
echo.
echo You can now safely restart with:
echo   node start-dev-servers.js
echo.
pause
