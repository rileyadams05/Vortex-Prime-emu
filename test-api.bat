@echo off
echo ========================================
echo Testing API Configuration
echo ========================================
echo.

echo Checking if backend is running on port 8000...
timeout /t 1 /nobreak >nul

node test-api-config.js

echo.
echo ========================================
if %ERRORLEVEL% EQU 0 (
    echo Test completed!
) else (
    echo Test failed - backend may not be running
    echo Try running: restart-servers.bat
)
echo ========================================
pause
