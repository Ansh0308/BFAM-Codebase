# Rebuilds the player (mobile-web) site and publishes it to the Azure Static Web App
# created by deploy-azure.ps1. Use this after any app UI change - it does not touch
# the backend, database or VM.  Needs `az login`.
#
#   powershell -ExecutionPolicy Bypass -File .\deploy\publish-web.ps1
#
# Plain ASCII on purpose (Windows PowerShell 5.1 mis-reads other characters).

$ErrorActionPreference = 'Continue'
$RepoRoot   = Split-Path -Parent $PSScriptRoot
$SecretsDir = Join-Path $env:USERPROFILE 'bfam-secrets'

function Step([string]$msg) { Write-Host ""; Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg) -ForegroundColor Cyan }

$AzExe = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
if (-not (Test-Path $AzExe)) { $c = Get-Command az -ErrorAction SilentlyContinue; if ($c) { $AzExe = $c.Source } else { Write-Host 'Azure CLI (az) not found.' -ForegroundColor Red; exit 1 } }

$namesFile = Join-Path $SecretsDir 'azure-names.env'
if (-not (Test-Path $namesFile)) { Write-Host 'azure-names.env not found - run deploy-azure.ps1 first.' -ForegroundColor Red; exit 1 }
$suf = $null
foreach ($line in Get-Content $namesFile) { if ($line -match '^\s*SUF=(.+)$') { $suf = $matches[1].Trim() } }
if (-not $suf) { Write-Host 'SUF missing in azure-names.env' -ForegroundColor Red; exit 1 }

$Rg     = 'bfam-beta'
$Swa    = "bfam-web-$suf"
$ApiUrl = "https://bfam-beta-$suf.southindia.cloudapp.azure.com"

Step "Building the player site against $ApiUrl"
Push-Location (Join-Path $RepoRoot 'apps\mobile')
try {
  $env:EXPO_PUBLIC_API_URL = $ApiUrl
  $env:EXPO_NO_TELEMETRY = '1'
  & npm run export:web
  if ($LASTEXITCODE -ne 0) { Write-Host 'expo export failed' -ForegroundColor Red; exit 1 }
} finally { Pop-Location }

Step "Publishing to Azure Static Web Apps ($Swa)"
$token = (& $AzExe staticwebapp secrets list -n $Swa -g $Rg --query properties.apiKey -o tsv).Trim()
if (-not $token) { Write-Host 'Could not read the deployment token (are you logged in with az login?).' -ForegroundColor Red; exit 1 }
$env:SWA_CLI_DEPLOYMENT_TOKEN = $token
Push-Location $RepoRoot
try {
  & npx --yes '@azure/static-web-apps-cli' deploy (Join-Path $RepoRoot 'apps\mobile\dist') --env production
  if ($LASTEXITCODE -ne 0) { Write-Host 'swa deploy failed' -ForegroundColor Red; exit 1 }
} finally { Pop-Location; Remove-Item Env:\SWA_CLI_DEPLOYMENT_TOKEN -ErrorAction SilentlyContinue }

$host_ = (& $AzExe staticwebapp show -n $Swa -g $Rg --query defaultHostname -o tsv).Trim()
Write-Host ""
Write-Host ("Published. Player site: https://" + $host_) -ForegroundColor Green
Write-Host "Phones may show the old version for up to a minute; pull down to refresh or reopen the tab."
