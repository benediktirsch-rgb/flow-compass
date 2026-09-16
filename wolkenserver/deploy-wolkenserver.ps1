# deploy-wolkenserver.ps1 — bringt den Compass-Server (produkt\server) auf den Linux-Wolkenserver
# und merkt sich die Adressen, unter denen die Compass-Instanzen ihn erreichen.
#
#   Was passiert (jeder Lauf ist ein vollständiger Abgleich, nichts davon braucht Handarbeit auf dem Server):
#     1) Staging-Ordner bauen: paket\ (produkt\server), compass-server.json (Name, Trello-Boards, Jira aus
#        dashboard.html), env (Schlüssel aus den Benutzer-Umgebungsvariablen dieses Rechners), daten\
#        (Persona, Profil, Pipeline, Aufgaben, Kanäle, Persönlichkeit aus C:\dev\john), die Server-Dateien
#        install.sh, compass-server.service, compass-server@.service, Caddyfile.tmpl — und je bekannter
#        Team-/Kundeninstanz ein Ordner instanzen\<slug>\ (Konfiguration aus instanzen\<slug>\compass\instanz.js,
#        eigener Port, eigener geheimer Pfad, eigener Dienst compass-server@<slug>).
#     2) per scp nach root@<server>:/tmp/compass-deploy, dann `install.sh` per ssh (idempotent).
#     3) von außen prüfen: https://<host>/<pfad>/api/john/status (Hauptinstanz und jede Instanz)
#     4) site\.publish-state\wolke.json schreiben — build-compass.ps1 setzt daraus die Server-Adresse in
#        die eigene Instanz ein; für Team-Instanzen wird `api:` in instanzen\<slug>\compass\instanz.js gesetzt.
#        publish-compass.ps1 lädt beides spätestens 30 Minuten später hoch.
#
#   Was Bene einmal tut (siehe README.md in diesem Ordner):
#     · Server anlegen (Hetzner, Ubuntu 24.04) mit dem Schlüssel ~\.ssh\id_ed25519_wolke.pub
#     · DNS: A-Record wolke.vishnuartists.com → IP des Servers (KAS); bis dahin geht <ip>.sslip.io
#     · `claude setup-token` → Wert als Benutzer-Umgebungsvariable WOLKE_CLAUDE_TOKEN (nie in Dateien)
#     · je Team-Instanz optional WOLKE_CLAUDE_TOKEN_<SLUG> (Slug in Großbuchstaben, Bindestrich → Unterstrich,
#       z. B. WOLKE_CLAUDE_TOKEN_PHILIPP_HEITZ) mit dem setup-token der Person — sonst läuft ihr Coach „ohne“.
#
#   Aufruf
#     powershell -NoProfile -ExecutionPolicy Bypass -File wolkenserver\deploy-wolkenserver.ps1 -Server 1.2.3.4
#     … -Hostname wolke.vishnuartists.com      (sobald der DNS-Eintrag steht; sonst <ip>.sslip.io)
#     … -Instanz "Philipp Heitz","Jan"         (Instanzen aufnehmen; bleiben danach in wolke.json und laufen mit)
#     … -Status                                (nur nachsehen: Dienste, Logbuch, Antwort von außen)
#     … -NurStaging                            (nur den Ordner bauen und zeigen, nichts hochladen)
#     … -Staging                               (Staging-Dienst compass-server@staging aufnehmen, 15.09.2026:
#                                               Benes Konfiguration und Schlüssel, eigener Datenordner, Port 8789,
#                                               eigener geheimer Pfad — der Staging-Compass zeigt dorthin,
#                                               publish-compass.ps1 liest ihn aus wolke.json › instanzen.staging)
#   Ohne -Server nimmt das Skript, was in site\.publish-state\wolke.json steht.
param(
  [string]$Server = '',
  [string]$Hostname = '',
  [string]$Pfad = '',
  [string[]]$Instanz = @(),
  [string]$Name = 'Bene',
  [string]$Coach = 'John',
  [string]$Modell = 'claude-opus-5',
  [string]$Effort = 'medium',
  [string]$JiraProjekt = 'VA',
  [string]$JohnDir = 'C:\dev\john',
  [string]$Schluessel = (Join-Path $env:USERPROFILE '.ssh\id_ed25519_wolke'),
  [switch]$NurStaging,
  [switch]$Staging,
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
function Neu-Pfad {
  # geheimer Pfadanfang: 26 Zeichen aus 32 → ~130 Bit, kryptografisch gewürfelt
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $b = New-Object byte[] 26; $rng.GetBytes($b)
  $abc = 'abcdefghijkmnpqrstuvwxyz23456789'
  return 't-' + (-join ($b | ForEach-Object { $abc[$_ % $abc.Length] }))
}
function Slug([string]$n) { ($n.ToLower() -replace '[^a-z0-9]+', '-').Trim('-') }
function Env-Zeile([string]$k, [string]$v) { $k + '="' + ($v -replace '\\', '\\' -replace '"', '\"') + '"' }

# ---------- Stand (gitignored) ----------
$stateDir = Join-Path $repo 'site\.publish-state'
if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Force $stateDir | Out-Null }
$stateDatei = Join-Path $stateDir 'wolke.json'
$state = @{}; $inst = [ordered]@{}
if (Test-Path $stateDatei) {
  try {
    $j = (Read-Utf8 $stateDatei) | ConvertFrom-Json
    foreach ($p in $j.PSObject.Properties) { if ($p.Name -ne 'instanzen') { $state[$p.Name] = [string]$p.Value } }
    if ($j.instanzen) { foreach ($p in $j.instanzen.PSObject.Properties) { $e = @{}; foreach ($q in $p.Value.PSObject.Properties) { $e[$q.Name] = [string]$q.Value }; $inst[$p.Name] = $e } }
  } catch { $state = @{}; $inst = [ordered]@{} }
}
if (-not $Server) { $Server = $state['server'] }
if (-not $Server) { throw 'Kein Server bekannt: -Server <IP oder Host> angeben (root-Zugang mit ~\.ssh\id_ed25519_wolke). Anlegen: siehe wolkenserver\README.md.' }
if (-not $Hostname) { $Hostname = $state['host'] }
if (-not $Hostname) {
  if ($Server -match '^\d{1,3}(\.\d{1,3}){3}$') { $Hostname = ($Server -replace '\.', '-') + '.sslip.io' } else { $Hostname = $Server }
}
if (-not $Pfad) { $Pfad = $state['pfad'] }
if (-not $Pfad) { $Pfad = Neu-Pfad }
$Pfad = $Pfad.Trim('/')
$api  = "https://$Hostname/$Pfad"
# Instanzen aufnehmen: Port ab 8791, je Instanz ein eigener geheimer Pfad
# (`powershell -File` reicht ein Array als EINEN kommagetrennten String durch — deshalb hier zerlegen)
$Instanz = @($Instanz | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
foreach ($n in $Instanz) {
  $s = Slug $n
  if (-not $inst.Contains($s)) {
    $ports = @($inst.Values | ForEach-Object { [int]$_.port }) + 8790
    $inst[$s] = @{ name = $n; port = [string](($ports | Measure-Object -Maximum).Maximum + 1); pfad = (Neu-Pfad) }
    Sag "Instanz aufgenommen: $n → $s (Port $($inst[$s].port))"
  }
}
# Staging-Dienst (15.09.2026): laeuft wie eine Instanz (compass-server@staging), aber mit Benes Konfiguration,
# Schluesseln und Daten — auf festem Port 8789 (die Instanzen zaehlen ab 8791), eigener Datenordner
# /var/lib/compass-server/instanzen/staging/daten. Einmal aufgenommen, bleibt er in wolke.json und laeuft mit.
if ($Staging -and -not $inst.Contains('staging')) {
  $inst['staging'] = @{ name = 'Staging'; port = '8789'; pfad = (Neu-Pfad) }
  Sag 'Staging-Dienst aufgenommen: compass-server@staging (Port 8789)'
}
foreach ($s in @($inst.Keys)) { $inst[$s].api = "https://$Hostname/$($inst[$s].pfad)" }
if (-not (Test-Path $Schluessel)) { throw "SSH-Schlüssel fehlt: $Schluessel — ssh-keygen -t ed25519 -f `"$Schluessel`" -N `"`"" }
$sshOpt = @('-i', $Schluessel, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')
$ziel = "root@$Server"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Probe([string]$url, [string]$wer) {
  try {
    $r = Invoke-RestMethod -Uri "$url/api/john/status" -TimeoutSec 60
    if ($r.paket -ne 'compass-server') { throw 'keine Compass-Server-Antwort' }
    Sag ("{0}: erreichbar · Name {1} · Backend {2} · angemeldet {3} · Dateien {4}" -f $wer, $r.name, $r.backend, $(if ($r.login) { $r.login.ok } else { '—' }), (@($r.geladen) -join ', '))
    if ($r.hint) { Sag "  Hinweis des Servers: $($r.hint)" }
    return $true
  } catch { Sag ("{0}: NICHT erreichbar ({1})" -f $wer, $_.Exception.Message); return $false }
}

if ($Status) {
  Sag "Server $Server · Host $Hostname"
  & ssh.exe @sshOpt $ziel 'for u in compass-server $(systemctl list-units --type=service --all --no-legend "compass-server@*" | awk "{print \$1}") caddy; do systemctl --no-pager --lines=0 status $u | sed -n 3p | sed "s|^ *|$u: |"; done; echo; journalctl -u compass-server -n 12 --no-pager -o cat | grep -v ScriptBlock'
  [void](Probe $api 'Hauptinstanz')
  foreach ($s in $inst.Keys) { [void](Probe $inst[$s].api ("Instanz " + $inst[$s].name)) }
  return
}

# ---------- 1) Staging ----------
$stage = Join-Path $env:TEMP ("wolke-deploy-" + [DateTime]::Now.Ticks)
New-Item -ItemType Directory -Force (Join-Path $stage 'paket\vorlagen'), (Join-Path $stage 'daten') | Out-Null
$paketQuelle = Join-Path $repo 'produkt\server'
foreach ($f in 'compass-server.ps1','coach-tools.ps1','coach-mcp.ps1','firmen-daten.ps1','README.md') { Write-Lf (Join-Path $stage "paket\$f") (Read-Utf8 (Join-Path $paketQuelle $f)) }
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
# Firmensicht (16.09.2026, Bene: „Philipp bekommt als Geschäftsführer volle Transparenz“): wer hier steht, bekommt im
# Compass Finanzen samt Entscheidungen, Nutzerzahlen, Pool/Trichter und Website-Aufrufe (produkt\serverirmen-daten.ps1).
# Schlüssel = Instanz ('' = Hauptinstanz), Wert = Name, unter dem die Person im Finanzlauf abstimmt. Staging bleibt draußen:
# nichts von Staging erreicht Prod-Daten. Den FINANZ_TOKEN dieses Rechners bekommen nur diese Instanzen.
$FirmaSicht = @{ '' = 'Benedikt Irsch'; 'philipp-heitz' = 'Philipp Heitz' }
function Firma-Block([string]$stimme) {
  if (-not $stimme) { return $null }
  [ordered]@{ stimme = $stimme; finanzUrl = 'https://vishnuartists.com/finanzlauf/'; nutzerUrl = 'https://vishnuartists.com/nutzer-kpi.php'
              poolUrl = 'https://vishnuartists.com/pool-api.php'; pflegeUrl = 'https://vishnuartists.com/portal-admin.php?v=bewerbungen'
              statsUrl = 'https://vishnuartists.com/stats.php'; towerUrl = 'https://tower.vishnuartists.com/' }
}
function Konfig-Json([string]$name, [string]$coach, [int]$port, [string]$backend, [string]$daten, [string]$privat, [string]$arbeit, [string]$site, [string]$projekt, [string]$hinweis, $firma = $null) {
  $k = [ordered]@{
    _hinweis = $hinweis
    name = $name; coach = $coach; sprache = 'Deutsch'; port = $port; backend = $backend; modell = $Modell; effort = $Effort
    daten = $daten
    anbieter = [ordered]@{ url = ''; modell = '' }
    trello = [ordered]@{ privat = $privat; arbeit = $arbeit }
    jira = [ordered]@{ site = $site; projekt = $projekt }
    # Seit 16.09.2026 weist der Server jeden Browser-Ursprung ab, der hier nicht steht (Test-OriginErlaubt) —
    # ohne diese Zeile bekam jede Compass-Seite auf *.vishnuartists.com 403 ORIGIN.
    origins = @('https://*.vishnuartists.com')
  }
  if ($firma) { $k.firma = $firma }
  return (($k | ConvertTo-Json -Depth 5) + "`n")
}
Write-Lf (Join-Path $stage 'compass-server.json') (Konfig-Json $Name $Coach 8787 'cli' '/var/lib/compass-server/daten' $trPrivat $trArbeit $jiraSite $JiraProjekt 'Konfiguration des Compass-Servers auf dem Wolkenserver — geschrieben von deploy-wolkenserver.ps1. Schlüssel liegen in /etc/compass-server/env.' (Firma-Block $FirmaSicht['']))

# Schlüssel: nur aus Benutzer-Umgebungsvariablen, nie ausgeben. Auf dem Server heißt der Claude-Token
# CLAUDE_CODE_OAUTH_TOKEN — hier trägt er einen eigenen Namen, damit er das lokale Claude Code nicht umstellt.
$paare = @(
  @('TRELLO_PRIVAT_KEY','TRELLO_PRIVAT_KEY'), @('TRELLO_PRIVAT_TOKEN','TRELLO_PRIVAT_TOKEN'),
  @('TRELLO_ARBEIT_KEY','TRELLO_ARBEIT_KEY'), @('TRELLO_ARBEIT_TOKEN','TRELLO_ARBEIT_TOKEN'),
  @('JIRA_EMAIL','JIRA_EMAIL'), @('JIRA_TOKEN','JIRA_TOKEN'), @('JIRA_SITE','JIRA_SITE'),
  @('CLAUDE_CODE_OAUTH_TOKEN','WOLKE_CLAUDE_TOKEN')
)
$envZeilen = @('# Umgebung des Dienstes compass-server — geschrieben von deploy-wolkenserver.ps1, nur root lesbar.', 'COMPASS_BACKEND=cli')
$finTok = Env-User 'FINANZ_TOKEN'
if (-not $finTok) { Sag 'FINANZ_TOKEN fehlt auf diesem Rechner — die Firmensicht bleibt auf dem Server ohne Zahlen (NO_KEY).' }
# Maschinenschlüssel der Tower-Tür (16.09.2026): dieselbe Zeichenfolge wie $GATE_KEY in vishnu-tower\site\gate-config.php.
$towKey = Env-User 'TOWER_GATE_KEY'
if (-not $towKey) { Sag 'TOWER_GATE_KEY fehlt auf diesem Rechner — die Tower-Karte auf dem Server sagt NO_KEY.' }
$da = @(); $fehlt = @()
foreach ($p in $paare) {
  $v = Env-User $p[1]
  if ($v) { $envZeilen += (Env-Zeile $p[0] $v); $da += $p[0] } else { $fehlt += $p[1] }
}
# Staging bekommt $envZeilen als Kopie (siehe unten) — FINANZ_TOKEN deshalb nur in die Hauptinstanz-Datei.
$hauptFirma = @()
if ($FirmaSicht.ContainsKey('')) {
  if ($finTok) { $hauptFirma += (Env-Zeile 'FINANZ_TOKEN' $finTok) }
  if ($towKey) { $hauptFirma += (Env-Zeile 'TOWER_GATE_KEY' $towKey) }
}
Write-Lf (Join-Path $stage 'env') ((($envZeilen + $hauptFirma) -join "`n") + "`n")
Sag ("Schlüssel für den Server: {0}" -f ($da -join ', '))
if ($fehlt.Count) { Sag ("FEHLT auf diesem Rechner (bleibt auf dem Server leer): {0}" -f ($fehlt -join ', ')) }
if ($fehlt -contains 'WOLKE_CLAUDE_TOKEN') { Sag 'Ohne WOLKE_CLAUDE_TOKEN läuft der Coach ohne Anmeldung (NO_LOGIN) - Trello, Jira und der Stapel aus Dateien gehen trotzdem. Setzen: claude setup-token, dann [Environment]::SetEnvironmentVariable(''WOLKE_CLAUDE_TOKEN'',''<token>'',''User'') und erneut deployen.' }

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

# Team- und Kundeninstanzen: Konfiguration aus instanzen\<slug>\compass\instanz.js (Name, Trello, Jira),
# eigener Port und Pfad aus wolke.json, Backend cli nur mit dem setup-token der Person (WOLKE_CLAUDE_TOKEN_<SLUG>).
foreach ($s in $inst.Keys) {
  $e = $inst[$s]
  if ($s -eq 'staging') {
    # Staging = Benes Hauptinstanz noch einmal: dieselbe Konfiguration, dieselben Schluessel (sein Abo, seine
    # Boards), dieselben Ausgangsdaten — aber ein eigener Datenordner. Was der Coach dort schreibt (TASKS.md,
    # Coaching-Notizen), bleibt in Staging. Kein instanz.js, kein Eintrag in einer Instanz.
    $d = Join-Path $stage "instanzen\$s"; New-Item -ItemType Directory -Force (Join-Path $d 'daten') | Out-Null
    Write-Lf (Join-Path $d 'compass-server.json') (Konfig-Json $Name $Coach ([int]$e.port) $(if ($da -contains 'CLAUDE_CODE_OAUTH_TOKEN') { 'cli' } else { 'ohne' }) "/var/lib/compass-server/instanzen/$s/daten" $trPrivat $trArbeit $jiraSite $JiraProjekt 'Staging-Dienst des Compass-Servers (compass-server@staging) — Benes Konfiguration, eigener Datenordner. Geschrieben von deploy-wolkenserver.ps1 -Staging. Schluessel: /etc/compass-server/instanzen/staging.env.')
    Write-Lf (Join-Path $d 'env') ((($envZeilen | ForEach-Object { $_ -replace '^# Umgebung des Dienstes compass-server ', '# Umgebung des Dienstes compass-server@staging ' }) -join "`n") + "`n")
    foreach ($f in (Get-ChildItem (Join-Path $stage 'daten') -File)) { Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $d "daten\$($f.Name)") -Force }
    Write-Lf (Join-Path $d "$s.caddy") ("handle_path /$($e.pfad)/* {`n`treverse_proxy localhost:$($e.port) {`n`t`theader_up Host localhost:$($e.port)`n`t}`n}`n")
    Sag ("Staging: Port {0} · Backend wie Hauptinstanz · Trello {1}/{2} · Jira {3}/{4} · Daten aus dem Hauptordner" -f $e.port, $trPrivat, $trArbeit, $jiraSite, $JiraProjekt)
    continue
  }
  $instJs = Join-Path $repo "instanzen\$s\compass\instanz.js"
  if (-not (Test-Path $instJs)) { Sag "WARNUNG: Instanz $s hat keine instanz.js ($instJs) — wird ohne Konfiguration angelegt."; $js = '' } else { $js = Read-Utf8 $instJs }
  $w = @{ name = $e.name; privat = ''; arbeit = ''; site = ''; projekt = '' }
  if ($js -match "(?m)^\s*name:\s*'([^']*)'")            { if ($Matches[1]) { $w.name = $Matches[1] } }
  if ($js -match "privat:\s*\{[^}]*url:\s*'[^']*trello\.com/b/([A-Za-z0-9]{8})") { $w.privat = $Matches[1] }
  if ($js -match "arbeit:\s*\{[^}]*url:\s*'[^']*trello\.com/b/([A-Za-z0-9]{8})") { $w.arbeit = $Matches[1] }
  if ($js -match "browse:\s*'https?://([^/']+)/")        { $w.site = $Matches[1] }
  if ($js -match "keys:\s*\[\s*'([A-Za-z0-9]+)'")        { $w.projekt = $Matches[1] }
  $tokVar = 'WOLKE_CLAUDE_TOKEN_' + ($s.ToUpper() -replace '[^A-Z0-9]', '_')
  $tok = Env-User $tokVar
  $backend = $(if ($tok) { 'cli' } else { 'ohne' })
  $d = Join-Path $stage "instanzen\$s"; New-Item -ItemType Directory -Force $d | Out-Null
  $fs = $(if ($FirmaSicht.ContainsKey($s)) { $FirmaSicht[$s] } else { '' })
  Write-Lf (Join-Path $d 'compass-server.json') (Konfig-Json $w.name 'Coach' ([int]$e.port) $backend "/var/lib/compass-server/instanzen/$s/daten" $w.privat $w.arbeit $w.site $w.projekt "Compass-Server der Instanz $s auf dem Wolkenserver — geschrieben von deploy-wolkenserver.ps1. Schlüssel: /etc/compass-server/instanzen/$s.env." (Firma-Block $fs))
  $ez = @("# Umgebung des Dienstes compass-server@$s — nur root lesbar.", "COMPASS_BACKEND=$backend")
  if ($tok) { $ez += (Env-Zeile 'CLAUDE_CODE_OAUTH_TOKEN' $tok) }
  # Trello/Jira der Person (Schritt 3, 15.09.2026): TRELLO_<SLUG>_KEY/_TOKEN (ein Trello-Konto, gilt für Privat- und
  # Arbeitsboard) und JIRA_<SLUG>_EMAIL/_TOKEN (Site aus instanz.js, sonst JIRA_<SLUG>_SITE). Eintragen: wolke-token.ps1.
  $sv = ($s.ToUpper() -replace '[^A-Z0-9]', '_'); $schl = @()
  $tk = Env-User "TRELLO_${sv}_KEY"; $tt = Env-User "TRELLO_${sv}_TOKEN"
  if ($tk -and $tt) {
    foreach ($b in 'PRIVAT','ARBEIT') { $ez += (Env-Zeile "TRELLO_${b}_KEY" $tk); $ez += (Env-Zeile "TRELLO_${b}_TOKEN" $tt) }
    $schl += 'Trello'
  }
  $je = Env-User "JIRA_${sv}_EMAIL"; $jt = Env-User "JIRA_${sv}_TOKEN"; $jsite = Env-User "JIRA_${sv}_SITE"
  if (-not $jsite -and -not $w.site) { $jsite = Env-User 'JIRA_SITE' }   # Team ohne eigene Site: dieselbe Vishnu-Site wie Bene
  if ($je -and $jt) {
    $ez += (Env-Zeile 'JIRA_EMAIL' $je); $ez += (Env-Zeile 'JIRA_TOKEN' $jt)
    if ($jsite) { $ez += (Env-Zeile 'JIRA_SITE' $jsite) }
    $schl += 'Jira'
  }
  if ($fs -and $finTok) { $ez += (Env-Zeile 'FINANZ_TOKEN' $finTok); $schl += "Firmensicht ($fs)" }
  if ($fs -and $towKey) { $ez += (Env-Zeile 'TOWER_GATE_KEY' $towKey); $schl += 'Tower' }
  Write-Lf (Join-Path $d 'env') (($ez -join "`n") + "`n")
  Write-Lf (Join-Path $d "$s.caddy") ("handle_path /$($e.pfad)/* {`n`treverse_proxy localhost:$($e.port) {`n`t`theader_up Host localhost:$($e.port)`n`t}`n}`n")
  Sag ("Instanz {0}: Name {1} · Port {2} · Backend {3} · Trello {4}/{5} · Jira {6}/{7} · Schlüssel der Person: {8}" -f $s, $w.name, $e.port, $backend, $w.privat, $w.arbeit, $w.site, $w.projekt, $(if ($schl.Count) { $schl -join ', ' } else { "keine (TRELLO_${sv}_*, JIRA_${sv}_* nicht gesetzt)" }))
}

foreach ($f in 'install.sh','compass-server.service','compass-server@.service','Caddyfile.tmpl') { Write-Lf (Join-Path $stage $f) (Read-Utf8 (Join-Path $hier $f)) }
Sag "Staging-Ordner: $stage (Paket $hash · Host $Hostname · Pfad t-… · $($inst.Count) Instanz(en)$(if ($inst.Contains('staging')) { ' inkl. Staging-Dienst' }))"
if ($NurStaging) { Get-ChildItem $stage -Recurse -File | ForEach-Object { $_.FullName.Substring($stage.Length + 1) }; Sag 'NurStaging: nichts hochgeladen. Den Ordner danach löschen — die Dateien env enthalten Schlüssel.'; return }

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
$ok = $false
for ($i = 1; $i -le 9 -and -not $ok; $i++) {
  $ok = Probe $api 'Hauptinstanz'
  if (-not $ok) { Sag "Versuch $i/9 — Zertifikat oder DNS brauchen einen Moment"; Start-Sleep 10 }
}
foreach ($s in $inst.Keys) { $inst[$s].erreichbar = [string](Probe $inst[$s].api ("Instanz " + $inst[$s].name)) }

# ---------- 4) Stand merken, Instanzen verdrahten ----------
$state['server'] = $Server; $state['host'] = $Hostname; $state['pfad'] = $Pfad; $state['api'] = $api
$state['stand'] = (Get-Date).ToString('o'); $state['paket'] = $hash; $state['erreichbar'] = [string]$ok
$aus = [ordered]@{}; foreach ($k in ($state.Keys | Sort-Object)) { $aus[$k] = $state[$k] }
$ai = [ordered]@{}; foreach ($s in $inst.Keys) { $ai[$s] = [pscustomobject]$inst[$s] }
$aus['instanzen'] = [pscustomobject]$ai
[IO.File]::WriteAllText($stateDatei, (([pscustomobject]$aus) | ConvertTo-Json -Depth 5), $enc)
Sag "Stand geschrieben: $stateDatei"
# Team-Instanzen: `api:` in instanz.js setzen (bleibt sonst leer = Solo-Modus). Nur wenn die Instanz antwortet.
foreach ($s in $inst.Keys) {
  if ($inst[$s].erreichbar -ne 'True') { continue }
  $instJs = Join-Path $repo "instanzen\$s\compass\instanz.js"
  if (-not (Test-Path $instJs)) { continue }
  $js = Read-Utf8 $instJs
  $neu = [regex]::Replace($js, "(?m)^(\s*api:\s*)'[^']*'", ('${1}''' + $inst[$s].api + ''''), 1)
  if ($neu -ne $js) { Write-Lf $instJs $neu; Sag "instanz.js von $s zeigt jetzt auf den Wolkenserver (publish-compass.ps1 baut es beim nächsten Lauf ein)." }
}
if ($ok) {
  Sag 'Der nächste Lauf von publish-compass.ps1 (alle 30 Min) baut bene.vishnuartists.com mit dieser Adresse. Sofort: powershell -ExecutionPolicy Bypass -File publish-compass.ps1'
  Sag 'Zurück zum lokalen John im Browser: ?john=http://localhost:8787 an die Compass-Adresse hängen (wird gemerkt); ?john= ohne Wert löscht das wieder.'
} else {
  Sag 'Nicht erreichbar — wolke.json ist trotzdem geschrieben (erreichbar=False). build-compass.ps1 setzt die Adresse erst ein, wenn erreichbar=True steht. Später: -Status'
}
