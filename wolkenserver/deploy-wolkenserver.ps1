# deploy-wolkenserver.ps1 — bringt den Compass-Server (produkt\server) auf den Linux-Wolkenserver
# und merkt sich die Adresse, unter der der Compass auf bene.vishnuartists.com ihn erreicht.
#
#   Was passiert (jeder Lauf ist ein vollständiger Abgleich, nichts davon braucht Handarbeit auf dem Server):
#     1) Staging-Ordner bauen: paket\ (produkt\server), compass-server.json (Name, Trello-Boards, Jira aus
#        dashboard.html), env (Schlüssel aus den Benutzer-Umgebungsvariablen dieses Rechners), daten\
#        (Persona, Profil, Pipeline, Aufgaben, Kanäle, Persönlichkeit aus C:\dev\john) und die drei
#        Server-Dateien install.sh, compass-server.service, Caddyfile.tmpl.
#     2) per scp nach root@<server>:/tmp/compass-deploy, dann `install.sh` per ssh (idempotent).
#     3) von außen prüfen: https://<host>/<pfad>/api/john/status
#     4) site\.publish-state\wolke.json schreiben — build-compass.ps1 setzt daraus die Server-Adresse in
#        die eigene Instanz ein, publish-compass.ps1 lädt sie spätestens 30 Minuten später hoch.
#
#   Was Bene einmal tut (siehe README.md in diesem Ordner):
#     · Server anlegen (Hetzner CX22, Ubuntu 24.04) mit dem Schlüssel ~\.ssh\id_ed25519_wolke.pub
#     · DNS: A-Record wolke.vishnuartists.com → IP des Servers (KAS); bis dahin geht <ip>.sslip.io
#     · `claude setup-token` → Wert als Benutzer-Umgebungsvariable WOLKE_CLAUDE_TOKEN (nie in Dateien)
#
#   Aufruf
#     powershell -NoProfile -ExecutionPolicy Bypass -File wolkenserver\deploy-wolkenserver.ps1 -Server 1.2.3.4
#     … -Hostname wolke.vishnuartists.com      (sobald der DNS-Eintrag steht; sonst <ip>.sslip.io)
#     … -Status                                (nur nachsehen: Dienst, Logbuch, Antwort von außen)
#     … -NurStaging                            (nur den Ordner bauen und zeigen, nichts hochladen)
#   Ohne -Server nimmt das Skript, was in site\.publish-state\wolke.json steht.
param(
  [string]$Server = '',
  [string]$Hostname = '',
  [string]$Pfad = '',
  [string]$Name = 'Bene',
  [string]$Coach = 'John',
  [string]$Modell = 'claude-opus-5',
  [string]$Effort = 'medium',
  [string]$JiraProjekt = 'VA',
  [string]$JohnDir = 'C:\dev\john',
  [string]$Schluessel = (Join-Path $env:USERPROFILE '.ssh\id_ed25519_wolke'),
  [switch]$NurStaging,
  [switch]$Status
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$hier = Split-Path -Parent $MyInvocation.MyCommand.Path
$enc  = New-Object Text.UTF8Encoding($false)
function Read-Utf8([string]$p) { [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) }
function Write-Lf([string]$p, [string]$t) { [IO.File]::WriteAllText($p, $t.Replace("`r`n", "`n"), $enc) }
function Sag([string]$m) { Write-Host ("{0:HH:mm:ss}  {1}" -f (Get-Date), $m) }
function Env-User([string]$n) { $v = [Environment]::GetEnvironmentVariable($n, 'User'); if (-not $v) { $v = [Environment]::GetEnvironmentVariable($n, 'Process') }; if ($v) { $v.Trim() } else { $null } }

# ---------- Stand (gitignored) ----------
$stateDir = Join-Path $repo 'site\.publish-state'
if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Force $stateDir | Out-Null }
$stateDatei = Join-Path $stateDir 'wolke.json'
$state = @{}
if (Test-Path $stateDatei) { try { $j = (Read-Utf8 $stateDatei) | ConvertFrom-Json; foreach ($p in $j.PSObject.Properties) { $state[$p.Name] = [string]$p.Value } } catch { $state = @{} } }
if (-not $Server) { $Server = $state['server'] }
if (-not $Server) { throw 'Kein Server bekannt: -Server <IP oder Host> angeben (root-Zugang mit ~\.ssh\id_ed25519_wolke). Anlegen: siehe wolkenserver\README.md.' }
if (-not $Hostname) { $Hostname = $state['host'] }
if (-not $Hostname) {
  if ($Server -match '^\d{1,3}(\.\d{1,3}){3}$') { $Hostname = ($Server -replace '\.', '-') + '.sslip.io' } else { $Hostname = $Server }
}
if (-not $Pfad) { $Pfad = $state['pfad'] }
if (-not $Pfad) {
  # geheimer Pfadanfang: 26 Zeichen aus 32 → ~130 Bit, kryptografisch gewürfelt
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $b = New-Object byte[] 26; $rng.GetBytes($b)
  $abc = 'abcdefghijkmnpqrstuvwxyz23456789'
  $Pfad = 't-' + (-join ($b | ForEach-Object { $abc[$_ % $abc.Length] }))
}
$Pfad = $Pfad.Trim('/')
$api  = "https://$Hostname/$Pfad"
if (-not (Test-Path $Schluessel)) { throw "SSH-Schlüssel fehlt: $Schluessel — ssh-keygen -t ed25519 -f `"$Schluessel`" -N `"`"" }
$sshOpt = @('-i', $Schluessel, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')
$ziel = "root@$Server"

if ($Status) {
  Sag "Server $Server · Host $Hostname"
  & ssh.exe @sshOpt $ziel 'systemctl --no-pager --lines=0 status compass-server caddy | grep -E "●|Active"; echo; journalctl -u compass-server -n 15 --no-pager -o cat'
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $r = Invoke-RestMethod -Uri "$api/api/john/status" -TimeoutSec 60
    Sag ("Von außen: ok · Name {0} · Backend {1} · angemeldet {2} · Dateien {3}" -f $r.name, $r.backend, $(if ($r.login) { $r.login.ok } else { '—' }), (@($r.geladen) -join ', '))
    if ($r.hint) { Sag "Hinweis des Servers: $($r.hint)" }
  } catch { Sag "Von außen NICHT erreichbar ($api): $($_.Exception.Message)" }
  return
}

# ---------- 1) Staging ----------
$stage = Join-Path $env:TEMP ("wolke-deploy-" + [DateTime]::Now.Ticks)
New-Item -ItemType Directory -Force (Join-Path $stage 'paket\vorlagen'), (Join-Path $stage 'daten') | Out-Null
$paketQuelle = Join-Path $repo 'produkt\server'
foreach ($f in 'compass-server.ps1','coach-tools.ps1','coach-mcp.ps1','README.md') { Write-Lf (Join-Path $stage "paket\$f") (Read-Utf8 (Join-Path $paketQuelle $f)) }
foreach ($f in 'persona.md','TASKS.md') { Write-Lf (Join-Path $stage "paket\vorlagen\$f") (Read-Utf8 (Join-Path $paketQuelle "vorlagen\$f")) }
$sha = [Security.Cryptography.SHA256]::Create(); $ms = New-Object IO.MemoryStream
foreach ($f in (Get-ChildItem (Join-Path $stage 'paket') -Recurse -File | Sort-Object FullName)) { $b = [IO.File]::ReadAllBytes($f.FullName); $ms.Write($b, 0, $b.Length) }
$hash = ([BitConverter]::ToString($sha.ComputeHash($ms.ToArray())) -replace '-', '').ToLower().Substring(0, 16); $ms.Dispose()
Write-Lf (Join-Path $stage 'paket\VERSION.txt') ("compass-server $hash`ngebaut $(Get-Date -Format 'yyyy-MM-dd HH:mm') für den Wolkenserver`n")

# Konfiguration: Trello-Kurzlinks und Jira-Site aus dashboard.html (dieselben Quellen wie der john-server)
$dash = Read-Utf8 (Join-Path $repo 'dashboard.html')
$trPrivat = ''; $trArbeit = ''; $jiraSite = ''
if ($dash -match "privat:\s*\{[^}]*url:'https://trello\.com/b/([A-Za-z0-9]{8})") { $trPrivat = $Matches[1] }
if ($dash -match "arbeit:\s*\{[^}]*url:'https://trello\.com/b/([A-Za-z0-9]{8})") { $trArbeit = $Matches[1] }
if ($dash -match "jiraBase:'https://([^/']+)/") { $jiraSite = $Matches[1] }
$konfig = [ordered]@{
  _hinweis = 'Konfiguration des Compass-Servers auf dem Wolkenserver — geschrieben von deploy-wolkenserver.ps1. Schlüssel liegen in /etc/compass-server/env.'
  name = $Name; coach = $Coach; sprache = 'Deutsch'; port = 8787; backend = 'cli'; modell = $Modell; effort = $Effort
  daten = '/var/lib/compass-server/daten'
  anbieter = [ordered]@{ url = ''; modell = '' }
  trello = [ordered]@{ privat = $trPrivat; arbeit = $trArbeit }
  jira = [ordered]@{ site = $jiraSite; projekt = $JiraProjekt }
}
Write-Lf (Join-Path $stage 'compass-server.json') (($konfig | ConvertTo-Json -Depth 5) + "`n")

# Schlüssel: nur aus Benutzer-Umgebungsvariablen, nie ausgeben. Auf dem Server heißt der Claude-Token
# CLAUDE_CODE_OAUTH_TOKEN — hier trägt er einen eigenen Namen, damit er das lokale Claude Code nicht umstellt.
$paare = @(
  @('TRELLO_PRIVAT_KEY','TRELLO_PRIVAT_KEY'), @('TRELLO_PRIVAT_TOKEN','TRELLO_PRIVAT_TOKEN'),
  @('TRELLO_ARBEIT_KEY','TRELLO_ARBEIT_KEY'), @('TRELLO_ARBEIT_TOKEN','TRELLO_ARBEIT_TOKEN'),
  @('JIRA_EMAIL','JIRA_EMAIL'), @('JIRA_TOKEN','JIRA_TOKEN'), @('JIRA_SITE','JIRA_SITE'),
  @('CLAUDE_CODE_OAUTH_TOKEN','WOLKE_CLAUDE_TOKEN')
)
$envZeilen = @('# Umgebung des Dienstes compass-server — geschrieben von deploy-wolkenserver.ps1, nur root lesbar.', 'COMPASS_BACKEND=cli')
$da = @(); $fehlt = @()
foreach ($p in $paare) {
  $v = Env-User $p[1]
  if ($v) { $envZeilen += ($p[0] + '="' + ($v -replace '\\', '\\' -replace '"', '\"') + '"'); $da += $p[0] } else { $fehlt += $p[1] }
}
Write-Lf (Join-Path $stage 'env') (($envZeilen -join "`n") + "`n")
Sag ("Schlüssel für den Server: {0}" -f ($da -join ', '))
if ($fehlt.Count) { Sag ("FEHLT auf diesem Rechner (bleibt auf dem Server leer): {0}" -f ($fehlt -join ', ')) }
if ($fehlt -contains 'WOLKE_CLAUDE_TOKEN') { Sag 'Ohne WOLKE_CLAUDE_TOKEN läuft der Coach ohne Anmeldung (NO_LOGIN) — Trello, Jira und der Stapel aus Dateien gehen trotzdem. Setzen: claude setup-token, dann [Environment]::SetEnvironmentVariable(''WOLKE_CLAUDE_TOKEN'',''<token>'',''User'') und erneut deployen.' }

# Daten des Coachs: dieselben Dateien, die der john-server dieses Rechners lädt
$datenPaare = @(
  @('persona.md','CLAUDE.md'), @('PROFIL.md','profil\PROFIL.md'), @('pipeline.md','bewerbungen\pipeline.md'),
  @('TASKS.md','TASKS.md'), @('kanaele.md','kanaele\kanaele.md'), @('PERSOENLICHKEIT.md','wissensbasis\PERSOENLICHKEIT.md')
)
$dz = @()
foreach ($p in $datenPaare) {
  $q = Join-Path $JohnDir $p[1]
  if (Test-Path $q) { Write-Lf (Join-Path $stage "daten\$($p[0])") (Read-Utf8 $q); $dz += $p[0] } else { Sag "Datei fehlt, wird nicht mitgegeben: $q" }
}
Sag ("Daten des Coachs: {0}" -f ($dz -join ', '))

foreach ($f in 'install.sh','compass-server.service','Caddyfile.tmpl') { Write-Lf (Join-Path $stage $f) (Read-Utf8 (Join-Path $hier $f)) }
Sag "Staging: $stage (Paket $hash · Host $Hostname · Pfad t-…)"
if ($NurStaging) { Get-ChildItem $stage -Recurse -File | ForEach-Object { $_.FullName.Substring($stage.Length + 1) }; Sag 'NurStaging: nichts hochgeladen. Den Ordner danach löschen — die Datei env enthält Schlüssel.'; return }

# ---------- 2) Hochladen und einrichten ----------
try {
  Sag "Hochladen nach ${ziel}:/tmp/compass-deploy"
  & ssh.exe @sshOpt $ziel 'rm -rf /tmp/compass-deploy'
  if ($LASTEXITCODE -ne 0) { throw "ssh fehlgeschlagen (Exit $LASTEXITCODE) — Schlüssel auf dem Server hinterlegt? Adresse richtig?" }
  & scp.exe @sshOpt -q -r $stage "${ziel}:/tmp/compass-deploy"
  if ($LASTEXITCODE -ne 0) { throw "scp fehlgeschlagen (Exit $LASTEXITCODE)" }
  Sag 'install.sh läuft (erster Lauf 2–4 Minuten: PowerShell 7, Caddy, Claude Code)'
  $cmd = "WOLKE_HOST='$Hostname' WOLKE_PFAD='$Pfad' bash /tmp/compass-deploy/install.sh /tmp/compass-deploy; rc=`$?; rm -rf /tmp/compass-deploy; exit `$rc"
  & ssh.exe @sshOpt $ziel $cmd
  if ($LASTEXITCODE -ne 0) { throw "install.sh fehlgeschlagen (Exit $LASTEXITCODE) — Ausgabe oben lesen" }
} finally {
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
}

# ---------- 3) Von außen prüfen ----------
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ok = $false
for ($i = 1; $i -le 9 -and -not $ok; $i++) {
  try {
    $r = Invoke-RestMethod -Uri "$api/api/john/status" -TimeoutSec 60
    if ($r.paket -eq 'compass-server') { $ok = $true
      Sag ("Von außen erreichbar: Name {0} · Backend {1} · angemeldet {2} · Dateien {3}" -f $r.name, $r.backend, $(if ($r.login) { $r.login.ok } else { '—' }), (@($r.geladen) -join ', '))
      if ($r.hint) { Sag "Hinweis des Servers: $($r.hint)" }
    }
  } catch { Sag ("Versuch {0}/9: noch nicht erreichbar ({1}) — Zertifikat oder DNS brauchen einen Moment" -f $i, $_.Exception.Message); Start-Sleep 10 }
}

# ---------- 4) Stand merken ----------
$state['server'] = $Server; $state['host'] = $Hostname; $state['pfad'] = $Pfad; $state['api'] = $api
$state['stand'] = (Get-Date).ToString('o'); $state['paket'] = $hash; $state['erreichbar'] = [string]$ok
[IO.File]::WriteAllText($stateDatei, (([pscustomobject]$state) | ConvertTo-Json), $enc)
Sag "Stand geschrieben: $stateDatei"
if ($ok) {
  Sag 'Der nächste Lauf von publish-compass.ps1 (alle 30 Min) baut bene.vishnuartists.com mit dieser Adresse. Sofort: powershell -ExecutionPolicy Bypass -File publish-compass.ps1'
  Sag 'Zurück zum lokalen John im Browser: ?john=http://localhost:8787 an die Compass-Adresse hängen (wird gemerkt); ?john= ohne Wert löscht das wieder.'
} else {
  Sag 'Nicht erreichbar — wolke.json ist trotzdem geschrieben (erreichbar=False). build-compass.ps1 setzt die Adresse erst ein, wenn erreichbar=True steht. Später: -Status'
}
