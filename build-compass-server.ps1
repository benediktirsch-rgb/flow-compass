# build-compass-server.ps1 — packt produkt\server\ zum auslieferbaren Compass-Server-Paket.
#
#   Quelle:  produkt\server\   (compass-server.ps1, coach-tools.ps1, coach-mcp.ps1, Konfiguration,
#            Starter, README, Vorlagen) — neutral, kennt keine Kundin und keinen Firmennamen.
#   Ziel:    site\compass-demo\compass-server.zip           (Standard: das Paket, wie es die Demo verlinkt)
#            instanzen\<slug>\compass\compass-server.zip     (-Instanz <Name>: Konfiguration vorbelegt aus
#                                                             instanzen\<slug>\compass\instanz.js — Name,
#                                                             Trello-Kurzlinks, Jira-Site/-Projekt)
#
# Warum ein eigenes Paket (07.09.2026): der Einrichtungs-Assistent (Schritt „Dein Coach“) verweist auf
# einen Compass-Server, den die Person auf dem eigenen Rechner startet — damit die KI auf IHREM Konto
# läuft. Der persönliche john-server.ps1 dieses Repos taugt dafür nicht: er kennt H:-Spiegel, Memory-
# Ordner, Kalender, Finanzen, Wächter und ein Dutzend Pfade dieses Rechners. Das Paket enthält nur, was
# eine Instanz braucht (Coach, Stapel, Trello, Jira) und liest Name/Persona aus compass-server.json.
#
# Was der Build tut
#   1) Wortpruefung über alle Textdateien des Pakets — dieselbe Liste wie build-compass-produkt.ps1.
#      Findet sie Bene/Vishnu/Vaikuntha/Porsche/vishnuartists/benedikt/John, bricht der Build ab.
#   2) Konfiguration vorbelegen (-Instanz) — textuell, damit die Datei lesbar bleibt.
#   3) Hash über alle Inhalte → VERSION.txt in der Zip. Steht derselbe Hash schon in der Zip am Ziel,
#      wird nichts geschrieben (die Demo ist committet; eine Zip, die sich bei jedem Lauf ändert, wäre
#      Rauschen in der Historie).
#   4) Zip mit Schrägstrich-Pfaden unter compass-server/… (entpackt sauber in einen Ordner).
#
# Aufruf
#   powershell -NoProfile -ExecutionPolicy Bypass -File build-compass-server.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File build-compass-server.ps1 -Instanz "Philipp Heitz"
#   powershell -NoProfile -ExecutionPolicy Bypass -File build-compass-server.ps1 -NurPruefen   (nur Wortpruefung)
param(
  [string]$Instanz = '',
  [string]$Ziel = '',
  [switch]$NurPruefen
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $base 'produkt\server'
$enc  = New-Object Text.UTF8Encoding($false)
function Read-Utf8([string]$p) { [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) }

# Die Dateien des Pakets — in dieser Reihenfolge (die Reihenfolge geht in den Hash ein).
$dateien = @('compass-server.ps1','coach-tools.ps1','coach-mcp.ps1','compass-server.json','start-compass-server.cmd',
             'README.md','vorlagen\persona.md','vorlagen\TASKS.md')
foreach ($f in $dateien) { if (-not (Test-Path -LiteralPath (Join-Path $src $f))) { throw "Paketdatei fehlt: produkt\server\$f" } }

# ── 1. Wortpruefung ──────────────────────────────────────────────────────────
# Gleiche Liste wie in build-compass-produkt.ps1 (Abschnitt 17). Gross-/Kleinschreibung zaehlt:
# `/api/john` (der Endpunkt, den der Compass anspricht) ist kein Treffer, „John“ als Name schon.
$verboten = @('\bBene\b','Vishnu','Vaikuntha','Porsche','vishnuartists',
              '(?<![a-z-])(?!firma\.|deine-firma\.)[a-z0-9-]+\.atlassian\.net',
              'trello\.com/b/[A-Za-z0-9]{6}','benedikt','\bJohn\b')
function Pruefe([string]$text, [string]$datei) {
  $funde = @()
  foreach ($w in $verboten) {
    foreach ($m in ([Text.RegularExpressions.Regex]::Matches($text, $w))) {
      $von = [Math]::Max(0, $m.Index - 60); $bis = [Math]::Min($text.Length, $m.Index + 60)
      $umfeld = $text.Substring($von, $bis - $von) -replace "`n",' '
      $zeile = ($text.Substring(0, $m.Index) -split "`n").Count
      $funde += ('  {0,-26} Zeile {1,-5} {2,-14} …{3}…' -f $datei, $zeile, $m.Value, $umfeld)
    }
  }
  return $funde
}
$funde = @()
foreach ($f in $dateien) { $funde += Pruefe (Read-Utf8 (Join-Path $src $f)) $f }
if ($funde.Count) {
  Write-Host 'WORTPRUEFUNG FEHLGESCHLAGEN — Persoenliches im Server-Paket:' -ForegroundColor Red
  $funde | Select-Object -First 25 | ForEach-Object { Write-Host $_ }
  throw "Wortpruefung: $($funde.Count) Treffer — Build abgebrochen."
}
Write-Host "Wortpruefung: 0 Treffer in $($dateien.Count) Dateien."
if ($NurPruefen) { return }

# ── 2. Konfiguration (je Instanz vorbelegt) ─────────────────────────────────
$konfig = (Read-Utf8 (Join-Path $src 'compass-server.json')).Replace("`r`n","`n")
$slug = ''
if ($Instanz) {
  $slug = ($Instanz.ToLower() -replace '[^a-z0-9]+','-').Trim('-')
  $instJs = Join-Path $base "instanzen\$slug\compass\instanz.js"
  if (-not (Test-Path -LiteralPath $instJs)) { throw "Instanz '$Instanz' hat keine instanz.js: $instJs — erst build-compass-produkt.ps1 -Instanz laufen lassen." }
  $js = Read-Utf8 $instJs
  $w = @{}
  if ($js -match "(?m)^\s*name:\s*'([^']*)'")            { $w.name = $Matches[1] }
  if ($js -match "privat:\s*\{[^}]*url:\s*'[^']*trello\.com/b/([A-Za-z0-9]{8})") { $w.privat = $Matches[1] }
  if ($js -match "arbeit:\s*\{[^}]*url:\s*'[^']*trello\.com/b/([A-Za-z0-9]{8})") { $w.arbeit = $Matches[1] }
  if ($js -match "browse:\s*'https?://([^/']+)/")        { $w.site = $Matches[1] }
  if ($js -match "keys:\s*\[\s*'([A-Za-z0-9]+)'")        { $w.projekt = $Matches[1] }
  function Setze([string]$t, [string]$schl, [string]$wert) {
    if (-not $wert) { return $t }
    $wert = $wert.Replace('\', '\\').Replace('"', '\"')
    return [regex]::Replace($t, ('"' + $schl + '":\s*""'), ('"' + $schl + '": "' + $wert + '"'), 1)
  }
  $konfig = Setze $konfig 'name'    $w.name
  $konfig = Setze $konfig 'privat'  $w.privat
  $konfig = Setze $konfig 'arbeit'  $w.arbeit
  $konfig = Setze $konfig 'site'    $w.site
  $konfig = Setze $konfig 'projekt' $w.projekt
  Write-Host ("Instanz {0}: name={1} trello.privat={2} trello.arbeit={3} jira.site={4} jira.projekt={5}" -f $slug, $w.name, $w.privat, $w.arbeit, $w.site, $w.projekt)
  # Die vorbelegte Konfiguration ist persoenlich (Name, Board-IDs) — sie darf nur in die
  # gitignorierte Instanz, nie in die Demo. Zur Sicherheit nochmal die Wortpruefung darueber:
  # ein Trello-Kurzlink der eigenen Boards waere ein Leck, wenn das Ziel doch die Demo ist.
  if (-not $Ziel) { $Ziel = Join-Path $base "instanzen\$slug\compass\compass-server.zip" }
} elseif (-not $Ziel) {
  $Ziel = Join-Path $base 'site\compass-demo\compass-server.zip'
}
if (-not $slug -and $Ziel -like '*compass-demo*') {
  $f2 = Pruefe $konfig 'compass-server.json'
  if ($f2.Count) { $f2 | ForEach-Object { Write-Host $_ }; throw 'Konfiguration fuer die Demo enthaelt Persoenliches.' }
}

# ── 3. Hash und Vergleich mit der Zip am Ziel ───────────────────────────────
$sha = [Security.Cryptography.SHA256]::Create()
$ms = New-Object IO.MemoryStream
foreach ($f in $dateien) {
  $b = $(if ($f -eq 'compass-server.json') { $enc.GetBytes($konfig) } else { [IO.File]::ReadAllBytes((Join-Path $src $f)) })
  $n = $enc.GetBytes($f + "`n"); $ms.Write($n, 0, $n.Length); $ms.Write($b, 0, $b.Length)
}
$hash = ([BitConverter]::ToString($sha.ComputeHash($ms.ToArray())) -replace '-','').ToLower().Substring(0, 16)
$ms.Dispose()
$version = "compass-server $hash`n" + "gebaut $(Get-Date -Format 'yyyy-MM-dd HH:mm')" + $(if ($slug) { " fuer Instanz $slug" } else { '' }) + "`n"
if (Test-Path -LiteralPath $Ziel) {
  try {
    $alt = [IO.Compression.ZipFile]::OpenRead($Ziel)
    $e = $alt.GetEntry('compass-server/VERSION.txt')
    $altHash = ''
    if ($e) { $sr = New-Object IO.StreamReader ($e.Open(), [Text.Encoding]::UTF8); $altHash = ($sr.ReadLine() -split ' ')[-1]; $sr.Close() }
    $alt.Dispose()
    if ($altHash -eq $hash) { Write-Host "Unveraendert ($hash): $Ziel"; return }
  } catch { Write-Host "  Alte Zip nicht lesbar ($($_.Exception.Message)) — wird neu geschrieben." -ForegroundColor Yellow }
}

# ── 4. Zip schreiben ────────────────────────────────────────────────────────
$zielDir = Split-Path -Parent $Ziel
if (-not (Test-Path -LiteralPath $zielDir)) { New-Item -ItemType Directory -Force $zielDir | Out-Null }
$tmp = $Ziel + '.tmp'
if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
$zip = [IO.Compression.ZipFile]::Open($tmp, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($f in $dateien) {
    $name = 'compass-server/' + $f.Replace('\', '/')
    if ($f -eq 'compass-server.json') {
      $e = $zip.CreateEntry($name); $st = $e.Open(); $b = $enc.GetBytes($konfig); $st.Write($b, 0, $b.Length); $st.Close()
    } else {
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $src $f), $name) | Out-Null
    }
  }
  $e = $zip.CreateEntry('compass-server/VERSION.txt'); $st = $e.Open(); $b = $enc.GetBytes($version); $st.Write($b, 0, $b.Length); $st.Close()
  # Leerer daten\-Ordner als Wegweiser (der Server fuellt ihn beim ersten Start aus vorlagen\).
  $zip.CreateEntry('compass-server/daten/') | Out-Null
} finally { $zip.Dispose() }
Move-Item -LiteralPath $tmp $Ziel -Force
Write-Host ("Geschrieben ({0}, {1:n0} Bytes): {2}" -f $hash, (Get-Item -LiteralPath $Ziel).Length, $Ziel)
