<#
.SYNOPSIS
    Vortex Prime Protocol Handler Registration Script
    
.DESCRIPTION
    This PowerShell script registers the vortexprime:// custom URI scheme
    on Windows systems. It provides more flexibility than the .reg file
    by auto-detecting the installation path or allowing custom paths.
    
.PARAMETER InstallPath
    Optional. The full path to Vortex Prime UI.exe
    Default: C:\Program Files\Vortex Prime\Vortex Prime UI.exe
    
.PARAMETER Uninstall
    Switch to remove the protocol handler registration
    
.EXAMPLE
    .\Register-VortexPrimeProtocol.ps1
    
.EXAMPLE
    .\Register-VortexPrimeProtocol.ps1 -InstallPath "D:\Games\Vortex Prime\Vortex Prime UI.exe"
    
.EXAMPLE
    .\Register-VortexPrimeProtocol.ps1 -Uninstall
    
.NOTES
    Requires Administrator privileges to modify the registry
#>

param(
    [string]$InstallPath = "C:\Program Files\Vortex Prime\Vortex Prime UI.exe",
    [switch]$Uninstall
)

# Requires elevation
#Requires -RunAsAdministrator

$ProtocolName = "vortexprime"
$ProtocolDescription = "URL:Vortex Prime Protocol"
$RegistryPath = "HKCR:\$ProtocolName"

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Register-ProtocolHandler {
    param([string]$ExePath)
    
    # Verify the executable exists
    if (-not (Test-Path $ExePath)) {
        Write-Host ""
        Write-Host "ERROR: Executable not found at:" -ForegroundColor Red
        Write-Host "  $ExePath" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Please provide the correct path using -InstallPath parameter" -ForegroundColor Cyan
        Write-Host "Example: .\Register-VortexPrimeProtocol.ps1 -InstallPath 'D:\MyPath\Vortex Prime UI.exe'" -ForegroundColor Gray
        return $false
    }
    
    # Create HKCR PSDrive if it doesn't exist
    if (-not (Test-Path "HKCR:")) {
        New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT | Out-Null
    }
    
    try {
        Write-Host ""
        Write-Host "Registering vortexprime:// protocol handler..." -ForegroundColor Cyan
        Write-Host ""
        
        # Create the protocol key
        if (Test-Path $RegistryPath) {
            Remove-Item -Path $RegistryPath -Recurse -Force
        }
        
        New-Item -Path $RegistryPath -Force | Out-Null
        Set-ItemProperty -Path $RegistryPath -Name "(Default)" -Value $ProtocolDescription
        Set-ItemProperty -Path $RegistryPath -Name "URL Protocol" -Value ""
        
        # Create DefaultIcon key
        New-Item -Path "$RegistryPath\DefaultIcon" -Force | Out-Null
        Set-ItemProperty -Path "$RegistryPath\DefaultIcon" -Name "(Default)" -Value "`"$ExePath`",0"
        
        # Create shell\open\command structure
        New-Item -Path "$RegistryPath\shell" -Force | Out-Null
        New-Item -Path "$RegistryPath\shell\open" -Force | Out-Null
        New-Item -Path "$RegistryPath\shell\open\command" -Force | Out-Null
        Set-ItemProperty -Path "$RegistryPath\shell\open\command" -Name "(Default)" -Value "`"$ExePath`" `"%1`""
        
        Write-Host "SUCCESS: Protocol handler registered!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Details:" -ForegroundColor Cyan
        Write-Host "  Protocol:    $ProtocolName://" -ForegroundColor White
        Write-Host "  Executable:  $ExePath" -ForegroundColor White
        Write-Host ""
        Write-Host "You can now use vortexprime://launch in your browser to start the application." -ForegroundColor Gray
        Write-Host ""
        
        return $true
    }
    catch {
        Write-Host ""
        Write-Host "ERROR: Failed to register protocol handler" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Yellow
        Write-Host ""
        return $false
    }
}

function Unregister-ProtocolHandler {
    # Create HKCR PSDrive if it doesn't exist
    if (-not (Test-Path "HKCR:")) {
        New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT | Out-Null
    }
    
    try {
        Write-Host ""
        Write-Host "Removing vortexprime:// protocol handler..." -ForegroundColor Cyan
        Write-Host ""
        
        if (Test-Path $RegistryPath) {
            Remove-Item -Path $RegistryPath -Recurse -Force
            Write-Host "SUCCESS: Protocol handler removed!" -ForegroundColor Green
        }
        else {
            Write-Host "INFO: Protocol handler was not registered." -ForegroundColor Yellow
        }
        Write-Host ""
        return $true
    }
    catch {
        Write-Host ""
        Write-Host "ERROR: Failed to remove protocol handler" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Yellow
        Write-Host ""
        return $false
    }
}

# ============================================================
# Main Execution
# ============================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Vortex Prime Protocol Handler Registration" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

if (-not (Test-Administrator)) {
    Write-Host ""
    Write-Host "ERROR: This script requires Administrator privileges." -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

if ($Uninstall) {
    Unregister-ProtocolHandler
}
else {
    # Try to auto-detect common installation paths
    $possiblePaths = @(
        $InstallPath,
        "C:\Program Files\Vortex Prime\Vortex Prime UI.exe",
        "C:\Program Files (x86)\Vortex Prime\Vortex Prime UI.exe",
        "$env:LOCALAPPDATA\Vortex Prime\Vortex Prime UI.exe",
        "$env:APPDATA\Vortex Prime\Vortex Prime UI.exe"
    )
    
    $foundPath = $null
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $foundPath = $path
            break
        }
    }
    
    if ($foundPath -and $foundPath -ne $InstallPath) {
        Write-Host ""
        Write-Host "Found Vortex Prime at: $foundPath" -ForegroundColor Cyan
        $InstallPath = $foundPath
    }
    
    Register-ProtocolHandler -ExePath $InstallPath
}
