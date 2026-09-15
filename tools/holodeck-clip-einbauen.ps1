<#
.SYNOPSIS
  Baut einen gerenderten Clip (z. B. aus Calliope) ins Holodeck ein — oder nimmt ihn wieder heraus.

.DESCRIPTION
  Der Erlebnisraum (holodeck-engine/experience.js) spielt zu einer Szene ein Video, sobald im
  holodeck-assets/manifest.json unter assets.<szene>.video ein Pfad steht. Dieses Skript legt den Clip
  nach holodeck-assets/motion/<szene>.mp4 (der Ordner, den build-compass.ps1 ohnehin mitkopiert) und
  trägt den Pfad ein — in BEIDEN Asset-Ordnern (flow-compass und john-agent), weil die Assets
  unversioniert sind und in beiden Repos liegen.

  Vorher wird geprüft, ob der Browser den Clip überhaupt abspielen kann (H.264 / yuv420p, faststart,
  Länge, Größe). -Optimieren wandelt ihn mit ffmpeg dafür um: ohne Ton, max. 1920 px breit, faststart.

.EXAMPLE
  powershell -NoProfile -File tools/holodeck-clip-einbauen.ps1 -Szene scene-02 -Clip "$env:USERPROFILE\Downloads\scene-02.mp4" -Optimieren
  powershell -NoProfile -File tools/holodeck-clip-einbauen.ps1 -Liste
  powershell -NoProfile -File tools/holodeck-clip-einbauen.ps1 -Szene scene-02 -Entfernen
#>
[CmdletBinding()]
param(
  [string]$Szene,
  [string]$Clip,
  [switch]$Optimieren,
  [switch]$Entfernen,
  [switch]$Liste,
  [string[]]$Wurzeln = @('C:\dev\persoenliches-dashboard\holodeck-assets', 'C:\dev\john-agent\compass\holodeck-assets')
)
$ErrorActionPreference = 'Stop'
$enc = New-Object Text.UTF8Encoding($false)

function Lies-Manifest([string]$wurzel) {
  $p = Join-Path $wurzel 'manifest.json'
  if (-not (Test-Path $p)) { throw "Manifest fehlt: $p" }
  return ([IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) | ConvertFrom-Json)
}
function Schreib-Manifest([string]$wurzel, $manifest) {
  # ConvertTo-Json (PS 5.1) rückt mit 4 Leerzeichen ein und kodiert Umlaute als \uXXXX — beides
  # gültiges JSON; das Manifest ist unversioniert, nur der Raum liest es.
  $p = Join-Path $wurzel 'manifest.json'
  $t = ($manifest | ConvertTo-Json -Depth 6).Replace("`r`n", "`n")
  [IO.File]::WriteAllText($p, $t + "`n", $enc)
}
function Sonde([string]$datei) {
  $ffprobe = Get-Command ffprobe -ErrorAction SilentlyContinue
  if (-not $ffprobe) { return $null }
  $raw = & $ffprobe.Source -v error -select_streams v:0 -show_entries 'stream=codec_name,pix_fmt,width,height:format=duration,size' -of json $datei
  return ($raw -join "`n" | ConvertFrom-Json)
}

# Über `powershell -File` kommt eine Liste als EIN String "a,b" an — hier auseinandernehmen.
$Wurzeln = @($Wurzeln | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
foreach ($w in $Wurzeln) { if (-not (Test-Path $w)) { throw "Asset-Ordner fehlt: $w" } }

if ($Liste) {
  $m = Lies-Manifest $Wurzeln[0]
  $namen = @($m.assets.PSObject.Properties.Name)
  '{0,-20} {1,-22} {2,-28} {3}' -f 'Szene', 'Standbild', 'Clip', 'liegt in'
  foreach ($n in $namen) {
    $a = $m.assets.$n
    $orte = @()
    foreach ($w in $Wurzeln) {
      if ($a.video -and (Test-Path (Join-Path $w $a.video))) { $orte += (Split-Path (Split-Path $w -Parent) -Leaf) }
    }
    $clip = if ($a.video) { $a.video } else { '—' }
    $wo = if ($a.video) { if ($orte.Count) { $orte -join ', ' } else { 'FEHLT (Manifest zeigt auf nichts)' } } else { '' }
    '{0,-20} {1,-22} {2,-28} {3}' -f $n, $a.poster, $clip, $wo
  }
  return
}

if (-not $Szene) { throw 'Bitte -Szene angeben (z. B. scene-02, enterprise-lounge, cinema-welcome) — oder -Liste.' }
if ($Szene -notmatch '^[a-z0-9-]+$') { throw "Ungültiger Szenenname: $Szene (nur a-z, 0-9, Bindestrich)" }
$ref = Lies-Manifest $Wurzeln[0]
if (-not $ref.assets.PSObject.Properties[$Szene]) {
  throw "Szene '$Szene' steht nicht im Manifest. Bekannt: $(($ref.assets.PSObject.Properties.Name | Sort-Object) -join ', ')"
}
$relativ = "motion/$Szene.mp4"

if ($Entfernen) {
  foreach ($w in $Wurzeln) {
    $m = Lies-Manifest $w
    if ($m.assets.$Szene.PSObject.Properties['video']) { $m.assets.$Szene.PSObject.Properties.Remove('video') }
    Schreib-Manifest $w $m
    $ziel = Join-Path $w $relativ
    if (Test-Path $ziel) { Remove-Item -LiteralPath $ziel -Force; "entfernt: $ziel" } else { "war nicht da: $ziel" }
  }
  "Der Raum zeigt für $Szene wieder das Standbild. Danach: build-compass.ps1, dann publish-compass.ps1."
  return
}

if (-not $Clip) { throw 'Bitte -Clip <pfad.mp4> angeben (oder -Entfernen / -Liste).' }
if (-not (Test-Path -LiteralPath $Clip)) { throw "Clip nicht gefunden: $Clip" }
$quelle = (Resolve-Path -LiteralPath $Clip).Path

$s = Sonde $quelle
if ($s) {
  $v = $s.streams[0]
  "Quelle: $($v.codec_name) $($v.pix_fmt) $($v.width)x$($v.height), $([math]::Round([double]$s.format.duration,1)) s, $([math]::Round([double]$s.format.size/1MB,1)) MB"
  $probleme = @()
  if ($v.codec_name -ne 'h264') { $probleme += "Codec $($v.codec_name) statt h264" }
  if ($v.pix_fmt -ne 'yuv420p') { $probleme += "Pixelformat $($v.pix_fmt) statt yuv420p (Safari/Chrome spielen sonst nichts)" }
  if ([double]$s.format.duration -gt 20) { $probleme += "länger als 20 s — der Raum loopt, 8–12 s reichen" }
  if ([double]$s.format.size -gt 8MB) { $probleme += "größer als 8 MB — lädt auf dem Handy zu lange" }
  if ($probleme.Count -and -not $Optimieren) {
    Write-Warning ("Clip ist so nicht browsertauglich: " + ($probleme -join '; ') + ". Mit -Optimieren wandelt ffmpeg ihn um.")
    throw 'Abbruch ohne Änderung.'
  }
} elseif (-not $Optimieren) {
  Write-Warning 'ffprobe nicht gefunden — Clip wird ungeprüft übernommen. Spielt er im Raum nicht, fällt experience.js still aufs Standbild zurück.'
}

$bereit = $quelle
if ($Optimieren) {
  $ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if (-not $ffmpeg) { throw 'ffmpeg nicht gefunden (winget install Gyan.FFmpeg).' }
  $tmp = Join-Path $env:TEMP "holodeck-$Szene-$(Get-Date -Format yyyyMMdd-HHmmss).mp4"
  & $ffmpeg.Source -v error -y -i $quelle -an -vf "scale='min(1920,iw)':-2,format=yuv420p" -c:v libx264 -preset slow -crf 22 -movflags +faststart $tmp
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tmp)) { throw 'ffmpeg ist gescheitert.' }
  $bereit = $tmp
  $s2 = Sonde $tmp
  if ($s2) { "Optimiert: $($s2.streams[0].width)x$($s2.streams[0].height), $([math]::Round([double]$s2.format.duration,1)) s, $([math]::Round([double]$s2.format.size/1MB,1)) MB" }
}

foreach ($w in $Wurzeln) {
  $motion = Join-Path $w 'motion'
  if (-not (Test-Path $motion)) { New-Item -ItemType Directory -Force $motion | Out-Null }
  $ziel = Join-Path $w $relativ
  Copy-Item -LiteralPath $bereit -Destination $ziel -Force
  $m = Lies-Manifest $w
  if ($m.assets.$Szene.PSObject.Properties['video']) { $m.assets.$Szene.video = $relativ }
  else { $m.assets.$Szene | Add-Member -NotePropertyName video -NotePropertyValue $relativ }
  Schreib-Manifest $w $m
  "eingebaut: $ziel  (Manifest: assets.$Szene.video = $relativ)"
}
''
"Weiter: build-compass.ps1 (kopiert motion/ + Manifest) → john-server :8787 → Holodeck → Platz '$Szene' ansehen → publish-compass.ps1."
"Zurück: tools/holodeck-clip-einbauen.ps1 -Szene $Szene -Entfernen"
