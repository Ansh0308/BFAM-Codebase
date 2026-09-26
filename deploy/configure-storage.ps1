# Turns on photo / document storage (Cloudflare R2) for the live backend.
# Reads %USERPROFILE%\bfam-secrets\r2.env, updates /opt/bfam/backend.env on the VM
# over SSH and restarts only the backend. Needs the VM's SSH key from deploy-azure.ps1.
#
#   powershell -ExecutionPolicy Bypass -File .\deploy\configure-storage.ps1
#
# r2.env keys used:
#   R2_ENDPOINT            https://<account-id>.r2.cloudflarestorage.com
#   R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
#   R2_PUBLIC_BUCKET       bucket for profile photos (public)
#   R2_PUBLIC_URL          the bucket's public address, e.g. https://pub-xxxx.r2.dev  (REQUIRED)
#   R2_PRIVATE_BUCKET      optional - a NON-public bucket for staff ID documents
#
# Plain ASCII on purpose (Windows PowerShell 5.1 mis-reads other characters).

$ErrorActionPreference = 'Continue'
$SecretsDir = Join-Path $env:USERPROFILE 'bfam-secrets'

function Step([string]$msg) { Write-Host ""; Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg) -ForegroundColor Cyan }
function Fail([string]$msg) { Write-Host ("STOPPED: " + $msg) -ForegroundColor Red; exit 1 }

function Read-EnvFile([string]$path) {
  if (-not (Test-Path $path)) { Fail ("Missing file: " + $path) }
  $h = @{}
  foreach ($line in Get-Content $path) { if ($line -match '^\s*([A-Za-z0-9_]+)=(.*)$') { $h[$matches[1]] = $matches[2].TrimEnd("`r").Trim() } }
  return $h
}

$r2 = Read-EnvFile (Join-Path $SecretsDir 'r2.env')
foreach ($k in 'R2_ENDPOINT','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_PUBLIC_BUCKET') { if (-not $r2[$k]) { Fail ("r2.env is missing " + $k) } }
if (-not $r2['R2_PUBLIC_URL']) {
  Fail 'R2_PUBLIC_URL is empty. In Cloudflare: R2 > bfam-public > Settings > Public Development URL > Enable, then copy the https://pub-....r2.dev address into r2.env.'
}
if ($r2['R2_PUBLIC_URL'] -notmatch '^https://') { Fail 'R2_PUBLIC_URL must start with https://' }

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

$lines = @(
  'AWS_REGION=auto',
  ('AWS_ACCESS_KEY_ID=' + $r2['R2_ACCESS_KEY_ID']),
  ('AWS_SECRET_ACCESS_KEY=' + $r2['R2_SECRET_ACCESS_KEY']),
  ('AWS_S3_BUCKET=' + $r2['R2_PUBLIC_BUCKET']),
  ('S3_ENDPOINT=' + $r2['R2_ENDPOINT']),
  ('S3_PUBLIC_BASE_URL=' + $r2['R2_PUBLIC_URL'])
)
if ($r2['R2_PRIVATE_BUCKET']) { $lines += ('AWS_S3_PRIVATE_BUCKET=' + $r2['R2_PRIVATE_BUCKET']) }
else { Write-Host 'Note: no R2_PRIVATE_BUCKET set - staff ID documents would go to the public bucket. Create a private bucket first if you use staff verification.' -ForegroundColor Yellow }

$script = "set -e`ncd /opt/bfam`nsed -i '/^AWS_REGION=/d;/^AWS_ACCESS_KEY_ID=/d;/^AWS_SECRET_ACCESS_KEY=/d;/^AWS_S3_BUCKET=/d;/^AWS_S3_PRIVATE_BUCKET=/d;/^S3_ENDPOINT=/d;/^S3_PUBLIC_BASE_URL=/d' backend.env`n# the file may not end with a newline; without one the first new line would be glued onto the last old line`nsed -i -e '`$a\' backend.env`ncat >> backend.env <<'ENVEOF'`n" + ($lines -join "`n") + "`nENVEOF`nchmod 600 backend.env`ndocker compose -f docker-compose.azure.yml up -d --force-recreate backend`n"
$tmp = Join-Path $SecretsDir 'configure-storage.sh'
[IO.File]::WriteAllText($tmp, $script, (New-Object Text.UTF8Encoding $false))

Step "Updating the backend settings on $Fqdn"
& $ScpExe @opts $tmp ("azureuser@" + $Fqdn + ":/tmp/bfam-configure-storage.sh")
if ($LASTEXITCODE -ne 0) { Remove-Item $tmp -ErrorAction SilentlyContinue; Fail 'Could not copy the script to the VM (is your current IP still allowed on port 22? re-run deploy-azure.ps1 to refresh the firewall rule).' }
& $SshExe @opts ("azureuser@" + $Fqdn) 'bash /tmp/bfam-configure-storage.sh; rm -f /tmp/bfam-configure-storage.sh'
$code = $LASTEXITCODE
Remove-Item $tmp -ErrorAction SilentlyContinue
if ($code -ne 0) { Fail 'The update failed on the VM.' }

Step "Waiting for the backend to come back"
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  try { $r = Invoke-WebRequest -UseBasicParsing -Uri ("https://" + $Fqdn + "/health") -TimeoutSec 10; if ($r.StatusCode -eq 200) { $ok = $true; break } } catch { }
  Start-Sleep -Seconds 4
}
if (-not $ok) { Fail 'The backend did not become healthy again. Check: docker compose -f /opt/bfam/docker-compose.azure.yml logs backend' }
Write-Host 'Storage is on. Backend is healthy. Try changing a profile photo in the app.' -ForegroundColor Green
