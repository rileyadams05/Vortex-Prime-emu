# Self-Contained Java Runtime Provisioning Script (Vortex Prime Emu)
# Objective: Provision portable Red Hat OpenJDK 17 LTS to /runtime/java_env

$PROJECT_ROOT = (Get-Item $PSScriptRoot).Parent.FullName
$JAVA_HOME = Join-Path $PROJECT_ROOT "runtime\java_env"
$JAVA_EXE = Join-Path $JAVA_HOME "bin\java.exe"
$ZIP_PATH = Join-Path $PROJECT_ROOT "runtime\jdk.zip"

if (Test-Path $JAVA_EXE) {
    Write-Host "[JAVA] Found bundled Java Runtime at $JAVA_EXE. Skipping download." -ForegroundColor Green
    exit 0
}

Write-Host "[JAVA] Bundled Java not found. Provisioning..." -ForegroundColor Yellow

# Ensure directory exists
if (!(Test-Path $JAVA_HOME)) {
    New-Item -ItemType Directory -Path $JAVA_HOME -Force | Out-Null
}

# Red Hat Build of OpenJDK 17.0.14 (LTS) for Windows x64 (Portable ZIP)
$JDK_URL = "https://access.redhat.com/fedora/java/openjdk-17-win-x64.zip"

# Use curl to download (standard on Win10/11)
Write-Host "[JAVA] Downloading Red Hat OpenJDK 17 LTS..."
curl.exe -L $JDK_URL -o $ZIP_PATH

if (!(Test-Path $ZIP_PATH) -or (Get-Item $ZIP_PATH).Length -lt 1MB) {
    Write-Host "[JAVA] ERROR: Download failed or zip is corrupted." -ForegroundColor Red
    exit 1
}

# Extract
Write-Host "[JAVA] Extracting JDK archive..."
Expand-Archive -Path $ZIP_PATH -DestinationPath $JAVA_HOME -Force

# Flatten: Red Hat ZIP usually contains a single folder like java-17-openjdk-17.0.14.7-1.portable.jdk.x86_64
$extracted_dirs = Get-ChildItem -Path $JAVA_HOME -Directory
if ($extracted_dirs.Count -eq 1) {
    $nested_dir = $extracted_dirs[0].FullName
    Write-Host "[JAVA] Flattening $nested_dir..."
    Get-ChildItem -Path $nested_dir | Move-Item -Destination $JAVA_HOME -Force
    Remove-Item $nested_dir -Force
}

# Clean up ZIP
Remove-Item $ZIP_PATH -ErrorAction SilentlyContinue

if (Test-Path $JAVA_EXE) {
    Write-Host "[JAVA] Successfully provisioned Java Runtime!" -ForegroundColor Green
} else {
    Write-Host "[JAVA] ERROR: java.exe missing after extraction." -ForegroundColor Red
    exit 1
}
