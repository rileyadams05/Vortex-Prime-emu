param(
  [string]$Version = "1.0.0",
  [string]$PackId = "com.vortexprime.ps3quicktool"
)

$ErrorActionPreference = 'Stop'

$proj = Join-Path $PSScriptRoot 'PS3QuickTool.csproj'
$publishDir = Join-Path $PSScriptRoot 'publish'

if (Test-Path $publishDir) { Remove-Item -Recurse -Force $publishDir }

& dotnet restore $proj

$rids = @('win-x64','osx-x64','linux-x64')
foreach ($rid in $rids) {
  & dotnet publish $proj -c Release -r $rid --self-contained true -p:PublishSingleFile=true -o (Join-Path $publishDir $rid)
}

# Requires Velopack CLI (vpk) to be installed on PATH
& vpk pack --packId $PackId --packVersion $Version --packDir (Join-Path $publishDir 'win-x64') --mainExe PS3QuickTool.exe
& vpk pack --packId $PackId --packVersion $Version --packDir (Join-Path $publishDir 'linux-x64') --mainExe PS3QuickTool
& vpk pack --packId $PackId --packVersion $Version --packDir (Join-Path $publishDir 'osx-x64') --mainExe PS3QuickTool
