# BFAM beta - one-shot Azure deployment (Windows PowerShell 5.1+).
#
# Creates, in the Azure subscription you are logged into with `az login`:
#   resource group, static public IP + DNS name, firewall rules, an Ubuntu VM running
#   Docker (backend + Redis + Caddy HTTPS), MySQL Flexible Server, and a Static Web App
#   for the player (mobile-web) site. Then it configures and starts the backend, seeds the
#   beta admin/owner accounts, and publishes the mobile-web build.
#
# Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File .\deploy\deploy-azure.ps1
#
# It is safe to re-run: steps that already exist are skipped. It reads (never prints)
# secrets from  %USERPROFILE%\bfam-secrets\  and writes a log there too.
# This file is plain ASCII on purpose (Windows PowerShell 5.1 mis-reads other characters).

param(
  [switch]$SkipWeb   # skip building/publishing the mobile-web site
)

$ErrorActionPreference = 'Continue'   # native-command failures are checked via $LASTEXITCODE
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RepoRoot   = Split-Path -Parent $PSScriptRoot
$SecretsDir = Join-Path $env:USERPROFILE 'bfam-secrets'
$Log        = Join-Path $SecretsDir 'deploy-azure.log'
Start-Transcript -Path $Log -Append | Out-Null

function Step([string]$msg) { Write-Host ""; Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg) -ForegroundColor Cyan }
function Fail([string]$msg) { Write-Host ("FAILED: " + $msg) -ForegroundColor Red; Stop-Transcript | Out-Null; exit 1 }

# ---------- tools ----------
$AzExe = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
if (-not (Test-Path $AzExe)) { $c = Get-Command az -ErrorAction SilentlyContinue; if ($c) { $AzExe = $c.Source } else { Fail 'Azure CLI (az) not found.' } }

$SshExe = Join-Path $env:SystemRoot 'System32\OpenSSH\ssh.exe'
$ScpExe = Join-Path $env:SystemRoot 'System32\OpenSSH\scp.exe'
if (-not (Test-Path $SshExe)) {
  $g = 'C:\Program Files\Git\usr\bin'
  if (Test-Path (Join-Path $g 'ssh.exe')) { $SshExe = Join-Path $g 'ssh.exe'; $ScpExe = Join-Path $g 'scp.exe' } else { Fail 'ssh/scp not found (install the Windows OpenSSH client).' }
}

function Invoke-Az {
  & $AzExe @args
  if ($LASTEXITCODE -ne 0) { throw ("az " + ($args[0..2] -join ' ') + " failed (exit " + $LASTEXITCODE + ")") }
}
function Test-Az { & $AzExe @args *> $null; return ($LASTEXITCODE -eq 0) }

function Read-EnvFile([string]$path) {
  if (-not (Test-Path $path)) { Fail ("Missing file: " + $path) }
  $h = @{}
  foreach ($line in Get-Content $path) { if ($line -match '^\s*([A-Za-z0-9_]+)=(.*)$') { $h[$matches[1]] = $matches[2].TrimEnd("`r") } }
  return $h
}
function Write-LfFile([string]$path, [string]$text) {
  [IO.File]::WriteAllText($path, ($text -replace "`r`n", "`n"), (New-Object Text.UTF8Encoding $false))
}

try {
  # ---------- secrets + names ----------
  $gen   = Read-EnvFile (Join-Path $SecretsDir 'generated.env')
  $admin = Read-EnvFile (Join-Path $SecretsDir 'admin-login.env')
  foreach ($k in 'DB_ADMIN_USER','DB_ADMIN_PASSWORD','JWT_SECRET','OWNER_PASSWORD') { if (-not $gen[$k]) { Fail ("generated.env is missing " + $k) } }
  foreach ($k in 'BETA_ADMIN_PHONE','BETA_ADMIN_PASSWORD') { if (-not $admin[$k]) { Fail ("admin-login.env is missing " + $k) } }

  $namesFile = Join-Path $SecretsDir 'azure-names.env'
  if (-not (Test-Path $namesFile)) {
    $suf = -join ((1..4) | ForEach-Object { '0123456789abcdef'[(Get-Random -Maximum 16)] })
    Write-LfFile $namesFile ("SUF=" + $suf + "`n")
  }
  $suf = (Read-EnvFile $namesFile)['SUF']

  $Region  = 'southindia'
  $Rg      = 'bfam-beta'
  $Label   = "bfam-beta-$suf"
  $Fqdn    = "$Label.$Region.cloudapp.azure.com"
  $Mysql   = "bfam-mysql-$suf"
  $MysqlHost = "$Mysql.mysql.database.azure.com"
  $Swa     = "bfam-web-$suf"
  $Vm      = 'bfam-beta-vm'
  $Image   = 'ghcr.io/ansh0308/bfam-backend:latest'
  $KeyPath = (Join-Path $SecretsDir 'deploy_key').Replace('\', '/')
  $PubKey  = Join-Path $SecretsDir 'deploy_key.pub'
  $KnownHosts = (Join-Path $SecretsDir 'known_hosts').Replace('\', '/')

  Step "Checking the Azure login"
  $acct = & $AzExe account show --query user.name -o tsv
  if ($LASTEXITCODE -ne 0 -or -not $acct) { Fail 'Not logged in. Run: az login' }
  Write-Host ("Logged in as " + $acct)
  Write-Host ("Region $Region, resource group $Rg, API address https://$Fqdn")

  # The SSH key must be readable only by you or Windows OpenSSH refuses it.
  & icacls (Join-Path $SecretsDir 'deploy_key') /inheritance:r /grant:r ($env:USERNAME + ':R') *> $null

  # ---------- resource providers ----------
  Step "Making sure the Azure services are registered"
  foreach ($p in 'Microsoft.Compute','Microsoft.Network','Microsoft.DBforMySQL','Microsoft.Web','Microsoft.Storage') {
    $state = & $AzExe provider show -n $p --query registrationState -o tsv
    if ($state -ne 'Registered') { & $AzExe provider register -n $p --wait | Out-Null }
  }

  # ---------- resource group, IP, firewall ----------
  Step "Resource group"
  Invoke-Az group create -n $Rg -l $Region -o none

  Step "Static public IP with the DNS name $Fqdn"
  if (-not (Test-Az network public-ip show -g $Rg -n bfam-beta-ip)) {
    Invoke-Az network public-ip create -g $Rg -n bfam-beta-ip -l $Region --sku Standard --allocation-method Static --version IPv4 --dns-name $Label -o none
  }
  $VmIp = (& $AzExe network public-ip show -g $Rg -n bfam-beta-ip --query ipAddress -o tsv).Trim()
  Write-Host ("Public IP: " + $VmIp)

  Step "Firewall (SSH only from this computer, web from everywhere)"
  $MyIp = (Invoke-RestMethod -Uri 'https://api.ipify.org').ToString().Trim()
  if (-not (Test-Az network nsg show -g $Rg -n bfam-beta-nsg)) { Invoke-Az network nsg create -g $Rg -n bfam-beta-nsg -l $Region -o none }
  # Recreated on every run so a changed home IP is picked up.
  Invoke-Az network nsg rule create -g $Rg --nsg-name bfam-beta-nsg -n allow-ssh-me --priority 100 --access Allow --protocol Tcp --direction Inbound --destination-port-ranges 22 --source-address-prefixes "$MyIp/32" -o none
  Invoke-Az network nsg rule create -g $Rg --nsg-name bfam-beta-nsg -n allow-http --priority 110 --access Allow --protocol Tcp --direction Inbound --destination-port-ranges 80 --source-address-prefixes '*' -o none
  Invoke-Az network nsg rule create -g $Rg --nsg-name bfam-beta-nsg -n allow-https --priority 120 --access Allow --protocol Tcp --direction Inbound --destination-port-ranges 443 --source-address-prefixes '*' -o none

  # ---------- static web app (player site) ----------
  Step "Static Web App for the player site"
  if (-not (Test-Az staticwebapp show -n $Swa -g $Rg)) {
    Invoke-Az staticwebapp create -n $Swa -g $Rg -l eastasia --sku Free -o none
  }
  $SwaHost = (& $AzExe staticwebapp show -n $Swa -g $Rg --query defaultHostname -o tsv).Trim()
  if (-not $SwaHost) { Fail 'Could not read the Static Web App address.' }
  Write-Host ("Player site: https://" + $SwaHost)

  # ---------- virtual machine ----------
  Step "Virtual machine (Ubuntu 24.04, B2ats v2 - on the free list). About 3 minutes."
  if (-not (Test-Az vm show -g $Rg -n $Vm)) {
    $cloudInit = Join-Path $PSScriptRoot 'cloud-init.yaml'
    $ok = $true
    try {
      Invoke-Az vm create -g $Rg -n $Vm -l $Region --image 'Canonical:ubuntu-24_04-lts:server:latest' --size Standard_B2ats_v2 --admin-username azureuser --ssh-key-values $PubKey --public-ip-address bfam-beta-ip --nsg bfam-beta-nsg --storage-sku Premium_LRS --os-disk-size-gb 64 --custom-data $cloudInit -o none
    } catch { $ok = $false; Write-Host ("First attempt failed: " + $_.Exception.Message) -ForegroundColor Yellow }
    if (-not $ok) {
      Write-Host 'Retrying with a standard SSD disk...' -ForegroundColor Yellow
      Invoke-Az vm create -g $Rg -n $Vm -l $Region --image 'Canonical:ubuntu-24_04-lts:server:latest' --size Standard_B2ats_v2 --admin-username azureuser --ssh-key-values $PubKey --public-ip-address bfam-beta-ip --nsg bfam-beta-nsg --storage-sku StandardSSD_LRS --custom-data $cloudInit -o none
    }
  }

  # ---------- database ----------
  Step "MySQL Flexible Server (B1ms, 32 GB, MySQL 8.0). This is the slow one: 5-10 minutes."
  if (-not (Test-Az mysql flexible-server show -g $Rg -n $Mysql)) {
    & $AzExe mysql flexible-server create -g $Rg -n $Mysql -l $Region -u $gen['DB_ADMIN_USER'] -p $gen['DB_ADMIN_PASSWORD'] --sku-name Standard_B1ms --tier Burstable --storage-size 32 --storage-auto-grow Disabled --version 8.0.21 --database-name bfam --public-access $VmIp --high-availability Disabled --backup-retention 7 --yes -o none
    if ($LASTEXITCODE -ne 0) { throw 'MySQL server creation failed' }
  }
  # Match the local MySQL the tests ran on (no auto-added hidden primary keys). Not critical.
  & $AzExe mysql flexible-server parameter set -g $Rg -s $Mysql --name sql_generate_invisible_primary_key --value OFF -o none 2>$null

  # ---------- configure the VM ----------
  Step "Waiting for the VM to accept SSH and finish installing Docker"
  $sshOpts = @('-i', $KeyPath, '-o', 'StrictHostKeyChecking=accept-new', '-o', ("UserKnownHostsFile=" + $KnownHosts), '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15')
  function Invoke-Ssh([string]$cmd) {
    & $SshExe @sshOpts ("azureuser@" + $VmIp) $cmd
    if ($LASTEXITCODE -ne 0) { throw ("remote command failed: " + $cmd.Substring(0, [Math]::Min(60, $cmd.Length))) }
  }
  $ready = $false
  for ($i = 1; $i -le 40; $i++) {
    & $SshExe @sshOpts ("azureuser@" + $VmIp) 'echo ready' *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 10
  }
  if (-not $ready) { throw 'The VM did not accept SSH within ~7 minutes (is your IP still the one allowed on port 22?).' }
  Invoke-Ssh 'cloud-init status --wait > /dev/null 2>&1; docker --version && docker compose version && test -d /opt/bfam'

  Step "Writing configuration and starting the backend"
  $tmp = Join-Path $SecretsDir 'upload'
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  Write-LfFile (Join-Path $tmp '.env') ("SITE_ADDRESS=$Fqdn`nBACKEND_IMAGE=$Image`n")
  $backendEnv = @"
DB_HOST=$MysqlHost
DB_PORT=3306
DB_NAME=bfam
DB_USER=$($gen['DB_ADMIN_USER'])
DB_PASSWORD=$($gen['DB_ADMIN_PASSWORD'])
DB_SSL=true
JWT_SECRET=$($gen['JWT_SECRET'])
CORS_ORIGIN=https://$SwaHost
OTP_MODE=static
STATIC_OTP_CODE=123456
"@
  Write-LfFile (Join-Path $tmp 'backend.env') $backendEnv
  Write-LfFile (Join-Path $tmp 'docker-compose.azure.yml') (Get-Content -Raw (Join-Path $PSScriptRoot 'docker-compose.azure.yml'))
  Write-LfFile (Join-Path $tmp 'Caddyfile') (Get-Content -Raw (Join-Path $PSScriptRoot 'Caddyfile'))

  foreach ($f in '.env','backend.env','docker-compose.azure.yml','Caddyfile') {
    & $ScpExe @sshOpts (Join-Path $tmp $f) ("azureuser@" + $VmIp + ":/opt/bfam/" + $f)
    if ($LASTEXITCODE -ne 0) { throw ("scp failed for " + $f) }
  }
  Invoke-Ssh 'chmod 600 /opt/bfam/backend.env /opt/bfam/.env; cd /opt/bfam && docker compose -f docker-compose.azure.yml pull && docker compose -f docker-compose.azure.yml up -d'

  function Wait-Health([int]$seconds) {
    $end = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $end) {
      try { $r = Invoke-WebRequest -UseBasicParsing -Uri ("https://" + $Fqdn + "/health") -TimeoutSec 10; if ($r.StatusCode -eq 200) { return $true } } catch { }
      Start-Sleep -Seconds 6
    }
    return $false
  }
  Step "Waiting for https://$Fqdn/health (first start applies the database migrations and gets the HTTPS certificate)"
  $healthy = Wait-Health 240
  if (-not $healthy) {
    Write-Host 'Not healthy yet - backend log:' -ForegroundColor Yellow
    $logs = & $SshExe @sshOpts ("azureuser@" + $VmIp) 'cd /opt/bfam && docker compose -f docker-compose.azure.yml logs --tail 40 backend 2>&1'
    $logs | ForEach-Object { Write-Host $_ }
    if (($logs -join "`n") -match '(?i)self.signed|unable to (get|verify)|certificate|issuer') {
      Write-Host 'The database certificate could not be verified. TEMPORARY beta fallback: keep TLS on but skip chain verification (see BFAM_Deployment_Plan.md).' -ForegroundColor Yellow
      Invoke-Ssh "echo 'DB_SSL_REJECT_UNAUTHORIZED=false' >> /opt/bfam/backend.env; cd /opt/bfam && docker compose -f docker-compose.azure.yml up -d --force-recreate backend"
      $healthy = Wait-Health 240
    }
  }
  if (-not $healthy) { throw 'The backend is not healthy. Send me the log above (with any passwords removed).' }
  Write-Host 'Backend is healthy.' -ForegroundColor Green

  Step "Creating the beta admin, owner and two turfs (skipped if they already exist)"
  $seed = @"
set -e
cd /opt/bfam
docker compose -f docker-compose.azure.yml run --rm -e BETA_ADMIN_PHONE='$($admin['BETA_ADMIN_PHONE'])' -e BETA_ADMIN_PASSWORD='$($admin['BETA_ADMIN_PASSWORD'])' -e BETA_OWNER_PASSWORD='$($gen['OWNER_PASSWORD'])' backend node dist/seed/betaSeed.js
"@
  Write-LfFile (Join-Path $tmp 'seed.sh') $seed
  & $ScpExe @sshOpts (Join-Path $tmp 'seed.sh') ("azureuser@" + $VmIp + ":/tmp/bfam-seed.sh")
  if ($LASTEXITCODE -ne 0) { throw 'scp of the seed script failed' }
  # (No double quotes inside remote commands: Windows PowerShell 5.1 mangles them when calling ssh.exe.)
  Invoke-Ssh 'bash /tmp/bfam-seed.sh 2>&1 | sed -E ''s/password: .*/password: (hidden)/''; rm -f /tmp/bfam-seed.sh'
  Remove-Item -Force (Join-Path $tmp 'seed.sh'), (Join-Path $tmp 'backend.env') -ErrorAction SilentlyContinue

  # ---------- player site ----------
  if (-not $SkipWeb) {
    Step "Building the player (mobile-web) site against https://$Fqdn"
    Push-Location (Join-Path $RepoRoot 'apps\mobile')
    try {
      $env:EXPO_PUBLIC_API_URL = "https://$Fqdn"
      $env:EXPO_NO_TELEMETRY = '1'
      & npm run export:web
      if ($LASTEXITCODE -ne 0) { throw 'expo export failed' }
    } finally { Pop-Location }

    Step "Publishing the player site"
    $token = (& $AzExe staticwebapp secrets list -n $Swa -g $Rg --query properties.apiKey -o tsv).Trim()
    if (-not $token) { throw 'Could not read the Static Web App deployment token.' }
    $env:SWA_CLI_DEPLOYMENT_TOKEN = $token
    Push-Location $RepoRoot
    try {
      & npx --yes '@azure/static-web-apps-cli' deploy (Join-Path $RepoRoot 'apps\mobile\dist') --env production
      if ($LASTEXITCODE -ne 0) { throw 'swa deploy failed' }
    } finally { Pop-Location; Remove-Item Env:\SWA_CLI_DEPLOYMENT_TOKEN -ErrorAction SilentlyContinue }
  }

  # ---------- final check ----------
  Step "Final checks"
  try {
    $body = @{ identifier = $admin['BETA_ADMIN_PHONE']; password = $admin['BETA_ADMIN_PASSWORD'] } | ConvertTo-Json
    $r = Invoke-RestMethod -Method Post -Uri ("https://" + $Fqdn + "/auth/login") -ContentType 'application/json' -Body $body
    if ($r.token) { Write-Host 'Admin login through the public API: OK' -ForegroundColor Green }
  } catch { Write-Host ('Admin login check failed: ' + $_.Exception.Message) -ForegroundColor Yellow }
  try {
    $w = Invoke-WebRequest -UseBasicParsing -Uri ("https://" + $SwaHost) -TimeoutSec 30
    Write-Host ("Player site answered: HTTP " + $w.StatusCode) -ForegroundColor Green
  } catch { Write-Host ('Player site check failed: ' + $_.Exception.Message) -ForegroundColor Yellow }

  Write-Host ""
  Write-Host "==================== DONE ====================" -ForegroundColor Green
  Write-Host ("Player site (open on phones): https://" + $SwaHost)
  Write-Host ("Backend API:                  https://" + $Fqdn)
  Write-Host ("Sign-up / reset code:         123456")
  Write-Host ("Admin login:                  " + $admin['BETA_ADMIN_PHONE'] + "  (password: the one you gave me)")
  Write-Host ("Owner login:                  +919000000002  (password in " + (Join-Path $SecretsDir 'generated.env') + ", OWNER_PASSWORD)")
  Write-Host ("Log file:                     " + $Log)
}
catch {
  Write-Host ""
  Write-Host ("STOPPED: " + $_.Exception.Message) -ForegroundColor Red
  Write-Host ("You can re-run the same command; finished steps are skipped. Log: " + $Log)
  Stop-Transcript | Out-Null
  exit 1
}
Stop-Transcript | Out-Null
