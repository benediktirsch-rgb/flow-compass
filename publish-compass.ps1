# publish-compass.ps1 — Flow Compass automatisch live bringen (seit 02.09.2026 im Repo flow-compass)
#   1) git pull --ff-only (nur Porcelain, nie Gewalt) — übersprungen, solange kein Remote hängt
#   2) build-compass.ps1          → site/compass/       (die EIGENE Instanz; nicht im Repo)
#   2b) build-compass-produkt.ps1 → site/compass-demo/  (anonymisierte Verkaufs-Demo; im Repo)
#      Scheitert der Produkt-Build (Anker fehlt, Wortprüfung), wird das nur geloggt — die eigene
#      Instanz geht trotzdem live, die alte Demo bleibt stehen.
#   3) per FTPS auf die Subdomains von vishnuartists.com (seit 03.09.2026, je Ziel ein eigenes
#      Dokumentenverzeichnis im KAS): eigene Instanz → bene., Demo → demo., Team-/Kundeninstanzen aus
#      instanzen\<slug> → <sub>. Nur Dateien, deren Hash sich seit dem letzten Upload geändert hat
#      (site/.publish-state/<sub>.json, gitignored). Nie löschen.
#      Zugang ausschließlich aus User-Umgebungsvariablen (nie in Datei oder Kommandozeile):
#        VA_FTP_HOST  z. B. wXXXXXXX.kasserver.com   VA_FTP_USER   VA_FTP_PASS
#      Fehlen sie, wird das geloggt und der Rest läuft weiter.
#   4) hat sich die Demo geändert → git add site/compass-demo → commit → git push origin main
#      (deploy.yml des Repos spielt sie per FTPS nach https://demo.vishnuartists.com/ — dieselben Bytes wie
#      Schritt 3, eigener Sync-State; solange dem Repo die Secrets fehlen, liefert nur Schritt 3 wirklich aus)
#
#   Warum zwei Wege: die eigene Instanz enthält persönliche Daten und gehört nicht ins Produkt-Repo;
#   die Demo ist Produkt und darf über GitHub laufen. Bis 02.09.2026 lief beides über das Repo
#   analytics-dashboard, das aufgelöst wurde.
#
#   Stufen (seit 15.09.2026, Regeln in stufen.json, Architektur in docs/umgebungen.md):
#     staging  = der Arbeitsstand, auch uncommittet → site\staging\<sub>\ → staging-<sub>.vishnuartists.com,
#                gekennzeichnet (build-stufe.ps1), eigener Compass-Server auf wolke (compass-server@staging).
#     prod     = wie bisher — oder, mit prod.freigabe = "commit" in stufen.json, nur dann, wenn die
#                Arbeitskopie keine uncommitteten Aenderungen an getrackten Dateien hat (Freigabe = Commit).
#     -Stufe staging|prod|alle waehlt aus, -Erzwingen uebersteuert die Freigabe-Regel einmalig.
#
#   Läuft als geplante Aufgabe „Vishnu Flow Compass publish“ (alle 30 Min + bei Anmeldung).
#   powershell -ExecutionPolicy Bypass -File publish-compass.ps1   (oder -Register / -Unregister / -NurBauen)
param([switch]$Register, [switch]$Unregister, [switch]$NurBauen, [int]$Minuten = 30,
      [ValidateSet('alle', 'staging', 'prod')][string]$Stufe = 'alle', [switch]$Erzwingen)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$log  = Join-Path $repo 'publish-compass.log'
$task = 'Vishnu Flow Compass publish'
function Log($m) { $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $m; Add-Content -Path $log -Value $line -Encoding UTF8; Write-Host $line }
# Fehlerzaehler (16.09.2026): Upload-Fehler und nicht ausgerollte Instanzen wurden bisher nur geloggt, der Lauf
# endete mit Exit-Code 0 — die geplante Aufgabe zeigte „erfolgreich", waehrend Dateien liegen blieben. Schluss
# schreibt am Ende eines Laufs die Summe und beendet mit 1, sobald etwas fehlgeschlagen ist. Steht an jedem
# Ausstieg NACH den Uploads ganz zuletzt, damit keine Aufraeumarbeit uebersprungen wird.
$script:PublishFehler = 0
function Schluss([string]$meldung = '') {
  if ($meldung) { Log $meldung }
  if ($script:PublishFehler -gt 0) { Log ("{0} Fehler in diesem Lauf — Exit-Code 1." -f $script:PublishFehler); exit 1 }
  Log '0 Fehler in diesem Lauf.'
}

if ($Register) {
  $act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$($MyInvocation.MyCommand.Path)`""
  $tr1 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes $Minuten)
  $tr2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RunOnlyIfNetworkAvailable
  Register-ScheduledTask -TaskName $task -Action $act -Trigger @($tr1,$tr2) -Settings $set -Description "Baut den Flow Compass (eigene Instanz + Demo) aus $repo, laedt die Instanz per FTPS hoch und pusht die Demo." -Force | Out-Null
  Log "Aufgabe '$task' registriert (alle $Minuten Min + bei Anmeldung) → $($MyInvocation.MyCommand.Path)"; return
}
if ($Unregister) { Unregister-ScheduledTask -TaskName $task -Confirm:$false; Log "Aufgabe '$task' entfernt."; return }

# Log kappen — erst vollständig lesen, DANN schreiben (ein offener Lesestrom beim Schreiben hat
# diesen Lauf am 30.08.2026 stillschweigend getötet). Ein Problem hier darf nichts verhindern.
try {
  if (Test-Path $log) {
    $altzeilen = @([IO.File]::ReadAllLines($log, [Text.Encoding]::UTF8))
    if ($altzeilen.Count -gt 400) { [IO.File]::WriteAllLines($log, $altzeilen[-200..-1], (New-Object Text.UTF8Encoding($false))) }
  }
} catch { Write-Host "Log-Kappen uebersprungen: $($_.Exception.Message)" }

Set-Location $repo
$env:GIT_TERMINAL_PROMPT = '0'
# git.exe explizit (sonst ruft sich die Funktion selbst auf — PowerShell-Namen sind case-insensitiv)
function Git { param([Parameter(ValueFromRemainingArguments)]$a)
  $ErrorActionPreference = 'Continue'
  $out = & git.exe @a 2>&1; $script:gitExit = $LASTEXITCODE; ($out | ForEach-Object { "$_" }) -join "`n" }

# ---------- FTPS (explizit, AUTH TLS) — Muster aus C:\dev\_tools\vaikuntha-ftp.ps1 ----------
function Hole-FtpZugang {
  $z = @{}
  foreach ($k in 'VA_FTP_HOST','VA_FTP_USER','VA_FTP_PASS') {
    $v = [Environment]::GetEnvironmentVariable($k, 'User'); if (-not $v) { $v = [Environment]::GetEnvironmentVariable($k, 'Process') }
    if (-not $v) { return $null }
    $z[$k] = $v.Trim()
  }
  return $z
}
function Neu-FtpAnfrage($zugang, [string]$fernPfad, [string]$methode) {
  $url = 'ftp://' + $zugang.VA_FTP_HOST + $fernPfad
  $a = [Net.FtpWebRequest]::Create($url)
  $a.Credentials = New-Object Net.NetworkCredential($zugang.VA_FTP_USER, $zugang.VA_FTP_PASS)
  $a.EnableSsl = $true; $a.UsePassive = $true; $a.UseBinary = $true; $a.KeepAlive = $false
  $a.Timeout = 30000; $a.ReadWriteTimeout = 60000
  $a.Method = $methode
  return $a
}
function Sichere-FtpOrdner($zugang, [string]$fernPfad) {
  # MKD; „existiert schon“ (550) ist kein Fehler
  try { $r = (Neu-FtpAnfrage $zugang $fernPfad ([Net.WebRequestMethods+Ftp]::MakeDirectory)).GetResponse(); $r.Close() }
  catch { if ("$($_.Exception.Message)" -notmatch '550') { throw } }
}
function Lade-FtpHoch($zugang, [string]$lokal, [string]$fernPfad) {
  $bytes = [IO.File]::ReadAllBytes($lokal)
  $a = Neu-FtpAnfrage $zugang $fernPfad ([Net.WebRequestMethods+Ftp]::UploadFile)
  $a.ContentLength = $bytes.Length
  $s = $a.GetRequestStream(); $s.Write($bytes, 0, $bytes.Length); $s.Close()
  $r = $a.GetResponse(); $r.Close()
}
function Hash([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash }

# ---------- Stufen (15.09.2026): staging = Arbeitsstand, prod = freigegebener Stand ----------
# stufen.json ist die eine Stelle fuer Ziele und Freigabe-Regel; fehlt sie, laeuft nur Prod wie bisher.
$STUFEN = $null
try { $STUFEN = (Get-Content -LiteralPath (Join-Path $repo 'stufen.json') -Raw -Encoding UTF8) | ConvertFrom-Json }
catch { Log "WARNUNG: stufen.json nicht lesbar ($($_.Exception.Message)) — nur Prod wie bisher." }
$stagingZiele = @(); $stagingInst = @(); $prodFreigabe = 'sofort'; $stagingOrdnerMuster = '/staging-{sub}.vishnuartists.com'
if ($STUFEN) {
  $stagingZiele = @($STUFEN.stufen.staging.ziele | Where-Object { $_ })
  $stagingInst  = @($STUFEN.stufen.staging.instanzen | Where-Object { $_ })
  if ($STUFEN.stufen.prod.freigabe)      { $prodFreigabe = [string]$STUFEN.stufen.prod.freigabe }
  if ($STUFEN.stufen.staging.kasOrdner)  { $stagingOrdnerMuster = [string]$STUFEN.stufen.staging.kasOrdner }
}
if ($Stufe -eq 'prod') { $stagingZiele = @(); $stagingInst = @() }

# Team- und Kundeninstanzen (steht seit dem 15.09.2026 hier oben, weil Staging die Liste auch braucht):
#   compass = $false (06.09.2026): nur das Portal an der Wurzel, kein Compass-Build — fuer Menschen,
#   die Raumschiff, Backstage und Verein brauchen, aber keine Boards (Martin). portal.js und
#   gate-config.php liegen dann von Hand in instanzen\<slug>\, weil keine instanz.js sie fuellt.
$INSTANZEN = @(
  @{ name = 'Philipp Heitz'; sub = 'philipp' }
  @{ name = 'Jan';           sub = 'jan' }
  @{ name = 'Marwan';        sub = 'marwan' }
  @{ name = 'Florian';       sub = 'florian' }
  @{ name = 'Domingo';       sub = 'domingo' }
  @{ name = 'Martin';        sub = 'martin'; compass = $false }
)

# 0) Repo-Zustand: laufender Rebase/Merge? dann nichts anfassen
if ((Test-Path '.git\rebase-merge') -or (Test-Path '.git\rebase-apply') -or (Test-Path '.git\MERGE_HEAD')) { Log 'ABBRUCH: Rebase/Merge im Gang.'; return }
$branch = (Git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') { Log "ABBRUCH: Branch ist '$branch', nicht main."; return }
$remote = (Git remote).Trim()
$hatRemote = ($remote -match '(?m)^origin$')

# 1) pull --ff-only (nur mit Remote)
if ($hatRemote) {
  $o = Git pull --ff-only origin main
  if ($gitExit -ne 0) { Log "ABBRUCH: pull --ff-only fehlgeschlagen: $o"; return }
} else { Log 'Hinweis: kein Remote origin — pull/push entfallen, gebaut und hochgeladen wird trotzdem.' }

# 2) eigene Instanz bauen — seit 04.09.2026 dreigeteilt wie jede persoenliche Subdomain:
#    erst das alte flache Layout nach compass\ holen (einmalig), dann den Compass dorthin
#    bauen, dann das Portal an die Wurzel. Die .htaccess bleibt an der Wurzel und schuetzt
#    beides; build-compass.ps1 prueft sie ueber -Wurzel weiterhin an der richtigen Stelle.
$beneWurzel = Join-Path $repo 'site\compass'
# Sternenkarte der Bruecke (11.09.2026): Benes Landkarte pflegt der Skill nordstern-landkarte —
# eine Stelle zum Anpassen, 30 Minuten spaeter ist bene.vishnuartists.com nachgezogen.
$landkarte = Join-Path $env:USERPROFILE '.claude\skills\nordstern-landkarte\landkarte.js'
if (Test-Path $landkarte) {
  try { Copy-Item -LiteralPath $landkarte -Destination (Join-Path $beneWurzel 'landkarte.js') -Force }
  catch { Log "WARNUNG: landkarte.js nicht kopiert: $($_.Exception.Message)" }
}
try {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-portal.ps1') -Ziel $beneWurzel -NurMigrieren | Out-Null
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-compass.ps1') -Ziel (Join-Path $beneWurzel 'compass') -Wurzel $beneWurzel | Out-Null
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-portal.ps1') -Ziel $beneWurzel | Out-Null
}
catch { Log "ABBRUCH: Build fehlgeschlagen: $($_.Exception.Message)"; return }

# 2b) Demo mitbauen — Fehler nur loggen
$demoOk = $true
try {
  $pb = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-compass-produkt.ps1') 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($pb | Select-Object -Last 6) -join ' / ' }
} catch { $demoOk = $false; Log "WARNUNG: Demo-Build (site/compass-demo) fehlgeschlagen, alte Demo bleibt live: $($_.Exception.Message)" }

# 2c) Compass-Server-Paket fuer die Demo (07.09.2026): produkt\server\ → site\compass-demo\compass-server.zip.
#     Die Zip liegt neben der index.html der Demo, der Einrichtungs-Assistent verlinkt sie, und sie geht
#     mit dem Demo-Commit unten mit. Der Build schreibt nur bei geaendertem Inhalt (Hash in VERSION.txt),
#     sonst stuende alle 30 Minuten eine neue Zip in der Historie. Fehler nur loggen — die Demo selbst
#     haengt nicht daran.
try {
  $ps = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-compass-server.ps1') 2>&1
  if ($LASTEXITCODE -ne 0) { throw (($ps | Select-Object -Last 4) -join ' / ') }
} catch { $script:PublishFehler++; Log "WARNUNG: Compass-Server-Paket (site/compass-demo/compass-server.zip) nicht gebaut: $($_.Exception.Message)" }

# 2d) Staging (15.09.2026): dieselben Builds noch einmal nach site\staging\<sub>\, gekennzeichnet
#     (build-stufe.ps1) und an den Staging-Compass-Server gehaengt. Quelle ist die Arbeitskopie —
#     auch Uncommittetes. Nichts davon beruehrt Prod-Daten: eigener Ursprung (staging-<sub>.
#     vishnuartists.com), eigene Tuer mit eigenem Geheimnis, eigener Server-Datenordner auf wolke.
#     Fehler werden nur geloggt — Staging darf Prod nie aufhalten. Regeln: stufen.json, docs/umgebungen.md.
$stagingOk = [ordered]@{}
if ($stagingZiele.Count -or $stagingInst.Count) {
  $stagingApi = ''
  try {
    $wj = Join-Path $repo 'site\.publish-state\wolke.json'
    if (Test-Path $wj) {
      $w = (Get-Content -LiteralPath $wj -Raw -Encoding UTF8) | ConvertFrom-Json
      $st = $null; if ($w.instanzen) { $st = $w.instanzen.staging }
      if ($st -and [string]$st.erreichbar -eq 'True' -and $st.api) { $stagingApi = [string]$st.api }
    }
  } catch { }
  # Ohne Staging-Dienst zeigt der Staging-Compass auf eine Adresse, die es nicht gibt — er meldet dann
  # ehrlich "Server nicht erreichbar". Nie auf den Prod-Server: der Coach schriebe Test-Aufgaben in die
  # echte TASKS.md. Dienst anlegen: wolkenserver\deploy-wolkenserver.ps1 -Staging
  if (-not $stagingApi) { $stagingApi = 'https://kein-staging-server.invalid'; Log 'Hinweis: kein Staging-Compass-Server in wolke.json (deploy-wolkenserver.ps1 -Staging) — der Staging-Compass laeuft ohne Server.' }
  $stStand = Get-Date -Format 'dd.MM.yyyy HH:mm'
  function Spiegle([string]$von, [string]$nach, [string[]]$dateien) {
    foreach ($f in $dateien) { $q = Join-Path $von $f; if (Test-Path $q) { Copy-Item -LiteralPath $q -Destination (Join-Path $nach $f) -Force } }
  }
  foreach ($z in $stagingZiele) {
    $w = Join-Path $repo "site\staging\$z"
    try {
      if (-not (Test-Path $w)) { New-Item -ItemType Directory -Force $w | Out-Null }
      $prodUrl = ''
      switch ($z) {
        'bene' {
          # Tuer und Bruecke spiegeln Prod (dieselben Personen duerfen hinein, dieselben Kacheln);
          # gate-secret.php entsteht eigens — ein Staging-Cookie oeffnet nie die Prod-Tuer. gate.php kommt
          # mit, damit build-compass.ps1 die Tuer schon im ERSTEN Lauf als Schutz erkennt (sonst fehlte
          # kundenlage.html einmalig); build-portal.ps1 zieht die Datei danach ohnehin nach.
          Spiegle $beneWurzel $w @('portal.js', 'landkarte.js', 'gate-config.php', 'gate.php')
          & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-compass.ps1') -Ziel (Join-Path $w 'compass') -Wurzel $w -JohnApi $stagingApi | Out-Null
          if ($LASTEXITCODE -ne 0) { throw 'build-compass.ps1 (Staging) fehlgeschlagen' }
          & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-portal.ps1') -Ziel $w | Out-Null
          if ($LASTEXITCODE -ne 0) { throw 'build-portal.ps1 (Staging) fehlgeschlagen' }
          $prodUrl = 'https://bene.vishnuartists.com/'
        }
        'demo' {
          if (-not $demoOk) { throw 'der Demo-Build ist fehlgeschlagen — die Staging-Demo bleibt stehen' }
          $pb = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-compass-produkt.ps1') -Ziel $w 2>&1
          if ($LASTEXITCODE -ne 0) { throw (($pb | Select-Object -Last 4) -join ' / ') }
          Spiegle (Join-Path $repo 'site\compass-demo') $w @('.htaccess')
          $ps = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-compass-server.ps1') -Ziel (Join-Path $w 'compass-server.zip') 2>&1
          if ($LASTEXITCODE -ne 0) { Log ("WARNUNG: Staging-Demo ohne Server-Paket: " + (($ps | Select-Object -Last 2) -join ' / ')) }
          $prodUrl = 'https://demo.vishnuartists.com/'
        }
        default { throw "unbekanntes Staging-Ziel '$z' (stufen.json > staging.ziele kennt bene und demo)" }
      }
      & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-stufe.ps1') -Ordner $w -Stufe staging -Prod $prodUrl -Stand $stStand | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'build-stufe.ps1 fehlgeschlagen' }
      $stagingOk[$z] = $true
    } catch { $script:PublishFehler++; Log ("WARNUNG: Staging {0} nicht gebaut: {1}" -f $z, $_.Exception.Message) }
  }
  foreach ($slugWunsch in $stagingInst) {
    $inst = $INSTANZEN | Where-Object { $_.sub -eq $slugWunsch -or (($_.name.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')) -eq $slugWunsch } | Select-Object -First 1
    if (-not $inst) { Log "WARNUNG: Staging-Instanz '$slugWunsch' steht nicht in `$INSTANZEN — uebersprungen."; continue }
    if ($inst.ContainsKey('compass') -and -not $inst.compass) { Log "WARNUNG: Staging-Instanz '$slugWunsch' hat keinen Compass — uebersprungen."; continue }
    $islug = ($inst.name.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
    $von = Join-Path $repo "instanzen\$islug"; $w = Join-Path $repo "site\staging\$($inst.sub)"
    try {
      if (-not (Test-Path (Join-Path $von 'compass\instanz.js'))) { throw "instanzen\$islug\compass\instanz.js fehlt" }
      New-Item -ItemType Directory -Force (Join-Path $w 'compass') | Out-Null
      # instanz.js der Person, aber ohne Server-Adresse: die Staging-Instanz laeuft solo, statt
      # Aufgaben in den Prod-Server der Person zu schreiben.
      $ij = [IO.File]::ReadAllText((Join-Path $von 'compass\instanz.js'), [Text.Encoding]::UTF8)
      $ij = (New-Object Text.RegularExpressions.Regex "(?m)^(\s*api:\s*)'[^']*'").Replace($ij, '${1}''''', 1)
      [IO.File]::WriteAllText((Join-Path $w 'compass\instanz.js'), $ij.Replace("`r`n", "`n"), (New-Object Text.UTF8Encoding($false)))
      Spiegle $von $w @('portal.js', 'landkarte.js', 'gate-config.php')
      $pi = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-compass-produkt.ps1') -Instanz $inst.name -Ziel (Join-Path $w 'compass') 2>&1
      if ($LASTEXITCODE -ne 0) { throw (($pi | Select-Object -Last 4) -join ' / ') }
      & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-portal.ps1') -Ziel $w | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'build-portal.ps1 (Staging) fehlgeschlagen' }
      & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-stufe.ps1') -Ordner $w -Stufe staging -Prod ('https://' + $inst.sub + '.vishnuartists.com/') -Stand $stStand | Out-Null
      $stagingOk[$inst.sub] = $true
    } catch { $script:PublishFehler++; Log ("WARNUNG: Staging-Instanz {0} nicht gebaut: {1}" -f $inst.name, $_.Exception.Message) }
  }
  if ($stagingOk.Count) { Log ("Staging gebaut: " + (@($stagingOk.Keys) -join ', ')) }
}

if ($NurBauen) { Schluss 'NurBauen: fertig, nichts hochgeladen, nichts committet.'; return }

# ---------- Freigabe-Regel fuer Prod (15.09.2026, stufen.json > prod.freigabe) ----------
# "sofort" = wie bisher. "commit" = Prod nur aus einer Arbeitskopie ohne uncommittete Aenderungen an
# getrackten Dateien; die gitignorierte Datenschicht zaehlt nicht. Staging traegt den Stand derweil.
$prodFrei = $true; $prodGrund = ''
if ($Stufe -eq 'staging') { $prodFrei = $false; $prodGrund = 'nur Staging angefordert (-Stufe staging).' }
elseif ($prodFreigabe -eq 'commit' -and -not $Erzwingen) {
  # Die Demo-Ausgabe (site/compass-demo) schreibt dieser Lauf selbst, bevor hier geprueft wird — und
  # committet sie erst in Schritt 4, wenn Prod frei ist. Zaehlte sie mit, sperrte jede Aenderung an
  # dashboard.html Prod fuer immer (16.09.2026: ab 10:01 jeder Lauf „Prod uebersprungen“ wegen der eigenen
  # Demo). Sie ist aus committeten Quellen gebaut; nur ihre handgepflegte .htaccess zaehlt weiter.
  $dirty = ((Git status --porcelain --untracked-files=no) -split "`n" | Where-Object {
    $_.Trim() -and ($_ -notmatch '^.. site/compass-demo/' -or $_ -match '^.. site/compass-demo/\.htaccess$') }) -join "`n"
  if ($dirty) { $prodFrei = $false; $prodGrund = "die Arbeitskopie hat uncommittete Aenderungen an getrackten Dateien — Prod wartet auf die Freigabe (Commit auf main), Staging traegt den Stand; -Erzwingen uebersteuert einmalig.`n$dirty" }
}

# 3) Hochladen per FTPS — je Ziel eine Subdomain mit eigenem Dokumentenverzeichnis (03.09.2026):
#      site\compass        → bene.vishnuartists.com   (eigene Instanz, Zugangsschutz per .htaccess)
#      site\compass-demo   → demo.vishnuartists.com   (öffentliche Demo)
#      instanzen\<slug>    → <sub>.vishnuartists.com  (Team- und Kundeninstanzen, Zuordnung $INSTANZEN)
#    Warum Subdomains: bis heute deployten drei Repos in denselben Domain-Ordner von vishnu-artists.de,
#    Compass und Cockpit teilten sich localStorage und Login, und jede weitere Instanz in einem Unterordner
#    hätte sich mit den anderen den Speicher geteilt. Ein Ursprung je Instanz — nichts wird geteilt.
#    Der Hash-Stand liegt je Ziel in site\.publish-state\<sub>.json (gitignored), NICHT mehr im Ordner
#    selbst: dort würde er in der Demo mit committet. Neues Ziel = leerer Stand = einmal alles hochladen.
#    Die Liste $INSTANZEN steht seit dem 15.09.2026 oben bei den Stufen (Staging braucht sie auch).
$stateDir = Join-Path $repo 'site\.publish-state'
if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Force $stateDir | Out-Null }

function Lade-Ordner($zugang, [string]$lokal, [string]$sub, [string]$was, [string]$stufe = 'prod') {
  $fernBasis = '/' + $sub + '.vishnuartists.com'; $stateName = $sub
  if ($stufe -eq 'staging') {
    # Staging-Ziel (15.09.2026): eigener Ordner im Webspace nach dem KAS-Muster staging-<sub>.vishnuartists.com,
    # eigener Hash-Stand. Der Ordner wird angelegt, auch wenn die Subdomain im KAS noch fehlt: ausserhalb
    # eines Dokumentenverzeichnisses ist er von aussen nicht erreichbar, und beim Anlegen der Subdomain
    # wird er einfach ausgewaehlt — die Tuer (.htaccess + gate.php) liegt dann schon drin.
    $fernBasis = $stagingOrdnerMuster.Replace('{sub}', $sub); $stateName = 'staging-' + $sub
    try { Sichere-FtpOrdner $zugang $fernBasis } catch { $script:PublishFehler++; Log ("FEHLER: Staging-Ordner {0} nicht anlegbar: {1}" -f $fernBasis, $_.Exception.Message); return }
  }
  if (-not (Test-Path (Join-Path $lokal 'index.html'))) { Log ("WARNUNG: {0} — {1}\index.html fehlt, nichts hochzuladen." -f $was, $lokal); return }
  $stateDatei = Join-Path $stateDir "$stateName.json"
  $state = @{}
  if (Test-Path $stateDatei) { try { $j = (Get-Content -LiteralPath $stateDatei -Raw -Encoding UTF8) | ConvertFrom-Json; foreach ($p in $j.PSObject.Properties) { $state[$p.Name] = [string]$p.Value } } catch { $state = @{} } }
  # .htaccess GANZ ZULETZT (04.09.2026): sie leitet seit der Umstellung auf das Konto-Gate
  # jede Anfrage auf gate.php um. Ginge sie vor gate.php hoch, waere die Subdomain in der
  # Zwischenzeit tot (alles 404). Zuletzt hochgeladen heisst: die Tuer steht, bevor der
  # Wegweiser auf sie zeigt.
  $dateien = @(Get-ChildItem -LiteralPath $lokal -Recurse -File -Force | Where-Object { $_.Name -notlike '.publish-state*' } |
    Sort-Object @{ Expression = { if ($_.Name -eq '.htaccess') { 1 } else { 0 } } }, FullName)
  $hoch = 0; $fehler = 0; $ordnerDa = @{}
  foreach ($f in $dateien) {
    $rel = $f.FullName.Substring($lokal.Length).TrimStart('\').Replace('\', '/')
    $h = Hash $f.FullName
    if ($state.ContainsKey($rel) -and $state[$rel] -eq $h) { continue }
    try {
      $teile = $rel.Split('/'); $pfad = $fernBasis
      for ($i = 0; $i -lt $teile.Count - 1; $i++) { $pfad = $pfad + '/' + $teile[$i]; if (-not $ordnerDa.ContainsKey($pfad)) { Sichere-FtpOrdner $zugang $pfad; $ordnerDa[$pfad] = $true } }
      Lade-FtpHoch $zugang $f.FullName ($fernBasis + '/' + $rel)
      $state[$rel] = $h; $hoch++
    } catch { $fehler++; $script:PublishFehler++; Log "FEHLER beim Upload von $rel nach $sub : $($_.Exception.Message)" }
  }
  try { [IO.File]::WriteAllText($stateDatei, ($state | ConvertTo-Json), (New-Object Text.UTF8Encoding($false))) } catch { }
  Log ("{0}: {1} Datei(en) hochgeladen, {2} Fehler → https://{3}/" -f $was, $hoch, $fehler, $fernBasis.TrimStart('/'))
}

# Zugangsschutz je Instanz: dieselbe Zugangsdatei wie das Team-Cockpit (AuthUserFile ist absolut und gilt
# von jedem Ordner aus), dazu https-Zwang — Basic-Auth über http hieße Team-Passwort im Klartext. Die
# Datei entsteht nur, wenn keine da ist: eine von Hand angepasste (eigenes Passwort, offen) bleibt stehen.
$HTACCESS_INSTANZ = @'
# Flow Compass — Instanz auf eigener Subdomain (erzeugt von publish-compass.ps1, bleibt bei Aenderung stehen)
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [R=301,L]
</IfModule>
AuthType Basic
AuthName "Vishnu Flow Cockpit"
AuthUserFile /www/htdocs/w01e7219/vishnu-artists.com/.htpasswd-va
Require valid-user
<IfModule mod_headers.c>
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Content-Security-Policy "frame-ancestors 'self'"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Strict-Transport-Security "max-age=31536000"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "geolocation=(), microphone=(), camera=(), interest-cohort=()"
</IfModule>
<FilesMatch ".(js|html)$">
  <IfModule mod_headers.c>
    Header always set Cache-Control "no-cache"
  </IfModule>
</FilesMatch>
'@
function Sichere-Htaccess([string]$ordner) {
  $p = Join-Path $ordner '.htaccess'
  if (-not (Test-Path $p)) { [IO.File]::WriteAllText($p, $HTACCESS_INSTANZ.Replace("`r`n", "`n"), (New-Object Text.UTF8Encoding($false))) }
}

$zugang = Hole-FtpZugang
if (-not $zugang) {
  Log 'WARNUNG: FTP-Zugang fehlt (User-Umgebungsvariablen VA_FTP_HOST / VA_FTP_USER / VA_FTP_PASS) — nichts hochgeladen.'
} else {
  # Staging zuerst — es traegt den Arbeitsstand und haengt an keiner Freigabe.
  foreach ($z in @($stagingOk.Keys)) { Lade-Ordner $zugang (Join-Path $repo "site\staging\$z") $z ("Staging " + $z) 'staging' }
  if (-not $prodFrei) { Log ("Prod uebersprungen: " + $prodGrund) }
}
if ($zugang -and $prodFrei) {
  Lade-Ordner $zugang (Join-Path $repo 'site\compass') 'bene' 'eigene Instanz'
  if ($demoOk) { Lade-Ordner $zugang (Join-Path $repo 'site\compass-demo') 'demo' 'Demo' }
  # Instanzen: erst neu bauen (instanz.js und Datenschicht bleiben dabei unangetastet, nur Produktcode
  # wird nachgezogen — so laufen alle Instanzen auf dem Stand von heute), dann hochladen.
  foreach ($inst in $INSTANZEN) {
    $slug = ($inst.name.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
    $ordner = Join-Path $repo "instanzen\$slug"
    try {
      # Compass zuerst: der Build holt in der ersten Runde das alte flache Layout nach
      # compass\ (build-portal.ps1 -NurMigrieren) und baut dann dorthin.
      if ($inst.ContainsKey('compass') -and -not $inst.compass) {
        # Portal ohne Compass: gate-config.php muss von Hand da sein, sonst bleibt die Tuer zu.
        if (-not (Test-Path (Join-Path $ordner 'gate-config.php'))) { throw "instanzen\$slug\gate-config.php fehlt (Instanz ohne Compass wird von Hand gefuellt)" }
      } else {
        $pi = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-compass-produkt.ps1') -Instanz $inst.name 2>&1
        if ($LASTEXITCODE -ne 0) { throw (($pi | Select-Object -Last 4) -join ' / ') }
        # Compass-Server-Paket mit vorbelegter Konfiguration (Name, Trello, Jira aus instanz.js) neben die
        # index.html der Instanz (07.09.2026). Fehler nur loggen — die Instanz rollt trotzdem aus.
        $ps = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-compass-server.ps1') -Instanz $inst.name 2>&1
        if ($LASTEXITCODE -ne 0) { $script:PublishFehler++; Log ("WARNUNG: Compass-Server-Paket fuer {0} nicht gebaut: {1}" -f $inst.name, (($ps | Select-Object -Last 3) -join ' / ')) }
      }
      # Portal an die Wurzel der Subdomain (04.09.2026): Kacheln zu Backstage, Team-Cockpit,
      # Vaikuntha und dem Compass daneben. portal.js bleibt dabei unangetastet.
      $pp = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-portal.ps1') -Ziel $ordner 2>&1
      if ($LASTEXITCODE -ne 0) { throw (($pp | Select-Object -Last 4) -join ' / ') }
      # Die .htaccess kommt seit dem 04.09.2026 von build-portal.ps1 (Konto-Gate statt
      # Basic-Auth) — Sichere-Htaccess bleibt nur als Rueckfallebene stehen und greift
      # nur, wenn gar keine Datei da ist.
      Sichere-Htaccess $ordner
      Lade-Ordner $zugang $ordner $inst.sub ('Instanz ' + $inst.name)
    } catch { $script:PublishFehler++; Log ("WARNUNG: Instanz {0} nicht ausgerollt: {1}" -f $inst.name, $_.Exception.Message) }
  }
}

# 4) Demo geändert? committen + pushen (nur die Build-Ausgabe, nie die handgepflegte .htaccess)
if (-not $prodFrei) { Schluss 'Prod nicht frei — die Demo wird nicht committet (sie ginge sonst mit dem unfreigegebenen Stand live).'; return }
if (-not $demoOk) { Schluss 'Demo nicht gebaut — kein Commit.'; return }
$pfade = @('site/compass-demo', ':(exclude)site/compass-demo/.htaccess')
$st = (Git status --porcelain -- @pfade).Trim()
if (-not $st) { Schluss 'Demo unverändert — nichts zu committen.'; return }
if ($st -match '(?m)^\s?D ') { Schluss "ABBRUCH: Löschungen im Demo-Ordner — bitte manuell prüfen:`n$st"; return }
Git add -- @pfade | Out-Null
$stamp = Get-Date -Format 'dd.MM.yyyy HH:mm'
$o = Git -c user.email=benedikt.irsch@gmail.com -c user.name='Benedikt Irsch' commit -q -m "compass-demo: automatischer Build $stamp" -m 'publish-compass.ps1 (geplante Aufgabe)'
if ($gitExit -ne 0) { Git reset -q -- @pfade | Out-Null; Schluss "ABBRUCH: commit fehlgeschlagen (Hook?): $o"; return }
if (-not $hatRemote) { Schluss ('Demo committet (' + (Git log --oneline -1).Trim() + '), kein Remote — Push entfällt.'); return }
$o = Git push origin main
if ($gitExit -ne 0) { Schluss "FEHLER: push fehlgeschlagen — Commit bleibt lokal, nächster Lauf versucht es erneut: $o"; return }
Schluss ('Demo committet: ' + (Git log --oneline -1).Trim() + ' → deploy.yml zielt auf https://demo.vishnuartists.com/ (läuft nur mit Repo-Secrets)')
