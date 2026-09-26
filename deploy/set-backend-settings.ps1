# Adds or changes settings in the live backend's /opt/bfam/backend.env, restarts only the
# backend, and RESTORES the previous file automatically if the backend does not come up.
#
#   powershell -ExecutionPolicy Bypass -File .\deploy\set-backend-settings.ps1 -SettingsFile razorpay.env
#
# -SettingsFile is a file inside %USERPROFILE%\bfam-secrets\ with one KEY=VALUE per line
# (KEY in capitals, e.g. RAZORPAY_KEY_ID=rzp_test_xxx). Existing keys are replaced, new keys added.
# Needs the VM's SSH key from deploy-azure.ps1 and your current IP allowed on port 22.
#
# Plain ASCII on purpose (Windows PowerShell 5.1 mis-reads other characters).

param([Parameter(Mandatory = $true)][string]$SettingsFile)

$ErrorActionPreference = 'Continue'
$SecretsDir = Join-Path $env:USERPROFILE 'bfam-secrets'

function Step([string]$msg) { Write-Host ""; Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg) -ForegroundColor Cyan }
function Fail([string]$msg) { Write-Host ("STOPPED: " + $msg) -ForegroundColor Red; exit 1 }

$src = Join-Path $SecretsDir $SettingsFile
if (-not (Test-Path $src)) { Fail ("File not found: " + $src) }

$clean = @()
foreach ($line in Get-Content $src) {
  $t = $line.TrimEnd("`r").Trim()
  if ($t -eq '' -or $t.StartsWith('#')) { continue }
  if ($t -notmatch '^[A-Z][A-Z0-9_]*=.+$') { Fail ("Not a valid KEY=VALUE line (KEY must be CAPITALS, value must not be empty): " + ($t -replace '=.*', '=...')) }
  $clean += $t
}
if ($clean.Count -eq 0) { Fail 'The settings file has no settings in it.' }
Write-Host ("Applying " + $clean.Count + " setting(s): " + (($clean | ForEach-Object { $_ -replace '=.*', '' }) -join ', '))

$suf = $null
foreach ($line in Get-Content (Join-Path $SecretsDir 'azure-names.env')) { if ($line -match '^\s*SUF=(.+)$') { $suf = $matches[1].Trim() } }
if (-not $suf) { Fail 'azure-names.env has no SUF - run deploy-azure.ps1 first.' }
$Fqdn = "bfam-beta-$suf.southindia.cloudapp.azure.com"

$SshExe = Join-Path $env:SystemRoot 'System32\OpenSSH\ssh.exe'
$ScpExe = Join-Path $env:SystemRoot 'System32\OpenSSH\scp.exe'
if (-not (Test-Path $SshExe)) { Fail 'Windows OpenSSH client not found.' }
$key = (Join-Path $SecretsDir 'deploy_key').Replace('\', '/')
$known = (Join-Path $SecretsDir 'known_hosts').Replace('\', '/')
$opts = @('-i', $key, '-o', 'StrictHostKeyChecking=accept-new', '-o', ("UserKnownHostsFile=" + $known), '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')

$remote = @'
set -e
cd /opt/bfam
cp backend.env backend.env.bak
# the file may not end with a newline; without one the first new line would be glued onto the last old line
sed -i -e '$a\' backend.env
while IFS= read -r line; do
  case "$line" in ''|'#'*) continue;; esac
  k="${line%%=*}"
  sed -i "/^${k}=/d" backend.env
  printf '%s\n' "$line" >> backend.env
done < /tmp/bfam-settings.env
chmod 600 backend.env
docker compose -f docker-compose.azure.yml up -d --force-recreate backend
ok=0
for i in $(seq 1 30); do
  if docker compose -f docker-compose.azure.yml exec -T backend node -e "fetch('http://127.0.0.1:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
rm -f /tmp/bfam-settings.env
if [ "$ok" = 1 ]; then rm -f backend.env.bak; echo HEALTHY; exit 0; fi
echo "The backend did not start with the new settings - restoring the previous settings."
cp backend.env.bak backend.env
docker compose -f docker-compose.azure.yml up -d --force-recreate backend
exit 1
'@

$tmpSettings = Join-Path $SecretsDir 'upload-settings.env'
$tmpScript = Join-Path $SecretsDir 'upload-apply.sh'
[IO.File]::WriteAllText($tmpSettings, (($clean -join "`n") + "`n"), (New-Object Text.UTF8Encoding $false))
[IO.File]::WriteAllText($tmpScript, ($remote -replace "`r`n", "`n"), (New-Object Text.UTF8Encoding $false))

Step "Sending the settings to $Fqdn"
& $ScpExe @opts $tmpSettings ("azureuser@" + $Fqdn + ":/tmp/bfam-settings.env")
$c1 = $LASTEXITCODE
& $ScpExe @opts $tmpScript ("azureuser@" + $Fqdn + ":/tmp/bfam-apply.sh")
$c2 = $LASTEXITCODE
Remove-Item $tmpSettings, $tmpScript -ErrorAction SilentlyContinue
if ($c1 -ne 0 -or $c2 -ne 0) { Fail 'Could not copy files to the VM (is your current IP still allowed on port 22? re-run deploy-azure.ps1 to refresh the firewall rule).' }

Step "Applying and restarting the backend (it is restored automatically if it fails to start)"
& $SshExe @opts ("azureuser@" + $Fqdn) 'bash /tmp/bfam-apply.sh; code=$?; rm -f /tmp/bfam-apply.sh; exit $code'
if ($LASTEXITCODE -ne 0) { Fail 'The new settings did not work and the previous ones were restored. Check the values and try again.' }

Step "Checking from the internet"
$ok = $false
for ($i = 0; $i -lt 15; $i++) {
  try { $r = Invoke-WebRequest -UseBasicParsing -Uri ("https://" + $Fqdn + "/health") -TimeoutSec 10; if ($r.StatusCode -eq 200) { $ok = $true; break } } catch { }
  Start-Sleep -Seconds 3
}
if (-not $ok) { Fail 'The backend is not answering from the internet.' }
Write-Host 'Done. The backend is healthy with the new settings.' -ForegroundColor Green
