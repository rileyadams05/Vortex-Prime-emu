# dev.ps1 — Kill everything, delete stale EXE, launch fresh dev session
# Usage: .\dev.ps1

$ProjectRoot = $PSScriptRoot

Write-Host "Killing any running instances..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.Name -match "vortex-prime|uvicorn|python" } |
    Stop-Process -Force -ErrorAction SilentlyContinue

# Kill node processes holding port 3005 or 8000
@(3005, 8000) | ForEach-Object {
    $conn = Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue
    if ($conn) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Start-Sleep -Seconds 1

# Always delete the stale release EXE so it can never be accidentally launched
$staleExe = Join-Path $ProjectRoot "src-tauri\target\release\vortex-prime.exe"
if (Test-Path $staleExe) {
    Remove-Item $staleExe -Force
    Write-Host "Deleted stale EXE." -ForegroundColor Cyan
}

Write-Host "Starting dev session (backend + frontend + Tauri)..." -ForegroundColor Green
Set-Location $ProjectRoot
npx tauri dev
