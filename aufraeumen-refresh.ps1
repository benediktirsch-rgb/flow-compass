<#
  aufraeumen-refresh.ps1 — zieht die Ticket-Aufraeum-Karte des Flow Compass
  (aufraeumen-data.js) gegen das echte Jira frisch. (Bene, 01.09.2026)

  Anlass: die Karte stand seit dem 18.08. als Handschnappschuss im Repo. Am 31.08.
  wurden die zehn "schliessen"-Vorschlaege in Jira erledigt — die Karte schlug sie
  danach weiter vor. Wer eine Liste von Hand pflegt, zeigt frueher oder spaeter
  geschlossene Tickets.

  Was das Skript macht:
    * holt alle offenen Tickets (assignee = currentUser() AND statusCategory != Done)
      — genau die Menge, auf die der "Alle ... in Jira"-Knopf der Karte zeigt;
    * uebernimmt die Einschaetzung (schliessen / pool / behalten + Begruendung) aus
      der vorhandenen Datei fuer jeden Schluessel, den es noch gibt;
    * wirft raus, was inzwischen Done ist;
    * legt neu aufgetauchte Tickets als "behalten - neu seit dem letzten Vorschlag,
      noch nicht eingeschaetzt" ab. Nie schlaegt das Skript von selbst etwas zum
      Schliessen vor — das bleibt eine Einschaetzung, die Claude oder Bene trifft.
    * schreibt nur, wenn sich wirklich etwas geaendert hat (ausser dem Datum).

  Zugangsdaten (NIE im Repo): %USERPROFILE%\.claude\secrets\jira.env
     JIRA_EMAIL=benedikt@vishnuartists.com
     JIRA_TOKEN=<Atlassian-API-Token>
  Dieselbe Datei nutzt sprint-rollover.ps1.

  Aufruf:  powershell -File aufraeumen-refresh.ps1            -> Datei nachziehen
           powershell -File aufraeumen-refresh.ps1 -DryRun    -> nur berichten
           powershell -File aufraeumen-refresh.ps1 -Leise     -> nur bei Aenderung reden
           powershell -File aufraeumen-refresh.ps1 -Commit    -> zusaetzlich committen + pushen
           powershell -File aufraeumen-refresh.ps1 -Register  -> geplante Aufgabe einrichten
                      (taeglich 06:20 + bei Anmeldung, laeuft mit -Commit -Leise)
           powershell -File aufraeumen-refresh.ps1 -Unregister
#>
param([switch]$DryRun, [switch]$Leise, [switch]$Commit, [switch]$Register, [switch]$Unregister)

$Aufgabe = 'Vishnu Compass Ticket-Aufraeumen'
if ($Register) {
  $act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$($MyInvocation.MyCommand.Path)`" -Commit -Leise"
  $tr1 = New-ScheduledTaskTrigger -Daily -At '06:20'
  $tr2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RunOnlyIfNetworkAvailable
  Register-ScheduledTask -TaskName $Aufgabe -Action $act -Trigger @($tr1,$tr2) -Settings $set -Description 'Zieht aufraeumen-data.js (Ticket-Aufraeum-Karte im Flow Compass) gegen das echte Jira frisch und committet nur bei Aenderung.' -Force | Out-Null
  Write-Output "Aufgabe '$Aufgabe' eingerichtet (taeglich 06:20 + bei Anmeldung)."
  return
}
if ($Unregister) { Unregister-ScheduledTask -TaskName $Aufgabe -Confirm:$false; Write-Output "Aufgabe '$Aufgabe' entfernt."; return }

$ErrorActionPreference = 'Stop'
$Base = 'https://vishnuartists.atlassian.net'
$Jql  = 'assignee = currentUser() AND statusCategory != Done ORDER BY updated ASC'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Ziel = Join-Path $Root 'aufraeumen-data.js'
$EnvFile = Join-Path $env:USERPROFILE '.claude\secrets\jira.env'

function Sag([string]$t) { if (-not $Leise) { Write-Output $t } }

# ---------- 1) Zugang ----------
if (-not (Test-Path $EnvFile)) {
  Write-Output "FEHLT: $EnvFile (JIRA_EMAIL=... / JIRA_TOKEN=...) — Token unter id.atlassian.com/manage-profile/security/api-tokens erstellen."
  exit 2
}
$cfg = @{}
Get-Content $EnvFile | ForEach-Object { if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { $cfg[$matches[1]] = $matches[2] } }
if (-not $cfg['JIRA_EMAIL'] -or -not $cfg['JIRA_TOKEN']) { Write-Output "FEHLT: JIRA_EMAIL/JIRA_TOKEN in $EnvFile"; exit 2 }
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$($cfg['JIRA_EMAIL']):$($cfg['JIRA_TOKEN'])"))
$H = @{ Authorization = "Basic $auth"; Accept = 'application/json' }

# ---------- 2) Bisherige Einschaetzung einlesen ----------
# Jede Zeile der Liste ist ein JSON-Array: ["KEY","PRJ","Status","Titel","Datum","empf","Grund"]
$alt = @{}          # KEY -> @{ empf; grund }
$altReihe = @()     # Reihenfolge der Schluessel, damit Bekanntes seine Position behaelt
if (Test-Path $Ziel) {
  foreach ($zeile in (Get-Content $Ziel -Encoding UTF8)) {
    $t = $zeile.Trim().TrimEnd(',')
    if ($t -notmatch '^\["[A-Z]+-[0-9]+"') { continue }
    try { $r = $t | ConvertFrom-Json } catch { continue }
    if ($r.Count -lt 7) { continue }
    $alt[$r[0]] = @{ empf = $r[5]; grund = $r[6] }
    $altReihe += $r[0]
  }
}
Sag ("Bisher eingeschaetzt: {0} Ticket(s) aus {1}" -f $alt.Count, (Split-Path $Ziel -Leaf))

# ---------- 3) Offene Tickets holen ----------
$offen = @(); $token = $null
do {
  $u = "$Base/rest/api/3/search/jql?jql=" + [uri]::EscapeDataString($Jql) + '&fields=summary,status,updated&maxResults=100'
  if ($token) { $u += '&nextPageToken=' + [uri]::EscapeDataString($token) }
  $r = Invoke-RestMethod -Uri $u -Headers $H -Method Get
  $offen += $r.issues
  $token = $r.nextPageToken
} while ($token)
if (-not $offen -or $offen.Count -eq 0) { Write-Output "Jira lieferte 0 offene Tickets — das ist unplausibel, Datei bleibt unveraendert."; exit 3 }
Sag ("Jira: {0} offene Ticket(s)" -f $offen.Count)

# ---------- 4) Zusammenfuehren ----------
$offeneKeys = @{}
$zeilen = @{ schliessen = @(); pool = @(); behalten = @() }
$neu = @()
$Unbewertet = 'noch nicht eingeschaetzt — seit dem letzten Vorschlag dazugekommen'
foreach ($i in $offen) {
  $k = $i.key
  $offeneKeys[$k] = $true
  $prj = $k.Split('-')[0]
  $empf = 'behalten'; $grund = $Unbewertet
  if ($alt.ContainsKey($k)) {
    $empf = $alt[$k].empf; $grund = $alt[$k].grund
    # Alte Schreibweisen des Platzhalters auf die aktuelle ziehen, sonst zaehlt
    # $unbewertetZahl sie nicht mehr mit und die Karte behauptet "alles eingeschaetzt".
    if ($grund -like '*noch nicht eingeschaetzt*') { $grund = $Unbewertet }
  }
  else { $neu += $k }
  if (-not $zeilen.ContainsKey($empf)) { $empf = 'behalten' }
  $zeilen[$empf] += ,@($k, $prj, [string]$i.fields.status.name, [string]$i.fields.summary,
                       ([string]$i.fields.updated).Substring(0,10), $empf, $grund)
}
$weg = @($altReihe | Where-Object { -not $offeneKeys.ContainsKey($_) })

# ---------- 5) Bericht ----------
if ($weg.Count) { Sag ("Seit dem letzten Stand erledigt (fliegen raus): {0}" -f ($weg -join ', ')) }
if ($neu.Count) { Sag ("Neu offen (als 'behalten' abgelegt, Einschaetzung fehlt): {0}" -f ($neu -join ', ')) }

# ---------- 6) Datei bauen ----------
function EscJs([string]$s) {
  if (-not $s) { return '' }
  $s = $s -replace '\\', '\\'
  $s = $s -replace '"', '\"'
  $s = $s -replace '[\r\n\t]', ' '
  return $s
}
$prjZaehler = [ordered]@{}
foreach ($k in ($offeneKeys.Keys | Sort-Object)) {
  $p = $k.Split('-')[0]
  if (-not $prjZaehler.Contains($p)) { $prjZaehler[$p] = 0 }
  $prjZaehler[$p] = $prjZaehler[$p] + 1
}
$prjText  = (($prjZaehler.Keys | ForEach-Object { "$($_):$($prjZaehler[$_])" }) -join ',')
# In die Datei kommt, wie viele Tickets NOCH KEINE Einschaetzung haben — nicht, wie viele
# seit dem letzten Lauf dazukamen. Sonst staende dort am naechsten Tag 0, obwohl der Stapel
# unbeurteilter Tickets unveraendert liegt, und die Datei aendert sich taeglich ohne Anlass.
$unbewertetZahl = @($zeilen.Values | ForEach-Object { $_ } | Where-Object { $_[6] -eq $Unbewertet }).Count
$empfText = "schliessen:$($zeilen.schliessen.Count),pool:$($zeilen.pool.Count),behalten:$($zeilen.behalten.Count)"
$stand = Get-Date -Format 'yyyy-MM-dd'

$sb = New-Object Text.StringBuilder
[void]$sb.Append("/* Erzeugt von aufraeumen-refresh.ps1 gegen das echte Jira — nicht von Hand pflegen.`n")
[void]$sb.Append("   Die Einschaetzung (schliessen/pool/behalten + Grund) wird bei jedem Lauf uebernommen;`n")
[void]$sb.Append("   erledigte Tickets fallen raus, neue kommen als 'behalten, noch nicht eingeschaetzt' rein. */`n")
[void]$sb.Append("window.AUFRAEUMEN = { stand:'$stand', gesamt:$($offen.Count), unbewertet:$unbewertetZahl, projekte:{$prjText}, empf:{$empfText},`n")
[void]$sb.Append("  liste:[`n")
foreach ($gruppe in @('schliessen','pool','behalten')) {
  [void]$sb.Append("    // ---------- $gruppe ----------`n")
  foreach ($z in $zeilen[$gruppe]) {
    $felder = ($z | ForEach-Object { '"' + (EscJs $_) + '"' }) -join ','
    [void]$sb.Append("    [$felder],`n")
  }
}
$text = $sb.ToString()
$text = $text -replace ",`n$", "`n"          # letztes Komma weg
$text += "  ] };`n"

# ---------- 7) Nur bei echter Aenderung schreiben ----------
$altText = ''
if (Test-Path $Ziel) { $altText = [IO.File]::ReadAllText($Ziel) }
$rumpfAlt = ($altText  -replace "stand:'[0-9-]+'", "stand:'x'")
$rumpfNeu = ($text     -replace "stand:'[0-9-]+'", "stand:'x'")
if ($rumpfAlt -eq $rumpfNeu) {
  Sag "Unveraendert — Datei bleibt liegen (nur das Datum haette sich bewegt)."
} elseif ($DryRun) {
  Write-Output ("DryRun: {0} wuerde geschrieben — {1} offen, {2} raus, {3} neu, empf {4}" -f (Split-Path $Ziel -Leaf), $offen.Count, $weg.Count, $neu.Count, $empfText)
  return
} else {
  [IO.File]::WriteAllText($Ziel, $text, (New-Object Text.UTF8Encoding($false)))
  Write-Output ("{0} geschrieben: {1} offen ({2}), {3} erledigt entfernt, {4} neu." -f (Split-Path $Ziel -Leaf), $offen.Count, $empfText, $weg.Count, $neu.Count)
}

# ---------- 8) Freigeben (nur mit -Commit, nur diese eine Datei) ----------
# Bewusst NICHT daran gehaengt, ob dieser Lauf geschrieben hat: konnte ein
# frueherer Lauf wegen fremdem Index nicht committen, laege die Aenderung sonst
# fuer immer liegen — der naechste Lauf sieht ja "unveraendert". Entscheidend
# ist allein, ob die Datei von HEAD abweicht.
if (-not $Commit) { return }
Push-Location $Root
$eapVorher = $ErrorActionPreference
# git schreibt Hinweise (CRLF-Warnung, die Meldungen des pre-commit-Hooks) auf stderr.
# Unter 'Stop' macht PowerShell daraus einen NativeCommandError und bricht mitten im
# Commit ab — deshalb hier auf 'Continue' und ausschliesslich $LASTEXITCODE auswerten.
$ErrorActionPreference = 'Continue'
try {
  # Ein nicht leerer Index gehoert einer anderen Sitzung — dann nichts anfassen.
  $index = @(& git diff --cached --name-only 2>$null)
  if ($LASTEXITCODE -ne 0) { Write-Output "Kein Git-Repo — nicht committet."; return }
  if ($index.Count) { Write-Output ("Index nicht leer ({0}) — nicht committet, die Datei liegt als Paket bereit." -f ($index -join ', ')); return }

  & git diff --quiet HEAD -- 'aufraeumen-data.js'
  if ($LASTEXITCODE -eq 0) { Sag "Nichts freizugeben — die Datei steht schon so in HEAD."; return }

  # persoenliches-dashboard hat kein Remote (der Compass wird ueber
  # analytics-dashboard\publish-compass.ps1 veroeffentlicht). Ohne Upstream
  # darf hier weder gepullt noch gepusht werden, sonst bricht der Lauf ab.
  $upstream = & git rev-parse --abbrev-ref '@{u}' 2>$null
  $hatRemote = ($LASTEXITCODE -eq 0 -and $upstream)
  if ($hatRemote) { & git pull --ff-only 2>&1 | Out-Null }

  & git add -- 'aufraeumen-data.js'
  if ($LASTEXITCODE -ne 0) { Write-Output "git add fehlgeschlagen — nicht committet."; return }

  $msg = Join-Path $env:TEMP ("aufraeum-msg-{0}.txt" -f $PID)   # Nachricht per Datei: ein " in -m zerlegt den Aufruf
  [IO.File]::WriteAllText($msg, ("compass: Ticket-Aufraeumen gegen Jira nachgezogen ({0} offen, {1} erledigt raus, {2} neu)`n" -f $offen.Count, $weg.Count, $neu.Count), (New-Object Text.UTF8Encoding($false)))
  $aus = & git commit -F $msg 2>&1
  Remove-Item $msg -ErrorAction SilentlyContinue
  if ($LASTEXITCODE -ne 0) { & git reset -q; Write-Output ("commit abgebrochen (meist der pre-commit-Hook, z. B. Lease einer anderen Sitzung):`n{0}" -f ($aus -join "`n")); return }
  if ($hatRemote) {
    $aus = & git push 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Output ("push fehlgeschlagen:`n{0}" -f ($aus -join "`n")); return }
  }
  Write-Output "committet — der naechste Compass-Publish (alle 30 Min) nimmt es mit."
} finally { $ErrorActionPreference = $eapVorher; Pop-Location }
