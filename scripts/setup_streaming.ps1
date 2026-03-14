# setup_streaming.ps1
# Automated Installation & Configuration for Vortex Prime Web Streaming
# Requires Administrator privileges

param(
    [switch]$AutoStart
)

function Write-Log($Message, $Color = "White") {
    Write-Host "[Vortex Streaming Setup] $Message" -ForegroundColor $Color
}

# Admin check is now handled by the main application manifest
# Assert-Admin removed.


$SunshinePath = "$env:ProgramFiles\Sunshine"
$ConfigPath = "$SunshinePath\config\sunshine.conf"

Write-Log "Step 1: Checking Sunshine installation..." "Cyan"
if (-not (Test-Path "$SunshinePath\sunshine.exe")) {
    Write-Log "Sunshine is not installed. You must install Sunshine first." "Yellow"
    Write-Log "Download the latest release from: https://github.com/LizardByte/Sunshine/releases" "Yellow"
    # Note: Downloading the exe directly and running silently could be done, 
    # but might trigger smartscreen or require reboot. For complete automation:
    Write-Log "Attempting to download and install Sunshine..." "Green"
    $sunshineUrl = "https://github.com/LizardByte/Sunshine/releases/latest/download/sunshine-windows-installer.exe"
    $installerPath = "$env:TEMP\sunshine-installer.exe"
    Invoke-WebRequest -Uri $sunshineUrl -OutFile $installerPath
    Write-Log "Running Sunshine silent installer..." "Cyan"
    Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait
}

Write-Log "Step 2: Securing Sunshine Configuration (Zero Setup)" "Cyan"
if (-not (Test-Path "$SunshinePath\config")) {
    New-Item -Path "$SunshinePath\config" -ItemType Directory -Force | Out-Null
}

$sunshineConfData = @"
# Network and Security Settings
lan_encryption_mode = none
origin_web_ui_allowed = enabled
origin_pin_allowed = enabled

# Custom Domain Integration
trusted_origins = https://Vortex-Prime-Emu-streaming

# Performance for Xenia
min_log_level = info
"@

Set-Content -Path $ConfigPath -Value $sunshineConfData
Write-Log "Overwrote sunshine.conf with no-passcode zero-configuration payload." "Green"

Write-Log "Step 3: Setting up Moonlight-Web-Stream Web Gateway..." "Cyan"
$WebStreamPath = "C:\Moonlight-Web-Stream"
if (-not (Test-Path $WebStreamPath)) {
    Write-Log "Downloading Moonlight-Web-Stream..." "Cyan"
    # To properly set up moonlight-web-stream, we would clone the repo and install node deps.
    # We will simulate the Node Setup assuming Node is installed.
    # Since the exact zip structure varies, we'll download the source.
    $repoUrl = "https://github.com/MrCreativ3001/moonlight-web-stream/archive/refs/heads/main.zip"
    $zipPath = "$env:TEMP\moonlight-web.zip"
    Invoke-WebRequest -Uri $repoUrl -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $env:TEMP -Force
    Move-Item -Path "$env:TEMP\moonlight-web-stream-main" -Destination $WebStreamPath -Force
    Write-Log "Moonlight Web Stream extracted to $WebStreamPath." "Green"
    
    # Inject Trust Certificate Button for Xbox Edge Gamepad API
    $IndexFilePath = "$WebStreamPath\public\index.html"
    if (-not (Test-Path $IndexFilePath)) { $IndexFilePath = "$WebStreamPath\index.html" }
    if (Test-Path $IndexFilePath) {
        $Injection = '<button onclick="window.open(`''https://Vortex-Prime-Emu-streaming`'', `''_blank`'')" style="position:fixed;bottom:20px;right:20px;z-index:9999;background-color:#107C10;color:#ffffff;border:none;padding:12px 24px;font-size:16px;font-weight:bold;border-radius:8px;box-shadow:0 4px 15px rgba(16,124,16,0.6);cursor:pointer;">Trust Certificate (Gamepad Fix)</button>'
        $HtmlContent = Get-Content $IndexFilePath -Raw
        if ($HtmlContent -notmatch "Trust Certificate") {
            $HtmlContent = $HtmlContent -replace '(<body[^>]*>)', "`$1`n    $Injection"
            Set-Content -Path $IndexFilePath -Value $HtmlContent
            Write-Log "Injected 'Trust Certificate' Gamepad Fix button into Portal UI." "Green"
        }
    }
}

Write-Log "Step 4: Real Domain & SSL Integration" "Cyan"
Write-Log "Generating self-signed SSL certificates for https://Vortex-Prime-Emu-streaming" "Cyan"
# Check if python is installed
if (Get-Command -Name python -ErrorAction SilentlyContinue) {
    Set-Location $WebStreamPath
    if (Test-Path "generate_certificate.py") {
        Write-Log "Running generate_certificate.py..." "Cyan"
        # Since standard generate script might ask questions, we would pipe answers. 
        # For full automation, passing non-interactive flags or generating via OpenSSL
        Start-Process -FilePath "python" -ArgumentList "generate_certificate.py --domain Vortex-Prime-Emu-streaming" -Wait -NoNewWindow
    } else {
        Write-Log "generate_certificate.py not found in repo." "Yellow"
    }
} else {
    Write-Log "Python not found. Please generate the certificate manually or ensure Python is installed." "Yellow"
}

# Add domain to hosts file mapping to localhost to fulfill standard DNS locally
$HostsFile = "$env:windir\System32\drivers\etc\hosts"
$HostEntry = "127.0.0.1 Vortex-Prime-Emu-streaming"
if (-not (Select-String -Path $HostsFile -Pattern "Vortex-Prime-Emu-streaming" -Quiet)) {
    Add-Content -Path $HostsFile -Value "`n$HostEntry"
    Write-Log "Added Vortex-Prime-Emu-streaming to Windows hosts file." "Green"
}

Write-Log "Step 5: Network requirement - Enabling UPnP (UDP 47998-48000)" "Cyan"
# Windows Firewall rules
New-NetFirewallRule -DisplayName "Sunshine UPnP / Streaming UDP" -Direction Inbound -Action Allow -Protocol UDP -LocalPort 47998-48000 -ErrorAction SilentlyContinue | Out-Null
New-NetFirewallRule -DisplayName "Sunshine UPnP / Streaming TCP" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 47984-47989,48010 -ErrorAction SilentlyContinue | Out-Null
Write-Log "Firewall rules for Sunshine streaming and Web UI added." "Green"

if ($AutoStart) {
    Write-Log "Step 6: Launching Background Services in Silent Mode..." "Cyan"
    
    # Start Sunshine
    Write-Log "Starting Sunshine..." "Cyan"
    Start-Process -FilePath "$SunshinePath\sunshine.exe" -WindowStyle Hidden
    
    # Start Web Server
    Write-Log "Starting Moonlight Web Stream Node server in zero-latency mode..." "Cyan"
    Set-Location $WebStreamPath
    if (Get-Command -Name npm -ErrorAction SilentlyContinue) {
        Start-Process -FilePath "npm" -ArgumentList "install" -Wait -WindowStyle Hidden
        Start-Process -FilePath "npm" -ArgumentList "start -- --video-codec h264 --low-latency" -WindowStyle Hidden
        Write-Log "Moonlight Web Stream started on port 3000 with h264 low-latency profile." "Green"
    } else {
        Write-Log "npm not found. Could not start Web Server automatically." "Red"
    }
}

Write-Log "Setup Complete! The Vortex Prime dashboard will now seamlessly integrate over Gamepad API." "Green"
Write-Log "You can reach the portal directly at https://Vortex-Prime-Emu-streaming" "Green"
