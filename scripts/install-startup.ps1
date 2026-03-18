# Vortex Prime — Install Startup Task
# Registers start-services.ps1 as a Windows Task Scheduler task that runs
# automatically every time you log in to Windows.
#
# Run this script ONCE as Administrator:
#   Right-click PowerShell → "Run as Administrator"
#   cd "M:\my project\my-emu\scripts"
#   .\install-startup.ps1
#
# To uninstall:
#   Unregister-ScheduledTask -TaskName "VortexPrimeStartup" -Confirm:$false

#Requires -RunAsAdministrator

$TaskName   = "VortexPrimeStartup"
$ScriptPath = Join-Path $PSScriptRoot "start-services.ps1"

if (-not (Test-Path $ScriptPath)) {
    Write-Error "start-services.ps1 not found at: $ScriptPath"
    exit 1
}

$action = New-ScheduledTaskAction `
    -Execute  "pwsh.exe" `
    -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$ScriptPath`""

# Trigger: at logon of the current user
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit  (New-TimeSpan -Minutes 5) `
    -MultipleInstances   IgnoreNew `
    -StartWhenAvailable

# Run with the highest available privileges (needed for Get-NetTCPConnection)
$principal = New-ScheduledTaskPrincipal `
    -UserId    $env:USERNAME `
    -LogonType Interactive `
    -RunLevel  Highest

Register-ScheduledTask `
    -TaskName  $TaskName `
    -Action    $action `
    -Trigger   $trigger `
    -Settings  $settings `
    -Principal $principal `
    -Force | Out-Null

Write-Host ""
Write-Host "  Startup task registered successfully." -ForegroundColor Green
Write-Host ""
Write-Host "  Task name : $TaskName" -ForegroundColor Cyan
Write-Host "  Script    : $ScriptPath" -ForegroundColor Cyan
Write-Host "  Trigger   : At logon ($env:USERNAME)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor Gray
Write-Host "    Run now  : Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "    Status   : Get-ScheduledTask  -TaskName '$TaskName' | Select-Object State" -ForegroundColor Gray
Write-Host "    Remove   : Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false" -ForegroundColor Gray
Write-Host ""
