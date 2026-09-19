# build-compass.ps1 — baut den Vishnu Flow Compass (persönliches Cockpit) für den Livegang
#   Quelle:  dashboard.html in diesem Repo (flow-compass) (+ kennzahlen.html, *-data.js, Initiative-Datei)
#   Ziel:    site\compass\  →  Deploy per `git push origin main` (deploy.yml spielt site/ in den Domain-Root)
#   Live:    https://vishnu-artists.de/compass/   (Zugangsschutz: COMPASS.gate in dashboard.html; greift nur außerhalb localhost)
#
# Was der Build macht
#   1) dashboard.html → site/compass/index.html (unverändert bis auf: kennzahlen-Link bleibt, kein Umschreiben nötig)
#   2) kennzahlen.html → site/compass/kennzahlen.html (Rücksprung „dashboard.html“ → „./“)
#   3) Datenschicht (dashboard-data.js, rhythmus-data.js, kennzahlen-data.js, ki-trainer-data.js, aufraeumen-data.js)
#      sowie compass-edit.js (Editiermodus) und compass-i18n.js (Deutsch/English/Arabisch samt RTL) —
#      beide werden von dashboard.html referenziert; fehlen sie hier, gibt es live einen 404.
#      und INITIATIVE-neukundengewinnung.md 1:1 kopieren
#   4) UTF-8 ohne BOM, LF; Ausgabe: Dateiliste + Prüfsummen-Kurzform
#
# Der Live-Compass spricht John/Trello/Arbeit über Benes lokalen john-server (http://localhost:8787) an —
# läuft der nicht, zeigt der Compass die Offline-Zustände (Board aus Woche/Rückfragen/Jira, keine Trello-Karten).
# Seit 14.09.2026 kann stattdessen der Wolkenserver (wolkenserver\, Compass-Server-Paket rund um die Uhr)
# die Standardadresse sein: steht in site\.publish-state\wolke.json eine erreichbare Adresse (oder kommt
# -JohnApi), setzt der Build sie statt localhost ein. ?john=http://localhost:8787 schaltet im Browser zurück.
# Fortschritt (XP, Streak, Board) liegt je Origin im localStorage → im Compass „⤓ Fortschritt sichern“ / „⤒ Einspielen“.
#
# Aufruf:  powershell -ExecutionPolicy Bypass -File build-compass.ps1 [-Quelle <Ordner>] [-Ziel <Ordner>]
param(
  [string]$Quelle = (Split-Path -Parent $MyInvocation.MyCommand.Path),   # seit 02.09.2026: Quelle und Build liegen im selben Repo (flow-compass)
  [string]$Ziel   = (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'site\compass'),
  # Wurzel der Subdomain. Seit 04.09.2026 liegt dort das persoenliche Portal und der
  # Compass darunter in compass\; die .htaccess mit dem Zugangsschutz bleibt aber an der
  # Wurzel und gilt von dort fuer alles. Leer = Ziel ist selbst die Wurzel (alter Stand).
  [string]$Wurzel = '',
  # Adresse des Compass-Servers für die eigene Instanz (Wolkenserver). Leer = aus wolke.json, sonst localhost.
  [string]$JohnApi = ''
)
$ErrorActionPreference = 'Stop'
$repoWurzel = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not [IO.Path]::IsPathRooted($Ziel))   { $Ziel   = Join-Path $repoWurzel $Ziel }
if (-not $Wurzel) { $Wurzel = $Ziel }
if (-not [IO.Path]::IsPathRooted($Wurzel)) { $Wurzel = Join-Path $repoWurzel $Wurzel }
$enc = New-Object Text.UTF8Encoding($false)
if (-not (Test-Path (Join-Path $Quelle 'dashboard.html'))) { throw "Quelle fehlt: $Quelle\dashboard.html" }
if (-not (Test-Path $Ziel)) { New-Item -ItemType Directory -Force $Ziel | Out-Null }

function Write-Lf([string]$p, [string]$t) { [IO.File]::WriteAllText($p, $t.Replace("`r`n","`n"), $enc) }
function Read-Utf8([string]$p) { [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) }

# 1) Compass
$html = Read-Utf8 (Join-Path $Quelle 'dashboard.html')
if ($html -notmatch "gate:\{ salt:'[^']+', hash:'[0-9a-f]{64}'") { Write-Warning 'COMPASS.gate.hash ist leer — der Live-Compass wäre ohne Zugangsschutz!' }

# 1b) Kundenlage nur ausliefern, wenn dieser Ordner serverseitig geschützt ist.
#     kundenlage-data.js enthält Klarnamen und E-Mail-Adressen der Kundschaft. Der
#     COMPASS.gate-Check in dashboard.html läuft NUR im Browser und schützt die Datei
#     selbst nicht (nachgeprüft 31.08.2026: https://vishnu-artists.de/compass/dashboard-data.js
#     liefert 200 ohne Anmeldung). Erst ein `Require valid-user` in der .htaccess dieses
#     Ordners legt eine echte Schicht davor — dieselbe Begründung wie bei site/va/.htaccess.
#     Solange die fehlt, fällt hier der Knopf raus: lieber ohne Kundenlage live als mit
#     Klarnamen im offenen Netz (und ohne den 404, den der Knopf sonst erzeugt).
#     Sobald der Schutz steht, liefert der nächste Build Seite und Daten von selbst mit.
#     Geprüft wird der Schutz an ZWEI Stellen, und beide müssen ihn zeigen:
#     im Arbeitsbaum UND in HEAD. Nur der Arbeitsbaum reicht nicht — am 31.08.2026 lag
#     die .htaccess mit `Require valid-user` aus einer parallelen Session uncommittet
#     daneben, der Build hielt den Ordner für geschützt und legte die Kundenlage bereit,
#     während live noch alles offen war. Committet heißt: der Schutz geht mit demselben
#     Deploy hoch (oder liegt längst oben) — die Daten gehen nie vorweg.
$htaccess = Join-Path $Wurzel '.htaccess'
# Zwei Bauarten von Schutz zaehlen (04.09.2026): das alte Basic-Auth mit Team-Passwort
# und die neue Tuer (gate.php + gate-config.php, .htaccess leitet alles dorthin). Beim
# Gate reicht die .htaccess allein NICHT — ohne die beiden Dateien leitet sie ins Leere.
function Geschuetzt([string]$text) {
  if ($text -match '(?m)^\s*Require\s+valid-user') { return $true }
  if ($text -match 'gate-fassung:\s*\d') {
    return (Test-Path (Join-Path $Wurzel 'gate.php')) -and (Test-Path (Join-Path $Wurzel 'gate-config.php'))
  }
  return $false
}
$imBaum   = (Test-Path $htaccess) -and (Geschuetzt (Read-Utf8 $htaccess))
$imHead   = $false
try {
  # Die Zugangsdatei liegt an der Wurzel der Subdomain, auch wenn hier nach
  # <wurzel>\compass gebaut wird. Liegt die Wurzel ausserhalb des Repos, bleibt es beim
  # bisherigen Pfad — in HEAD steht dann ohnehin nichts anderes.
  $rel = 'site/compass/.htaccess'
  if ($Wurzel.StartsWith($repoWurzel, [StringComparison]::OrdinalIgnoreCase)) {
    $rel = $Wurzel.Substring($repoWurzel.Length).Trim('\').Replace('\', '/') + '/.htaccess'
  }
  # Staging (15.09.2026): site/staging/<sub>/ ist gitignored, in HEAD liegt dort nie eine .htaccess.
  # Die Tuer ist dieselbe wie bei der eigenen Instanz — also zaehlt deren committeter Schutz.
  if ($rel -match '^site/staging/[^/]+/\.htaccess$') { $rel = 'site/compass/.htaccess' }
  $alt = & git.exe -C (Split-Path -Parent $MyInvocation.MyCommand.Path) show "HEAD:$rel" 2>$null
  if ($LASTEXITCODE -eq 0) { $imHead = Geschuetzt (($alt -join "`n")) }
} catch { }
# git setzt $LASTEXITCODE (128, wenn der Pfad in HEAD fehlt). Der wäre sonst der
# Rückgabewert des ganzen Skripts — publish-compass.ps1 und die geplante Aufgabe
# würden einen erfolgreichen Build als Fehler lesen.
$global:LASTEXITCODE = 0
$geschuetzt  = $imBaum -and $imHead
$unterseiten = @('kennzahlen.html')
if ($geschuetzt) { $unterseiten += 'kundenlage.html' }
else {
  # Anker pruefen wie die uebrigen (16.09.2026): trifft das Muster nicht mehr, bliebe der Knopf still stehen
  # und zeigte in einer ungeschuetzten Instanz auf eine Seite, die es dort nicht gibt (404).
  $kundenlageKnopf = '(?m)^[ \t]*<a class="btn g" href="kundenlage\.html".*?</a>[ \t]*\r?\n'
  if (-not [regex]::IsMatch($html, $kundenlageKnopf)) { throw 'ANKER FEHLT: Kundenlage-Knopf in dashboard.html' }
  $html = $html -replace $kundenlageKnopf, ''
  # Reste eines früheren, noch ungeschützten Laufs wegräumen: sonst bleiben sie liegen
  # und `git add site/compass` in publish-compass.ps1 nimmt sie beim nächsten Mal mit.
  foreach ($rest in 'kundenlage.html','kundenlage-data.js') {
    $rp = Join-Path $Ziel $rest; if (Test-Path $rp) { Remove-Item $rp -Force }
  }
  $grund = if ($imBaum) { 'der Schutz steht erst im Arbeitsbaum, noch nicht in HEAD' } else { 'kein `Require valid-user` in site\compass\.htaccess' }
  Write-Warning "kundenlage.html bleibt lokal ($grund) — Klarnamen in kundenlage-data.js. Knopf aus dem Live-Compass entfernt."
}
# Johns Rezeption (11.09.2026): Adresse und Token bekommt NUR die eigene Instanz mit.
# Sie liegt hinter dem Gate und ist gitignored; die Demo und jede Kundeninstanz bekommen die
# Lobby ohnehin nicht (build-compass-produkt.ps1 nimmt sie heraus). Fehlt eines von beiden,
# wird nichts eingesetzt — die Lobby zeigt dann ehrlich „keine Rezeption hinterlegt".
$hubUrl = $null; $hubTok = $null
foreach ($s in @('Process','User')) {
  if (-not $hubUrl) { $hubUrl = [Environment]::GetEnvironmentVariable('JOHN_HUB_URL', $s) }
  # Der Browser bekommt den EINGESCHRAENKTEN Schluessel (nachsehen, abraeumen, fragen) --
  # nie den Geraeteschluessel. Fehlt er, wird nichts eingesetzt; die Lobby sagt das dann.
  if (-not $hubTok) { $hubTok = [Environment]::GetEnvironmentVariable('JOHN_HUB_TOKEN_BROWSER', $s) }
}
$lobbyTag = '<script src="compass-john-lobby.js"></script>'
if ($hubUrl -and $hubTok -and $html.Contains($lobbyTag)) {
  $einsatz = '<script>window.JOHN_HUB=''' + $hubUrl.Trim().TrimEnd('/') + ''';window.JOHN_HUB_TOKEN=''' + $hubTok.Trim() + ''';</script>' + "`n"
  $html = $html.Replace($lobbyTag, $einsatz + $lobbyTag)
  Write-Host "Rezeption eingesetzt: $($hubUrl.Trim()) (Token aus der Benutzerumgebung)"
} elseif ($html.Contains($lobbyTag)) {
  Write-Warning "JOHN_HUB_URL/JOHN_HUB_TOKEN fehlen - die Lobby zeigt keinen Stand aus der Rezeption."
}

# Wolkenserver (14.09.2026): der Compass-Server aus produkt\server läuft rund um die Uhr auf einem
# Linux-Server (wolkenserver\deploy-wolkenserver.ps1 schreibt site\.publish-state\wolke.json, gitignored).
# Steht dort eine erreichbare Adresse, zeigt die eigene Instanz standardmäßig dorthin statt auf
# http://localhost:8787. Die Adresse trägt den geheimen Pfad — deshalb nur in der gebauten Instanz,
# nie in dashboard.html. Fehlt der Anker, bricht der Build laut ab, statt still bei localhost zu bleiben.
$wolkeApi = $JohnApi
if (-not $wolkeApi) {
  $wj = Join-Path $repoWurzel 'site\.publish-state\wolke.json'
  if (Test-Path $wj) { try { $w = (Read-Utf8 $wj) | ConvertFrom-Json; if ([string]$w.erreichbar -eq 'True' -and $w.api) { $wolkeApi = [string]$w.api } } catch { } }
}
if ($wolkeApi) {
  $ankerApi = "const JOHN_API = LOKAL ? '' : (localStorage.getItem('compassJohnApi') || 'http://localhost:8787');"
  if (-not $html.Contains($ankerApi)) { throw 'Wolkenserver: Anker der JOHN_API-Zeile fehlt in dashboard.html — Adresse nicht eingesetzt.' }
  $wolkeApi = $wolkeApi.Trim().TrimEnd('/')
  $html = $html.Replace($ankerApi, "const JOHN_API = LOKAL ? '' : (localStorage.getItem('compassJohnApi') || '" + $wolkeApi + "');")
  Write-Host ("Wolkenserver eingesetzt: " + ($wolkeApi -replace '/t-[a-z0-9]+$', '/t-…'))
}

Write-Lf (Join-Path $Ziel 'index.html') $html

# 2) Unterseiten (Rücksprung auf den Ordner statt dashboard.html)
foreach ($s in $unterseiten) {
  $src = Join-Path $Quelle $s
  if (-not (Test-Path $src)) { Write-Warning "fehlt in der Quelle: $s"; continue }
  Write-Lf (Join-Path $Ziel $s) ((Read-Utf8 $src).Replace('href="dashboard.html"', 'href="./"'))
}

# 3) Begleitdateien: nicht mehr von Hand pflegen, sondern aus den gebauten Seiten ableiten.
#     Grund (31.08.2026): eine neue Seite/Skriptzeile in dashboard.html lief durch den Build,
#     ohne dass jemand diese Liste nachzog — live gab es dann einen 404, den nur merkt, wer
#     genau den Knopf drückt. Was referenziert wird, wird kopiert; was fehlt, bricht ab (3b).
$rxVerweis = '(?i)(?:src|href)="(?![a-z][a-z0-9+.-]*:|//|#)([^":?#]+\.(?:js|css|html|md|json|woff2))"'
function Verweise([string]$text) {
  foreach ($m in [regex]::Matches($text, $rxVerweis)) {
    $v = $m.Groups[1].Value
    if ($v -notmatch '^(\.\./|/)') { $v }
  }
}
$begleiter = @()
foreach ($seite in (Get-ChildItem $Ziel -Filter *.html -File)) { $begleiter += Verweise (Read-Utf8 $seite.FullName) }
$begleiter = @($begleiter + @('INITIATIVE-neukundengewinnung.md','fonts.css') | Where-Object { $_ -notin $unterseiten } | Sort-Object -Unique)
foreach ($f in $begleiter) {
  $src = Join-Path $Quelle $f
  if (Test-Path $src) { Write-Lf (Join-Path $Ziel $f) (Read-Utf8 $src) } else { Write-Warning "fehlt in der Quelle: $f" }
}

# Shared Holodeck portraits only; no private scene or conversation data.
$avatarZiel = Join-Path $Ziel 'avatar-assets'
New-Item -ItemType Directory -Force $avatarZiel | Out-Null
foreach ($portrait in @('john.png','madeleine.png')) {
  Copy-Item -LiteralPath (Join-Path $Quelle "avatar-assets\$portrait") -Destination (Join-Path $avatarZiel $portrait) -Force
}

# Holodeck-Assets: nur eigener Build, niemals Produkt-Demo.
$holoQuelle = Join-Path $Quelle 'holodeck-assets'
if (Test-Path $holoQuelle) {
  $holoZiel = Join-Path $Ziel 'holodeck-assets'
  if (-not (Test-Path $holoZiel)) { New-Item -ItemType Directory -Force $holoZiel | Out-Null }
  Get-ChildItem -LiteralPath $holoQuelle -File | Where-Object { $_.Extension -in @('.png','.webp') -or $_.Name -in @('manifest.json','motion-manifest.json') } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $holoZiel $_.Name) -Force }
  # Bewegungsclips (15.09.2026): eigener Unterordner motion/ mit mp4 + Poster. Ohne diesen
  # Block bliebe motion-manifest.json ohne Dateien und der Raum zeigte nur das Standbild.
  $motionQuelle = Join-Path $holoQuelle 'motion'
  if (Test-Path $motionQuelle) {
    $motionZiel = Join-Path $holoZiel 'motion'
    if (-not (Test-Path $motionZiel)) { New-Item -ItemType Directory -Force $motionZiel | Out-Null }
    Get-ChildItem -LiteralPath $motionQuelle -File | Where-Object { $_.Extension -in @('.mp4','.png','.webp') } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $motionZiel $_.Name) -Force }
  }
}

# Holodeck-Filmszenen: Module werden dynamisch geladen, deshalb explizit im eigenen Build.
$holoEngineZiel = Join-Path $Ziel 'holodeck-engine'
if (-not (Test-Path $holoEngineZiel)) { New-Item -ItemType Directory -Force $holoEngineZiel | Out-Null }
foreach ($datei in @('scenes.js','production.js','cinema.js','cinema.css','experience.js','experience.css','coach-door.js','studio-audio.js','studio-direction.js','sternenszenen.js')) {
  $src = Join-Path $Quelle "holodeck-engine/$datei"
  if (-not (Test-Path $src)) { throw "Holodeck-Modul fehlt: $datei" }
  Copy-Item $src (Join-Path $holoEngineZiel $datei) -Force
}

# 3b) Vollständigkeitsprüfung — was die gebauten Seiten referenzieren, muss im Zielordner
#     liegen. Fehlt etwas, bricht der Build ab: publish-compass.ps1 würde einen 404 sonst
#     stillschweigend veröffentlichen, und im Browser sieht man ihn erst beim Klicken.
$fehlend = @()
foreach ($seite in (Get-ChildItem $Ziel -Filter *.html -File)) {
  foreach ($v in (Verweise (Read-Utf8 $seite.FullName))) {
    if (-not (Test-Path (Join-Path $Ziel $v))) { $fehlend += ('{0} → {1}' -f $seite.Name, $v) }
  }
}
if ($fehlend.Count) { throw ("Verweise ins Leere (wären 404 im Live-Compass):`n  " + ($fehlend -join "`n  ")) }

# 3b) Selbst gehostete Schriften (VA-13512, 24.08.2026) — sonst laedt der Live-Compass wieder von Google.
$fq = Join-Path $Quelle 'fonts'; $fz = Join-Path $Ziel 'fonts'
if (-not (Test-Path $fz)) { New-Item -ItemType Directory -Force $fz | Out-Null }
Get-ChildItem $fq -File -Filter *.woff2 | ForEach-Object { Copy-Item $_.FullName (Join-Path $fz $_.Name) -Force }

# 3c) Als App installierbar (04.09.2026) — dieselben Dateien wie im Produkt-Build.
#     Warum hier unten und nicht oben im $html: die Begleitdatei-Ableitung (3) sucht
#     Verweise nur in der QUELLE, und diese vier Dateien liegen in produkt\compass.
#     Stuenden die Kopfzeilen vor 3b, wuerde die Vollstaendigkeitspruefung sie als
#     404 melden, obwohl gleich danach alles da ist.
#     Der Symbolordner heisst app-icons und NICHT icons: /icons/ ist in der
#     Standard-Apache-Konfiguration ein Alias auf die Server-eigenen Symbole — am
#     04.09.2026 lagen die Dateien per FTP auf dem Server und lieferten trotzdem 404.
$prodC = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'produkt\compass'
if (Test-Path (Join-Path $prodC 'manifest.webmanifest')) {
  foreach ($f in 'manifest.webmanifest', 'sw.js', 'compass-app.js') {
    Write-Lf (Join-Path $Ziel $f) (Read-Utf8 (Join-Path $prodC $f))
  }
  $aq = Join-Path $prodC 'app-icons'; $az = Join-Path $Ziel 'app-icons'
  if (-not (Test-Path $az)) { New-Item -ItemType Directory -Force $az | Out-Null }
  Get-ChildItem $aq -File -Filter *.png | ForEach-Object { Copy-Item $_.FullName (Join-Path $az $_.Name) -Force }

  $ip = Join-Path $Ziel 'index.html'
  $it = Read-Utf8 $ip
  $ankerKopf = '<link rel="stylesheet" href="fonts.css">'
  if (-not $it.Contains($ankerKopf)) { throw 'App-Kopfzeilen: Anker <link rel="stylesheet" href="fonts.css"> fehlt in index.html' }
  $kopf = @'
<link rel="stylesheet" href="fonts.css">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#1c2314">
<link rel="icon" type="image/png" sizes="192x192" href="app-icons/icon-192.png">
<link rel="apple-touch-icon" href="app-icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Compass">
<script src="compass-app.js" defer></script>
'@
  $rx = New-Object System.Text.RegularExpressions.Regex ([regex]::Escape($ankerKopf))
  $it = $rx.Replace($it, ($kopf -replace "`r", ''), 1)
  Write-Lf $ip $it
} else {
  Write-Warning 'produkt\compass\manifest.webmanifest fehlt — die eigene Instanz ist nicht als App installierbar.'
}

# 4) Bericht
Get-ChildItem $Ziel -File | Sort-Object Name | ForEach-Object {
  $b = [IO.File]::ReadAllBytes($_.FullName)
  $bom = ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB)
  '{0,-36} {1,8:n0} B  BOM={2}' -f $_.Name, $_.Length, $bom
}
Write-Host ''
Write-Host "Compass gebaut → $Ziel"
Write-Host 'Weiter: git status --short → git add site/compass → git commit -m "compass: Livegang-Build <Datum>" → git push origin main'
Write-Host 'Danach: https://bene.vishnuartists.com/ (Passphrase siehe Übergabe; ändern per Konsole compass.hash(...) → COMPASS.gate.hash)'

# Avatar catalog is loaded at runtime, so the static reference scanner cannot discover it.
Write-Lf (Join-Path $Ziel 'avatar-guides.json') (Read-Utf8 (Join-Path $Quelle 'avatar-guides.json'))
