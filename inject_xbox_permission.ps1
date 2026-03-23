$AppId = "8a444c9b-2c07-46f7-916f-e3089c615371"
$XboxLiveResourceId = "00000000-0000-0000-0000-000000000001" # This is the Xbox Live API Resource ID

# Connect to Microsoft Graph
Connect-MgGraph -Scopes "Application.ReadWrite.All"

# Get the Service Principal for the App
$ServicePrincipal = Get-MgServicePrincipal -Filter "AppId eq '$AppId'"

if ($null -eq $ServicePrincipal) {
    Write-Host "Application not found. Please verify the Client ID." -ForegroundColor Red
    exit
}

# Get the Service Principal for Xbox Live
$XboxLiveSP = Get-MgServicePrincipal -Filter "AppId eq '$XboxLiveResourceId'"

if ($null -eq $XboxLiveSP) {
    # If not found by AppId, try by name (sometimes known as Microsoft.XboxLive)
    $XboxLiveSP = Get-MgServicePrincipal -Filter "DisplayName eq 'Xbox Live'"
}

if ($null -eq $XboxLiveSP) {
    Write-Host "Xbox Live Service Principal not found in this tenant." -ForegroundColor Red
    exit
}

# Define the permission scope we want (XboxLive.signin)
$PermissionName = "XboxLive.signin"
$Permission = $XboxLiveSP.Oauth2PermissionScopes | Where-Object { $_.Value -eq $PermissionName }

if ($null -eq $Permission) {
    Write-Host "Permission '$PermissionName' not found in Xbox Live service principal." -ForegroundColor Red
    exit
}

# Add the permission to the application
# Note: This usually requires adding an AppRoleAssignment or updating RequiredResourceAccess in the Application object
# Since we are updating the App Registration (not Service Principal assignment for enterprise apps), we target the Application object.

$App = Get-MgApplication -Filter "AppId eq '$AppId'"

$ResourceAccess = @{
    ResourceAppId = $XboxLiveResourceId
    ResourceAccess = @(
        @{
            Id = $Permission.Id
            Type = "Scope" # Scope for Delegated permissions, Role for Application permissions
        }
    )
}

# Merge with existing required resource access if any
$ExistingAccess = $App.RequiredResourceAccess
if ($null -eq $ExistingAccess) {
    $ExistingAccess = @()
}

# Check if we already have access to this resource
$Found = $false
foreach ($Access in $ExistingAccess) {
    if ($Access.ResourceAppId -eq $XboxLiveResourceId) {
        $Found = $true
        # Add the new scope if not present
        $ScopeExists = $false
        foreach ($Scope in $Access.ResourceAccess) {
            if ($Scope.Id -eq $Permission.Id) {
                $ScopeExists = $true
                break
            }
        }
        if (-not $ScopeExists) {
            $Access.ResourceAccess += $ResourceAccess.ResourceAccess[0]
        }
    }
}

if (-not $Found) {
    $ExistingAccess += $ResourceAccess
}

# Update the Application
Update-MgApplication -ApplicationId $App.Id -RequiredResourceAccess $ExistingAccess

Write-Host "Successfully injected 'XboxLive.signin' permission into Application ID: $AppId" -ForegroundColor Green
