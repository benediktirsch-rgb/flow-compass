$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$t = [Environment]::GetEnvironmentVariable('HCLOUD_TOKEN', 'User').Trim()
$h = @{ Authorization = 'Bearer ' + $t; 'Content-Type' = 'application/json' }
$api = 'https://api.hetzner.cloud/v1'
function Api($m, $p, $b) { if ($b) { Invoke-RestMethod -Method $m -Uri "$api$p" -Headers $h -Body (($b | ConvertTo-Json -Depth 8 -Compress)) } else { Invoke-RestMethod -Method $m -Uri "$api$p" -Headers $h } }

# Typ und Standort: Verfuegbarkeit aus server_types[].locations[].available (das datacenters-Feld ist veraltet)
$alle = (Api GET '/server_types?per_page=50').server_types
foreach ($s in $alle) { if ($s.name -in @('cx43','cax31','cpx31','cax21')) { $s.locations | ForEach-Object { "  {0,-6} {1,-5} verfuegbar={2}" -f $s.name, $_.name, $_.available } } }
$st = $null; $ort = $null
foreach ($n in @('cx43','cax31','cpx31','cax21','cx33','cx23')) {
  $s = $alle | Where-Object { $_.name -eq $n }
  foreach ($l in @('fsn1','nbg1','hel1')) { $lo = $s.locations | Where-Object { $_.name -eq $l -and $_.available }; if ($lo) { $st = $s; $ort = $l; break } }
  if ($st) { break }
}
if (-not $st) { throw 'Keiner der Typen cx43/cax31/cpx31/cax21 ist in Deutschland/Finnland verfuegbar' }
$typ = $st.name
"Typ $typ ($($st.cores) vCPU, $($st.memory) GB, $($st.architecture)) am Standort $ort"

# SSH-Key
$pub = (Get-Content (Join-Path $env:USERPROFILE '.ssh\id_ed25519_wolke.pub') -Raw).Trim()
$keys = (Api GET '/ssh_keys').ssh_keys | Where-Object { $_.name -eq 'wolkenserver' }
if (-not $keys) { $keys = (Api POST '/ssh_keys' @{ name = 'wolkenserver'; public_key = $pub }).ssh_key; "SSH-Key angelegt: $($keys.name)" } else { "SSH-Key vorhanden: $($keys.name)" }

# Firewall: nur 22, 80, 443 und ICMP herein
$fw = (Api GET '/firewalls').firewalls | Where-Object { $_.name -eq 'wolkenserver' }
if (-not $fw) {
  $rules = @(
    @{ direction = 'in'; protocol = 'tcp'; port = '22';  source_ips = @('0.0.0.0/0', '::/0'); description = 'SSH' },
    @{ direction = 'in'; protocol = 'tcp'; port = '80';  source_ips = @('0.0.0.0/0', '::/0'); description = 'HTTP (Zertifikat)' },
    @{ direction = 'in'; protocol = 'tcp'; port = '443'; source_ips = @('0.0.0.0/0', '::/0'); description = 'HTTPS' },
    @{ direction = 'in'; protocol = 'icmp'; source_ips = @('0.0.0.0/0', '::/0'); description = 'Ping' }
  )
  $fw = (Api POST '/firewalls' @{ name = 'wolkenserver'; rules = $rules }).firewall; "Firewall angelegt: $($fw.name)"
} else { "Firewall vorhanden: $($fw.name)" }

# Server
$srv = (Api GET '/servers').servers | Where-Object { $_.name -eq 'wolke' }
if (-not $srv) {
  $body = @{ name = 'wolke'; server_type = $typ; image = 'ubuntu-24.04'; location = $ort
             ssh_keys = @($keys.id); firewalls = @(@{ firewall = $fw.id })
             public_net = @{ enable_ipv4 = $true; enable_ipv6 = $true }
             labels = @{ zweck = 'compass-server'; angelegt = '2026-09-14' }; start_after_create = $true }
  $r = Api POST '/servers' $body
  $srv = $r.server
  "Server angelegt: $($srv.name) (id $($srv.id)), Zugang nur per SSH-Key."
} else { "Server vorhanden: $($srv.name) (id $($srv.id))" }

# Warten bis er laeuft
for ($i = 0; $i -lt 30; $i++) {
  $srv = (Api GET "/servers/$($srv.id)").server
  if ($srv.status -eq 'running') { break }
  Start-Sleep 5
}
"Status: $($srv.status)"
"IPv4: $($srv.public_net.ipv4.ip)"
"IPv6: $($srv.public_net.ipv6.ip)"

# Backups an (20 % Aufpreis): auf Wachstum ausgelegt
if (-not $srv.backup_window) {
  try { Api POST "/servers/$($srv.id)/actions/enable_backup" | Out-Null; 'Backups eingeschaltet (taeglich, 7 Staende).' } catch { "Backups nicht eingeschaltet: $($_.Exception.Message)" }
} else { "Backups laufen bereits ($($srv.backup_window))." }
$srv.public_net.ipv4.ip | Set-Content -Path (Join-Path $PSScriptRoot 'wolke-ip.txt') -Encoding ASCII
