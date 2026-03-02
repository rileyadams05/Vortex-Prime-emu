@echo off
REM Vortex Prime - Development Launcher for Windows

echo.
echo ========================================
echo   Vortex Prime - Development Launcher
echo ========================================
echo.

REM Check if Rust is installed
where rustc >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Rust not found! Please install from https://rustup.rs/
    pause
    exit /b 1
)
echo [OK] Rust found

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install from https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found

REM Check if root dependencies are installed
if not exist "node_modules\" (
    echo.
    echo [INFO] Installing root dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check if frontend dependencies are installed
if not exist "frontend\node_modules\" (
    echo.
    echo [INFO] Installing frontend dependencies...
    cd frontend
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install frontend dependencies
        pause
        exit /b 1
    )
    cd ..
)

REM Check if Xenia exists
if not exist "src-tauri\resources\xenia\xenia-canary.exe" (
    echo.
    echo [WARNING] Xenia not found!
    echo           Expected location: src-tauri\resources\xenia\xenia-canary.exe
    echo           Download from: https://github.com/xenia-canary/xenia-canary/releases
    echo.
    echo Press any key to continue anyway...
    pause >nul
)

echo.
echo [INFO] Starting Vortex Prime...
echo.

REM Launch Tauri dev
call npm run dev

pause

REM Last Updated: March 2, 2026
