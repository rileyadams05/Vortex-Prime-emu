# Vortex Prime — Service Startup Script
# Starts all background services required for the web backend and PC streaming.
#
# Usage:
#   .\start-services.ps1            — start everything
#   .\start-services.ps1 -NoTauri  — start services only, skip launching the Tauri app
#
# Installed as a Windows logon task by install-startup.ps1
# Log written to: %TEMP%\vortex_startup.log

param(
    [switch]$NoTauri
)

$ErrorActionPreference = 'SilentlyContinue'

# --- Paths -------------------------------------------------------------------
$ProjectRoot   = Split-Path $PSScriptRoot -Parent
$BackendDir    = Join-Path $ProjectRoot "backend"
$TauriExe      = Join-Path $ProjectRoot "src-tauri\target\release\vortex-prime.exe"
$Cloudflared   = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$CloudflaredQt = "$env:TEMP\cloudflared.exe"          # quick-tunnel binary
$TunnelConfig  = "$env:USERPROFILE\.cloudflared\config.yml"
$Sunshine      = "C:\Program Files\Sunshine\sunshine.exe"
$TunnelUrlFile = "$env:TEMP\vortex_prime_tunnel_url.txt"
$LogFile       = "$env:TEMP\vortex_startup.log"

# --- Logging -----------------------------------------------------------------
function Write-Log($msg) {
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

# Rotate log if it is larger than 512 KB
if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 524288) {
    Move-Item $LogFile "$LogFile.old" -Force
}
Write-Log "=== Vortex Prime Startup ==="

# --- Helper: check if a port is already in use -------------------------------
function Test-PortInUse($port) {
    $null -ne (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
               Select-Object -First 1)
}

# 1. Backend — uvicorn on port 8000 -------------------------------------------
if (Test-PortInUse 8000) {
    Write-Log "Backend already running on port 8000 — skipping"
} else {
    Write-Log "Starting backend (uvicorn on port 8000)..."
    Start-Process -FilePath "python" `
        -ArgumentList "-m uvicorn server:app --host 0.0.0.0 --port 8000" `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

# 2. Named Cloudflare tunnel → discord.vortex-prime-emu.com -------------------
if (-not (Test-Path $Cloudflared)) {
    Write-Log "WARNING: Named cloudflared not found at $Cloudflared — skipping"
} elseif (Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue |
          Where-Object { $_.CommandLine -like "*config.yml*" }) {
    Write-Log "Named Cloudflare tunnel already running — skipping"
} else {
    Write-Log "Starting named Cloudflare tunnel (discord.vortex-prime-emu.com)..."
    Start-Process -FilePath $Cloudflared `
        -ArgumentList "tunnel --config `"$TunnelConfig`" run" `
        -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

# 3. Sunshine — streaming host ------------------------------------------------
if (-not (Test-Path $Sunshine)) {
    Write-Log "WARNING: Sunshine not found at $Sunshine — skipping"
} elseif (Get-Process -Name "sunshine" -ErrorAction SilentlyContinue) {
    Write-Log "Sunshine already running — skipping"
} else {
    Write-Log "Starting Sunshine..."
    Start-Process -FilePath $Sunshine -WindowStyle Hidden
    Start-Sleep -Seconds 4
}

# 4. Quick Cloudflare tunnel → localhost:47990 (Sunshine web UI) --------------
if (-not (Test-Path $CloudflaredQt)) {
    Write-Log "WARNING: Quick-tunnel cloudflared not found at $CloudflaredQt — skipping"
} else {
    # Kill any stale quick-tunnel process that isn't the named one
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -notlike "*config.yml*" } |
        Stop-Process -Force -ErrorAction SilentlyContinue

    $qtOut = "$env:TEMP\vortex_qt_stdout.txt"
    $qtErr = "$env:TEMP\vortex_qt_stderr.txt"
    Remove-Item $qtOut, $qtErr -Force -ErrorAction SilentlyContinue

    Write-Log "Starting quick tunnel (localhost:47990 → trycloudflare.com)..."
    Start-Process -FilePath $CloudflaredQt `
        -ArgumentList "tunnel --url http://localhost:47990" `
        -RedirectStandardOutput $qtOut `
        -RedirectStandardError  $qtErr `
        -WindowStyle Hidden

    # Poll both stdout and stderr for the HTTPS URL (appears within ~20 s)
    Write-Log "Waiting for tunnel URL..."
    $tunnelUrl = $null
    $deadline  = (Get-Date).AddSeconds(45)

    while ((Get-Date) -lt $deadline -and -not $tunnelUrl) {
        Start-Sleep -Milliseconds 500
        foreach ($f in @($qtOut, $qtErr)) {
            if (Test-Path $f) {
                $content = Get-Content $f -Raw -ErrorAction SilentlyContinue
                $match   = [regex]::Match($content, 'https://[a-z0-9\-]+\.trycloudflare\.com')
                if ($match.Success) { $tunnelUrl = $match.Value; break }
            }
        }
    }

    if ($tunnelUrl) {
        # Write without trailing newline so Rust's trim() reads it cleanly
        [System.IO.File]::WriteAllText($TunnelUrlFile, $tunnelUrl)
        Write-Log "Tunnel URL: $tunnelUrl"
    } else {
        Write-Log "WARNING: Tunnel URL not captured within 45 s — streaming auto-discovery may not work"
    }
}

# 5. Tauri app — registers IP + tunnel URL with backend every 60 s ------------
if ($NoTauri) {
    Write-Log "Skipping Tauri launch (-NoTauri flag set)"
} elseif (-not (Test-Path $TauriExe)) {
    Write-Log "WARNING: Vortex Prime exe not found at $TauriExe — skipping"
} else {
    Write-Log "Launching Vortex Prime..."
    Start-Process -FilePath $TauriExe
}

Write-Log "Startup complete. Full log: $LogFile"
