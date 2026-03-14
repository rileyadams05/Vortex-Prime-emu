@echo off
echo.
echo ========================================
echo Vortex Prime Emu - Setup Verification
echo ========================================
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js NOT found - Please install Node.js
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
    echo [OK] Node.js found: %NODE_VER%
)

REM Check npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [X] npm NOT found
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VER=%%i
    echo [OK] npm found: %NPM_VER%
)

REM Check Python
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [X] Python NOT found - Please install Python 3.x
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('python --version') do set PY_VER=%%i
    echo [OK] Python found: %PY_VER%
)

REM Check Rust/Cargo
where cargo >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [X] Cargo NOT found - Please install Rust
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('cargo --version') do set CARGO_VER=%%i
    echo [OK] Cargo found: %CARGO_VER%
)

REM Check project files
if not exist "start-dev-servers.js" (
    echo [X] start-dev-servers.js NOT found
    exit /b 1
) else (
    echo [OK] start-dev-servers.js exists
)

if not exist "backend\server.py" (
    echo [X] backend\server.py NOT found
    exit /b 1
) else (
    echo [OK] backend\server.py exists
)

if not exist "frontend\package.json" (
    echo [X] frontend\package.json NOT found
    exit /b 1
) else (
    echo [OK] frontend\package.json exists
)

if not exist "src-tauri\tauri.conf.json" (
    echo [X] src-tauri\tauri.conf.json NOT found
    exit /b 1
) else (
    echo [OK] src-tauri\tauri.conf.json exists
)

echo.
echo ========================================
echo All checks passed!
echo.
echo Ready to run: cargo tauri dev
echo ========================================
echo.
