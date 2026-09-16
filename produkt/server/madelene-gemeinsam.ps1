# madelene-gemeinsam.ps1 — eine Madelene, zwei Laufwege (16.09.2026)
#
#   Bene, 16.09.2026: „Madelene ist eine Person." Astra (ChatGPT Work) und die Beratungs-Laufzeit (Codex im
#   john-server bzw. auf wolke) teilen sich deshalb ein Gedächtnis und eine Persona. Beides liegt in Johns
#   Rezeption (hotel-vaikuntha.de/john, docs/protokoll.md in john-agent):
#     w=gedaechtnis   kurze Sätze, die beide Laufwege schreiben und lesen (keine Beträge, Kontodaten, Adressen)
#     w=freigaben     was Bene pro Frage für Madelene freigegeben hat (höchstens 30 Tage)
#     w=rueckfragen   Astras Rückfragen an Bene und seine Antworten
#   Diese Datei holt das mit dem Geräteschlüssel dieses Rechners bzw. Servers und bereitet es für den
#   Systemtext auf. Wird von john-madeleine.ps1 dot-sourced; madeleine.ps1 (wolke) kann dasselbe tun.
#
#   Zwei Regeln, die nicht zurückgebaut werden:
#   1. Der Server arbeitet seriell. Jeder Abruf hat 6 s Timeout, das Ergebnis wird 5 Minuten gecacht, und ein
#      Fehler bleibt eine Zeile im Systemtext statt einer Ausnahme.
#   2. In die Rezeption geht nur, was die Muster-Prüfung besteht. Dieselben vier Muster prüft die Rezeption
#      noch einmal; ein Satz, der hier scheitert, bleibt in den lokalen Notizen.

$script:MadeleneGemeinsamCache = $null
$script:MadeleneGemeinsamZeit = [datetime]::MinValue

function Get-MadeleneEnv([string]$n) {
  foreach ($s in 'Process', 'User') {
    try { $v = [Environment]::GetEnvironmentVariable($n, $s) } catch { $v = $null }
    if ($v -and $v.Trim()) { return $v.Trim() }
  }
  return $null
}

function Get-MadeleneHub {
  $url = Get-MadeleneEnv 'JOHN_HUB_URL'
  if (-not $url) { $url = 'https://hotel-vaikuntha.de/john' }
  $tok = $null
  foreach ($n in 'JOHN_HUB_TOKEN_MADELENE_GERAET', 'JOHN_HUB_TOKEN_VISHNU_MASTER', 'JOHN_HUB_TOKEN') {
    if (-not $tok) { $tok = Get-MadeleneEnv $n }
  }
  return @{ url = $url.TrimEnd('/'); token = $tok }
}

function Invoke-MadeleneHub([string]$w, $body = $null, [string]$q = '') {
  $h = Get-MadeleneHub
  if (-not $h.token) { throw 'NO_HUB_TOKEN: kein Geräteschlüssel für die Rezeption (JOHN_HUB_TOKEN_*)' }
  $p = @{ Uri = "$($h.url)/api.php?w=$w$q"; Headers = @{ 'X-John-Token' = $h.token }; TimeoutSec = 6; UseBasicParsing = $true }
  if ($null -ne $body) {
    $p.Method = 'Post'
    $p.ContentType = 'application/json; charset=utf-8'
    $p.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 5 -Compress))
  } else { $p.Method = 'Get' }
  return Invoke-RestMethod @p
}

# Dieselben vier Muster wie jh_muster() in hub/api.php — beim Ändern beide Stellen anfassen.
function Test-MadeleneMuster([string]$t) {
  $m = @()
  if ($t -match '(?i)\d[\d.,]*\s?(€|eur\b|euro\b|\$|usd\b|tsd\b|t€|k€)' -or $t -match '(€|\$)\s?\d' -or $t -match '(?i)\b\d+(?:[.,]\d+)?\s?k\b') { $m += 'betrag' }
  if ($t.ToUpperInvariant() -match '\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}') { $m += 'iban' }
  if ($t -match '(?i)[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}') { $m += 'mail' }
  if ($t -match '(?:\+|\b00)\d[\d \/-]{7,}\d|\b0\d{2,5}[ \/-]?\d{3,}[\d -]{2,}\d\b') { $m += 'telefon' }
  return , $m
}

# Was der andere Laufweg weiß: Gedächtnis, Freigaben, Astras Rückfragen. Gibt @{ text; geladen; fehler } zurück.
function Get-MadeleneGemeinsam([switch]$Frisch) {
  if (-not $Frisch -and $script:MadeleneGemeinsamCache -and ((Get-Date) - $script:MadeleneGemeinsamZeit).TotalSeconds -lt 300) {
    return $script:MadeleneGemeinsamCache
  }
  $teile = New-Object System.Collections.Generic.List[string]
  $geladen = New-Object System.Collections.Generic.List[string]
  $fehler = New-Object System.Collections.Generic.List[string]
  try {
    $g = Invoke-MadeleneHub 'gedaechtnis' $null '&fuer=madelene'
    $zeilen = @($g.eintraege | Select-Object -First 30 | ForEach-Object {
      $wer = $(if ([string]$_.von -eq 'astra') { 'Astra' } else { 'Beratung' })
      "- $(([string]$_.ts).Substring(0, 10)) · $wer$(if ($_.thema) { ' · ' + $_.thema }): $($_.text)"
    })
    $teile.Add("## Gemeinsames Gedächtnis (jüngste zuerst)`n" + $(if ($zeilen.Count) { $zeilen -join "`n" } else { '(noch leer)' }))
    $geladen.Add("rezeption/gedaechtnis ($($zeilen.Count))")
  } catch { $fehler.Add("Gedächtnis: $($_.Exception.Message)") }
  try {
    $f = Invoke-MadeleneHub 'freigaben' $null '&fuer=madelene'
    $zeilen = @($f.freigaben | ForEach-Object {
      $z = "- bis $($_.bis): $($_.frage)"
      if ($_.antwort) { $z += " — Antwort: $($_.antwort)" }
      if ($_.notiz) { $z += " — Notiz: $($_.notiz)" }
      $z
    })
    $teile.Add("## Was Bene für Astra freigegeben hat (das und nur das sieht der Astra-Laufweg aus seinem Kontext)`n" + $(if ($zeilen.Count) { $zeilen -join "`n" } else { '(nichts freigegeben)' }))
    $geladen.Add("rezeption/freigaben ($($zeilen.Count))")
  } catch { $fehler.Add("Freigaben: $($_.Exception.Message)") }
  try {
    $r = Invoke-MadeleneHub 'rueckfragen' $null '&von=madelene&status=alle'
    $zeilen = @($r.rueckfragen | Select-Object -First 10 | ForEach-Object {
      $a = $(if ($_.antwort) { "Antwort: $($_.antwort.a)" } else { [string]$_.status })
      "- $($_.frage) → $a"
    })
    $teile.Add("## Astras Rückfragen an Bene (jüngste zuerst)`n" + $(if ($zeilen.Count) { $zeilen -join "`n" } else { '(keine)' }))
    $geladen.Add("rezeption/rueckfragen-madelene ($($zeilen.Count))")
  } catch { $fehler.Add("Rückfragen: $($_.Exception.Message)") }
  $text = "# Madelene ist eine Person — was der Astra-Laufweg weiß und teilt (Rezeption)`n" + ($teile -join "`n`n")
  if ($fehler.Count) { $text += "`n`n(Nicht erreichbar in diesem Lauf: " + ($fehler -join '; ') + ')' }
  $erg = @{ text = $text; geladen = $geladen; fehler = $fehler }
  $script:MadeleneGemeinsamCache = $erg
  $script:MadeleneGemeinsamZeit = Get-Date
  return $erg
}

# „GEMEINSAM: …"-Zeilen aus einer Antwort lösen (wie NOTIZ in john-madeleine.ps1).
function Split-MadeleneGemeinsam([string]$text) {
  $rx = '(?m)^[ \t]*\**GEMEINSAM:\**[ \t]*(.+?)[ \t]*\r?$'
  $saetze = @([regex]::Matches($text, $rx) | ForEach-Object { $_.Groups[1].Value.Trim() } | Where-Object { $_ })
  return @{ text = ([regex]::Replace($text, $rx, '')).Trim(); saetze = $saetze }
}

# Einen Satz ins gemeinsame Gedächtnis legen. Scheitert die Musterprüfung oder die Rezeption, kommt ok=false zurück —
# der Aufrufer legt den Satz dann in die lokalen Notizen.
function Send-MadeleneGemeinsam([string]$text, [string]$thema = '') {
  $m = Test-MadeleneMuster $text
  if ($m.Count) { return @{ ok = $false; grund = 'muster'; muster = $m } }
  try {
    $r = Invoke-MadeleneHub 'gedaechtnis' @{ fuer = 'madelene'; text = $text; thema = $thema }
    $script:MadeleneGemeinsamCache = $null
    return @{ ok = [bool]$r.ok; id = $r.id }
  } catch { return @{ ok = $false; grund = $_.Exception.Message } }
}
