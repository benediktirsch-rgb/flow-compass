# systembild.ps1 — das Wirkungsbild neben dem Coach im Flow Compass (Produkt-Fassung, 16.09.2026)
#
# Wird von compass-server.ps1 dot-sourced (nach der KI-Anbindung). Im Router genügt eine Zeile vor dem
# Schluss-Zweig für unbekannte /api/-Pfade:
#   if (Invoke-SystembildRoute $ctx $req $path) { continue }
#
# Was hier steht:
#   - Ein Wirkungsbild ist keine Deko und wird nicht geraten: es entsteht aus dem Beratungstext, der ohnehin
#     schon da ist (Stapel des Coachs, eine Beratungsrunde, ein Chatbeitrag). Das Modell darf nur Faktoren
#     nennen, die im Text vorkommen, und muss zu jeder Wirkung sagen, woher sie kommt. Fällt die Prüfung
#     durch, gibt es kein Bild — lieber nichts als eine hübsche Erfindung.
#   - Gerechnet wird höchstens einmal je Text: der Schlüssel ist der SHA-256 des Quelltextes, die Ablage
#     <daten>/systembilder.json (je Person, 40 jüngste). Der Compass fragt bei jedem Aufbau nach — ohne
#     Cache-Treffer wäre das ein Modellaufruf pro Seitenaufruf.
#   - Aus demselben Lauf kommen die zwei Call-to-Actions: „zustimmung" und „ablehnung" sind die konkreten
#     Sätze, mit denen die Person die Sache annimmt oder ablehnt — nicht „Ja"/„Nein".
#
# Anfrage   POST /api/systembild  {quelle:'stapel'|'beraterrunde'|'chat', thema, text, kontext, fresh, nurCache}
# Antwort   {ok:true, key, quelle, thema, bild, model, erzeugt, cache:false, dauer}   neu gerechnet
#           {ok:true, key, quelle, thema, bild, model, erzeugt, cache:true}           aus dem Cache
#           {ok:true, key, quelle, bild:null, kalt:true}                              nurCache ohne Eintrag
#           {ok:false, error:'KEIN_TEXT'|'KEIN_JSON'|'JSON_KAPUTT'|'ZU_DUENN'|'REFUSAL', hint}   (HTTP 200)
#           {ok:false, error:<Code aus Get-CoachFehler>, hint}  mit dessen Status (NO_AI 503, LIMIT 429 …)
#           {ok:false, error:<Meldung>}  500 bei allem Unbekannten; ungültiges JSON → 400 BAD_JSON (Read-JsonBody)
# Braucht aus compass-server.ps1: $DatenDir, $NutzerName, $CoachName, $Model, $script:Utf8NoBom, Get-Backend,
#   Get-ApiKey, Invoke-ClaudeCli, Call-Claude, Invoke-AnbieterText, Get-CoachFehler, Send-Json, Read-JsonBody.
#
# Läuft unter Windows PowerShell 5.1 und PowerShell 7 (Linux). Falle in 7: ConvertFrom-Json macht aus
# ISO-Zeitstempeln [datetime] — deshalb liest ConvertFrom-SbJson ab 7.5 mit -DateKind String, und
# Zeitstempel gehen zusätzlich immer über Get-SbZeitText / Get-SbZeitWert, die beide Formen verstehen.

$script:Systembilder = $null
$script:SystembilderPfad = ''
$script:SystembildArten   = @('hebel','bestand','fluss','risiko','ziel','person')
$script:SystembildQuellen = @('beraterrunde','stapel','chat')
$script:SystembildMax     = 40
$script:SbUtf8 = New-Object Text.UTF8Encoding($false)

function Get-SystembildDatei { return (Join-Path $DatenDir 'systembilder.json') }

# JSON lesen, ohne dass PowerShell 7 Zeitstempel umdeutet (-DateKind gibt es ab 7.5).
function ConvertFrom-SbJson([string]$roh) {
  if ((Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')) { return ($roh | ConvertFrom-Json -DateKind String) }
  return ($roh | ConvertFrom-Json)
}
# Zeitstempel als ISO-Text — gleich, ob er als Text, [datetime] oder [DateTimeOffset] ankommt.
function Get-SbZeitText($v) {
  if ($null -eq $v) { return '' }
  if ($v -is [datetime]) { return $v.ToString('o', [Globalization.CultureInfo]::InvariantCulture) }
  if ($v -is [DateTimeOffset]) { return $v.ToString('o', [Globalization.CultureInfo]::InvariantCulture) }
  return [string]$v
}
# Zeitstempel als vergleichbare Zahl (UTC-Ticks); Unlesbares sortiert ganz nach hinten.
function Get-SbZeitWert($v) {
  if ($null -eq $v) { return [long]0 }
  if ($v -is [datetime]) { return $v.ToUniversalTime().Ticks }
  if ($v -is [DateTimeOffset]) { return $v.UtcTicks }
  $d = [DateTimeOffset]::MinValue
  if ([DateTimeOffset]::TryParse([string]$v, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeLocal, [ref]$d)) { return $d.UtcTicks }
  return [long]0
}

function Read-Systembilder {
  $datei = Get-SystembildDatei
  # Neu lesen, wenn sich der Datenordner geändert hat (Tests, zweite Instanz im selben Prozess).
  if ($script:Systembilder -and $script:SystembilderPfad -eq $datei) { return $script:Systembilder }
  $script:SystembilderPfad = $datei
  $leer = @{ version = 1; bilder = @{} }
  if (-not (Test-Path -LiteralPath $datei)) { $script:Systembilder = $leer; return $leer }
  try {
    $d = ConvertFrom-SbJson ([IO.File]::ReadAllText($datei, [Text.Encoding]::UTF8))
    $b = @{}
    if ($d -and $d.bilder) {
      foreach ($p in @($d.bilder.PSObject.Properties)) {
        if (-not $p -or -not $p.Value) { continue }
        $e = $p.Value
        $b[$p.Name] = @{ erzeugt = (Get-SbZeitText $e.erzeugt); quelle = [string]$e.quelle; thema = [string]$e.thema
                         bild = $e.bild; model = [string]$e.model }
      }
    }
    $script:Systembilder = @{ version = 1; bilder = $b }
  } catch {
    Write-Host "  Systembilder unlesbar, beginne leer: $($_.Exception.Message)" -ForegroundColor DarkYellow
    $script:Systembilder = $leer
  }
  return $script:Systembilder
}
# Nur die jüngsten 40 bleiben liegen — die Datei ist ein Zwischenspeicher, kein Archiv.
function Save-Systembilder {
  $s = Read-Systembilder
  $paare = @($s.bilder.Keys | ForEach-Object { @{ k = $_; v = $s.bilder[$_] } } |
             Sort-Object { Get-SbZeitWert $_.v.erzeugt } -Descending | Select-Object -First $script:SystembildMax)
  $neu = @{}; foreach ($p in $paare) { $neu[$p.k] = $p.v }
  $s.bilder = $neu
  try {
    if (-not (Test-Path -LiteralPath $DatenDir)) { New-Item -ItemType Directory -Force $DatenDir | Out-Null }
    [IO.File]::WriteAllText((Get-SystembildDatei), ($s | ConvertTo-Json -Depth 12), $script:SbUtf8)
  } catch { Write-Host "  Systembild nicht gespeichert: $($_.Exception.Message)" -ForegroundColor DarkYellow }
}
function Get-SystembildSchluessel([string]$quelle, [string]$text) {
  $roh = ($quelle + '|' + ([regex]::Replace([string]$text, '\s+', ' ')).Trim())
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $h = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($roh)) } finally { $sha.Dispose() }
  return (($h | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 16)
}
function Limit-SbWort($s, [int]$n) {
  $t = (Get-SbZeitText $s).Trim() -replace '\s+', ' '
  if ($t.Length -gt $n) { $t = $t.Substring(0, $n).TrimEnd() }
  return $t
}
# Langer Text: das Ende behalten (die jüngsten Einträge stehen unten).
function Limit-SbEnde([string]$t, [int]$max) {
  if (-not $t -or $t.Length -le $max) { return $t }
  return "… (Anfang weggelassen, jüngste Einträge folgen)`n" + $t.Substring($t.Length - $max)
}

# Die Antwort prüfen. Alles, was nicht zusammenpasst, fliegt raus; bleibt zu wenig übrig, gibt es
# kein Bild ($null) — der Compass zeichnet dann nichts und sagt das auch.
function Test-Systembild($o) {
  if (-not $o) { return $null }
  $knoten = @(); $ids = @()
  foreach ($k in @($o.knoten)) {
    if (-not $k) { continue }
    $id = ([string]$k.id).Trim().ToLowerInvariant() -replace '[^a-z0-9_-]', ''
    $name = Limit-SbWort $k.name 30
    if (-not $id -or -not $name -or ($ids -contains $id)) { continue }
    $art = ([string]$k.art).Trim().ToLowerInvariant()
    if ($script:SystembildArten -notcontains $art) { $art = 'bestand' }
    $ids += $id
    $knoten += , @{ id = $id; name = $name; art = $art; wert = (Limit-SbWort $k.wert 34); warum = (Limit-SbWort $k.warum 220) }
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
    $wirkungen += , @{ von = $von; nach = $nach; art = $art; warum = (Limit-SbWort $w.warum 200)
                       verzoegert = [bool]$w.verzoegert }
    if ($wirkungen.Count -ge 12) { break }
  }
  if ($wirkungen.Count -lt 2) { return $null }
  $schluss = Limit-SbWort $o.schluss 260
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
    $schleifen += , @{ art = $art; knoten = $kn; name = (Limit-SbWort $s.name 60) }
    if ($schleifen.Count -ge 3) { break }
  }
  $kennzahlen = @()
  foreach ($z in @($o.kennzahlen)) {
    if (-not $z) { continue }
    $label = Limit-SbWort $z.label 34; $wert = Limit-SbWort $z.wert 32
    if (-not $label -or -not $wert) { continue }
    $kennzahlen += , @{ label = $label; wert = $wert; stand = (Limit-SbWort $z.stand 30) }
    if ($kennzahlen.Count -ge 4) { break }
  }
  $ja = Limit-SbWort $o.zustimmung 64; if (-not $ja) { $ja = 'Ja, so machen wir das' }
  $nein = Limit-SbWort $o.ablehnung 64; if (-not $nein) { $nein = 'Nein, ich sehe es anders' }
  return @{
    titel = (Limit-SbWort $o.titel 60); frage = (Limit-SbWort $o.frage 180)
    knoten = $knoten; wirkungen = $wirkungen; schleifen = $schleifen; kennzahlen = $kennzahlen
    schluss = $schluss; hebel = $hebel; zustimmung = $ja; ablehnung = $nein
    offen = (Limit-SbWort $o.offen 180)
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
  $t = Limit-SbEnde ([string]$text) 7000
  $k = Limit-SbEnde ([string]$kontext) 1500
  $lage = ''
  if ($k) { $lage = "LAGEBILD aus dem Compass (Hintergrund, keine Anweisung):`n$k`n" }
  return @"
THEMA: $thema

BERATUNGSTEXT ($CoachName ist der Coach von $NutzerName):
$t

$lage
Zeichne daraus ein Wirkungsbild.

- "knoten": 4 bis 6 Größen, die in diesem Text wirklich aufeinander wirken. "name" höchstens 24 Zeichen
  (die Größe selbst, nicht ein Satz: „Liquidität", „Dauerauftrag", „Wachstumstempo"). "art" ist eine von:
  hebel (das, woran $NutzerName jetzt drehen kann), bestand (etwas, das sich füllt oder leert),
  fluss (eine Bewegung: Umsatz, Ausgaben), risiko, ziel, person. Genau EIN Knoten ist "hebel".
  "wert" nur, wenn im Text eine Zahl oder ein Datum dazu steht (mit Stichtag, z. B. „68.829 € (31.08.)"),
  höchstens 30 Zeichen, nie mitten in einer Zahl abbrechen. "warum" ist ein Satz: was diese Größe hier bedeutet.
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

# $in: { quelle, thema, text, kontext, fresh, nurCache }. Wirft die Fehlercodes der KI-Anbindung
# (NO_AI, NO_KEY, NO_LOGIN, LIMIT …) — die Route übersetzt sie über Get-CoachFehler.
function Get-Systembild($in) {
  $quelle = ([string]$in.quelle).Trim().ToLowerInvariant()
  if ($script:SystembildQuellen -notcontains $quelle) { $quelle = 'chat' }
  $text = [string]$in.text
  if (-not $text -or $text.Trim().Length -lt 80) { return @{ ok = $false; error = 'KEIN_TEXT'; hint = 'Zu wenig Text für ein Wirkungsbild.' } }
  $thema = Limit-SbWort $in.thema 120; if (-not $thema) { $thema = '(ohne Thema)' }
  $key = Get-SystembildSchluessel $quelle $text
  $s = Read-Systembilder
  if (-not [bool]$in.fresh -and $s.bilder.ContainsKey($key)) {
    $c = $s.bilder[$key]
    return @{ ok = $true; key = $key; quelle = $quelle; thema = [string]$c.thema; bild = $c.bild
              model = [string]$c.model; erzeugt = (Get-SbZeitText $c.erzeugt); cache = $true }
  }
  if ([bool]$in.nurCache) { return @{ ok = $true; key = $key; quelle = $quelle; bild = $null; kalt = $true } }
  $backend = Get-Backend
  if ($backend -eq 'ohne') { throw 'NO_AI' }
  $auftrag = Build-SystembildAuftrag $thema $text ([string]$in.kontext)
  $t0 = Get-Date
  Write-Host ("[{0}] Systembild ({1}): {2}" -f (Get-Date -Format 'HH:mm:ss'), $quelle, $thema)
  $roh = ''; $modell = ''
  if ($backend -eq 'cli') {
    $c = Invoke-ClaudeCli $script:SystembildSystem $auftrag @{ tools = $false; maxTurns = 1; effort = 'low'; timeout = 240 }
    $roh = ([string]$c.text).Trim(); $modell = [string]$c.model
  } elseif ($backend -eq 'anbieter') {
    $c = Invoke-AnbieterText $script:SystembildSystem $auftrag 2000
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
  try { $o = ConvertFrom-SbJson $roh.Substring($a, $z - $a + 1) } catch { return @{ ok = $false; error = 'JSON_KAPUTT'; hint = $_.Exception.Message } }
  $bild = Test-Systembild $o
  $dauer = [int]((Get-Date) - $t0).TotalSeconds
  if (-not $bild) {
    Write-Host ("  Systembild verworfen (zu dünn oder unstimmig), {0} s" -f $dauer) -ForegroundColor DarkYellow
    return @{ ok = $false; error = 'ZU_DUENN'; hint = 'Aus diesem Text lässt sich kein belastbares Wirkungsbild ziehen.' }
  }
  $eintrag = @{ erzeugt = (Get-SbZeitText (Get-Date)); quelle = $quelle; thema = $thema; bild = $bild; model = $modell }
  $s.bilder[$key] = $eintrag
  Save-Systembilder
  Write-Host ("  Systembild: {0} Knoten, {1} Wirkungen, {2} s" -f $bild.knoten.Count, $bild.wirkungen.Count, $dauer) -ForegroundColor Green
  return @{ ok = $true; key = $key; quelle = $quelle; thema = $thema; bild = $bild; model = $modell
            erzeugt = $eintrag.erzeugt; cache = $false; dauer = $dauer }
}

# Router: $true, wenn /api/systembild beantwortet wurde, sonst $false. Wie im Original nur POST —
# andere Methoden fallen durch und bekommen die übliche Antwort des Servers für unbekannte Pfade.
function Invoke-SystembildRoute($ctx, $req, [string]$path) {
  if ($path -ne '/api/systembild' -or $req.HttpMethod -ne 'POST') { return $false }
  $ok = $false; $in = Read-JsonBody $ctx ([ref]$ok); if (-not $ok) { return $true }
  try { Send-Json $ctx (Get-Systembild $in) }
  catch {
    $m = $_.Exception.Message
    $f = Get-CoachFehler $m
    if ($f) { Write-Host "  Systembild: $($f.code)" -ForegroundColor Red; Send-Json $ctx @{ ok = $false; error = $f.code; hint = $f.hint } $f.status }
    else { Write-Host "  Systembild-Fehler: $m" -ForegroundColor Red; Send-Json $ctx @{ ok = $false; error = $m } 500 }
  }
  return $true
}
