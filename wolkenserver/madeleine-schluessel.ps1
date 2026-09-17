# madeleine-schluessel.ps1 — die zwei Schlüssel, die Madeleine auf dem Wolkenserver noch fehlen (17.09.2026)
#
#   Bene, 17.09.2026: „ja, bereite die schlüssel vor". Dieses Skript würfelt beide, legt sie nur in deine
#   Benutzer-Umgebung (nie in eine Datei, nie in den Chat) und sagt dir, was du noch tun musst.
#
#   1) JOHN_HUB_TOKEN_MADELENE_GERAET — Geräteschlüssel der Rezeption (gemeinsames Gedächtnis mit Astra).
#      Erzeugt und hochgeladen von john-agent\hub\hub-deploy.ps1 -GeraetErzeugen madelene-geraet
#      (auf der Rezeption liegt nur der SHA-256).
#   2) MADELEINE_TOKEN — eigener Ausweis für den Raumschiff-Briefkasten (f/raumschiff/madeleine.php).
#      Gilt nur dort, nicht in Finanzlauf, Upload, Klärung oder Steuerbüro. Muss als Repo-Secret
#      MADELEINE_TOKEN ins Website-Repo — das Skript legt ihn dafür kurz in die Zwischenablage
#      (ohne Windows-Verlauf und ohne Cloud-Sync) und öffnet die Seite.
#   3) Danach: Website-Deploy einmal laufen lassen, dann deploy-wolkenserver.ps1 (macht das Skript am Ende,
#      wenn du es bestätigst). Ab dann holt der Server die Raumschiff-Fragen, der lokale Abholer lässt sie liegen.
#
#   Aufruf:  powershell -NoProfile -ExecutionPolicy Bypass -File C:\dev\persoenliches-dashboard\wolkenserver\madeleine-schluessel.ps1
#            … -Status    nur zeigen, was gesetzt ist (ohne Werte)
param([switch]$Status)
$ErrorActionPreference = 'Stop'
$hier = Split-Path -Parent $MyInvocation.MyCommand.Path
function Sag($m, $f = 'Gray') { Write-Host $m -ForegroundColor $f }
function LiesEnv([string]$n) { $v = [Environment]::GetEnvironmentVariable($n, 'User'); if ($v -and $v.Trim()) { $v.Trim() } else { $null } }
function Kopiere-Geheim([string]$t) {
  Add-Type -AssemblyName System.Windows.Forms
  $d = New-Object System.Windows.Forms.DataObject
  $d.SetData([System.Windows.Forms.DataFormats]::UnicodeText, $t)
  foreach ($f in 'ExcludeClipboardContentFromMonitorProcessing', 'CanIncludeInClipboardHistory', 'CanUploadToCloudClipboard') {
    $d.SetData($f, (New-Object IO.MemoryStream(,[byte[]](0,0,0,0))))
  }
  [System.Windows.Forms.Clipboard]::SetDataObject($d, $true)
}

$hubVar = 'JOHN_HUB_TOKEN_MADELENE_GERAET'
Sag ("Rezeption ({0}): {1}" -f $hubVar, $(if (LiesEnv $hubVar) { 'gesetzt' } else { 'fehlt' }))
Sag ("Raumschiff (MADELEINE_TOKEN): {0}" -f $(if (LiesEnv 'MADELEINE_TOKEN') { 'gesetzt' } else { 'fehlt' }))
if ($Status) { return }

# ---------- 1) Rezeption ----------
if (-not (LiesEnv $hubVar)) {
  Sag "`n1) Geräteschlüssel für die Rezeption wird erzeugt und hochgeladen …" 'Cyan'
  & powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\dev\john-agent\hub\hub-deploy.ps1' -GeraetErzeugen 'madelene-geraet' -OhnePersona
  if (-not (LiesEnv $hubVar)) { Sag "   $hubVar ist danach nicht gesetzt — Ausgabe oben lesen." 'Red'; return }
  Sag '   erledigt.' 'Green'
} else { Sag "`n1) Rezeption: Schlüssel liegt schon — übersprungen." }

# ---------- 2) Raumschiff ----------
if (-not (LiesEnv 'MADELEINE_TOKEN')) {
  Sag "`n2) Ausweis für den Raumschiff-Briefkasten" 'Cyan'
  $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  $wert = -join ($b | ForEach-Object { $_.ToString('x2') })
  Kopiere-Geheim $wert
  Sag '   Der Wert liegt jetzt in der Zwischenablage (ohne Verlauf).'
  Sag '   Gleich öffnet sich GitHub: Name = MADELEINE_TOKEN, Wert = Strg+V, „Add secret".'
  Start-Process 'https://github.com/benediktirsch-rgb/vishnuartists-website-redesign/settings/secrets/actions/new'
  $ok = Read-Host '   Secret gespeichert? (j = ja, alles andere bricht ab)'
  try { [System.Windows.Forms.Clipboard]::Clear() } catch { }
  if ($ok -ne 'j') { Sag '   Abgebrochen — nichts gesetzt. Einfach noch einmal starten.' 'Yellow'; return }
  [Environment]::SetEnvironmentVariable('MADELEINE_TOKEN', $wert, 'User')
  $wert = $null
  Sag '   MADELEINE_TOKEN als Benutzer-Umgebungsvariable gesetzt, Zwischenablage geleert.' 'Green'
  Sag '   Jetzt den Website-Deploy einmal laufen lassen (Actions → deploy → „Run workflow" bzw. „Re-run all jobs").' 'Yellow'
  Start-Process 'https://github.com/benediktirsch-rgb/vishnuartists-website-redesign/actions'
  [void](Read-Host '   Deploy grün? Enter')
} else { Sag "`n2) Raumschiff: Ausweis liegt schon — übersprungen." }

# ---------- 3) Wolkenserver ----------
$ja = Read-Host "`n3) Beide Schlüssel jetzt auf den Wolkenserver bringen (deploy-wolkenserver.ps1)? (j/n)"
if ($ja -eq 'j') {
  $env:MADELEINE_TOKEN = LiesEnv 'MADELEINE_TOKEN'; $env:JOHN_HUB_TOKEN_MADELENE_GERAET = LiesEnv $hubVar
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $hier 'deploy-wolkenserver.ps1')
  Sag "`nFertig. Der Server holt Raumschiff-Fragen jetzt alle 10 Minuten; der lokale Abholer lässt sie liegen." 'Green'
} else { Sag 'Später: powershell -ExecutionPolicy Bypass -File wolkenserver\deploy-wolkenserver.ps1' }
