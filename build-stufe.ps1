# build-stufe.ps1 — kennzeichnet einen gebauten Compass-Ordner als Staging (15.09.2026)
#
#   Warum: Staging und Prod sehen sonst gleich aus. Wer morgens auf staging-bene.vishnuartists.com
#   den Morgencheck macht, arbeitet gegen den Staging-Server — und wundert sich abends, warum in
#   Prod nichts steht. Deshalb bekommt jede Seite der Staging-Stufe einen sichtbaren Balken, einen
#   Titel-Praefix, noindex, und die installierbare App heisst "Staging · …" statt wie die echte.
#
#   Was passiert (idempotent — ein zweiter Lauf aendert nichts mehr):
#     · jede *.html im Ordner und in <Ordner>\compass: Balken direkt nach <body>, "[STAGING] " vor
#       den <title>, <meta name="robots" content="noindex,nofollow">
#     · manifest.webmanifest (Wurzel + compass\): name/short_name mit "Staging · ", theme_color bernstein
#     · sw.js wird nicht angefasst: der Cache gilt je Ursprung, und Staging ist ein eigener Ursprung
#
#   Aufruf
#     powershell -NoProfile -ExecutionPolicy Bypass -File build-stufe.ps1 -Ordner site\staging\bene -Stufe staging -Prod https://bene.vishnuartists.com/
#     -Stufe prod entfernt nichts — Prod-Builds werden nie gekennzeichnet, der Schalter ist nur Schutz
#     gegen einen versehentlichen Aufruf.
param(
  [Parameter(Mandatory = $true)][string]$Ordner,
  [ValidateSet('staging', 'prod')][string]$Stufe = 'staging',
  [string]$Prod = '',
  [string]$Stand = ''
)
$ErrorActionPreference = 'Stop'
$enc = New-Object Text.UTF8Encoding($false)
function Read-Utf8([string]$p) { [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) }
function Write-Lf([string]$p, [string]$t) { [IO.File]::WriteAllText($p, $t.Replace("`r`n", "`n"), $enc) }

if ($Stufe -ne 'staging') { Write-Host "Stufe $Stufe wird nicht gekennzeichnet — nichts zu tun."; return }
if (-not [IO.Path]::IsPathRooted($Ordner)) { $Ordner = Join-Path $PSScriptRoot $Ordner }
if (-not (Test-Path $Ordner)) { throw "Ordner fehlt: $Ordner" }
if (-not $Stand) { $Stand = Get-Date -Format 'dd.MM.yyyy HH:mm' }
$MARKE = 'id="stufe-banner"'

# Der Balken: keine externen Abhaengigkeiten, unten am Rand (oben liegen die klebrigen Kontext-Chips
# des Compass), hoechster z-index, per Knopf fuer diese Seite ausblendbar. Inline-Stil, weil der
# Balken in drei verschiedenen Seiten landet (Compass, Kennzahlen, Bruecke) und keine davon eine
# gemeinsame CSS-Datei hat. button{color:var(--ink)} aus der Marke wird durch den Inline-Stil geschlagen.
$link = ''
if ($Prod) { $link = '<a href="' + $Prod + '" style="color:#fff;text-decoration:underline;font-weight:700">Zur Live-Version</a>' }
$balken = '<div ' + $MARKE + ' role="status" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:#8a6008;color:#fff;font:600 12px/1.4 Inter,system-ui,sans-serif;padding:5px 12px;display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;box-shadow:0 -2px 8px rgba(0,0,0,.25)">' +
  '<span>&#9888; STAGING &middot; Arbeitsstand vom ' + $Stand + ' &middot; nicht die Live-Version</span>' + $link +
  '<button type="button" onclick="this.parentNode.style.display=''none''" style="background:transparent;border:1px solid #fff;color:#fff;border-radius:999px;padding:1px 9px;cursor:pointer;font:inherit">ausblenden</button></div>'
$robots = '<meta name="robots" content="noindex,nofollow">'

$seiten = @()
foreach ($d in @($Ordner, (Join-Path $Ordner 'compass'))) {
  if (Test-Path $d) { $seiten += Get-ChildItem -LiteralPath $d -File -Filter *.html }
}
$n = 0
foreach ($f in $seiten) {
  $t = Read-Utf8 $f.FullName
  if ($t.Contains($MARKE)) { continue }
  # Instanz-Methode mit Zaehler: die STATISCHE [regex]::Replace kennt kein viertes Argument "count" —
  # die 1 wird dort zu RegexOptions (IgnoreCase) und ersetzt ALLE Treffer (so stand der Balken am
  # 15.09. zweimal in der Seite: <body> und ein <body> in einem Skript-String).
  # Nur ein <body> am Zeilenanfang zaehlt: dashboard.html erwaehnt "<body>" auch in einem Kommentar (Zeile 8).
  $neu = (New-Object Text.RegularExpressions.Regex '(?im)^(<body[^>]*>)').Replace($t, ('$1' + "`n" + $balken), 1)
  if ($neu -eq $t) { Write-Warning "$($f.Name): kein <body> gefunden — nicht gekennzeichnet."; continue }
  $neu = (New-Object Text.RegularExpressions.Regex '(?i)<title>(?!\[STAGING\])').Replace($neu, '<title>[STAGING] ', 1)
  if ($neu -notmatch '(?i)name="robots"') { $neu = (New-Object Text.RegularExpressions.Regex '(?i)(<meta charset=[^>]*>)').Replace($neu, ('$1' + "`n" + $robots), 1) }
  Write-Lf $f.FullName $neu
  $n++
}

foreach ($d in @($Ordner, (Join-Path $Ordner 'compass'))) {
  $m = Join-Path $d 'manifest.webmanifest'
  if (-not (Test-Path $m)) { continue }
  $t = Read-Utf8 $m
  if ($t -match '"name":\s*"Staging') { continue }
  $t = (New-Object Text.RegularExpressions.Regex '"name":\s*"').Replace($t, '"name": "Staging · ', 1)
  $t = (New-Object Text.RegularExpressions.Regex '"short_name":\s*"').Replace($t, '"short_name": "Stg · ', 1)
  $t = (New-Object Text.RegularExpressions.Regex '"theme_color":\s*"#[0-9a-fA-F]{3,8}"').Replace($t, '"theme_color": "#8a6008"', 1)
  Write-Lf $m $t
}
Write-Host ("Staging gekennzeichnet: {0} Seite(n) in {1} (Stand {2})" -f $n, $Ordner, $Stand)
