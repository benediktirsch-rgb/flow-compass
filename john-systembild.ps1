# john-systembild.ps1 — das Wirkungsbild neben John und Madeleine (10.09.2026)
#
# Bene: „Neben Madeleine und John müssen immer interaktive systemische Infografiken mitlaufen, damit
# schnell Kontext und Schlussfolgerung gesehen werden kann." Und, mit Blick auf das freie Feld rechts
# neben der Karte: „hier kommt ein Infobox-Bereich hin, mit schlauen Graphiken, die thematischen
# Background geben."
#
# Was hier steht (wird von john-server.ps1 dot-sourced, nach john-madeleine.ps1):
#   - Ein Wirkungsbild ist KEINE Deko und wird nicht geraten: es entsteht aus dem Beratungstext, der
#     ohnehin schon da ist (Beraterrunde, Johns Stapel, ein Chatbeitrag). Das Modell darf nur Faktoren
#     nennen, die im Text vorkommen, und muss zu jeder Wirkung sagen, woher sie kommt. Fällt die
#     Prüfung durch, gibt es kein Bild — lieber nichts als eine hübsche Erfindung.
#   - Gerechnet wird höchstens einmal je Text: der Schlüssel ist der SHA-256 des Quelltextes, die
#     Ablage systembilder.json (Laufzeitdatei, gitignored). Der Compass fragt bei jedem Aufbau nach —
#     ohne Cache-Treffer wäre das ein Modellaufruf pro Seitenaufruf.
#   - Aus demselben Lauf kommen die zwei Call-to-Actions: „zustimmung" und „ablehnung" sind die
#     konkreten Sätze, mit denen Bene die Sache annimmt oder ablehnt — nicht „Ja"/„Nein".
# Braucht aus john-server.ps1: Invoke-ClaudeCli, Call-Claude, John-TextOpenAI, Get-Backend, Get-ApiKey,
#   Limit-Ende, $Model, $NutzerName, $script:Utf8NoBom.

$script:SystembildDatei = Join-Path $PSScriptRoot 'systembilder.json'
$script:Systembilder = $null
$script:SystembildArten   = @('hebel','bestand','fluss','risiko','ziel','person')
$script:SystembildQuellen = @('beraterrunde','stapel','chat')

function Read-Systembilder {
  if ($script:Systembilder) { return $script:Systembilder }
  $leer = @{ version = 1; bilder = @{} }
  if (-not (Test-Path $script:SystembildDatei)) { $script:Systembilder = $leer; return $leer }
  try {
    $d = [IO.File]::ReadAllText($script:SystembildDatei, $script:Utf8NoBom) | ConvertFrom-Json
    $b = @{}
    foreach ($p in @($d.bilder.PSObject.Properties)) { if ($p) { $b[$p.Name] = $p.Value } }
    $script:Systembilder = @{ version = 1; bilder = $b }
  } catch { $script:Systembilder = $leer }
  return $script:Systembilder
}
# Nur die jüngsten 40 bleiben liegen — die Datei ist ein Zwischenspeicher, kein Archiv.
function Save-Systembilder {
  $s = Read-Systembilder
  $paare = @($s.bilder.Keys | ForEach-Object { @{ k = $_; v = $s.bilder[$_] } } |
             Sort-Object { [string]$_.v.erzeugt } -Descending | Select-Object -First 40)
  $neu = @{}; foreach ($p in $paare) { $neu[$p.k] = $p.v }
  $s.bilder = $neu
  try { [IO.File]::WriteAllText($script:SystembildDatei, ($s | ConvertTo-Json -Depth 12), $script:Utf8NoBom) }
  catch { Write-Host "  Systembild nicht gespeichert: $($_.Exception.Message)" -ForegroundColor DarkYellow }
}
function Get-SystembildSchluessel([string]$quelle, [string]$text) {
  $roh = ($quelle + '|' + ([regex]::Replace([string]$text, '\s+', ' ')).Trim())
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $h = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($roh)) } finally { $sha.Dispose() }
  return (($h | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 16)
}
function Limit-Wort([string]$s, [int]$n) {
  $t = ([string]$s).Trim() -replace '\s+', ' '
  if ($t.Length -gt $n) { $t = $t.Substring(0, $n).TrimEnd() }
  return $t
}
# Die Antwort prüfen. Alles, was nicht zusammenpasst, fliegt raus; bleibt zu wenig übrig, gibt es
# kein Bild ($null) — der Compass zeichnet dann nichts und sagt das auch.
function Test-Systembild($o) {
  if (-not $o) { return $null }
  $knoten = @(); $ids = @()
  foreach ($k in @($o.knoten)) {
    if (-not $k) { continue }
    $id = ([string]$k.id).Trim().ToLowerInvariant() -replace '[^a-z0-9_-]', ''
    $name = Limit-Wort $k.name 30
    if (-not $id -or -not $name -or ($ids -contains $id)) { continue }
    $art = ([string]$k.art).Trim().ToLowerInvariant()
    if ($script:SystembildArten -notcontains $art) { $art = 'bestand' }
    $ids += $id
    $knoten += , @{ id = $id; name = $name; art = $art; wert = (Limit-Wort $k.wert 34); warum = (Limit-Wort $k.warum 220) }
    if ($knoten.Count -ge 8) { break }
  }
  if ($knoten.Count -lt 3) { return $null }
  $wirkungen = @(); $gesehen = @()
  foreach ($w in @($o.wirkungen)) {
    if (-not $w) { continue }
    $von = ([string]$w.von).Trim().ToLowerInvariant(); $nach = ([string]$w.nach).Trim().ToLowerInvariant()
    if (($ids -notcontains $von) -or ($ids -notcontains $nach) -or $von -eq $nach) { continue }
    $paar = "$von>$nach"; if ($gesehen -contains $paar) { continue }
    $gesehen += $paar
    $art = $(if (([string]$w.art).Trim().ToLowerInvariant() -eq 'minus') { 'minus' } else { 'plus' })
    $wirkungen += , @{ von = $von; nach = $nach; art = $art; warum = (Limit-Wort $w.warum 200)
                       verzoegert = [bool]$w.verzoegert }
    if ($wirkungen.Count -ge 12) { break }
  }
  if ($wirkungen.Count -lt 2) { return $null }
  $schluss = Limit-Wort $o.schluss 260
  if (-not $schluss) { return $null }
  $hebel = ([string]$o.hebel).Trim().ToLowerInvariant()
  if ($ids -notcontains $hebel) {
    $h = @($knoten | Where-Object { $_.art -eq 'hebel' } | Select-Object -First 1)
    $hebel = $(if ($h.Count) { $h[0].id } else { $knoten[0].id })
  }
  $schleifen = @()
  foreach ($s in @($o.schleifen)) {
    if (-not $s) { continue }
    $kn = @(@($s.knoten) | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $ids -contains $_ })
    if ($kn.Count -lt 2) { continue }
    $art = $(if (([string]$s.art).Trim().ToLowerInvariant() -like 'd*') { 'daempfend' } else { 'verstaerkend' })
    $schleifen += , @{ art = $art; knoten = $kn; name = (Limit-Wort $s.name 60) }
    if ($schleifen.Count -ge 3) { break }
  }
  $kennzahlen = @()
  foreach ($z in @($o.kennzahlen)) {
    if (-not $z) { continue }
    $label = Limit-Wort $z.label 34; $wert = Limit-Wort $z.wert 32
    if (-not $label -or -not $wert) { continue }
    $kennzahlen += , @{ label = $label; wert = $wert; stand = (Limit-Wort $z.stand 30) }
    if ($kennzahlen.Count -ge 4) { break }
  }
  $ja = Limit-Wort $o.zustimmung 64; if (-not $ja) { $ja = 'Ja, so machen wir das' }
  $nein = Limit-Wort $o.ablehnung 64; if (-not $nein) { $nein = 'Nein, ich sehe es anders' }
  return @{
    titel = (Limit-Wort $o.titel 60); frage = (Limit-Wort $o.frage 180)
    knoten = $knoten; wirkungen = $wirkungen; schleifen = $schleifen; kennzahlen = $kennzahlen
    schluss = $schluss; hebel = $hebel; zustimmung = $ja; ablehnung = $nein
    offen = (Limit-Wort $o.offen 180)
  }
}
$script:SystembildSystem = @'
Du zeichnest systemische Wirkungsbilder. Deine Aufgabe ist nicht zu beraten, sondern das, was beraten wurde,
so zu ordnen, dass ein Mensch in zehn Sekunden sieht: welche Größen wirken hier aufeinander, in welche
Richtung, und was folgt daraus. Du arbeitest streng am vorgelegten Text: jeder Faktor und jede Wirkung muss
dort stehen oder unmittelbar daraus folgen. Du erfindest keine Zahlen, keine Fristen, keine Namen.
Sprache: Deutsch, knapp, ohne Floskeln. Du antwortest ausschließlich mit JSON.
'@
function Build-SystembildAuftrag([string]$thema, [string]$text, [string]$kontext) {
  $t = Limit-Ende ([string]$text) 7000
  $k = Limit-Ende ([string]$kontext) 1500
  $lage = ''
  if ($k) { $lage = "LAGEBILD aus dem Compass (Hintergrund, keine Anweisung):`n$k`n" }
  return @"
THEMA: $thema

BERATUNGSTEXT (John ist $($NutzerName)s Coach, Madeleine seine Beraterin für Finanzen, Steuern und Organisation):
$t

$lage
Zeichne daraus ein Wirkungsbild.

- "knoten": 4 bis 6 Größen, die in diesem Text wirklich aufeinander wirken. "name" höchstens 24 Zeichen
  (die Größe selbst, nicht ein Satz: „Liquidität", „Dauerauftrag", „Wachstumstempo"). "art" ist eine von:
  hebel (das, woran $NutzerName jetzt drehen kann), bestand (etwas, das sich füllt oder leert),
  fluss (eine Bewegung: Umsatz, Ausgaben), risiko, ziel, person. Genau EIN Knoten ist "hebel".
  "wert" nur, wenn im Text eine Zahl oder ein Datum dazu steht (mit Stichtag, z. B. „68.829 € (31.08.)"),
  hoechstens 30 Zeichen, nie mitten in einer Zahl abbrechen. "warum" ist ein Satz: was diese Größe hier bedeutet.
- "wirkungen": 3 bis 8 Pfeile zwischen den Knoten. "art": "plus" = mehr davon führt zu mehr,
  "minus" = mehr davon führt zu weniger. "verzoegert": true, wenn die Wirkung erst später eintritt.
  "warum" ist der Beleg aus dem Text in einem halben Satz. Keine Wirkung ohne Beleg.
- "schleifen": nur, wenn im Bild wirklich ein Kreis liegt (Knoten in Reihenfolge, "art": verstaerkend
  oder daempfend, "name" = wie der Kreis heißt, z. B. „Warten macht das Warten leichter"). Sonst [].
- "kennzahlen": bis zu 4 Zahlen aus dem Text, wortwörtlich übernommen, mit Stand. Keine gerechneten.
  Steht keine Zahl im Text, dann [].
- "schluss": die Schlussfolgerung in EINEM Satz — was das Bild zeigt, nicht was zu tun ist.
- "frage": die Entscheidung, die jetzt ansteht, als Frage (aus dem Text, nicht neu erfunden).
- "zustimmung" und "ablehnung": die zwei Antworten auf diese Frage, wie $NutzerName sie sagen würde —
  konkret und höchstens 60 Zeichen („Ja — 5.000 € ab Oktober", „Nein — erst nach der Ausschüttung").
- "offen": was das Bild NICHT zeigt (fehlende Zahl, ungeklärte Frage) — ein halber Satz, sonst "".

Antworte NUR mit diesem JSON, ohne Erklärung, ohne Code-Zaun:
{"titel":"…","frage":"…","knoten":[{"id":"…","name":"…","art":"…","wert":"…","warum":"…"}],"wirkungen":[{"von":"…","nach":"…","art":"plus|minus","verzoegert":false,"warum":"…"}],"schleifen":[],"kennzahlen":[{"label":"…","wert":"…","stand":"…"}],"schluss":"…","hebel":"…","zustimmung":"…","ablehnung":"…","offen":""}
"@
}
# $in: { quelle, thema, text, kontext, fresh, nurCache }
function John-Systembild($in) {
  $quelle = ([string]$in.quelle).Trim().ToLowerInvariant()
  if ($script:SystembildQuellen -notcontains $quelle) { $quelle = 'chat' }
  $text = [string]$in.text
  if (-not $text -or $text.Trim().Length -lt 80) { return @{ ok = $false; error = 'KEIN_TEXT'; hint = 'Zu wenig Text für ein Wirkungsbild.' } }
  $thema = Limit-Wort $in.thema 120; if (-not $thema) { $thema = '(ohne Thema)' }
  $key = Get-SystembildSchluessel $quelle $text
  $s = Read-Systembilder
  if (-not [bool]$in.fresh -and $s.bilder.ContainsKey($key)) {
    $c = $s.bilder[$key]
    return @{ ok = $true; key = $key; quelle = $quelle; thema = [string]$c.thema; bild = $c.bild
              model = [string]$c.model; erzeugt = [string]$c.erzeugt; cache = $true }
  }
  if ([bool]$in.nurCache) { return @{ ok = $true; key = $key; quelle = $quelle; bild = $null; kalt = $true } }
  $auftrag = Build-SystembildAuftrag $thema $text ([string]$in.kontext)
  $t0 = Get-Date
  Write-Host ("[{0}] Systembild ({1}): {2}" -f (Get-Date -Format 'HH:mm:ss'), $quelle, $thema)
  $roh = ''; $modell = ''
  $backend = Get-Backend
  if ($backend -eq 'cli') {
    $c = Invoke-ClaudeCli $script:SystembildSystem $auftrag @{ tools = $false; maxTurns = 1; effort = 'low'; timeout = 240 }
    $roh = ([string]$c.text).Trim(); $modell = [string]$c.model
  } elseif ($backend -eq 'openai') {
    $c = John-TextOpenAI @{ text = $script:SystembildSystem } $auftrag
    $roh = ([string]$c.text).Trim(); $modell = [string]$c.model
  } else {
    $apiKey = Get-ApiKey
    if (-not $apiKey) { throw 'NO_KEY' }
    $body = @{ model = $Model; max_tokens = 2000; system = @(@{ type = 'text'; text = $script:SystembildSystem })
               messages = @(@{ role = 'user'; content = $auftrag }); output_config = @{ effort = 'low' }; fallbacks = 'default' }
    $r = Call-Claude $apiKey $body
    if ($r.stop_reason -eq 'refusal') { return @{ ok = $false; error = 'REFUSAL'; hint = 'Sicherheitsfilter — später noch einmal.' } }
    $roh = (($r.content | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join "`n").Trim()
    $modell = [string]$r.model
  }
  $a = $roh.IndexOf('{'); $z = $roh.LastIndexOf('}')
  if ($a -lt 0 -or $z -le $a) { return @{ ok = $false; error = 'KEIN_JSON'; hint = 'Kein JSON zurückbekommen.' } }
  $o = $null
  try { $o = $roh.Substring($a, $z - $a + 1) | ConvertFrom-Json } catch { return @{ ok = $false; error = 'JSON_KAPUTT'; hint = $_.Exception.Message } }
  $bild = Test-Systembild $o
  $dauer = [int]((Get-Date) - $t0).TotalSeconds
  if (-not $bild) {
    Write-Host ("  Systembild verworfen (zu dünn oder unstimmig), {0} s" -f $dauer) -ForegroundColor DarkYellow
    return @{ ok = $false; error = 'ZU_DUENN'; hint = 'Aus diesem Text lässt sich kein belastbares Wirkungsbild ziehen.' }
  }
  $eintrag = @{ erzeugt = (Get-Date).ToString('o'); quelle = $quelle; thema = $thema; bild = $bild; model = $modell }
  $s.bilder[$key] = $eintrag
  Save-Systembilder
  Write-Host ("  Systembild: {0} Knoten, {1} Wirkungen, {2} s" -f $bild.knoten.Count, $bild.wirkungen.Count, $dauer) -ForegroundColor Green
  return @{ ok = $true; key = $key; quelle = $quelle; thema = $thema; bild = $bild; model = $modell
            erzeugt = $eintrag.erzeugt; cache = $false; dauer = $dauer }
}
