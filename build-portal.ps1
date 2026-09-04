# build-portal.ps1 — macht aus einer Compass-Subdomain ein persoenliches Portal (04.09.2026)
#
#   Bis heute lag auf <vorname>.vishnuartists.com nur der Flow Compass, an der Wurzel.
#   Benes Entscheidung vom 04.09.2026: "Auf der Subdomain liegen alle persoenlichen
#   Portale — Backend vishnuartists, Cockpit, Vaikuntha und der Compass."
#   Seitdem ist die Wurzel eine Portalseite mit Kacheln, und der Compass liegt daneben:
#
#     <instanz>\              index.html (Portal), portal.js, sw.js, manifest.webmanifest,
#                             fonts.css, fonts\, app-icons\, .htaccess
#     <instanz>\compass\      der gesamte Compass-Build (build-compass-produkt.ps1)
#
#   Aufruf
#     powershell -NoProfile -ExecutionPolicy Bypass -File build-portal.ps1 -Ziel instanzen\jan
#     ... -NurMigrieren     holt nur das alte flache Layout nach compass\, schreibt sonst nichts
#
#   portal.js wird nur angelegt, wenn keine da ist — von Hand Eingetragenes bleibt stehen
#   (dieselbe Regel wie instanz.js im Compass). Alles andere wird bei jedem Lauf nachgezogen.
# ACHTUNG: keine Standardwerte aus $MyInvocation im param-Block. Der Block wird
# ausgewertet, bevor das Skript sein eigenes $MyInvocation hat — beim Aufruf aus einem
# anderen Skript heraus stand dort NULL und Split-Path brach ab (04.09.2026). Im Rumpf
# ist $PSScriptRoot verlaesslich.
param(
  [Parameter(Mandatory = $true)][string]$Ziel,
  [string]$Quelle = '',
  [switch]$NurMigrieren
)
$ErrorActionPreference = 'Stop'
$base  = $PSScriptRoot
if (-not $Quelle) { $Quelle = $base }
$prod  = Join-Path $base 'produkt\portal'
$prodC = Join-Path $base 'produkt\compass'
$enc   = New-Object Text.UTF8Encoding($false)

if (-not [IO.Path]::IsPathRooted($Ziel)) { $Ziel = Join-Path $base $Ziel }
if (-not (Test-Path (Join-Path $prod 'portal.html'))) { throw "Portalvorlage fehlt: $prod\portal.html" }
if (-not (Test-Path $Ziel)) { New-Item -ItemType Directory -Force $Ziel | Out-Null }

function Read-Utf8([string]$p) { [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) }
function Write-Lf([string]$p, [string]$t) {
  if ([string]::IsNullOrEmpty($t)) { throw "Leerer Inhalt fuer $p — nichts geschrieben." }
  [IO.File]::WriteAllText($p, $t.Replace("`r`n", "`n"), $enc)
}

# ── 1. Altes Layout: der Compass lag an der Wurzel ───────────────────────────
# Erkannt wird das Portal an seinem Marker, NICHT der Compass an einem seiner Bausteine:
# es gibt zwei Compass-Bauarten (Produkt-Build fuer Instanzen, build-compass.ps1 fuer die
# eigene) mit unterschiedlichen Dateien. Was hier liegt und kein Portal ist, gehoert nach
# compass\. Kopiert, geprueft, dann erst geloescht — ein Abbruch mittendrin verliert nichts.
function Migriere([string]$wurzel) {
  $ix = Join-Path $wurzel 'index.html'
  if (-not (Test-Path $ix)) { return $false }
  if ((Read-Utf8 $ix) -match 'vishnu-portal v\d') { return $false }

  $nach = Join-Path $wurzel 'compass'
  if (-not (Test-Path $nach)) { New-Item -ItemType Directory -Force $nach | Out-Null }
  # .htaccess gilt fuer die ganze Subdomain, der Hash-Stand des Uploads gehoert nicht in
  # den Compass-Ordner.
  $bleibt = @('.htaccess', 'compass', '.publish-state.json')
  $bewegt = 0; $stehen = @()
  foreach ($e in Get-ChildItem -LiteralPath $wurzel -Force) {
    if ($bleibt -contains $e.Name) { continue }
    $neu = Join-Path $nach $e.Name
    if (Test-Path $neu) { $stehen += $e.Name; continue }
    Copy-Item -LiteralPath $e.FullName -Destination $neu -Recurse -Force
    if (Test-Path $neu) { Remove-Item -LiteralPath $e.FullName -Recurse -Force; $bewegt++ }
  }
  Write-Host "Altes Layout migriert: $bewegt Eintrag/Eintraege nach $nach verschoben."
  if ($stehen.Count) { Write-Host ("  Stehen geblieben (lag schon in compass\): " + ($stehen -join ', ')) }
  return $true
}

Migriere $Ziel | Out-Null
if ($NurMigrieren) { return }

# ── 2. Portalseite, Service Worker, Manifest ─────────────────────────────────
Write-Lf (Join-Path $Ziel 'index.html')           (Read-Utf8 (Join-Path $prod 'portal.html'))
Write-Lf (Join-Path $Ziel 'sw.js')                (Read-Utf8 (Join-Path $prod 'portal-sw.js'))
Write-Lf (Join-Path $Ziel 'manifest.webmanifest') (Read-Utf8 (Join-Path $prod 'portal.webmanifest'))

# portal.js: nur anlegen, nie ueberschreiben
$pj = Join-Path $Ziel 'portal.js'
if (Test-Path $pj) { Write-Host 'portal.js besteht bereits — bleibt unveraendert.' }
else { Write-Lf $pj (Read-Utf8 (Join-Path $prod 'portal.example.js')); Write-Host 'portal.js aus der Vorlage angelegt.' }

# ── 3. Schriften und App-Symbole an der Wurzel ───────────────────────────────
# Das Portal ist eine eigene Seite und laedt nichts aus compass\: dort liegt Produktcode,
# der jederzeit umziehen kann. Zwei kleine Kopien sind billiger als eine Abhaengigkeit
# ueber Ordnergrenzen.
Write-Lf (Join-Path $Ziel 'fonts.css') (Read-Utf8 (Join-Path $Quelle 'fonts.css'))
$fq = Join-Path $Quelle 'fonts'; $fz = Join-Path $Ziel 'fonts'
if (-not (Test-Path $fz)) { New-Item -ItemType Directory -Force $fz | Out-Null }
Get-ChildItem $fq -File -Filter *.woff2 | ForEach-Object { Copy-Item $_.FullName (Join-Path $fz $_.Name) -Force }

# Der Ordner heisst app-icons und NICHT icons — /icons/ ist in der Standard-Apache-
# Konfiguration ein Alias auf die Server-eigenen Verzeichnissymbole (04.09.2026).
$aq = Join-Path $prodC 'app-icons'; $az = Join-Path $Ziel 'app-icons'
if (Test-Path $aq) {
  if (-not (Test-Path $az)) { New-Item -ItemType Directory -Force $az | Out-Null }
  Get-ChildItem $aq -File -Filter *.png | ForEach-Object { Copy-Item $_.FullName (Join-Path $az $_.Name) -Force }
} else { Write-Warning "App-Symbole fehlen: $aq" }

# ── 4. Bericht ───────────────────────────────────────────────────────────────
Get-ChildItem $Ziel -File | Sort-Object Name | ForEach-Object {
  $b = [IO.File]::ReadAllBytes($_.FullName)
  $bom = ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB)
  $crlf = ([Text.Encoding]::UTF8.GetString($b)).Contains("`r`n")
  '{0,-24} {1,9:n0} B  BOM={2,-5} CRLF={3}' -f $_.Name, $_.Length, $bom, $crlf
}
Write-Host ''
Write-Host "Portal gebaut -> $Ziel"
if (-not (Test-Path (Join-Path $Ziel 'compass\index.html'))) {
  Write-Host 'Hinweis: compass\index.html fehlt noch — build-compass-produkt.ps1 -Instanz <Name> baut ihn.'
}
