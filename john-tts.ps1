# john-tts.ps1 — Serverstimme für Holodeck und Gesprächsraum (15.09.2026)
#
# Warum: die Browserstimmen auf diesem Rechner sind die alten Windows-Stimmen Hedda/Katja/Stefan — sie
# klingen wie ein Navigationsgerät. Eine neuronale Engine läuft hier lokal, kostenlos und ohne Netz:
# Piper (rhasspy/piper). Der Server rendert einen Satz zu WAV, der Gesprächsraum spielt ihn ab und
# fällt bei jedem Fehler still auf die Browserstimme zurück.
#
# Aufbau:  C:\dev\_tools\piper\piper.exe           (Binary, unversioniert)
#          C:\dev\_tools\piper\voices\<modell>.onnx (+ .onnx.json daneben)
# Ohne piper.exe meldet /api/tts/status engine='sapi' — dann rendert System.Speech (dieselben alten
# Stimmen, aber die Kette ist prüfbar) und der Gesprächsraum bleibt bei der Browserstimme.
#
# Braucht aus john-server.ps1: Invoke-Prozess, $script:Utf8NoBom.

$script:TtsDir = 'C:\dev\_tools\piper'
$script:TtsCache = Join-Path $env:LOCALAPPDATA 'john-compass\tts-cache'
# Besetzung je Sprache und Figur: Piper-Modellname ohne .onnx. Fehlt das Modell, nimmt Resolve-TtsModell ein
# anderes derselben Sprache; fehlt auch das, gibt es für diese Sprache keine Serverstimme.
$script:TtsBesetzung = @{
  de = @{ john = 'de_DE-thorsten-high';    madeleine = 'de_DE-kerstin-low';   picard = 'de_DE-thorsten-medium' }
  en = @{ john = 'en_US-ryan-high';        madeleine = 'en_US-amy-medium';    picard = 'en_GB-alan-medium' }
  fr = @{ john = 'fr_FR-tom-medium';       madeleine = 'fr_FR-siwis-medium';  picard = 'fr_FR-tom-medium' }
  it = @{ john = 'it_IT-riccardo-x_low';   madeleine = 'it_IT-paola-medium';  picard = 'it_IT-riccardo-x_low' }
}
# Sprechtempo (length_scale: >1 langsamer) und Lebendigkeit (noise_scale) je Figur — Regie aus production.js:
# John sonor und lässig, Madeleine warm und etwas flinker, Picard ruhig mit Atempausen.
$script:TtsProsodie = @{
  john      = @{ length = 1.06; noise = 0.55;  pause = 0.35 }
  madeleine = @{ length = 0.97; noise = 0.667; pause = 0.30 }
  picard    = @{ length = 1.12; noise = 0.50;  pause = 0.45 }
}

function Get-TtsExe { $p = Join-Path $script:TtsDir 'piper.exe'; if (Test-Path $p -PathType Leaf) { $p } else { $null } }
function Get-TtsModelle {
  $d = Join-Path $script:TtsDir 'voices'
  if (-not (Test-Path $d)) { return @() }
  @(Get-ChildItem -LiteralPath $d -Filter *.onnx -File | Where-Object { Test-Path ($_.FullName + '.json') } | ForEach-Object { $_.BaseName })
}
function Resolve-TtsModell([string]$lang, [string]$wer) {
  $prefix = ($lang -split '-')[0].ToLower(); $modelle = Get-TtsModelle
  $wunsch = $script:TtsBesetzung[$prefix]; if ($wunsch -and $wunsch[$wer] -and ($modelle -contains $wunsch[$wer])) { return $wunsch[$wer] }
  # Ersatz: ein anderes Modell derselben Sprache — lieber die falsche Figur als die alte Windows-Stimme.
  $ersatz = @($modelle | Where-Object { $_ -like "$prefix`_*" })
  if ($ersatz.Count) { return $ersatz[0] }
  return $null
}
function Get-TtsStatus {
  $exe = Get-TtsExe; $modelle = Get-TtsModelle
  $besetzung = @{}
  foreach ($lang in @('de','en','fr','it','hi')) {
    $besetzung[$lang] = @{}
    foreach ($wer in @('john','madeleine','picard')) { $besetzung[$lang][$wer] = $(if ($exe) { Resolve-TtsModell $lang $wer } else { $null }) }
  }
  $engine = if ($exe -and $modelle.Count) { 'piper' } elseif ($exe) { 'piper-ohne-modelle' } else { 'sapi' }
  $hint = switch ($engine) {
    'piper' { '' }
    'piper-ohne-modelle' { "piper.exe da, aber keine Modelle in $script:TtsDir\voices (<name>.onnx + .onnx.json)." }
    default { "Keine neuronale Engine: $script:TtsDir\piper.exe fehlt. Solange spricht der Browser." }
  }
  @{ ok = $true; engine = $engine; natural = ($engine -eq 'piper'); modelle = $modelle; besetzung = $besetzung; ordner = $script:TtsDir; hint = $hint }
}
# Text für die Stimme: kein Markdown, keine Adressen, keine Emojis — vorgelesene Sternchen sind das Erste, was
# eine Stimme unnatürlich macht. Der Gesprächsraum bereinigt ebenfalls; hier ist die zweite Sicherung.
function ConvertTo-TtsText([string]$t) {
  if (-not $t) { return '' }
  $t = $t -replace '```[\s\S]*?```', ' ' -replace '`([^`]*)`', '$1'
  $t = $t -replace 'https?://\S+', 'Link' -replace '(?m)^\s*(#+|[-*•]|\d+[.)])\s+', '' -replace '[*_~]{1,3}([^*_~]+)[*_~]{1,3}', '$1'
  $t = $t -replace '\s+[—–]\s+', ', ' -replace '[\u2600-\u27BF]', '' -replace '\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDEFF]|\uD83E[\uDD00-\uDEFF]', ''
  $t = $t -replace '\s+', ' '
  $t.Trim()
}
function Get-TtsWav([string]$text, [string]$wer, [string]$lang) {
  $text = ConvertTo-TtsText $text
  if (-not $text) { throw 'TTS_LEER' }
  if ($text.Length -gt 1200) { $text = $text.Substring(0, 1200) }
  if ($wer -notin @('john','madeleine','picard')) { $wer = 'john' }
  if (-not (Test-Path $script:TtsCache)) { New-Item -ItemType Directory -Force $script:TtsCache | Out-Null }
  $exe = Get-TtsExe
  $modell = $(if ($exe) { Resolve-TtsModell $lang $wer } else { $null })
  $engine = $(if ($modell) { 'piper' } else { 'sapi' })
  $sha = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($script:Utf8NoBom.GetBytes("$engine|$modell|$wer|$lang|$text"))).Replace('-','').Substring(0,32).ToLower()
  $wav = Join-Path $script:TtsCache "$sha.wav"
  if (Test-Path $wav -PathType Leaf) { return @{ datei = $wav; engine = $engine; modell = $modell; cache = $true } }
  if ($engine -eq 'piper') {
    $p = $script:TtsProsodie[$wer]
    $argv = @('--model', (Join-Path $script:TtsDir "voices\$modell.onnx"), '--output_file', $wav,
              '--length_scale', ([string]$p.length), '--noise_scale', ([string]$p.noise), '--sentence_silence', ([string]$p.pause))
    $r = Invoke-Prozess $exe $argv $text 60 @{} $script:TtsDir
    if ($r.code -ne 0 -or -not (Test-Path $wav)) { throw "TTS_PIPER: $($r.stderr)" }
  } else {
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
      $culture = $(try { [Globalization.CultureInfo]::GetCultureInfo($lang) } catch { [Globalization.CultureInfo]::GetCultureInfo('de-DE') })
      $gender = $(if ($wer -eq 'madeleine') { [System.Speech.Synthesis.VoiceGender]::Female } else { [System.Speech.Synthesis.VoiceGender]::Male })
      try { $synth.SelectVoiceByHints($gender, [System.Speech.Synthesis.VoiceAge]::Adult, 0, $culture) } catch { }
      $synth.Rate = $(if ($wer -eq 'madeleine') { 0 } else { -1 })
      $synth.SetOutputToWaveFile($wav); $synth.Speak($text); $synth.SetOutputToNull()
    } finally { $synth.Dispose() }
  }
  # Cache klein halten: älter als 14 Tage weg (höchstens einmal je Stunde nachsehen).
  if (-not $script:TtsAufgeraeumt -or $script:TtsAufgeraeumt -lt (Get-Date).AddHours(-1)) {
    $script:TtsAufgeraeumt = Get-Date
    Get-ChildItem -LiteralPath $script:TtsCache -Filter *.wav -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item -Force -ErrorAction SilentlyContinue
  }
  return @{ datei = $wav; engine = $engine; modell = $modell; cache = $false }
}
