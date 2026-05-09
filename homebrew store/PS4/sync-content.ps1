# Requires: PowerShell 5+
# Purpose: Mirror docs/ into PS4 PKG content tree under app0\Homebrew Store\PS4\

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Resolve-Path (Join-Path $root '..' '..' 'docs')
$dest   = Join-Path $root 'app0' 'Homebrew Store' 'PS4'

Write-Host "Source : $source"
Write-Host "Dest   : $dest"

New-Item -ItemType Directory -Force -Path $dest | Out-Null

# Prefer robocopy for speed and reliability on Windows
$robocopy = "$env:SystemRoot\System32\robocopy.exe"
if (Test-Path $robocopy) {
  & $robocopy "$source" "$dest" /MIR /R:1 /W:1 /NFL /NDL /NP /NJH /NJS | Out-Null
} else {
  # Fallback copy for environments without robocopy
  if (Test-Path $dest) { Remove-Item -Recurse -Force "$dest\*" }
  Copy-Item -Recurse -Force "$source\*" $dest
}

Write-Host "Synced docs/ to app0\\Homebrew Store\\PS4\\"
Write-Host "Place your eboot.bin at:    $($root)\app0\eboot.bin"
Write-Host "Place your PARAM.SFO at:    $($root)\sce_sys\param.sfo"
Write-Host "PKG root for TrueAncestor:  $($root)"
