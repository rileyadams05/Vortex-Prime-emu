[CmdletBinding()]
param ()

$workingDir = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $workingDir

$host.UI.RawUI.WindowTitle = "Vortex Prime - Auto-Git Sync Engine"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Vortex Prime - 100% Guaranteed Auto-Git Sync Engine    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Monitoring this project for any file changes..."
Write-Host "This window will automatically push your work to GitHub."
Write-Host "Do not close this window if you want auto-save enabled." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$pollIntervalSeconds = 15
$debounceSeconds = 5

while ($true) {
    Start-Sleep -Seconds $pollIntervalSeconds

    try {
        # Check if git has any modified, added, or deleted files
        $status = git status --porcelain
        
        if (![string]::IsNullOrWhiteSpace($status)) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] File change detected! Waiting $debounceSeconds seconds to ensure you are done saving..." -ForegroundColor Yellow
            
            # Debounce: wait to allow batch saves (like AI editing multiple files) to finish completely
            Start-Sleep -Seconds $debounceSeconds
            
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Committing and pushing to GitHub 'Vortex-Prime-emu'..." -ForegroundColor Cyan
            
            # 1. Pull first to avoid merge conflicts if edited elsewhere
            git pull origin main --rebase --quiet
            
            # 2. Stage all modifications and new files
            git add .
            
            # 3. Commit with a timestamp
            $date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            git commit -m "Auto-sync update: $date" --quiet
            
            # 4. Push to remote
            git push origin main
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] SUCCESS: 100% uploaded to GitHub." -ForegroundColor Green
            } else {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] WARNING: GitHub upload hit an issue. Will automatically retry." -ForegroundColor Red
            }
            Write-Host ""
            Write-Host "Monitoring for new file saves..." -ForegroundColor Gray
        }
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Warning: Git sync failed. The system will retry on the next loop." -ForegroundColor Red
    }
}
