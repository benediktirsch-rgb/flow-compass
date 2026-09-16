# ausgabe.ps1 — die Erfolgs-Ausgabe für den Compass-Server (16.09.2026)
#
#   Wird von compass-server.ps1 per Dot-Source geladen (nach $DatenDir, nach firmen-daten.ps1). Liefert:
#     GET  /api/ausgabe[?fresh=1]   was gerade gilt, sofort und ohne Modell: die redigierte Ausgabe oder den Entwurf
#     POST /api/ausgabe {fresh}     die Redaktion — ein Modellaufruf (10–40 s), einmal je Ausgabe
#   Router: Invoke-AusgabeRoute $ctx $req $path → $true, wenn beantwortet.
#
#   Die Folie „Anerkennung“ im Kompass-Kino (compass-ausgabe.js) wird zu einem Boulevardblatt mit Morgen- und
#   Abendausgabe. Gedruckt wird nur Belegtes:
#     - Rituale und Entscheidungen aus $DatenDir/checkins/*.json (dieselbe Entscheidung steht oft in zwei Dateien)
#     - erledigte Jira-Vorgänge der Person (Get-JiraKpi › zuletzt)
#     - Firmensicht, nur wenn firmen-daten.ps1 geladen ist: eigene Finanz-Stimmen und neu einige Entscheidungen im
#       Zeitfenster, Pool-Bewegungen (nur Stufe und Rolle, nie ein Personenname), Website-Aufrufe gestern,
#       Summen aus dem Tower.
#   Jede Quelle darf ausfallen; welche fehlt, steht in der Antwort unter `fehlt`. Git-Commits gibt es hier nicht —
#   die Person hat keine Repositorien auf diesem Server.
#
#   Zwei Ausgaben am Tag: Morgenausgabe (04–16 Uhr, Zeitraum ab gestern 04:00, montags ab Freitag) und
#   Abendausgabe (ab 16 Uhr, Zeitraum heute ab 04:00). Samstag und Sonntag: Wochenendausgabe (ab Montag).
#   Ohne Modell steht trotzdem eine Ausgabe da (New-AusgabeEntwurf). Der Modellaufruf passiert nur auf POST,
#   einmal je Ausgabe (Cache $DatenDir/ausgaben.json) und noch einmal, wenn seither deutlich mehr passiert ist.
#   Test-Ausgabe wirft Meldungen ohne Beleg und jede unbelegte Zahl raus; steckt eine unbelegte Zahl in der
#   Schlagzeile, gilt die ganze Ausgabe als verworfen und der Entwurf bleibt.
#
#   Läuft unter Windows PowerShell 5.1 und pwsh 7. Falle: pwsh 7 macht beim JSON-Lesen aus ISO-Zeitstempeln
#   sofort [datetime]; [string] ergibt dann US-Form. Jeder Zeitstempel geht deshalb durch ConvertTo-AusgabeZeit.
#
#   Braucht aus compass-server.ps1: $DatenDir, $NutzerName, ($NutzerFehlt), $Model, $script:Utf8NoBom, Get-Backend,
#   Get-ApiKey, Invoke-ClaudeCli, Call-Claude, Invoke-AnbieterText, Get-CoachFehler, Get-JiraKpi, Send-Json,
#   Read-JsonBody. Optional ($FirmaGeladen): Get-Finanzen, Get-Pool, Get-Traffic, Get-Tower, $script:PoolStufen.

$script:Ausgaben = $null
$script:AusgabeFaktenCache = @{ key = ''; zeit = $null; out = $null }
if (-not $script:Utf8NoBom) { $script:Utf8NoBom = New-Object Text.UTF8Encoding($false) }

function Get-AusgabeDatei { return (Join-Path $DatenDir 'ausgaben.json') }

function Get-AusgabeKurz([string]$s, [int]$n) {
  $t = ([string]$s).Trim() -replace '\s+', ' '
  if ($t.Length -gt $n) { $t = $t.Substring(0, $n - 1).TrimEnd() + '…' }
  return $t
}

# Zeitstempel lesen, egal in welcher Form er ankommt: [datetime] (pwsh 7 nach ConvertFrom-Json), ISO-Text mit
# oder ohne Zone, „yyyy-MM-dd HH:mm“ (Checkins), die US-Form, die [string] aus einem [datetime] macht, oder
# deutsche Schreibweise. Ergebnis ist Ortszeit oder $null — nie eine Ausnahme.
function ConvertTo-AusgabeZeit($x) {
  if ($null -eq $x) { return $null }
  if ($x -is [datetime]) { if ($x.Kind -eq [DateTimeKind]::Utc) { return $x.ToLocalTime() }; return $x }
  if ($x -is [DateTimeOffset]) { return $x.LocalDateTime }
  $s = ([string]$x).Trim()
  if (-not $s) { return $null }
  $inv = [Globalization.CultureInfo]::InvariantCulture
  $lokal = [Globalization.DateTimeStyles]::AssumeLocal
  if ($s -match '(Z|[+-]\d{2}:?\d{2})$' -and $s -match '^\d{4}-') {
    $o = [DateTimeOffset]::MinValue
    if ([DateTimeOffset]::TryParse($s, $inv, $lokal, [ref]$o)) { return $o.LocalDateTime }
  }
  $d = [datetime]::MinValue
  $formate = [string[]]@('yyyy-MM-dd HH:mm', 'yyyy-MM-dd HH:mm:ss', 'yyyy-MM-ddTHH:mm', 'yyyy-MM-ddTHH:mm:ss',
                         'yyyy-MM-ddTHH:mm:ss.FFFFFFF', 'yyyy-MM-dd', 'dd.MM.yyyy HH:mm', 'dd.MM.yyyy HH:mm:ss', 'dd.MM.yyyy')
  if ([datetime]::TryParseExact($s, $formate, $inv, $lokal, [ref]$d)) { return $d }
  if ([datetime]::TryParse($s, $inv, $lokal, [ref]$d)) { return $d }
  if ([datetime]::TryParse($s, [Globalization.CultureInfo]::CurrentCulture, $lokal, [ref]$d)) { return $d }
  return $null
}

# Einträge eines Objekts, das eine Hashtable oder ein PSCustomObject sein kann (Stimmen je Name).
function Get-AusgabePaare($o) {
  $raus = @()
  if ($null -eq $o) { return $raus }
  if ($o -is [Collections.IDictionary]) { foreach ($k in @($o.Keys)) { $raus += , @{ name = [string]$k; wert = $o[$k] } } }
  else { foreach ($p in @($o.PSObject.Properties)) { if ($p) { $raus += , @{ name = [string]$p.Name; wert = $p.Value } } } }
  return $raus
}
function Get-AusgabeWert($o, [string]$name) {
  if ($null -eq $o) { return $null }
  if ($o -is [Collections.IDictionary]) { if ($o.Contains($name)) { return $o[$name] }; return $null }
  $p = $o.PSObject.Properties[$name]
  if ($p) { return $p.Value }
  return $null
}

# Welche Ausgabe gilt jetzt, und welchen Zeitraum deckt sie ab?
function Get-AusgabeLage([datetime]$jetzt) {
  $h = $jetzt.Hour
  if ($h -lt 4) { $tag = $jetzt.Date.AddDays(-1); $art = 'abend' }
  elseif ($h -lt 16) { $tag = $jetzt.Date; $art = 'morgen' }
  else { $tag = $jetzt.Date; $art = 'abend' }
  $wt = [int]$tag.DayOfWeek
  $wochenende = ($wt -eq 0 -or $wt -eq 6)
  if ($wochenende) {
    $von = $tag.AddDays(-(($wt + 6) % 7)).AddHours(4)                 # Montag dieser Woche, 04:00
    $name = 'Wochenendausgabe'; $zeitraum = 'diese Woche'
  } elseif ($art -eq 'morgen') {
    $zurueck = $(if ($wt -eq 1) { 3 } else { 1 })                      # Montag früh: ab Freitag
    $von = $tag.AddDays(-$zurueck).AddHours(4)
    $name = 'Morgenausgabe'; $zeitraum = $(if ($wt -eq 1) { 'seit Freitag' } else { 'seit gestern früh' })
  } else {
    $von = $tag.AddHours(4)
    $name = 'Abendausgabe'; $zeitraum = 'heute'
  }
  $wtage = @('So','Mo','Di','Mi','Do','Fr','Sa')
  return @{ key = ($tag.ToString('yyyy-MM-dd') + '-' + $art); art = $art; name = $name; wochenende = $wochenende
            tag = $tag.ToString('yyyy-MM-dd'); datum = ($wtage[$wt] + ' ' + $tag.ToString('dd.MM.yyyy'))
            von = $von.ToString('o'); vonDt = $von; zeitraum = $zeitraum }
}

# ---------- Fakten ----------
function Get-AusgabeCheckins([datetime]$von) {
  $out = @{ ok = $true; entscheidungen = @(); rituale = @(); bilanz = @() }
  # Dieselbe Entscheidung steht oft in zwei Dateien (Rückfragen-Runde und danach im Abendcheck) — einmal zählen.
  $gesehen = New-Object 'System.Collections.Generic.HashSet[string]'
  $dir = Join-Path $DatenDir 'checkins'
  if (-not (Test-Path -LiteralPath $dir)) { $out.ok = $false; return $out }
  foreach ($f in @(Get-ChildItem -LiteralPath $dir -Filter '*.json' -File -ErrorAction SilentlyContinue | Sort-Object Name)) {
    if ($f.Name -notmatch '^(\d{4}-\d{2}-\d{2})-([a-z]+)\.json$') { continue }
    $art = $Matches[2]
    $d = [datetime]::MinValue
    if (-not [datetime]::TryParseExact($Matches[1], 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$d)) { continue }
    if ($d -lt $von.Date) { continue }
    $j = $null
    try { $j = [IO.File]::ReadAllText($f.FullName, $script:Utf8NoBom) | ConvertFrom-Json } catch { continue }
    if (-not $j) { continue }
    $empf = ConvertTo-AusgabeZeit (Get-AusgabeWert $j 'empfangen')
    if (-not $empf) { $empf = $f.LastWriteTime }
    if ($empf -lt $von) { continue }
    $out.rituale += , @{ art = $art; titel = [string](Get-AusgabeWert $j 'titel'); wann = $empf }
    foreach ($e in @(Get-AusgabeWert $j 'entschieden')) {
      if (-not $e) { continue }
      $fr = [string](Get-AusgabeWert $e 'frage'); $an = [string](Get-AusgabeWert $e 'antwort')
      if ($an -and $gesehen.Add(($fr + '|' + $an))) {
        $out.entscheidungen += , @{ frage = (Get-AusgabeKurz $fr 150); antwort = (Get-AusgabeKurz $an 110); wann = $empf }
      }
    }
    $antw = Get-AusgabeWert $j 'antworten'
    $bil = [string](Get-AusgabeWert $antw 'bilanz')
    if ($art -eq 'abend' -and $bil) { $out.bilanz += , (Get-AusgabeKurz $bil 140) }
  }
  return $out
}

function Get-AusgabeJira([datetime]$von) {
  $k = $null
  try { $k = Get-JiraKpi $false }
  catch {
    $m = [string]$_.Exception.Message
    $grund = $(if ($m -eq 'NO_KEY' -or $m -eq 'NO_SITE') { 'nicht angebunden' } elseif ($m -eq 'AUTH_INVALID') { 'Token abgelehnt' } else { 'nicht erreichbar' })
    return @{ ok = $false; grund = $grund; liste = @(); mehr = $false }
  }
  $liste = @()
  $jahr = [datetime]::Now.Year
  foreach ($i in @(Get-AusgabeWert $k 'zuletzt')) {
    if (-not $i) { continue }
    $roh = Get-AusgabeWert $i 'erledigt'
    $w = $null
    if ($roh -is [datetime]) { $w = ConvertTo-AusgabeZeit $roh }
    else {
      $d = [datetime]::MinValue
      if ([datetime]::TryParseExact(("$roh" + " $jahr"), 'dd.MM. HH:mm yyyy', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeLocal, [ref]$d)) { $w = $d }
      else { $w = ConvertTo-AusgabeZeit $roh }
    }
    if ($w -and $w -gt (Get-Date).AddDays(1)) { $w = $w.AddYears(-1) }   # Jahreswechsel
    if ($w -and $w -ge $von) {
      $liste += , @{ key = [string](Get-AusgabeWert $i 'key'); titel = (Get-AusgabeKurz (Get-AusgabeWert $i 'titel') 110); wann = $w }
    }
  }
  # `zuletzt` hält höchstens acht — stehen alle acht im Zeitraum, waren es womöglich mehr.
  return @{ ok = $true; grund = ''; liste = $liste; mehr = ($liste.Count -ge 8) }
}

# Firmensicht: nur Belegtes im Zeitfenster, nur Summen und Titel. Jeder Teil darf einzeln ausfallen.
function Get-AusgabeFirma([datetime]$von) {
  $out = @{ an = $false; fehlt = @(); stimmen = @(); einig = @(); pool = @(); aufrufe = $null; tower = $null }
  if (-not (Get-Variable -Name FirmaGeladen -ValueOnly -ErrorAction SilentlyContinue)) { return $out }
  $out.an = $true
  $bis = (Get-Date).AddMinutes(5)

  # Finanzen: eigene Stimmen im Fenster, und Entscheidungen, die im Fenster einig geworden sind.
  if (Get-Command Get-Finanzen -ErrorAction SilentlyContinue) {
    $fin = $null
    try { $fin = Get-Finanzen $false } catch { $fin = $null }
    if ($fin -and (Get-AusgabeWert $fin 'ok')) {
      $ich = [string](Get-AusgabeWert $fin 'ich')
      foreach ($e in @(Get-AusgabeWert $fin 'entscheidungen')) {
        if (-not $e) { continue }
        $id = [string](Get-AusgabeWert $e 'id'); $titel = Get-AusgabeKurz (Get-AusgabeWert $e 'titel') 90
        $opt = @(Get-AusgabeWert $e 'optionen')
        $juengste = $null; $alleHaben = $true; $n = 0
        foreach ($p in @(Get-AusgabePaare (Get-AusgabeWert $e 'stimmen'))) {
          $n++
          $wahl = Get-AusgabeWert $p.wert 'wahl'
          $zeit = ConvertTo-AusgabeZeit (Get-AusgabeWert $p.wert 'zeit')
          if ($null -eq $wahl -or "$wahl" -eq '') { $alleHaben = $false; continue }
          if ($zeit -and ($null -eq $juengste -or $zeit -gt $juengste)) { $juengste = $zeit }
          if ($ich -and $p.name -eq $ich -and $zeit -and $zeit -ge $von -and $zeit -le $bis) {
            $wText = [string]$wahl; $wi = 0
            if ([int]::TryParse([string]$wahl, [ref]$wi) -and $wi -ge 0 -and $wi -lt $opt.Count) { $wText = [string]$opt[$wi] }
            $out.stimmen += , @{ id = $id; titel = $titel; wahl = (Get-AusgabeKurz $wText 80); wann = $zeit }
          }
        }
        if ((Get-AusgabeWert $e 'einig') -and $alleHaben -and $n -gt 0 -and $juengste -and $juengste -ge $von -and $juengste -le $bis) {
          $out.einig += , @{ id = $id; titel = $titel; wann = $juengste }
        }
      }
    } else { $out.fehlt += 'Finanzen' }
  }

  # Pool: Vorgänge, die im Fenster bewegt wurden — Stufe und Rolle, nie der Name.
  if (Get-Command Get-Pool -ErrorAction SilentlyContinue) {
    $pl = $null
    try { $pl = Get-Pool $false } catch { $pl = $null }
    if ($pl -and (Get-AusgabeWert $pl 'ok')) {
      $stufen = Get-Variable -Scope Script -Name PoolStufen -ValueOnly -ErrorAction SilentlyContinue
      foreach ($b in @(Get-AusgabeWert $pl 'offen')) {
        if (-not $b) { continue }
        $g = ConvertTo-AusgabeZeit (Get-AusgabeWert $b 'geaendert')
        if (-not $g -or $g -lt $von -or $g -gt $bis) { continue }
        $art = [string](Get-AusgabeWert $b 'art'); $st = [string](Get-AusgabeWert $b 'status')
        $stText = $st
        if ($stufen -and $stufen.Contains($art) -and $stufen[$art].Contains($st)) { $stText = [string]$stufen[$art][$st] }
        $out.pool += , @{ bahn = $(if ($art -eq 'einsatz') { 'Einsatz' } else { 'Kollektiv' }); stufe = $stText
                          rolle = (Get-AusgabeKurz (Get-AusgabeWert $b 'rolle') 60); wann = $g }
      }
    } else { $out.fehlt += 'Pool' }
  }

  # Website-Aufrufe gestern (ein voller Tag).
  if (Get-Command Get-Traffic -ErrorAction SilentlyContinue) {
    $tr = $null
    try { $tr = Get-Traffic $false } catch { $tr = $null }
    $t = Get-AusgabeWert $tr 'traffic'
    if ($tr -and (Get-AusgabeWert $tr 'ok') -and $t) {
      $n = Get-AusgabeWert $t 'aufrufe'
      if ($null -ne $n -and [int]$n -gt 0) {
        $tag = ConvertTo-AusgabeZeit (Get-AusgabeWert $t 'tag')
        $out.aufrufe = @{ n = [int]$n; tag = $(if ($tag) { $tag.ToString('dd.MM.') } else { '' }) }
      }
    } else { $out.fehlt += 'Website' }
  }

  # Tower: nur die Summen, und nur, wenn der Stand nicht älter als zwei Tage ist.
  if (Get-Command Get-Tower -ErrorAction SilentlyContinue) {
    $tw = $null
    try { $tw = Get-Tower $false } catch { $tw = $null }
    if ($tw -and (Get-AusgabeWert $tw 'ok')) {
      $alter = Get-AusgabeWert $tw 'alterStd'
      $p = Get-AusgabeWert $tw 'pool'
      if ($p -and ($null -eq $alter -or [double]$alter -le 48)) {
        $teile = @()
        $namen = [ordered]@{ pool = 'im Pool'; verfuegbar = 'verfügbar'; im_einsatz = 'im Einsatz'; angebote_90 = 'Angebote in 90 Tagen'; platziert_90 = 'Platzierungen in 90 Tagen' }
        foreach ($k in @($namen.Keys)) {
          $v = Get-AusgabeWert $p $k; $vi = 0
          if ($null -ne $v -and [int]::TryParse([string]$v, [ref]$vi) -and $vi -gt 0) { $teile += "$vi $($namen[$k])" }
        }
        if ($teile.Count) { $out.tower = @{ text = ($teile -join ', ') } }
      }
    } else { $out.fehlt += 'Tower' }
  }
  return $out
}

function Get-AusgabeFakten($lage, [bool]$fresh = $false) {
  $cc = $script:AusgabeFaktenCache
  if (-not $fresh -and $cc.out -and $cc.key -eq $lage.key -and ((Get-Date) - $cc.zeit).TotalSeconds -lt 300) { return $cc.out }
  $von = $lage.vonDt
  $fehlt = @()
  $ck = Get-AusgabeCheckins $von
  if (-not $ck.ok) { $fehlt += 'Checkins (noch keine abgelegt)' }
  $jira = Get-AusgabeJira $von
  if (-not $jira.ok) { $fehlt += "Jira ($($jira.grund))" }
  $firma = Get-AusgabeFirma $von
  foreach ($x in $firma.fehlt) { $fehlt += "$x (nicht erreichbar)" }

  $fakten = New-Object System.Collections.ArrayList
  $i = 0
  foreach ($x in $jira.liste) {
    $i++
    [void]$fakten.Add(@{ id = "j$i"; art = 'jira'; bereich = 'Jira'; text = "$($x.key) erledigt: $($x.titel)"; wann = $x.wann.ToString('dd.MM. HH:mm') })
  }
  $i = 0
  foreach ($e in ($ck.entscheidungen | Select-Object -First 12)) {
    $i++
    [void]$fakten.Add(@{ id = "e$i"; art = 'entscheidung'; bereich = 'Entscheidung'; text = "$($e.frage) → $($e.antwort)"; wann = $e.wann.ToString('dd.MM. HH:mm') })
  }
  $i = 0
  foreach ($s in ($firma.stimmen | Select-Object -First 8)) {
    $i++
    [void]$fakten.Add(@{ id = "s$i"; art = 'stimme'; bereich = 'Finanzen'; text = ('Eigene Stimme zu {0} „{1}“: {2}' -f $s.id, $s.titel, $s.wahl); wann = $s.wann.ToString('dd.MM. HH:mm') })
  }
  $i = 0
  foreach ($s in ($firma.einig | Select-Object -First 8)) {
    $i++
    [void]$fakten.Add(@{ id = "g$i"; art = 'einig'; bereich = 'Finanzen'; text = ('Geschäftsführung einig über {0} „{1}“' -f $s.id, $s.titel); wann = $s.wann.ToString('dd.MM. HH:mm') })
  }
  $i = 0
  foreach ($p in ($firma.pool | Sort-Object { $_.wann } -Descending | Select-Object -First 8)) {
    $i++
    $rolle = $(if ($p.rolle) { " (Rolle: $($p.rolle))" } else { '' })
    [void]$fakten.Add(@{ id = "p$i"; art = 'pool'; bereich = "Pool · $($p.bahn)"; text = ('Vorgang weiterbewegt, steht jetzt auf „{0}“{1}' -f $p.stufe, $rolle); wann = $p.wann.ToString('dd.MM. HH:mm') })
  }
  $i = 0
  foreach ($b in $ck.bilanz) { $i++; [void]$fakten.Add(@{ id = "b$i"; art = 'bilanz'; bereich = 'Abendcheck'; text = "Tagesbilanz in eigenen Worten: $b"; wann = '' }) }
  $rit = @($ck.rituale)
  if ($rit.Count) {
    $namen = @($rit | ForEach-Object { $_.titel } | Where-Object { $_ } | Select-Object -Unique)
    [void]$fakten.Add(@{ id = 'r1'; art = 'ritual'; bereich = 'Rhythmus'; text = ("$($rit.Count) Rituale abgeschlossen: " + ($namen -join ', ')); wann = '' })
  }
  if ($firma.aufrufe) {
    [void]$fakten.Add(@{ id = 'w1'; art = 'website'; bereich = 'Website'; text = "$($firma.aufrufe.n) Aufrufe der Website am $($firma.aufrufe.tag)"; wann = '' })
  }
  if ($firma.tower) {
    [void]$fakten.Add(@{ id = 't1'; art = 'tower'; bereich = 'Tower'; text = "Stand im Tower: $($firma.tower.text)"; wann = '' })
  }

  $zahlen = [ordered]@{
    jira = @($jira.liste).Count; entscheidungen = @($ck.entscheidungen).Count; checkins = $rit.Count
  }
  if ($firma.an) {
    $zahlen['stimmen'] = @($firma.stimmen).Count
    $zahlen['einig'] = @($firma.einig).Count
    $zahlen['pool'] = @($firma.pool).Count
    if ($firma.aufrufe) { $zahlen['aufrufe'] = $firma.aufrufe.n }
  }
  $gesamt = @($jira.liste).Count + @($ck.entscheidungen).Count + @($firma.stimmen).Count + @($firma.einig).Count + @($firma.pool).Count
  $out = @{ fakten = @($fakten); zahlen = $zahlen; gesamt = $gesamt; fehlt = @($fehlt)
            jiraMehr = [bool]$jira.mehr; jiraOk = [bool]$jira.ok; firma = [bool]$firma.an }
  $script:AusgabeFaktenCache = @{ key = $lage.key; zeit = Get-Date; out = $out }
  return $out
}

# ---------- Ablage ----------
function Read-Ausgaben {
  if ($script:Ausgaben) { return $script:Ausgaben }
  $leer = @{ version = 1; ausgaben = @{} }
  $datei = Get-AusgabeDatei
  if (-not (Test-Path -LiteralPath $datei)) { $script:Ausgaben = $leer; return $leer }
  try {
    $d = [IO.File]::ReadAllText($datei, $script:Utf8NoBom) | ConvertFrom-Json
    $a = @{}
    foreach ($p in @(Get-AusgabePaare (Get-AusgabeWert $d 'ausgaben'))) { if ($p.wert) { $a[$p.name] = $p.wert } }
    $script:Ausgaben = @{ version = 1; ausgaben = $a }
  } catch { $script:Ausgaben = $leer }
  return $script:Ausgaben
}
function Save-Ausgaben {
  $s = Read-Ausgaben
  $keys = @($s.ausgaben.Keys | Sort-Object -Descending | Select-Object -First 30)
  $neu = @{}; foreach ($k in $keys) { $neu[$k] = $s.ausgaben[$k] }
  $s.ausgaben = $neu
  try {
    if (-not (Test-Path -LiteralPath $DatenDir)) { New-Item -ItemType Directory -Force $DatenDir | Out-Null }
    [IO.File]::WriteAllText((Get-AusgabeDatei), ($s | ConvertTo-Json -Depth 12), $script:Utf8NoBom)
  } catch { Write-Host "  Ausgabe nicht gespeichert: $($_.Exception.Message)" -ForegroundColor DarkYellow }
}
function Get-AusgabeZuletzt([string]$ohneKey) {
  $s = Read-Ausgaben
  return @($s.ausgaben.Keys | Where-Object { $_ -ne $ohneKey } | Sort-Object -Descending | Select-Object -First 6 |
           ForEach-Object { [string](Get-AusgabeWert (Get-AusgabeWert $s.ausgaben[$_] 'ausgabe') 'schlagzeile') } | Where-Object { $_ })
}
# Erzeugt-Zeitpunkt eines Cache-Eintrags (pwsh 7 liefert [datetime], 5.1 Text) — als Alter in Minuten und als ISO.
function Get-AusgabeErzeugt($c) {
  $z = ConvertTo-AusgabeZeit (Get-AusgabeWert $c 'erzeugt')
  if (-not $z) { return @{ minuten = 0; iso = [string](Get-AusgabeWert $c 'erzeugt') } }
  return @{ minuten = ((Get-Date) - $z).TotalMinutes; iso = $z.ToString('o') }
}

# ---------- Entwurf ohne Modell ----------
# Feste Vorräte, gewählt über den Schlüssel der Ausgabe: jede Ausgabe sieht anders aus, dieselbe
# Ausgabe bleibt beim Neuladen gleich. {n} = Zahl der Erfolge, {W} = Zeitraum, {name} = Name der Person.
$script:AusgabeKoepfe = @(
  'WAHNSINN! {n} ERFOLGE {W}', '{name} LIEFERT AB!', 'DA IST DAS DING!', 'SO GEHT ANPACKEN!',
  'DER {n}-TREFFER-TAG!', 'HAKEN DRAN! {n}-MAL!', 'NICHT ZU STOPPEN!', 'VOLLTREFFER {W}!'
)
$script:AusgabeStoerer = @('EXKLUSIV', 'SENSATION', 'KNALLER', 'RIESEN-JUBEL', 'EXTRABLATT', 'BREAKING')
$script:AusgabeKommentare = @{
  morgen = @('Gestern angepackt, heute geht es weiter — genau so wächst etwas.', 'Der Vorsprung von gestern ist der Anlauf für heute. Erst das Eine, dann der Rest.', 'Wer so in den Tag startet, darf ruhig einmal kurz stolz sein. Dann los.')
  abend  = @('Wer so abliefert, darf jetzt die Füße hochlegen.', 'Feierabend ist auch eine Leistung — und heute ist sie verdient.', 'Mehr muss heute nicht. Der Rest hat bis morgen Zeit.')
  wochenende = @('Die Woche steht. Jetzt ist Wochenende — die Zahlen ruhen bis Montag.', 'Genug geschafft für eine Woche. Jetzt hat Erholung Vorfahrt.')
}
function Get-AusgabeWahl($liste, [string]$key, [int]$salz) {
  $h = 0; foreach ($ch in ($key + $salz).ToCharArray()) { $h = ($h * 31 + [int]$ch) % 1000003 }
  return $liste[$h % $liste.Count]
}
function Get-AusgabeGruppe($f, [string]$art) { return @($f.fakten | Where-Object { $_.art -eq $art }) }
function New-AusgabeEntwurf($lage, $f) {
  $n = [int]$f.gesamt
  $W = $(switch ($lage.art) { 'morgen' { if ($lage.zeitraum -eq 'seit Freitag') { 'SEIT FREITAG' } else { 'SEIT GESTERN' } } default { 'HEUTE' } })
  if ($lage.wochenende) { $W = 'DIESE WOCHE' }
  $meld = @()
  $jf = Get-AusgabeGruppe $f 'jira'
  if ($jf.Count) {
    $meld += , @{ titel = $(if ($jf.Count -gt 1) { "$($jf.Count) Tickets vom Tisch" } else { 'Ticket erledigt' }); text = (($jf | Select-Object -First 2 | ForEach-Object { Get-AusgabeKurz $_.text 80 }) -join ' · '); quellen = @($jf | ForEach-Object { $_.text }) }
  }
  $ef = Get-AusgabeGruppe $f 'entscheidung'
  if ($ef.Count) {
    $meld += , @{ titel = $(if ($ef.Count -gt 1) { "$($ef.Count) Entscheidungen getroffen" } else { 'Entscheidung gefallen' }); text = (Get-AusgabeKurz $ef[0].text 160); quellen = @($ef | ForEach-Object { $_.text }) }
  }
  $ff = @(Get-AusgabeGruppe $f 'stimme') + @(Get-AusgabeGruppe $f 'einig')
  if ($ff.Count -and $meld.Count -lt 4) {
    $gf = Get-AusgabeGruppe $f 'einig'
    $meld += , @{ titel = $(if ($gf.Count) { 'Finanzen: Einigkeit erzielt' } else { 'Finanzen: Stimme abgegeben' }); text = (($ff | Select-Object -First 2 | ForEach-Object { Get-AusgabeKurz $_.text 80 }) -join ' · '); quellen = @($ff | ForEach-Object { $_.text }) }
  }
  $pf = Get-AusgabeGruppe $f 'pool'
  if ($pf.Count -and $meld.Count -lt 4) {
    $meld += , @{ titel = $(if ($pf.Count -gt 1) { "Pool: $($pf.Count) Vorgänge bewegt" } else { 'Pool: ein Vorgang bewegt' }); text = (($pf | Select-Object -First 2 | ForEach-Object { Get-AusgabeKurz $_.text 80 }) -join ' · '); quellen = @($pf | ForEach-Object { $_.text }) }
  }
  $rf = Get-AusgabeGruppe $f 'ritual'
  if ($rf.Count -and $meld.Count -lt 4 -and $meld.Count -lt 3) {
    $meld += , @{ titel = 'Der Rhythmus steht'; text = (Get-AusgabeKurz $rf[0].text 160); quellen = @($rf | ForEach-Object { $_.text }) }
  }
  if ($n -eq 0) {
    $kopf = 'RUHIGER TAG — AUCH DAS IST ERLAUBT'
    $unter = "Keine erledigten Tickets, keine Entscheidungen $($lage.zeitraum). Ruhe ist auch Fortschritt."
    $stoer = 'RUHE'
  } else {
    $vorrat = $script:AusgabeKoepfe
    $ohneName = [bool](Get-Variable -Name NutzerFehlt -ValueOnly -ErrorAction SilentlyContinue)
    $kopf = (Get-AusgabeWahl $vorrat $lage.key 1)
    if ($ohneName -or -not $NutzerName) { $kopf = $kopf.Replace('{name} LIEFERT AB!', 'DU LIEFERST AB!') }
    $kopf = $kopf.Replace('{n}', [string]$n).Replace('{W}', $W).Replace('{name}', ([string]$NutzerName).ToUpperInvariant())
    $teile = @()
    if ($f.zahlen.jira) { $teile += $(if ($f.zahlen.jira -eq 1) { '1 Ticket erledigt' } else { "$($f.zahlen.jira) Tickets erledigt" }) }
    if ($f.zahlen.entscheidungen) { $teile += $(if ($f.zahlen.entscheidungen -eq 1) { '1 Entscheidung' } else { "$($f.zahlen.entscheidungen) Entscheidungen" }) }
    $fz = [int]$f.zahlen['stimmen'] + [int]$f.zahlen['einig']
    if ($fz) { $teile += $(if ($fz -eq 1) { '1 Finanz-Schritt' } else { "$fz Finanz-Schritte" }) }
    if ($f.zahlen['pool']) { $teile += $(if ($f.zahlen['pool'] -eq 1) { '1 Pool-Vorgang bewegt' } else { "$($f.zahlen['pool']) Pool-Vorgänge bewegt" }) }
    $unter = ($teile -join ', ') + " — $($lage.zeitraum)."
    $stoer = Get-AusgabeWahl $script:AusgabeStoerer $lage.key 2
  }
  $kArt = $(if ($lage.wochenende) { 'wochenende' } else { $lage.art })
  $zahl = $null
  if ($f.zahlen.jira) { $zahl = @{ wert = [string]$f.zahlen.jira; text = 'Tickets erledigt' } }
  elseif ($f.zahlen.entscheidungen) { $zahl = @{ wert = [string]$f.zahlen.entscheidungen; text = 'Entscheidungen getroffen' } }
  elseif ($f.zahlen['pool']) { $zahl = @{ wert = [string]$f.zahlen['pool']; text = 'Pool-Vorgänge bewegt' } }
  return @{
    dachzeile = "Das hast du $($lage.zeitraum) geschafft"; schlagzeile = $kopf; unterzeile = $unter; stoerer = $stoer
    meldungen = @($meld | Select-Object -First 4); kurz = @(); zahl = $zahl
    kommentar = (Get-AusgabeWahl $script:AusgabeKommentare[$kArt] $lage.key 3)
  }
}

# ---------- Redaktion (ein Modellaufruf) ----------
$script:AusgabeSystem = @'
Du bist Chefredakteur eines Boulevardblatts, das ausschließlich gute Nachrichten druckt — und zwar über das,
was ein einzelner Mensch wirklich geschafft hat. Ton: wie die großen deutschen Straßenblätter — Wucht-
Schlagzeilen in Großbuchstaben, Ausrufezeichen, Wortspiele, Superlative, Dachzeile, Störer, ein
augenzwinkernder Kommentar. Die Wahrheit ist nicht verhandelbar: jede Meldung beruht auf Belegen aus der
Faktenliste. Du erfindest nichts — keine Zahlen, keine Zitate, keine Personen, keine Ereignisse, keine
Wirkung, die nicht in den Fakten steht. Keine Häme gegen Dritte, keine Politik, nichts über Gesundheit oder
Intimes, keine Namen von Dritten in Schlagzeilen. Du antwortest ausschließlich mit JSON.
'@
$script:AusgabeStilmittel = @(
  'ein Wortspiel mit dem wichtigsten Erfolg', 'ein Superlativ („Der größte …", „So … wie nie")',
  'eine Frage-Schlagzeile („Wie macht … das?")', 'eine Zahlen-Schlagzeile mit der Zahl des Tages',
  'ein Ausruf in der Wir-Form des Blatts („Wir sind …")', 'ein kurzer Reim oder Stabreim'
)
function Build-AusgabeAuftrag($lage, $f) {
  $zeilen = @($f.fakten | ForEach-Object {
    $w = $(if ($_.wann) { ", $($_.wann)" } else { '' })
    "$($_.id) [$($_.bereich)$w] $($_.text)"
  }) -join "`n"
  if (-not $zeilen) { $zeilen = '(keine)' }
  $zahlen = @($f.zahlen.GetEnumerator() | ForEach-Object { "$($_.Key) = $($_.Value)" }) -join ', '
  $zuletzt = @(Get-AusgabeZuletzt $lage.key)
  $zl = $(if ($zuletzt.Count) { ($zuletzt | ForEach-Object { "- $_" }) -join "`n" } else { '(noch keine)' })
  $ton = $(if ($lage.wochenende) { 'Wochenbilanz — Tonfall: Pause verdient, Wochenende hat Vorfahrt (keine Arbeitsaufträge).' }
           elseif ($lage.art -eq 'morgen') { 'Was gestern und über Nacht passiert ist — Tonfall: Anpfiff für den Tag.' }
           else { 'Bilanz des heutigen Tages — Tonfall: Feierabend-Jubel.' })
  $stil = Get-AusgabeWahl $script:AusgabeStilmittel $lage.key 4
  $jhinweis = $(if ($f.jiraMehr) { ' (Jira: mindestens so viele, die Liste ist gekappt — schreib „mindestens" oder nenne keine Zahl)' } else { '' })
  $fehlt = $(if (@($f.fehlt).Count) { "NICHT ERREICHBAR IN DIESEM LAUF (darüber nichts behaupten): " + (@($f.fehlt) -join ', ') } else { 'Alle Quellen erreichbar.' })
  return @"
AUSGABE: $($lage.name), $($lage.datum). Zeitraum: $($lage.zeitraum).
LESER: $NutzerName — Du-Form, der Kommentar spricht $NutzerName direkt an.
TONFALL: $ton
STILMITTEL FÜR DIE SCHLAGZEILE HEUTE: $stil
ZULETZT GEDRUCKTE SCHLAGZEILEN (keine davon wiederholen, auch nicht sinngemäß; anderer Einstieg):
$zl
$fehlt

ZAHLEN (nur diese Zahlen darfst du verwenden, als Ziffern):$jhinweis
$zahlen

FAKTEN (id [Bereich, Zeit] Beleg):
$zeilen

So baust du die Ausgabe:
- Ticket-Titel und Entscheidungen sind oft trocken formuliert. Übersetze sie in das, was jetzt erledigt oder
  geklärt ist — sachlich richtig, nur nicht trocken. Mehrere Belege zum selben Thema sind EINE Meldung.
- Finanz-Stimmen und Pool-Bewegungen sind Fortschritt der Firma: nenne Titel und Stufe, nie Beträge oder
  Namen, die nicht in den Fakten stehen. Website- und Tower-Zahlen sind Stand, kein eigener Verdienst.
- Wähle die 3 bis 4 stärksten Geschichten, nicht die neuesten. Ein Automat ist kein Erfolg.
- Ist ein Beleg mehrdeutig (wer hat wem was geschrieben?), bleib nah am Wortlaut, statt eine Richtung zu raten.
- "schlagzeile": höchstens 46 Zeichen, GROSSBUCHSTABEN, mit Wucht.
- "dachzeile": höchstens 60 Zeichen, normale Schreibung, führt zur Schlagzeile hin.
- "unterzeile": höchstens 140 Zeichen, sagt in einem Satz, worum es geht.
- "stoerer": ein bis zwei Wörter in Großbuchstaben, höchstens 14 Zeichen (z. B. EXKLUSIV, SENSATION).
- "meldungen": 3 bis 4, je {"titel" höchstens 44 Zeichen im Boulevard-Stil, "text" höchstens 170 Zeichen,
  "belege": ["j1","e2"] — nur ids aus der Faktenliste}.
- "kurz": bis zu 3 Einzeiler (höchstens 90 Zeichen) für den Rest, je {"text","belege":[…]}.
- "zahl": die Zahl des Tages aus ZAHLEN, {"wert":"…","text":"… höchstens 30 Zeichen"}.
- "kommentar": der Kommentar des Blatts OHNE das Präfix „Kompass meint" (das setzt die Seite davor), 1–2 Sätze, höchstens 200 Zeichen, augenzwinkernd und warm.
Gibt es kaum Fakten, dann ist das die Geschichte: ein ruhiger Tag — nichts aufblasen.

Antworte NUR mit diesem JSON, ohne Erklärung, ohne Code-Zaun:
{"dachzeile":"…","schlagzeile":"…","unterzeile":"…","stoerer":"…","meldungen":[{"titel":"…","text":"…","belege":["j1"]}],"kurz":[{"text":"…","belege":["e1"]}],"zahl":{"wert":"…","text":"…"},"kommentar":"…"}
"@
}

# Jede Zahl im gedruckten Text muss in den Fakten, den Zahlen oder im Datum der Ausgabe stehen.
function Test-AusgabeZahlen([string]$text, $erlaubt) {
  foreach ($m in [regex]::Matches([string]$text, '\d+(?:[.,]\d+)*')) {
    $roh = $m.Value
    $teile = @($roh -split '[.,]' | Where-Object { $_ })
    $ok = $erlaubt.Contains($roh) -or (@($teile | Where-Object { -not $erlaubt.Contains($_) }).Count -eq 0)
    if (-not $ok) { return $false }
  }
  return $true
}
function Test-Ausgabe($o, $lage, $f) {
  if (-not $o) { return $null }
  $ids = @{}; foreach ($x in $f.fakten) { $ids[$x.id] = $x }
  $korpus = (($f.fakten | ForEach-Object { "$($_.text) $($_.wann)" }) -join ' ') + ' ' + (($f.zahlen.Values) -join ' ') + ' ' + $lage.datum + ' ' + $f.gesamt
  $erlaubt = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($m in [regex]::Matches($korpus, '\d+(?:[.,]\d+)*')) { [void]$erlaubt.Add($m.Value); foreach ($t in ($m.Value -split '[.,]')) { if ($t) { [void]$erlaubt.Add($t) } } }
  $meld = @()
  foreach ($m in @(Get-AusgabeWert $o 'meldungen')) {
    if (-not $m) { continue }
    $bel = @(@(Get-AusgabeWert $m 'belege') | Where-Object { $null -ne $_ } | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $ids.ContainsKey($_) } | Select-Object -Unique)
    $titel = Get-AusgabeKurz (Get-AusgabeWert $m 'titel') 52; $text = Get-AusgabeKurz (Get-AusgabeWert $m 'text') 200
    if (-not $bel.Count -or -not $titel) { continue }
    if (-not (Test-AusgabeZahlen "$titel $text" $erlaubt)) { continue }
    $meld += , @{ titel = $titel; text = $text; quellen = @($bel | ForEach-Object { $ids[$_].text }) }
    if ($meld.Count -ge 4) { break }
  }
  if ($f.gesamt -gt 0 -and $meld.Count -lt 1) { return $null }
  $kurz = @()
  foreach ($k in @(Get-AusgabeWert $o 'kurz')) {
    if (-not $k) { continue }
    $bel = @(@(Get-AusgabeWert $k 'belege') | Where-Object { $null -ne $_ } | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $ids.ContainsKey($_) })
    $t = Get-AusgabeKurz (Get-AusgabeWert $k 'text') 100
    if (-not $bel.Count -or -not $t -or -not (Test-AusgabeZahlen $t $erlaubt)) { continue }
    $kurz += , @{ text = $t; quellen = @($bel | ForEach-Object { $ids[$_].text }) }
    if ($kurz.Count -ge 3) { break }
  }
  $kopf = Get-AusgabeKurz (Get-AusgabeWert $o 'schlagzeile') 56
  if (-not $kopf -or -not (Test-AusgabeZahlen $kopf $erlaubt)) { return $null }
  $leer = { param($s) if (Test-AusgabeZahlen $s $erlaubt) { $s } else { '' } }
  $zahl = $null
  $oz = Get-AusgabeWert $o 'zahl'
  if ($oz -and [string](Get-AusgabeWert $oz 'wert')) {
    $zw = Get-AusgabeKurz (Get-AusgabeWert $oz 'wert') 8
    if (($f.zahlen.Values | ForEach-Object { [string]$_ }) -contains $zw -and $zw -ne '0') {
      $zahl = @{ wert = $zw; text = (& $leer (Get-AusgabeKurz (Get-AusgabeWert $oz 'text') 34)) }
    }
  }
  return @{
    dachzeile = (& $leer (Get-AusgabeKurz (Get-AusgabeWert $o 'dachzeile') 70)); schlagzeile = $kopf.ToUpperInvariant()
    unterzeile = (& $leer (Get-AusgabeKurz (Get-AusgabeWert $o 'unterzeile') 160))
    stoerer = (Get-AusgabeKurz (([string](Get-AusgabeWert $o 'stoerer')).ToUpperInvariant()) 16)
    meldungen = $meld; kurz = $kurz; zahl = $zahl
    kommentar = (& $leer (Get-AusgabeKurz ([string](Get-AusgabeWert $o 'kommentar') -replace '^\s*Kompass meint:?\s*', '') 230))
  }
}

function Invoke-AusgabeRedaktion($lage, $f, [string]$backend) {
  $auftrag = Build-AusgabeAuftrag $lage $f
  $roh = ''; $modell = ''
  if ($backend -eq 'cli') {
    $c = Invoke-ClaudeCli $script:AusgabeSystem $auftrag @{ tools = $false; maxTurns = 1; effort = 'low'; timeout = 240 }
    $roh = ([string]$c.text).Trim(); $modell = [string]$c.model
  } elseif ($backend -eq 'anbieter') {
    $c = Invoke-AnbieterText $script:AusgabeSystem $auftrag 2000
    $roh = ([string]$c.text).Trim(); $modell = [string]$c.model
  } elseif ($backend -eq 'api') {
    $apiKey = Get-ApiKey
    if (-not $apiKey) { throw 'NO_KEY' }
    $body = @{ model = $Model; max_tokens = 2000; system = @(@{ type = 'text'; text = $script:AusgabeSystem })
               messages = @(@{ role = 'user'; content = $auftrag }); output_config = @{ effort = 'low' }; fallbacks = 'default' }
    $r = Call-Claude $apiKey $body
    if ($r.stop_reason -eq 'refusal') { return @{ ok = $false; error = 'REFUSAL' } }
    $roh = ((@($r.content) | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join "`n").Trim()
    $modell = [string]$r.model
  } else {
    return @{ ok = $false; error = 'NO_AI' }
  }
  $a = $roh.IndexOf('{'); $z = $roh.LastIndexOf('}')
  if ($a -lt 0 -or $z -le $a) { return @{ ok = $false; error = 'KEIN_JSON' } }
  $o = $null
  try { $o = $roh.Substring($a, $z - $a + 1) | ConvertFrom-Json } catch { return @{ ok = $false; error = 'JSON_KAPUTT' } }
  $aus = Test-Ausgabe $o $lage $f
  if (-not $aus) { return @{ ok = $false; error = 'VERWORFEN' } }
  return @{ ok = $true; ausgabe = $aus; model = $modell }
}

# Weicht der aktuelle Stand so weit von der Redaktion ab, dass einmal nachgefordert werden darf?
# (≥ 3 Erfolge mehr und älter als 90 Minuten)
function Test-AusgabeVeraltet($c, $f) {
  $alter = (Get-AusgabeErzeugt $c).minuten
  return ([int]$f.gesamt -ge ([int](Get-AusgabeWert $c 'gesamt') + 3) -and $alter -gt 90)
}

# GET: was gerade gilt. Liegt die redigierte Ausgabe vor, kommt sie; sonst der Entwurf und die Bitte,
# die Redaktion anzustoßen.
function Get-Ausgabe([bool]$fresh = $false) {
  $lage = Get-AusgabeLage (Get-Date)
  $f = Get-AusgabeFakten $lage $fresh
  $s = Read-Ausgaben
  $lageOut = @{ key = $lage.key; art = $lage.art; name = $lage.name; datum = $lage.datum; zeitraum = $lage.zeitraum; von = $lage.von; wochenende = $lage.wochenende }
  $ohneModell = ((Get-Backend) -eq 'ohne')
  if ($s.ausgaben.ContainsKey($lage.key)) {
    $c = $s.ausgaben[$lage.key]
    return @{ ok = $true; lage = $lageOut; ausgabe = (Get-AusgabeWert $c 'ausgabe'); redaktion = $true; erzeugt = (Get-AusgabeErzeugt $c).iso
              model = [string](Get-AusgabeWert $c 'model'); veraltet = (Test-AusgabeVeraltet $c $f); gesamt = $f.gesamt; zahlen = $f.zahlen
              fehlt = @($f.fehlt); ohneModell = $ohneModell }
  }
  return @{ ok = $true; lage = $lageOut; ausgabe = (New-AusgabeEntwurf $lage $f); redaktion = $false
            erzeugt = (Get-Date).ToString('o'); gesamt = $f.gesamt; zahlen = $f.zahlen; veraltet = $false
            fehlt = @($f.fehlt); ohneModell = $ohneModell }
}

# POST: die Redaktion. Scheitert das Modell (oder gibt es keins), bleibt der Entwurf stehen und die Antwort sagt warum.
function Build-Ausgabe([bool]$fresh = $false) {
  $lage = Get-AusgabeLage (Get-Date)
  $s = Read-Ausgaben
  $f = Get-AusgabeFakten $lage $true
  if (-not $fresh -and $s.ausgaben.ContainsKey($lage.key)) {
    if (-not (Test-AusgabeVeraltet $s.ausgaben[$lage.key] $f)) { return Get-Ausgabe }
  }
  $backend = Get-Backend
  if ($backend -eq 'ohne') {
    # Ehrlich: ohne KI-Anbindung gibt es keine Redaktion — der Entwurf bleibt und sagt es.
    $g = Get-Ausgabe
    $h = Get-CoachFehler 'NO_AI'
    $g['redaktionFehler'] = 'NO_AI'
    if ($h) { $g['hint'] = $h.hint }
    return $g
  }
  $t0 = Get-Date
  Write-Host ("[{0}] Erfolgs-Ausgabe {1}: {2} Fakten{3}" -f (Get-Date -Format 'HH:mm:ss'), $lage.key, @($f.fakten).Count, $(if (@($f.fehlt).Count) { ' · fehlt: ' + (@($f.fehlt) -join ', ') } else { '' }))
  if ($f.gesamt -eq 0 -and -not @($f.fakten).Count) {
    $r = @{ ok = $true; ausgabe = (New-AusgabeEntwurf $lage $f); model = 'ohne Modell (keine Fakten)' }
  } else {
    $r = Invoke-AusgabeRedaktion $lage $f $backend
  }
  $dauer = [int]((Get-Date) - $t0).TotalSeconds
  if (-not $r.ok) {
    Write-Host ("  Ausgabe verworfen ({0}), {1} s — der Entwurf bleibt stehen" -f $r.error, $dauer) -ForegroundColor DarkYellow
    $g = Get-Ausgabe; $g['redaktionFehler'] = $r.error
    return $g
  }
  $s.ausgaben[$lage.key] = @{ erzeugt = (Get-Date).ToString('o'); gesamt = $f.gesamt; ausgabe = $r.ausgabe; model = $r.model }
  Save-Ausgaben
  Write-Host ("  Ausgabe: '{0}', {1} Meldungen, {2} s" -f $r.ausgabe.schlagzeile, @($r.ausgabe.meldungen).Count, $dauer) -ForegroundColor Green
  return Get-Ausgabe
}

# Router-Hilfe: $true, wenn der Pfad hier beantwortet wurde. compass-server.ps1 ruft sie vor seinem 404.
function Invoke-AusgabeRoute($ctx, $req, [string]$path) {
  if ($path -ne '/api/ausgabe') { return $false }
  try {
    if ($req.HttpMethod -eq 'POST') {
      $ok = $false; $in = Read-JsonBody $ctx ([ref]$ok); if (-not $ok) { return $true }
      $frisch = $false
      if ($in) { $frisch = [bool](Get-AusgabeWert $in 'fresh') }
      Send-Json $ctx (Build-Ausgabe $frisch)
    } else {
      Send-Json $ctx (Get-Ausgabe ($req.QueryString['fresh'] -eq '1'))
    }
  } catch {
    $m = $_.Exception.Message
    $f = Get-CoachFehler $m
    if ($f) { Write-Host "  Ausgabe: $($f.code)" -ForegroundColor Red; Send-Json $ctx @{ ok = $false; error = $f.code; hint = $f.hint } $f.status }
    else { Write-Host "  Ausgabe-Fehler: $m" -ForegroundColor Red; Send-Json $ctx @{ ok = $false; error = $m } 500 }
  }
  return $true
}
