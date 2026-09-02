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
# Fortschritt (XP, Streak, Board) liegt je Origin im localStorage → im Compass „⤓ Fortschritt sichern“ / „⤒ Einspielen“.
#
# Aufruf:  powershell -ExecutionPolicy Bypass -File build-compass.ps1 [-Quelle <Ordner>] [-Ziel <Ordner>]
param(
  [string]$Quelle = (Split-Path -Parent $MyInvocation.MyCommand.Path),   # seit 02.09.2026: Quelle und Build liegen im selben Repo (flow-compass)
  [string]$Ziel   = (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'site\compass')
)
$ErrorActionPreference = 'Stop'
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
$htaccess = Join-Path $Ziel '.htaccess'
$imBaum   = (Test-Path $htaccess) -and ((Read-Utf8 $htaccess) -match '(?m)^\s*Require\s+valid-user')
$imHead   = $false
try {
  $rel = 'site/compass/.htaccess'
  $alt = & git.exe -C (Split-Path -Parent $MyInvocation.MyCommand.Path) show "HEAD:$rel" 2>$null
  if ($LASTEXITCODE -eq 0) { $imHead = (($alt -join "`n") -match '(?m)^\s*Require\s+valid-user') }
} catch { }
# git setzt $LASTEXITCODE (128, wenn der Pfad in HEAD fehlt). Der wäre sonst der
# Rückgabewert des ganzen Skripts — publish-compass.ps1 und die geplante Aufgabe
# würden einen erfolgreichen Build als Fehler lesen.
$global:LASTEXITCODE = 0
$geschuetzt  = $imBaum -and $imHead
$unterseiten = @('kennzahlen.html')
if ($geschuetzt) { $unterseiten += 'kundenlage.html' }
else {
  $html = $html -replace '(?m)^[ \t]*<a class="btn g" href="kundenlage\.html".*?</a>[ \t]*\r?\n', ''
  # Reste eines früheren, noch ungeschützten Laufs wegräumen: sonst bleiben sie liegen
  # und `git add site/compass` in publish-compass.ps1 nimmt sie beim nächsten Mal mit.
  foreach ($rest in 'kundenlage.html','kundenlage-data.js') {
    $rp = Join-Path $Ziel $rest; if (Test-Path $rp) { Remove-Item $rp -Force }
  }
  $grund = if ($imBaum) { 'der Schutz steht erst im Arbeitsbaum, noch nicht in HEAD' } else { 'kein `Require valid-user` in site\compass\.htaccess' }
  Write-Warning "kundenlage.html bleibt lokal ($grund) — Klarnamen in kundenlage-data.js. Knopf aus dem Live-Compass entfernt."
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

# 4) Bericht
Get-ChildItem $Ziel -File | Sort-Object Name | ForEach-Object {
  $b = [IO.File]::ReadAllBytes($_.FullName)
  $bom = ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB)
  '{0,-36} {1,8:n0} B  BOM={2}' -f $_.Name, $_.Length, $bom
}
Write-Host ''
Write-Host "Compass gebaut → $Ziel"
Write-Host 'Weiter: git status --short → git add site/compass → git commit -m "compass: Livegang-Build <Datum>" → git push origin main'
Write-Host 'Danach: https://vishnu-artists.de/compass/ (Passphrase siehe Übergabe; ändern per Konsole compass.hash(...) → COMPASS.gate.hash)'
