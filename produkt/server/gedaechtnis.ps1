<#
  gedaechtnis.ps1 — das geräteübergreifende Gedächtnis des Compass-Servers (16.09.2026).
  Wird von compass-server.ps1 per Dot-Source geladen. Erwartet dort: $DatenDir, Get-Feld, Send-Json,
  Read-JsonBody, Read-Text (Move-KaputteDatei und Add-Kaputt, falls vorhanden).

  Der Compass merkt sich drei Dinge zunächst nur im localStorage des Browsers — also je Gerät und je
  Adresse getrennt. Hier liegen sie an einer Stelle, damit sie auf jedem Gerät gleich sind:

    GET  /api/antworten        → {ok, anzahl, datei, antworten:{id:{a,ts,frage,quelle}}}
    POST /api/antworten        {id,antwort,ts,frage}  (eine Antwort, gerade gegeben)
                               {antworten:{id:{a,ts,frage}}}  (der ganze Speicher des Browsers)
                               → {ok, neu, anzahl, antworten}. Neueres Datum (JJJJ-MM-TT) gewinnt.
    GET  /api/einstellungen    → {ok, datei, erlaubt, einstellungen:{key:{wert,ts,quelle}}}
    POST /api/einstellungen    {key,wert,ts} oder {einstellungen:{key:{wert,ts}}}
                               → {ok, neu, einstellungen}. Jüngerer Zeitstempel (sekundengenau) gewinnt,
                               nur bekannte Schlüssel mit bekannten Werten (weiße Liste).
    GET  /api/checkin[?art=morgen&limit=5&voll=1] → {ok, anzahl, ordner, checkins:[…]}
    POST /api/checkin          {art,datum,titel,text,fokus,auftrag,entschieden,offen,quelle,antworten,wahl}
                               → {ok, datei, art, datum, ordner, board:null}; 400 LEER ohne Text.

  Ablage unter $DatenDir: antworten.json, einstellungen.json, checkins\<datum>-<art>.md + .json;
  ein zweiter Checkin derselben Art am selben Tag schiebt die alte Fassung nach checkins\_alt\.
  Geschrieben wird atomar (erst <datei>.neu, dann ersetzen), UTF-8 ohne BOM, LF.

  Bewusst nicht in diesem Paket (nur im persönlichen Server des Erfinders): Morgen-/Abendboard nach
  dem Checkin, Spiegel auf ein zweites Laufwerk, Snapshots, Briefkasten-Abholung, Import aus fremden
  Ordnern. `board` ist darum immer null — der Compass wartet dann auf kein Board.

  Läuft unter Windows PowerShell 5.1 und PowerShell 7 (Linux). Falle in 7: ConvertFrom-Json macht aus
  ISO-Zeitstempeln ("2026-09-16T16:07:58") sofort [datetime], und [string] darauf ergibt US-Format.
  Deshalb geht jeder gelesene Wert durch ConvertTo-GedText, Zeitstempel zusätzlich durch
  ConvertTo-GedTag / ConvertTo-GedSekunde; verglichen wird ordinal. Ortszeit, kein UTC.
#>

$script:GedInv = [Globalization.CultureInfo]::InvariantCulture
$script:Antw = $null
$script:Einst = $null
$script:EinstBeruehrt = $false
$script:EinstErlaubt = @{
  theme = @('auto','light','dark')                                  # Farbschema
  lang  = @('de','en','ar')                                         # Sprache (compass-i18n.js)
  phase = @('','sonnenaufgang','morgen','tag','abend','nacht')      # feste Tagesphase, '' = nach der Uhr
  board = @('*json')                                                # Board-Einrichtung: ein JSON-Objekt, höchstens 32 KB
}
$script:CheckinArten = @('morgen','abend','wochenstart','wochenreview','fragen','freigaben','trichter')

# Fallbacks, falls der Server sie (noch) nicht definiert hat — sonst gelten seine.
if (-not (Get-Command Move-KaputteDatei -CommandType Function -ErrorAction SilentlyContinue)) {
  if ($null -eq $script:KaputteDateien) { $script:KaputteDateien = @() }
  function Move-KaputteDatei([string]$pfad, [string]$fehler) {
    $ziel = Join-Path (Split-Path $pfad -Parent) ("{0}_kaputt-{1}.json" -f [IO.Path]::GetFileNameWithoutExtension($pfad), (Get-Date -Format 'yyyyMMdd-HHmmss'))
    try { Move-Item -LiteralPath $pfad -Destination $ziel -Force } catch { $ziel = $pfad }
    $script:KaputteDateien += [IO.Path]::GetFileName($ziel)
    Write-Host ("[{0}] Zustandsdatei unlesbar: {1} — {2} → beiseitegelegt als {3}" -f (Get-Date -Format 'HH:mm:ss'), $pfad, $fehler, [IO.Path]::GetFileName($ziel)) -ForegroundColor Red
  }
}
if (-not (Get-Command Add-Kaputt -CommandType Function -ErrorAction SilentlyContinue)) {
  function Add-Kaputt($antwort) {
    if ($script:KaputteDateien -and $script:KaputteDateien.Count) { $antwort.kaputt = @($script:KaputteDateien) }
    return $antwort
  }
}

# ---------- Hilfen ----------
function Get-GedPfad([string]$name) { return (Join-Path $DatenDir $name) }
function Get-GedJetzt([string]$format) { return (Get-Date).ToString($format, $script:GedInv) }

# Ein Wert aus ConvertFrom-Json als Text. [datetime] (nur PowerShell 7) wird wieder ISO, nie US-Format.
function ConvertTo-GedText($v) {
  if ($null -eq $v) { return '' }
  if ($v -is [datetime]) {
    if ($v.Kind -eq [DateTimeKind]::Utc) { return $v.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'", $script:GedInv) }
    if ($v.Kind -eq [DateTimeKind]::Local) { return $v.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFFFzzz", $script:GedInv) }
    return $v.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFFF", $script:GedInv)
  }
  if ($v -is [DateTimeOffset]) { return $v.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFFFzzz", $script:GedInv) }
  return [string]$v
}
# Datum einer Antwort: JJJJ-MM-TT. [datetime] → Ortsdatum; "JJJJ-MM-TTThh:mm…" → der Datumsteil; sonst wie gegeben.
function ConvertTo-GedTag($v) {
  if ($v -is [datetime]) {
    $d = $(if ($v.Kind -eq [DateTimeKind]::Utc) { $v.ToLocalTime() } else { $v })
    return $d.ToString('yyyy-MM-dd', $script:GedInv)
  }
  $s = ConvertTo-GedText $v
  if ($s -match '^(\d{4}-\d{2}-\d{2})T') { return $Matches[1] }
  return $s
}
# Zeitstempel einer Vorliebe: JJJJ-MM-TT hh:mm:ss (Ortszeit). [datetime] und die T-Schreibweise werden umgesetzt.
function ConvertTo-GedSekunde($v) {
  if ($v -is [datetime]) {
    $d = $(if ($v.Kind -eq [DateTimeKind]::Utc) { $v.ToLocalTime() } else { $v })
    return $d.ToString('yyyy-MM-dd HH:mm:ss', $script:GedInv)
  }
  $s = ConvertTo-GedText $v
  if ($s -match '^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})$') { return "$($Matches[1]) $($Matches[2])" }
  return $s
}
# Ganze Struktur (Body-Teile) in schreibbare Form bringen: [datetime] → ISO-Text, Rest unverändert.
function ConvertTo-GedRoh($v, [int]$tiefe = 0) {
  if ($null -eq $v) { return $null }
  if ($tiefe -gt 12) { return (ConvertTo-GedText $v) }
  if ($v -is [datetime] -or $v -is [DateTimeOffset]) { return (ConvertTo-GedText $v) }
  if ($v -is [string] -or $v -is [ValueType]) { return $v }
  if ($v -is [Collections.IDictionary]) {
    $h = [ordered]@{}
    foreach ($k in @($v.Keys)) { $h[[string]$k] = ConvertTo-GedRoh $v[$k] ($tiefe + 1) }
    return $h
  }
  if ($v -is [Management.Automation.PSCustomObject]) {
    $h = [ordered]@{}
    foreach ($p in @($v.PSObject.Properties)) { if ($p) { $h[$p.Name] = ConvertTo-GedRoh $p.Value ($tiefe + 1) } }
    return $h
  }
  if ($v -is [Collections.IEnumerable]) {
    $l = New-Object Collections.ArrayList
    foreach ($x in $v) { [void]$l.Add((ConvertTo-GedRoh $x ($tiefe + 1))) }
    return ,($l.ToArray())
  }
  return $v
}
# Ein Feld eines Objekts (PSCustomObject oder Hashtable), fehlend = $null.
function Get-GedFeld($obj, [string]$name) {
  if ($null -eq $obj) { return $null }
  if ($obj -is [Collections.IDictionary]) { return $obj[$name] }
  $p = $obj.PSObject.Properties[$name]
  if ($null -eq $p) { return $null }
  return $p.Value
}
# Eigenschaften eines Objekts als Liste (leer, wenn keins).
function Get-GedEintraege($obj) {
  if ($null -eq $obj) { return @() }
  if ($obj -is [Collections.IDictionary]) { return @($obj.GetEnumerator() | ForEach-Object { [pscustomobject]@{ Name = [string]$_.Key; Value = $_.Value } }) }
  if ($obj -is [Management.Automation.PSCustomObject]) { return @($obj.PSObject.Properties | Where-Object { $_ }) }
  return @()
}
# Erst daneben schreiben, dann ersetzen — ein abgebrochener Schreibvorgang lässt den letzten guten Stand stehen.
function Write-GedAtomar([string]$pfad, [string]$text) {
  $ordner = Split-Path $pfad -Parent
  if ($ordner -and -not (Test-Path -LiteralPath $ordner)) { New-Item -ItemType Directory -Force $ordner | Out-Null }
  $tmp = "$pfad.neu"
  [IO.File]::WriteAllText($tmp, $text.Replace("`r`n", "`n"), (New-Object Text.UTF8Encoding($false)))
  try {
    if ([IO.File]::Exists($pfad)) { [IO.File]::Replace($tmp, $pfad, $null) } else { [IO.File]::Move($tmp, $pfad) }
  } catch {
    [IO.File]::Copy($tmp, $pfad, $true)
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
}
function Read-GedJson([string]$pfad) { return ((Read-Text $pfad) | ConvertFrom-Json) }
function Test-GedJuenger([string]$a, [string]$b) { return ([string]::CompareOrdinal($a, $b) -gt 0) }

# ---------- Beantwortete Rückfragen — /api/antworten ----------
function Save-Antworten {
  if ($null -eq $script:Antw) { return }
  $o = @{ stand = (Get-GedJetzt 'yyyy-MM-dd HH:mm'); anzahl = $script:Antw.Count
          hinweis = 'Beantwortete Rueckfragen des Flow Compass. Geschrieben vom Compass-Server (/api/antworten, /api/checkin).'
          antworten = $script:Antw }
  Write-GedAtomar (Get-GedPfad 'antworten.json') ($o | ConvertTo-Json -Depth 6)
}

function Read-Antworten {
  if ($null -ne $script:Antw) { return $script:Antw }
  $datei = Get-GedPfad 'antworten.json'
  $h = @{}
  if (Test-Path -LiteralPath $datei) {
    try {
      $d = Read-GedJson $datei
      if ($null -eq $d) { throw 'leere Datei' }
      foreach ($p in @(Get-GedEintraege (Get-GedFeld $d 'antworten'))) {
        $w = $p.Value
        $h[$p.Name] = @{ a = (ConvertTo-GedText (Get-GedFeld $w 'a')); ts = (ConvertTo-GedTag (Get-GedFeld $w 'ts'))
                         frage = (ConvertTo-GedText (Get-GedFeld $w 'frage')); quelle = (ConvertTo-GedText (Get-GedFeld $w 'quelle')) }
      }
      $script:Antw = $h
      return $script:Antw
    } catch { Move-KaputteDatei $datei $_.Exception.Message; $h = @{} }
    # Die Datei war kaputt und liegt beiseite — weiter wie beim allerersten Lesen.
  }
  # Erstbefüllung aus den eigenen Checkins (Feld `entschieden`), ältester zuerst: die jüngste Antwort gewinnt.
  $cdir = Get-GedPfad 'checkins'
  foreach ($f in @(Get-GedCheckinDateien $cdir $false)) {
    $o = $null
    try { $o = Read-GedJson $f.FullName } catch { continue }
    if ($null -eq $o) { continue }
    $tag = ConvertTo-GedTag (Get-GedFeld $o 'datum')
    foreach ($e in @(Get-GedFeld $o 'entschieden')) {
      if ($null -eq $e) { continue }
      $id = ConvertTo-GedText (Get-GedFeld $e 'id')
      if (-not $id) { continue }
      $h[$id] = @{ a = (ConvertTo-GedText (Get-GedFeld $e 'antwort')); ts = $tag
                   frage = (ConvertTo-GedText (Get-GedFeld $e 'frage')); quelle = 'checkin' }
    }
  }
  $script:Antw = $h
  Save-Antworten
  $script:Antw
}

# Eine Antwort aufnehmen. Neueres Datum gewinnt; bei gleichem Datum bleibt das Bekannte stehen — außer mit
# -direkt (eine einzelne Antwort, gerade gegeben: Rückgängig und Nachfragen am selben Tag müssen ankommen).
# Rückgabe: $true, wenn sich etwas geändert hat.
function Add-Antwort([string]$id, [string]$a, [string]$ts, [string]$frage, [string]$quelle, [switch]$direkt) {
  if (-not $id -or -not $a) { return $false }
  if ($ts -notmatch '^\d{4}-\d{2}-\d{2}$') { $ts = Get-GedJetzt 'yyyy-MM-dd' }
  $h = Read-Antworten
  $alt = $h[$id]
  if ($alt -and [string]$alt.a -and -not (Test-GedJuenger $ts ([string]$alt.ts)) -and -not ($direkt -and ([string]$alt.ts) -eq $ts)) {
    if ($frage -and -not [string]$alt.frage) { $alt.frage = $frage; return $true }
    return $false
  }
  $h[$id] = @{ a = $a; ts = $ts; quelle = $(if ($quelle) { $quelle } else { 'compass' })
               frage = $(if ($frage) { $frage } elseif ($alt) { [string]$alt.frage } else { '' }) }
  return $true
}

# ---------- Vorlieben — /api/einstellungen ----------
# Weiße Liste: ein unbekannter Schlüssel oder Wert wird verworfen, nicht durchgereicht — ein kaputtes
# 'theme' wäre eine Seite, die sich nicht mehr lesen lässt. '*json' = ein JSON-Objekt bis 32 KB.
function Test-EinstWert([string]$key, [string]$wert) {
  if (-not $key -or -not $script:EinstErlaubt.ContainsKey($key)) { return $false }
  $erl = $script:EinstErlaubt[$key]
  if ($erl -contains '*json') {
    if (-not $wert -or $wert.Length -gt 32768 -or -not $wert.TrimStart().StartsWith('{')) { return $false }
    try { $null = $wert | ConvertFrom-Json; return $true } catch { return $false }
  }
  return ($erl -ccontains $wert)
}

function Save-Einstellungen {
  if ($null -eq $script:Einst) { return }
  $o = @{ stand = (Get-GedJetzt 'yyyy-MM-dd HH:mm:ss')
          hinweis = 'Vorlieben des Flow Compass (Farbschema, Sprache, Tagesphase, Board-Einrichtung), geraeteuebergreifend. Geschrieben vom Compass-Server (/api/einstellungen).'
          einstellungen = $script:Einst }
  Write-GedAtomar (Get-GedPfad 'einstellungen.json') ($o | ConvertTo-Json -Depth 6)
}

function Read-Einstellungen {
  if ($null -ne $script:Einst) { return $script:Einst }
  $datei = Get-GedPfad 'einstellungen.json'
  $h = @{}
  if (Test-Path -LiteralPath $datei) {
    try {
      $d = Read-GedJson $datei
      foreach ($p in @(Get-GedEintraege (Get-GedFeld $d 'einstellungen'))) {
        if (-not $script:EinstErlaubt.ContainsKey($p.Name)) { continue }
        $wert = ConvertTo-GedText (Get-GedFeld $p.Value 'wert')
        if (-not (Test-EinstWert $p.Name $wert)) { continue }
        $h[$p.Name] = @{ wert = $wert; ts = (ConvertTo-GedSekunde (Get-GedFeld $p.Value 'ts')); quelle = (ConvertTo-GedText (Get-GedFeld $p.Value 'quelle')) }
      }
    } catch { Move-KaputteDatei $datei $_.Exception.Message; $h = @{} }
  }
  $script:Einst = $h
  $script:Einst
}

# Eine Vorliebe aufnehmen. Jüngerer Zeitstempel gewinnt; bei gleichem bleibt das Bekannte.
# Rückgabe: $true, wenn sich der Wert geändert hat (der Zeitstempel wird auch bei gleichem Wert nachgezogen).
function Add-Einstellung([string]$key, [string]$wert, [string]$ts, [string]$quelle) {
  if (-not $key -or -not $script:EinstErlaubt.ContainsKey($key)) { return $false }
  if (-not (Test-EinstWert $key $wert)) { return $false }
  if ($ts -notmatch '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$') { $ts = Get-GedJetzt 'yyyy-MM-dd HH:mm:ss' }
  $alle = Read-Einstellungen
  $alt = $alle[$key]
  if ($alt -and -not (Test-GedJuenger $ts ([string]$alt.ts))) { return $false }
  $geaendert = (-not $alt) -or ([string]$alt.wert -cne $wert)
  $script:Einst[$key] = @{ wert = $wert; ts = $ts; quelle = $quelle }
  $script:EinstBeruehrt = $true
  $geaendert
}

# ---------- Checkins — /api/checkin ----------
# Die JSON-Dateien eines Checkin-Ordners, nach Namen ordinal sortiert (Namen beginnen mit dem Datum).
function Get-GedCheckinDateien([string]$dir, [bool]$absteigend) {
  if (-not (Test-Path -LiteralPath $dir)) { return @() }
  $fs = @(Get-ChildItem -LiteralPath $dir -Filter '*.json' -File -ErrorAction SilentlyContinue)
  if ($fs.Count -lt 2) { return $fs }
  $namen = [string[]]@($fs | ForEach-Object { $_.Name })
  $arr = [IO.FileInfo[]]$fs
  [Array]::Sort($namen, $arr, [StringComparer]::Ordinal)
  if ($absteigend) { [Array]::Reverse($arr) }
  return $arr
}

function Save-Checkin($in) {
  $dir = Get-GedPfad 'checkins'
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  $text = ConvertTo-GedText (Get-GedFeld $in 'text')
  if (-not $text.Trim()) { return @{ code = 400; antwort = @{ ok = $false; error = 'LEER'; hint = 'Feld „text“ fehlt — nichts gespeichert.' } } }
  $art = (ConvertTo-GedText (Get-GedFeld $in 'art')).ToLowerInvariant()
  if ($script:CheckinArten -notcontains $art) { $art = 'checkin' }            # kein Pfad aus fremder Eingabe
  $datum = ConvertTo-GedTag (Get-GedFeld $in 'datum')
  if ($datum -notmatch '^\d{4}-\d{2}-\d{2}$') { $datum = Get-GedJetzt 'yyyy-MM-dd' }
  $jetzt  = Get-GedJetzt 'yyyy-MM-dd HH:mm'
  $name   = "$datum-$art"
  $titel  = ConvertTo-GedText (Get-GedFeld $in 'titel'); if (-not $titel) { $titel = $name }
  $quelle = ConvertTo-GedText (Get-GedFeld $in 'quelle')
  $fokus  = ConvertTo-GedText (Get-GedFeld $in 'fokus')
  $auftrag = ConvertTo-GedText (Get-GedFeld $in 'auftrag')
  $entschieden = @(@(Get-GedFeld $in 'entschieden') | Where-Object { $null -ne $_ })
  $off = @(@(Get-GedFeld $in 'offen') | Where-Object { $_ } | ForEach-Object { ConvertTo-GedText $_ })

  $md = @("# $titel", '',
          "> Übergabe aus dem Flow Compass, $jetzt Uhr — geschrieben vom Compass-Server (POST /api/checkin).",
          "> Art: $art · Datum: $datum$(if ($quelle) { ' · Quelle: ' + $quelle })", '',
          $text.Replace("`r`n", "`n").Trim(), '') -join "`n"
  $extra = @()
  if ($fokus)   { $extra += "- **Das Eine:** $fokus" }
  if ($auftrag) { $extra += "- **Übergabe an Claude:** $auftrag" }
  foreach ($e in $entschieden) {
    $extra += "- **Entschieden** ($(ConvertTo-GedText (Get-GedFeld $e 'id'))): $(ConvertTo-GedText (Get-GedFeld $e 'frage')) → $(ConvertTo-GedText (Get-GedFeld $e 'antwort'))"
  }
  if ($off.Count) { $extra += "- **Noch offen:** " + ($off -join ', ') }
  if ($extra.Count) { $md += "`n---`n`n" + ($extra -join "`n") + "`n" }

  # Zweiter Checkin derselben Art am selben Tag: alte Fassung nach checkins\_alt\<name>-<HHmm>.* sichern.
  if (Test-Path -LiteralPath (Join-Path $dir "$name.md")) {
    $alt = Join-Path $dir '_alt'
    if (-not (Test-Path -LiteralPath $alt)) { New-Item -ItemType Directory -Force $alt | Out-Null }
    $stempel = Get-GedJetzt 'HHmm'
    foreach ($x in 'md','json') {
      $q = Join-Path $dir "$name.$x"
      if (Test-Path -LiteralPath $q) { Copy-Item -LiteralPath $q -Destination (Join-Path $alt "$name-$stempel.$x") -Force }
    }
  }
  Write-GedAtomar (Join-Path $dir "$name.md") $md
  $js = [ordered]@{ art = $art; datum = $datum; titel = $titel; empfangen = $jetzt; fokus = $fokus
                    auftrag = $auftrag; entschieden = @(ConvertTo-GedRoh $entschieden); offen = $off
                    quelle = $quelle; antworten = (ConvertTo-GedRoh (Get-GedFeld $in 'antworten'))
                    wahl = (ConvertTo-GedRoh (Get-GedFeld $in 'wahl')); text = $text }
  Write-GedAtomar (Join-Path $dir "$name.json") ($js | ConvertTo-Json -Depth 8)

  # Entschiedenes ins Rückfragen-Gedächtnis: wird auf keinem Gerät noch einmal gefragt.
  $na = 0
  foreach ($e in $entschieden) {
    $id = ConvertTo-GedText (Get-GedFeld $e 'id')
    if (-not $id) { continue }
    if (Add-Antwort $id (ConvertTo-GedText (Get-GedFeld $e 'antwort')) $datum (ConvertTo-GedText (Get-GedFeld $e 'frage')) "checkin:$art") { $na++ }
  }
  if ($na) { Save-Antworten }
  Write-Host ("[{0}] Checkin <- {1} ({2}.md){3}" -f (Get-Date -Format 'HH:mm:ss'), $art, $name, $(if ($na) { ", $na Antworten gemerkt" } else { '' })) -ForegroundColor Green
  return @{ code = 200; antwort = @{ ok = $true; datei = "checkins\$name.md"; art = $art; datum = $datum; ordner = $dir; board = $null } }
}

function Get-Checkins([string]$limitText, [string]$filter, [bool]$voll) {
  $dir = Get-GedPfad 'checkins'
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  $limit = 5
  if ($limitText) { $n = 0; if ([int]::TryParse($limitText, [ref]$n)) { $limit = [Math]::Max(1, [Math]::Min(60, $n)) } }
  $liste = @()
  foreach ($f in @(Get-GedCheckinDateien $dir $true)) {
    $o = $null
    try { $o = Read-GedJson $f.FullName } catch { continue }
    if ($null -eq $o -or $o -isnot [Management.Automation.PSCustomObject]) { continue }
    if ($filter -and (ConvertTo-GedText (Get-GedFeld $o 'art')) -ne $filter) { continue }
    if (-not $voll) { foreach ($w in 'text','antworten','wahl') { $o.PSObject.Properties.Remove($w) } }
    # Zurück so, wie es in der Datei steht — auch unter PowerShell 7 ohne [datetime]-Umdeutung.
    $liste += ,(ConvertTo-GedRoh $o)
    if ($liste.Count -ge $limit) { break }
  }
  return @{ ok = $true; anzahl = $liste.Count; ordner = $dir; checkins = $liste }
}

# ---------- Router ----------
# Gibt $true zurück, wenn die Anfrage beantwortet ist (auch bei 400), sonst $false.
function Invoke-GedaechtnisRoute($ctx, $req, [string]$path) {
  if ($path -eq '/api/antworten') {
    if ($req.HttpMethod -eq 'POST') {
      $ok = $false; $in = Read-JsonBody $ctx ([ref]$ok); if (-not $ok) { return $true }
      $n = 0
      # a) eine einzelne Antwort, gerade gegeben: {id, antwort, ts, frage}
      $id = ConvertTo-GedText (Get-GedFeld $in 'id')
      if ($id) {
        if (Add-Antwort $id (ConvertTo-GedText (Get-GedFeld $in 'antwort')) (ConvertTo-GedTag (Get-GedFeld $in 'ts')) (ConvertTo-GedText (Get-GedFeld $in 'frage')) 'compass' -direkt) { $n++ }
      }
      # b) der ganze Speicher des Browsers: {antworten:{id:{a,ts,frage}}}
      foreach ($p in @(Get-GedEintraege (Get-GedFeld $in 'antworten'))) {
        $w = $p.Value
        if (Add-Antwort $p.Name (ConvertTo-GedText (Get-GedFeld $w 'a')) (ConvertTo-GedTag (Get-GedFeld $w 'ts')) (ConvertTo-GedText (Get-GedFeld $w 'frage')) 'compass') { $n++ }
      }
      if ($n) { Save-Antworten; Write-Host ("[{0}] Antworten <- {1} neu ({2} gesamt)" -f (Get-Date -Format 'HH:mm:ss'), $n, (Read-Antworten).Count) -ForegroundColor Green }
      Send-Json $ctx @{ ok = $true; neu = $n; anzahl = (Read-Antworten).Count; antworten = (Read-Antworten) }
      return $true
    }
    Send-Json $ctx (Add-Kaputt @{ ok = $true; anzahl = (Read-Antworten).Count; datei = (Get-GedPfad 'antworten.json'); antworten = (Read-Antworten) })
    return $true
  }

  if ($path -eq '/api/einstellungen') {
    if ($req.HttpMethod -eq 'POST') {
      $ok = $false; $in = Read-JsonBody $ctx ([ref]$ok); if (-not $ok) { return $true }
      $n = 0
      # a) eine einzelne Vorliebe, gerade umgestellt: {key, wert, ts}
      $key = ConvertTo-GedText (Get-GedFeld $in 'key')
      if ($key) {
        if (Add-Einstellung $key (ConvertTo-GedText (Get-GedFeld $in 'wert')) (ConvertTo-GedSekunde (Get-GedFeld $in 'ts')) 'compass') { $n++ }
      }
      # b) alles, was der Browser hat: {einstellungen:{theme:{wert,ts},…}}
      foreach ($p in @(Get-GedEintraege (Get-GedFeld $in 'einstellungen'))) {
        if (Add-Einstellung $p.Name (ConvertTo-GedText (Get-GedFeld $p.Value 'wert')) (ConvertTo-GedSekunde (Get-GedFeld $p.Value 'ts')) 'compass') { $n++ }
      }
      # Gespeichert wird, sobald etwas angenommen wurde — auch ein nur nachgezogener Zeitstempel;
      # ein Abgleich ohne Neues schreibt nichts (der Compass gleicht bei jedem Laden ab).
      if ($script:EinstBeruehrt) { Save-Einstellungen; $script:EinstBeruehrt = $false }
      if ($n) { Write-Host ("[{0}] Einstellungen <- {1} geaendert" -f (Get-Date -Format 'HH:mm:ss'), $n) -ForegroundColor Green }
      Send-Json $ctx @{ ok = $true; neu = $n; einstellungen = (Read-Einstellungen) }
      return $true
    }
    Send-Json $ctx @{ ok = $true; datei = (Get-GedPfad 'einstellungen.json'); erlaubt = $script:EinstErlaubt; einstellungen = (Read-Einstellungen) }
    return $true
  }

  if ($path -eq '/api/checkin') {
    if ($req.HttpMethod -eq 'POST') {
      $ok = $false; $in = Read-JsonBody $ctx ([ref]$ok); if (-not $ok) { return $true }
      $r = Save-Checkin $in
      Send-Json $ctx $r.antwort $r.code
      return $true
    }
    $qs = $req.QueryString
    Send-Json $ctx (Get-Checkins ([string]$qs['limit']) ([string]$qs['art']) ($qs['voll'] -eq '1'))
    return $true
  }

  return $false
}
