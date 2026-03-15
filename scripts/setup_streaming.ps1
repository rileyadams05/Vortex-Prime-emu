# setup_streaming.ps1
# Automated Installation & Configuration for Vortex Prime Streaming
# Runs silently in the background — no manual steps required for users
# Admin privileges handled by the main application manifest.

param(
    [switch]$AutoStart
)

function Write-Log($Message, $Color = "White") {
    Write-Host "[Vortex Streaming Setup] $Message" -ForegroundColor $Color
}

$SunshinePath = "$env:ProgramFiles\Sunshine"
$ConfigPath = "$SunshinePath\config\sunshine.conf"
$CloudflaredPath = "$env:TEMP\cloudflared.exe"
$TunnelUrlFile = "$env:TEMP\vortex_prime_tunnel_url.txt"

Write-Log "Step 1: Checking Sunshine installation..." "Cyan"
if (-not (Test-Path "$SunshinePath\sunshine.exe")) {
    Write-Log "Sunshine not found — downloading silent installer..." "Yellow"
    $sunshineUrl = "https://github.com/LizardByte/Sunshine/releases/latest/download/sunshine-windows-installer.exe"
    $installerPath = "$env:TEMP\sunshine-installer.exe"
    try {
        Invoke-WebRequest -Uri $sunshineUrl -OutFile $installerPath -UseBasicParsing
        Write-Log "Running Sunshine silent installer..." "Cyan"
        Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait
        Write-Log "Sunshine installed." "Green"
    } catch {
        Write-Log "Could not download Sunshine: $_" "Red"
    }
}

Write-Log "Step 2: Configuring Sunshine (zero-PIN + Cloudflare STUN)..." "Cyan"
if (-not (Test-Path "$SunshinePath\config")) {
    New-Item -Path "$SunshinePath\config" -ItemType Directory -Force | Out-Null
}

$sunshineConfData = @"
# Vortex Prime Auto-Configuration
# Network and Security Settings
lan_encryption_mode = none
origin_web_ui_allowed = enabled
origin_pin_allowed = enabled

# Cloudflare STUN for optimal NAT traversal and low latency
stun_server = stun.cloudflare.com:3478

# Performance
min_log_level = info
"@

Set-Content -Path $ConfigPath -Value $sunshineConfData
Write-Log "sunshine.conf written with Cloudflare STUN and zero-PIN config." "Green"

Write-Log "Step 3: Downloading cloudflared (Cloudflare Tunnel)..." "Cyan"
if (-not (Test-Path $CloudflaredPath)) {
    try {
        $cfUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        Invoke-WebRequest -Uri $cfUrl -OutFile $CloudflaredPath -UseBasicParsing
        Write-Log "cloudflared downloaded." "Green"
    } catch {
        Write-Log "Could not download cloudflared: $_" "Red"
    }
} else {
    Write-Log "cloudflared already present." "Green"
}

Write-Log "Step 4: Opening firewall ports for Sunshine streaming..." "Cyan"
New-NetFirewallRule -DisplayName "Vortex Prime Stream UDP" -Direction Inbound -Action Allow -Protocol UDP -LocalPort 47998-48000 -ErrorAction SilentlyContinue | Out-Null
New-NetFirewallRule -DisplayName "Vortex Prime Stream TCP" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 47984-47990,48010 -ErrorAction SilentlyContinue | Out-Null
Write-Log "Firewall rules applied (UDP 47998-48000, TCP 47984-47990, 48010)." "Green"

if ($AutoStart) {
    Write-Log "Step 5: Starting Sunshine in background..." "Cyan"
    if (Test-Path "$SunshinePath\sunshine.exe") {
        $sunshineRunning = Get-Process -Name "sunshine" -ErrorAction SilentlyContinue
        if (-not $sunshineRunning) {
            Start-Process -FilePath "$SunshinePath\sunshine.exe" -WindowStyle Hidden
            Write-Log "Sunshine started." "Green"
        } else {
            Write-Log "Sunshine already running." "Green"
        }
    }

    Write-Log "Step 6: Starting Cloudflare Tunnel (Sunshine web UI → public HTTPS)..." "Cyan"
    if (Test-Path $CloudflaredPath) {
        # Kill any stale cloudflared tunnels for this purpose
        Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

        # Launch cloudflared quick tunnel pointing at Sunshine's local web UI (port 47990)
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $CloudflaredPath
        $psi.Arguments = "tunnel --url http://localhost:47990 --no-autoupdate"
        $psi.UseShellExecute = $false
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true

        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo = $psi
        $proc.Start() | Out-Null

        # Read cloudflared stderr until the trycloudflare.com URL appears (up to 30 s)
        $deadline = [DateTime]::Now.AddSeconds(30)
        $tunnelUrl = $null
        while ([DateTime]::Now -lt $deadline -and -not $proc.StandardError.EndOfStream) {
            $line = $proc.StandardError.ReadLine()
            if ($line -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
                $tunnelUrl = $matches[0]
                break
            }
        }

        if ($tunnelUrl) {
            Set-Content -Path $TunnelUrlFile -Value $tunnelUrl -NoNewline
            Write-Log "Cloudflare Tunnel active: $tunnelUrl" "Green"
            Write-Log "Streaming portal is now reachable from any device at: $tunnelUrl" "Green"
        } else {
            Write-Log "cloudflared started but tunnel URL not yet captured — it will appear shortly." "Yellow"
            # Keep reading in background via a job
            Start-Job -ScriptBlock {
                param($proc, $urlFile)
                $deadline = [DateTime]::Now.AddSeconds(60)
                while ([DateTime]::Now -lt $deadline -and -not $proc.StandardError.EndOfStream) {
                    $line = $proc.StandardError.ReadLine()
                    if ($line -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
                        Set-Content -Path $urlFile -Value $matches[0] -NoNewline
                        break
                    }
                }
            } -ArgumentList $proc, $TunnelUrlFile | Out-Null
        }
    } else {
        Write-Log "cloudflared not found — skipping tunnel. Streaming portal will be LAN-only." "Yellow"
    }
}

Write-Log "Vortex Prime streaming setup complete." "Green"
