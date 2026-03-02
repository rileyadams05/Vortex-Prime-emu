# Azure App Registration Configuration Script for Vortex Prime Emulator
# This script uses the Azure CLI to configure the app registration with Xbox Live permissions.
# Usage: Ensure you are logged in via 'az login' before running.

$AppId = "8a444c9b-2c07-46f7-916f-e3089c615371"
$XboxLiveResourceId = "00000000-0000-0000-0000-000000000001"
$XboxLiveSigninScopeId = "eb099307-8e6f-442c-a2d9-e93fc6440e29"

Write-Host "Configuring Azure App Registration for App ID: $AppId" -ForegroundColor Cyan

# 1. Get the Object ID of the App Registration (needed for Graph API calls)
try {
    $app = az ad app show --id $AppId --output json | ConvertFrom-Json
    $ObjectId = $app.id
    Write-Host "Found App Object ID: $ObjectId" -ForegroundColor Green
} catch {
    Write-Error "Failed to find App Registration with ID $AppId. Please check the ID and your login status."
    exit 1
}

# 2. Update Basic Metadata (Branding)
Write-Host "Updating Application Branding..." -ForegroundColor Yellow
$brandingBody = @{
    displayName = "Vortex Prime Emulator"
    description = "A professional multi-platform dashboard for real-time achievement tracking and game library management."
    signInAudience = "AzureADandPersonalMicrosoftAccount"
} | ConvertTo-Json

# Use az rest to patch the application object
az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$ObjectId" --body $brandingBody --headers "Content-Type=application/json"
if ($?) { Write-Host "Branding updated successfully." -ForegroundColor Green }

# 3. Configure Redirect URIs (SPA/PublicClient)
Write-Host "Configuring Redirect URIs..." -ForegroundColor Yellow
$spaBody = @{
    publicClient = @{
        redirectUris = @(
            "http://localhost:3000/"
        )
    }
} | ConvertTo-Json -Depth 10

az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$ObjectId" --body $spaBody --headers "Content-Type=application/json"
if ($?) { Write-Host "Redirect URIs updated successfully." -ForegroundColor Green }

# 4. Force Add Xbox Live Permissions (requiredResourceAccess)
Write-Host "Adding Xbox Live Permissions..." -ForegroundColor Yellow

# Construct the requiredResourceAccess JSON structure
$permissionBody = @{
    requiredResourceAccess = @(
        @{
            resourceAppId = $XboxLiveResourceId
            resourceAccess = @(
                @{
                    id = $XboxLiveSigninScopeId
                    type = "Scope"
                }
            )
        },
        @{
            resourceAppId = "00000000-0000-0000-0000-000000000003" # Microsoft Graph
            resourceAccess = @(
                @{
                    id = "e1fe6dd8-ba31-4d61-89e7-88639da4683d" # User.Read
                    type = "Scope"
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/$ObjectId" --body $permissionBody --headers "Content-Type=application/json"

if ($?) { 
    Write-Host "Xbox Live permissions added successfully." -ForegroundColor Green 
    Write-Host "NOTE: You may need to grant admin consent in the portal if required by your tenant policy." -ForegroundColor Magenta
} else {
    Write-Error "Failed to update permissions."
}

Write-Host "Configuration Complete!" -ForegroundColor Cyan
