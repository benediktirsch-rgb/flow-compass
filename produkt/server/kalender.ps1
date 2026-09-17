# Existing local ICS reader, moved to the cloud without exposing feed URLs.
# Source: john-server.ps1 calendar section; no provider/account changes.
$KalenderCacheSec = 600
$KalenderTitelTsv = '' # Desktop title overrides are not available in the cloud.
$ArbeitszeitVon = '08:00'
$ArbeitszeitBis = '18:00'
$HttpKurz = [System.Net.Http.HttpClient]::new()
$HttpKurz.Timeout = [TimeSpan]::FromSeconds(20)
$script:IcsDow = @{ 'SU' = 0; 'MO' = 1; 'TU' = 2; 'WE' = 3; 'TH' = 4; 'FR' = 5; 'SA' = 6 }
# IANA → Windows-Zeitzonen. .NET Framework kennt nur die Windows-Namen; was hier fehlt, wird als
# lokale Zeit gelesen — für Benes Kalender (Europe/Berlin = lokal) ist das ohnehin dasselbe.
$script:IcsTz = @{
  'Europe/Berlin' = 'W. Europe Standard Time'; 'Europe/Vienna' = 'W. Europe Standard Time'
  'Europe/Zurich' = 'W. Europe Standard Time'; 'Europe/Amsterdam' = 'W. Europe Standard Time'
  'Europe/Rome' = 'W. Europe Standard Time'; 'Europe/Stockholm' = 'W. Europe Standard Time'
  'Europe/Paris' = 'Romance Standard Time'; 'Europe/Madrid' = 'Romance Standard Time'
  'Europe/Brussels' = 'Romance Standard Time'; 'Europe/Copenhagen' = 'Romance Standard Time'
  'Europe/London' = 'GMT Standard Time'; 'Europe/Dublin' = 'GMT Standard Time'
  'Europe/Lisbon' = 'GMT Standard Time'; 'Europe/Prague' = 'Central Europe Standard Time'
  'Europe/Budapest' = 'Central Europe Standard Time'; 'Europe/Warsaw' = 'Central European Standard Time'
  'Europe/Athens' = 'GTB Standard Time'; 'Europe/Helsinki' = 'FLE Standard Time'
  'Europe/Kiev' = 'FLE Standard Time'; 'Europe/Istanbul' = 'Turkey Standard Time'
  'Europe/Moscow' = 'Russian Standard Time'; 'UTC' = 'UTC'; 'Etc/UTC' = 'UTC'; 'GMT' = 'UTC'
  'America/New_York' = 'Eastern Standard Time'; 'America/Chicago' = 'Central Standard Time'
  'America/Denver' = 'Mountain Standard Time'; 'America/Los_Angeles' = 'Pacific Standard Time'
  'America/Sao_Paulo' = 'E. South America Standard Time'
  'Asia/Kolkata' = 'India Standard Time'; 'Asia/Calcutta' = 'India Standard Time'
  'Asia/Dubai' = 'Arabian Standard Time'; 'Asia/Jerusalem' = 'Israel Standard Time'
  'Asia/Tokyo' = 'Tokyo Standard Time'; 'Asia/Shanghai' = 'China Standard Time'
  'Asia/Hong_Kong' = 'China Standard Time'; 'Asia/Singapore' = 'Singapore Standard Time'
  'Asia/Bangkok' = 'SE Asia Standard Time'; 'Australia/Sydney' = 'AUS Eastern Standard Time'
  'Pacific/Auckland' = 'New Zealand Standard Time'
}

function Get-KalenderQuellen {
  # User-Scope zuerst (live aus der Registry, wirkt ohne Neustart), dann Prozess, dann Datei.
  foreach ($scope in @('User', 'Process')) {
    $v = [Environment]::GetEnvironmentVariable('GCAL_ICS', $scope)
    if (-not $v -or -not $v.Trim() -or $v -like '<*') { continue }
    $out = @()
    foreach ($teil in ($v -split '[;\r\n]')) {
      $t = $teil.Trim()
      if (-not $t) { continue }
      $name = ''; $url = $t
      $m = [regex]::Match($t, '^([^=]{1,40})=\s*((?:https?|webcal)://.+)$')
      if ($m.Success) { $name = $m.Groups[1].Value.Trim(); $url = $m.Groups[2].Value.Trim() }
      if ($url -notmatch '^(https?|webcal)://') { continue }
      if (-not $name) { $name = 'Kalender' }
      $out += , @{ name = $name; url = $url; quelle = "env:$scope" }
    }
    if ($out.Count) { return $out }
  }
  $f = Join-Path $PSScriptRoot 'kalender-urls.json'
  if (Test-Path $f) {
    try {
      $j = (Get-Content $f -Raw -Encoding UTF8) | ConvertFrom-Json
      $out = @()
      foreach ($p in $j.PSObject.Properties) {
        $u = ([string]$p.Value).Trim()
        if ($u -match '^(https?|webcal)://') { $out += , @{ name = $p.Name; url = $u; quelle = 'kalender-urls.json' } }
      }
      if ($out.Count) { return $out }
    } catch { Write-Host "  kalender-urls.json unlesbar: $($_.Exception.Message)" -ForegroundColor Yellow }
  }
  return @()
}

function Get-IcsText([string]$url) {
  $u = $url -replace '^webcal://', 'https://'
  $res = $HttpKurz.GetAsync($u).GetAwaiter().GetResult()
  if (-not $res.IsSuccessStatusCode) { throw "HTTP $([int]$res.StatusCode)" }
  $bytes = $res.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
  $text = [Text.Encoding]::UTF8.GetString($bytes)
  if ($text -notmatch 'BEGIN:VCALENDAR') { throw 'KEIN_ICAL' }
  return $text
}

# Eine iCal-Zeile ist NAME;PARAM=WERT:Inhalt — der Doppelpunkt zählt nur außerhalb von Anführungszeichen
# (Parameter dürfen welche enthalten, und der Inhalt ist oft eine URL mit https://).
function Split-IcsLine([string]$line) {
  $inQ = $false; $idx = -1
  for ($i = 0; $i -lt $line.Length; $i++) {
    $c = $line[$i]
    if ($c -eq '"') { $inQ = -not $inQ }
    elseif ($c -eq ':' -and -not $inQ) { $idx = $i; break }
  }
  if ($idx -lt 0) { return $null }
  $stueck = ($line.Substring(0, $idx) -split ';')
  $par = @{}
  for ($i = 1; $i -lt $stueck.Count; $i++) {
    $kv = $stueck[$i] -split '=', 2
    if ($kv.Count -eq 2) { $par[$kv[0].Trim().ToUpperInvariant()] = $kv[1].Trim().Trim('"') }
  }
  return @{ name = $stueck[0].Trim().ToUpperInvariant(); value = $line.Substring($idx + 1); params = $par }
}

function Expand-IcsText([string]$v) {
  return ($v -replace '\\[nN]', "`n" -replace '\\,', ',' -replace '\\;', ';' -replace '\\\\', '\').Trim()
}

function ConvertFrom-IcsDate([string]$val, $par) {
  $v = ([string]$val).Trim()
  if (-not $v) { return $null }
  if (-not $par) { $par = @{} }
  try {
    if ($par['VALUE'] -eq 'DATE' -or $v.Length -eq 8) {
      return @{ zeit = [datetime]::ParseExact($v.Substring(0, 8), 'yyyyMMdd', [Globalization.CultureInfo]::InvariantCulture); ganztags = $true }
    }
    $utc = $v.EndsWith('Z')
    $core = $v.TrimEnd('Z')
    if ($core.Length -lt 15) { return $null }
    $dt = [datetime]::ParseExact($core.Substring(0, 15), "yyyyMMdd'T'HHmmss", [Globalization.CultureInfo]::InvariantCulture)
    if ($utc) { return @{ zeit = ([datetime]::SpecifyKind($dt, [DateTimeKind]::Utc)).ToLocalTime(); ganztags = $false } }
    $tzid = [string]$par['TZID']
    if ($tzid -and $script:IcsTz.ContainsKey($tzid)) {
      try {
        $tz = [TimeZoneInfo]::FindSystemTimeZoneById($script:IcsTz[$tzid])
        $u = [TimeZoneInfo]::ConvertTimeToUtc([datetime]::SpecifyKind($dt, [DateTimeKind]::Unspecified), $tz)
        return @{ zeit = $u.ToLocalTime(); ganztags = $false }
      } catch {}
    }
    return @{ zeit = $dt; ganztags = $false }   # schwebende Zeit → als lokale Zeit lesen
  } catch { return $null }
}

function ConvertFrom-IcsText([string]$text, [string]$kalName) {
  # Entfalten: eine Fortsetzungszeile beginnt mit Leerzeichen oder Tab und gehört an die vorige.
  $lines = New-Object 'System.Collections.Generic.List[string]'
  foreach ($raw in ($text -split '\r?\n')) {
    if ($raw.Length -gt 0 -and ($raw[0] -eq ' ' -or $raw[0] -eq "`t") -and $lines.Count -gt 0) {
      $lines[$lines.Count - 1] = $lines[$lines.Count - 1] + $raw.Substring(1)
    } else { $lines.Add($raw) }
  }
  $events = New-Object 'System.Collections.ArrayList'
  $cur = $null
  foreach ($line in $lines) {
    if ($line -eq 'BEGIN:VEVENT') { $cur = @{ kal = $kalName; exdate = New-Object 'System.Collections.ArrayList' }; continue }
    if ($line -eq 'END:VEVENT') { if ($cur -and $cur.start) { [void]$events.Add($cur) }; $cur = $null; continue }
    if (-not $cur) { continue }
    $p = Split-IcsLine $line
    if (-not $p) { continue }
    switch ($p.name) {
      'UID' { $cur.uid = $p.value.Trim() }
      'SUMMARY' { $cur.titel = Expand-IcsText $p.value }
      'LOCATION' { $cur.ort = Expand-IcsText $p.value }
      'STATUS' { $cur.status = $p.value.Trim().ToUpperInvariant() }
      'TRANSP' { $cur.transp = $p.value.Trim().ToUpperInvariant() }
      'RRULE' { $cur.rrule = $p.value.Trim() }
      'DURATION' { $cur.dauer = $p.value.Trim() }
      'DTSTART' { $d = ConvertFrom-IcsDate $p.value $p.params; if ($d) { $cur.start = $d.zeit; $cur.ganztags = $d.ganztags } }
      'DTEND' { $d = ConvertFrom-IcsDate $p.value $p.params; if ($d) { $cur.ende = $d.zeit } }
      'RECURRENCE-ID' { $d = ConvertFrom-IcsDate $p.value $p.params; if ($d) { $cur.recId = $d.zeit } }
      'EXDATE' {
        foreach ($x in ($p.value -split ',')) { $d = ConvertFrom-IcsDate $x $p.params; if ($d) { [void]$cur.exdate.Add($d.zeit) } }
      }
    }
  }
  return $events
}

function ConvertFrom-Rrule([string]$s) {
  $r = @{ freq = ''; interval = 1; count = 0; until = $null; byday = @(); bymonthday = @(); bymonth = @(); wkst = 'MO' }
  foreach ($kv in ($s -split ';')) {
    $p = $kv -split '=', 2
    if ($p.Count -lt 2) { continue }
    $k = $p[0].Trim().ToUpperInvariant(); $v = $p[1].Trim()
    switch ($k) {
      'FREQ' { $r.freq = $v.ToUpperInvariant() }
      'INTERVAL' { $n = 0; if ([int]::TryParse($v, [ref]$n) -and $n -gt 0) { $r.interval = $n } }
      'COUNT' { $n = 0; if ([int]::TryParse($v, [ref]$n) -and $n -gt 0) { $r.count = $n } }
      'UNTIL' { $d = ConvertFrom-IcsDate $v @{}; if ($d) { $r.until = $d.zeit } }
      'BYDAY' { $r.byday = @(($v.ToUpperInvariant() -split ',') | Where-Object { $_ }) }
      'BYMONTHDAY' { $r.bymonthday = @(($v -split ',') | ForEach-Object { $n = 0; if ([int]::TryParse($_.Trim(), [ref]$n)) { $n } }) }
      'BYMONTH' { $r.bymonth = @(($v -split ',') | ForEach-Object { $n = 0; if ([int]::TryParse($_.Trim(), [ref]$n)) { $n } }) }
      'WKST' { $r.wkst = $v.ToUpperInvariant() }
    }
  }
  return $r
}

# Dauer eines Termins: DTEND, sonst DURATION, sonst 1 Tag (ganztägig) bzw. 1 Stunde.
function Get-IcsDauer($e) {
  if ($e.ende) { $d = ([datetime]$e.ende) - ([datetime]$e.start); if ($d.TotalMinutes -gt 0) { return $d } }
  if ($e.dauer) {
    $m = [regex]::Match([string]$e.dauer, '^-?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$')
    if ($m.Success) {
      $g = { param($i) if ($m.Groups[$i].Success) { [int]$m.Groups[$i].Value } else { 0 } }
      $ts = New-TimeSpan -Days ((& $g 1) * 7 + (& $g 2)) -Hours (& $g 3) -Minutes (& $g 4) -Seconds (& $g 5)
      if ($ts.TotalMinutes -gt 0) { return $ts }
    }
  }
  if ($e.ganztags) { return (New-TimeSpan -Days 1) }
  return (New-TimeSpan -Hours 1)
}

# Alle Startzeitpunkte einer Serie von DTSTART bis $bis. COUNT zählt ab dem ersten Vorkommen,
# auch wenn das lange vor dem Fenster liegt — deshalb wird von vorn gerechnet und erst danach
# aufs Fenster geschnitten. $max deckelt Endlosregeln (tägliche Serie seit 2010 ≈ 6000 Schritte).
function Get-IcsKandidaten($e, $r, [datetime]$bis) {
  $start = [datetime]$e.start
  $grenze = $bis
  if ($r.until -and $r.until -lt $grenze) { $grenze = $r.until }
  $kand = New-Object 'System.Collections.ArrayList'
  $max = 5000
  if ($start -gt $grenze) { return @() }
  switch ($r.freq) {
    'DAILY' {
      $cur = $start
      # Ohne COUNT darf direkt vor das Fenster gesprungen werden (spart Tausende Schritte).
      if ($r.count -le 0 -and $cur -lt $bis.AddDays(-370)) {
        $spr = [Math]::Floor((($bis.AddDays(-370)) - $cur).TotalDays / $r.interval)
        if ($spr -gt 0) { $cur = $cur.AddDays($spr * $r.interval) }
      }
      while ($cur -le $grenze -and $kand.Count -lt $max) { [void]$kand.Add($cur); $cur = $cur.AddDays($r.interval) }
    }
    'WEEKLY' {
      $tage = @()
      foreach ($d in $r.byday) {
        if ($d.Length -lt 2) { continue }
        $k = $d.Substring($d.Length - 2)
        if ($script:IcsDow.ContainsKey($k)) { $tage += $script:IcsDow[$k] }
      }
      if (-not $tage.Count) { $tage = @([int]$start.DayOfWeek) }
      $wkst = 1; if ($script:IcsDow.ContainsKey($r.wkst)) { $wkst = $script:IcsDow[$r.wkst] }
      $wochenStart = $start.Date.AddDays(-((([int]$start.DayOfWeek) - $wkst + 7) % 7))
      if ($r.count -le 0 -and $wochenStart -lt $bis.AddDays(-370)) {
        $spr = [Math]::Floor((($bis.AddDays(-370)) - $wochenStart).TotalDays / (7 * $r.interval))
        if ($spr -gt 0) { $wochenStart = $wochenStart.AddDays($spr * 7 * $r.interval) }
      }
      $tage = @($tage | Sort-Object -Unique)
      while ($wochenStart -le $grenze -and $kand.Count -lt $max) {
        foreach ($t in $tage) {
          $c = $wochenStart.AddDays((($t - $wkst + 7) % 7)).Add($start.TimeOfDay)
          if ($c -ge $start -and $c -le $grenze) { [void]$kand.Add($c) }
        }
        $wochenStart = $wochenStart.AddDays(7 * $r.interval)
      }
    }
    'MONTHLY' {
      $monat = [datetime]::new($start.Year, $start.Month, 1)
      while ($monat -le $grenze -and $kand.Count -lt $max) {
        foreach ($c in (Get-IcsMonatstage $monat $r $start)) {
          if ($c -ge $start -and $c -le $grenze) { [void]$kand.Add($c) }
        }
        $monat = $monat.AddMonths($r.interval)
      }
    }
    'YEARLY' {
      $cur = $start
      while ($cur -le $grenze -and $kand.Count -lt $max) { [void]$kand.Add($cur); $cur = $cur.AddYears($r.interval) }
    }
    default { [void]$kand.Add($start) }
  }
  $erg = @($kand | Sort-Object)
  if ($r.bymonth.Count) { $erg = @($erg | Where-Object { $r.bymonth -contains $_.Month }) }
  if ($r.count -gt 0 -and $erg.Count -gt $r.count) { $erg = @($erg[0..($r.count - 1)]) }
  return $erg
}

# Die Tage eines Monats, auf die eine MONTHLY-Regel zeigt: BYMONTHDAY (auch -1 = letzter),
# BYDAY mit Ordnungszahl (3TU = dritter Dienstag, -1FR = letzter Freitag) oder der Tag aus DTSTART.
function Get-IcsMonatstage([datetime]$monat, $r, [datetime]$start) {
  $tage = New-Object 'System.Collections.ArrayList'
  $letzter = [datetime]::DaysInMonth($monat.Year, $monat.Month)
  if ($r.bymonthday.Count) {
    foreach ($md in $r.bymonthday) {
      $tag = $(if ($md -lt 0) { $letzter + 1 + $md } else { $md })
      if ($tag -ge 1 -and $tag -le $letzter) { [void]$tage.Add(([datetime]::new($monat.Year, $monat.Month, $tag)).Add($start.TimeOfDay)) }
    }
  } elseif ($r.byday.Count) {
    foreach ($bd in $r.byday) {
      $m = [regex]::Match($bd, '^(-?\d)?([A-Z]{2})$')
      if (-not $m.Success -or -not $script:IcsDow.ContainsKey($m.Groups[2].Value)) { continue }
      $dow = $script:IcsDow[$m.Groups[2].Value]
      $treffer = @()
      for ($t = 1; $t -le $letzter; $t++) {
        $d = [datetime]::new($monat.Year, $monat.Month, $t)
        if ([int]$d.DayOfWeek -eq $dow) { $treffer += $d }
      }
      $ord = 0; if ($m.Groups[1].Success) { $ord = [int]$m.Groups[1].Value }
      if ($ord -gt 0 -and $treffer.Count -ge $ord) { [void]$tage.Add($treffer[$ord - 1].Add($start.TimeOfDay)) }
      elseif ($ord -lt 0 -and $treffer.Count -ge - $ord) { [void]$tage.Add($treffer[$treffer.Count + $ord].Add($start.TimeOfDay)) }
      elseif ($ord -eq 0) { foreach ($d in $treffer) { [void]$tage.Add($d.Add($start.TimeOfDay)) } }
    }
  } else {
    [void]$tage.Add(([datetime]::new($monat.Year, $monat.Month, [Math]::Min($start.Day, $letzter))).Add($start.TimeOfDay))
  }
  return @($tage | Sort-Object)
}

# Belegte Minuten im Arbeitsfenster eines Tages (Überschneidungen zusammengelegt) + die Lücken.
# Ganztägige Termine und alles, was im Kalender auf "frei" steht (TRANSP:TRANSPARENT), zählen nicht
# als belegt — ein Geburtstag blockiert keine Arbeitszeit.
function Get-IcsBelegung($termine, [datetime]$fVon, [datetime]$fBis, [int]$minLuecke = 30) {
  $iv = @()
  foreach ($t in $termine) {
    if ($t.ganztags -or $t.frei) { continue }
    $a = [datetime]$t.start; $b = [datetime]$t.ende
    if ($a -lt $fVon) { $a = $fVon }
    if ($b -gt $fBis) { $b = $fBis }
    if ($b -gt $a) { $iv += , @($a, $b) }
  }
  $iv = @($iv | Sort-Object { $_[0] })
  $merged = New-Object 'System.Collections.ArrayList'
  foreach ($x in $iv) {
    if ($merged.Count -gt 0 -and $merged[$merged.Count - 1][1] -ge $x[0]) {
      if ($x[1] -gt $merged[$merged.Count - 1][1]) { $merged[$merged.Count - 1][1] = $x[1] }
    } else { [void]$merged.Add(@($x[0], $x[1])) }
  }
  $belegt = 0
  foreach ($m in $merged) { $belegt += [int](($m[1] - $m[0]).TotalMinutes) }
  $luecken = @()
  $cur = $fVon
  foreach ($m in $merged) {
    $min = [int](($m[0] - $cur).TotalMinutes)
    if ($min -ge $minLuecke) { $luecken += , @{ von = $cur.ToString('HH:mm'); bis = $m[0].ToString('HH:mm'); minuten = $min } }
    if ($m[1] -gt $cur) { $cur = $m[1] }
  }
  $min = [int](($fBis - $cur).TotalMinutes)
  if ($min -ge $minLuecke) { $luecken += , @{ von = $cur.ToString('HH:mm'); bis = $fBis.ToString('HH:mm'); minuten = $min } }
  $fenster = [int](($fBis - $fVon).TotalMinutes)
  return @{ belegt = $belegt; frei = [Math]::Max(0, $fenster - $belegt); luecken = @($luecken) }
}

function ConvertTo-KalenderTermin($t, [datetime]$tag) {
  $s = [datetime]$t.start; $e = [datetime]$t.ende
  $zeit = 'ganztägig'
  if (-not $t.ganztags) {
    $vonTxt = $(if ($s.Date -lt $tag) { '…' } else { $s.ToString('HH:mm') })
    $bisTxt = $(if ($e.Date -gt $tag -or ($e.Date -eq $tag -and $e.TimeOfDay -eq [TimeSpan]::Zero -and $e -gt $s)) { '…' } else { $e.ToString('HH:mm') })
    $zeit = "$vonTxt–$bisTxt"
  }
  return @{
    titel = $(if ($t.titel) { $t.titel } else { '(ohne Titel)' })
    ort = $t.ort; kal = $t.kal; zeit = $zeit
    start = $s.ToString('s'); ende = $e.ToString('s')
    minuten = [int](($e - $s).TotalMinutes)
    ganztags = [bool]$t.ganztags; frei = [bool]$t.frei
    vorlaeufig = [bool]$t.vorlaeufig; ohneTitel = [bool]$t.ohneTitel
  }
}

# ---------- Titel-Wörterbuch für Frei/Gebucht-Feeds (02.09.2026) ----------
# Liest $KalenderTitelTsv (DATUM<TAB>START<TAB>TITEL) und hält je "yyyy-MM-dd|HH:mm" die Liste der Titel.
# Neu gelesen wird nur, wenn sich eine Datei geändert hat (Signatur aus Pfad + Schreibzeit).
$script:TitelCache = @{ sig = $null; map = @{}; stand = $null; dateien = @(); eintraege = 0 }
function Get-KalenderTitel {
  $dateien = @(([string]$KalenderTitelTsv -split ';') | ForEach-Object { $_.Trim() } | Where-Object { $_ -and (Test-Path -LiteralPath $_) })
  $sig = (@($dateien | ForEach-Object { $_ + '|' + (Get-Item -LiteralPath $_).LastWriteTimeUtc.Ticks }) -join ';')
  if ($sig -eq $script:TitelCache.sig) { return $script:TitelCache }
  $map = @{}; $stand = $null; $n = 0
  foreach ($f in $dateien) {
    try {
      foreach ($z in [IO.File]::ReadAllLines($f, [Text.Encoding]::UTF8)) {
        $t = $z -split "`t"
        if ($t.Count -lt 3) { continue }
        $d = $t[0].Trim(); $u = $t[1].Trim(); $titel = (($t[2..($t.Count - 1)]) -join ' ').Trim()
        if ($d -notmatch '^\d{4}-\d{2}-\d{2}$' -or $u -notmatch '^\d{1,2}:\d{2}$' -or -not $titel) { continue }
        if ($u.Length -eq 4) { $u = '0' + $u }
        $k = "$d|$u"
        if (-not $map.ContainsKey($k)) { $map[$k] = New-Object 'System.Collections.ArrayList' }
        [void]$map[$k].Add($titel); $n++
      }
      $lw = (Get-Item -LiteralPath $f).LastWriteTime
      if (-not $stand -or $lw -gt $stand) { $stand = $lw }
    } catch { Write-Host "  Titel-Wörterbuch '$f' unlesbar: $($_.Exception.Message)" -ForegroundColor Yellow }
  }
  $script:TitelCache = @{ sig = $sig; map = $map; stand = $stand; dateien = $dateien; eintraege = $n }
  return $script:TitelCache
}

$script:KalCache = @{ zeit = $null; out = $null; tage = 0 }
function Get-Kalender([int]$tage, [bool]$fresh) {
  if ($tage -lt 1) { $tage = 7 }
  if ($tage -gt 31) { $tage = 31 }
  $cc = $script:KalCache
  if (-not $fresh -and $cc.out -and $cc.tage -eq $tage -and $cc.zeit -and ((Get-Date) - $cc.zeit).TotalSeconds -lt $KalenderCacheSec) { return $cc.out }
  $quellen = Get-KalenderQuellen
  if (-not $quellen.Count) {
    return @{ ok = $false; error = 'NO_ICS'
      hint = 'Keine Kalenderadresse hinterlegt. Google Kalender → Einstellungen → Kalender auswählen → "Kalender integrieren" → "Geheime Adresse im iCal-Format" kopieren, dann in PowerShell: [Environment]::SetEnvironmentVariable(''GCAL_ICS'',''Privat=<adresse>'',''User'') — wirkt ohne Neustart.' }
  }
  $heute = (Get-Date).Date
  $bis = $heute.AddDays($tage)
  $roh = New-Object 'System.Collections.ArrayList'
  $kalInfo = @()
  foreach ($q in $quellen) {
    try {
      $evs = ConvertFrom-IcsText (Get-IcsText $q.url) $q.name
      foreach ($e in $evs) { [void]$roh.Add($e) }
      $kalInfo += , @{ name = $q.name; ok = $true; eintraege = $evs.Count; quelle = $q.quelle }
    } catch {
      $kalInfo += , @{ name = $q.name; ok = $false; eintraege = 0; quelle = $q.quelle; fehler = $_.Exception.GetType().Name }
      Write-Host "Kalenderquelle nicht erreichbar"
    }
  }
  # Verschobene Einzeltermine einer Serie stehen als eigener Eintrag mit RECURRENCE-ID drin.
  # Das Original an dieser Stelle muss raus, sonst steht der Termin zweimal (alt + neu) im Tag.
  $ersetzt = @{}
  foreach ($e in $roh) {
    if ($e.recId -and $e.uid) { $ersetzt[($e.uid + '|' + ([datetime]$e.recId).ToString('yyyyMMddHHmm'))] = $true }
  }
  $alle = New-Object 'System.Collections.ArrayList'
  foreach ($e in $roh) {
    if ($e.status -eq 'CANCELLED') { continue }
    $dauer = Get-IcsDauer $e
    $ex = @{}
    foreach ($x in $e.exdate) { $ex[([datetime]$x).ToString('yyyyMMddHHmm')] = $true }
    $kand = $null
    if ($e.rrule -and -not $e.recId) { $kand = Get-IcsKandidaten $e (ConvertFrom-Rrule $e.rrule) $bis }
    else { $kand = @([datetime]$e.start) }
    foreach ($s in $kand) {
      $key = $s.ToString('yyyyMMddHHmm')
      if ($ex.ContainsKey($key)) { continue }
      if ($e.rrule -and $e.uid -and $ersetzt.ContainsKey($e.uid + '|' + $key)) { continue }
      $ende = $s + $dauer
      if ($s -ge $bis -or $ende -le $heute) { continue }
      # Frei/Gebucht-Feed: SUMMARY ist nur der Status, kein Titel — merken, damit unten das Wörterbuch greift.
      $block = ''
      if ([string]$e.titel -match '^\s*(Busy|Tentative|Free|Gebucht|Mit Vorbehalt|Frei)\s*$') { $block = $Matches[1].ToLowerInvariant() }
      [void]$alle.Add(@{ start = $s; ende = $ende; titel = $e.titel; ort = $e.ort; kal = $e.kal
                         ganztags = [bool]$e.ganztags; frei = ($e.transp -eq 'TRANSPARENT'); block = $block })
    }
  }
  # Titel für Frei/Gebucht-Blöcke aus dem Wörterbuch: je Datum+Startzeit der Reihe nach verbraucht —
  # zwei Blöcke um 10:35 bekommen zwei Titel, ein dritter bleibt ehrlich "Belegt". Je Kalender wird
  # gezählt, wie viele Blöcke einen Titel bekamen; das steht im Compass neben der Quelle.
  $wb = Get-KalenderTitel
  $verbraucht = @{}
  $titelStat = @{}
  foreach ($t in @($alle | Sort-Object { [datetime]$_.start })) {
    if (-not $t.block) { continue }
    if (-not $titelStat.ContainsKey($t.kal)) { $titelStat[$t.kal] = @{ bloecke = 0; mitTitel = 0 } }
    $titelStat[$t.kal].bloecke++
    $t.vorlaeufig = ($t.block -eq 'tentative' -or $t.block -eq 'mit vorbehalt')
    $istFrei = ($t.frei -or $t.block -eq 'free' -or $t.block -eq 'frei')
    $k = ([datetime]$t.start).ToString('yyyy-MM-dd|HH:mm')
    $i = 0; if ($verbraucht.ContainsKey($k)) { $i = $verbraucht[$k] }
    if (-not $t.ganztags -and $wb.map.ContainsKey($k) -and $i -lt $wb.map[$k].Count) {
      $t.titel = $wb.map[$k][$i]; $verbraucht[$k] = $i + 1; $t.ohneTitel = $false
      $titelStat[$t.kal].mitTitel++
    } else {
      $t.ohneTitel = $true
      $t.titel = $(if ($istFrei) { 'Frei' } elseif ($t.vorlaeufig) { 'Vorläufig belegt' } else { 'Belegt' })
    }
  }
  foreach ($ki in $kalInfo) {
    if ($titelStat.ContainsKey($ki.name)) {
      $ki.bloecke = $titelStat[$ki.name].bloecke; $ki.mitTitel = $titelStat[$ki.name].mitTitel
      $ki.titelStand = $(if ($wb.stand) { $wb.stand.ToString('yyyy-MM-dd') } else { $null })
    }
  }
  $fVon = [TimeSpan]::Parse($ArbeitszeitVon)
  $fBis = [TimeSpan]::Parse($ArbeitszeitBis)
  $wt = @('So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa')
  $tageOut = @()
  for ($i = 0; $i -lt $tage; $i++) {
    $tag = $heute.AddDays($i)
    $bisTag = $tag.AddDays(1)
    $drin = @($alle | Where-Object { ([datetime]$_.start) -lt $bisTag -and ([datetime]$_.ende) -gt $tag } | Sort-Object { [datetime]$_.start })
    $bel = Get-IcsBelegung $drin $tag.Add($fVon) $tag.Add($fBis)
    $tageOut += , @{
      datum = $tag.ToString('yyyy-MM-dd'); wochentag = $wt[[int]$tag.DayOfWeek]
      n = $drin.Count
      termine = @($drin | Where-Object { -not $_.ganztags } | ForEach-Object { ConvertTo-KalenderTermin $_ $tag })
      ganztags = @($drin | Where-Object { $_.ganztags } | ForEach-Object { ConvertTo-KalenderTermin $_ $tag })
      belegt = $bel.belegt; frei = $bel.frei; luecken = $bel.luecken
      freiStunden = [Math]::Round($bel.frei / 60, 1)
    }
  }
  $jetzt = Get-Date
  $naechster = $null
  $kommend = @($alle | Where-Object { -not $_.ganztags -and ([datetime]$_.ende) -gt $jetzt } | Sort-Object { [datetime]$_.start })
  if ($kommend.Count) {
    $n = $kommend[0]
    $naechster = ConvertTo-KalenderTermin $n ([datetime]$n.start).Date
    $naechster['inMin'] = [Math]::Max(0, [int]((([datetime]$n.start) - $jetzt).TotalMinutes))
    $naechster['laeuft'] = (([datetime]$n.start) -le $jetzt)
    $naechster['datum'] = ([datetime]$n.start).ToString('yyyy-MM-dd')
  }
  $out = @{
    ok = $true; stand = $jetzt.ToString('o'); tage = $tage
    kalender = $kalInfo
    fenster = @{ von = $ArbeitszeitVon; bis = $ArbeitszeitBis; minuten = [int](($fBis - $fVon).TotalMinutes) }
    heute = $tageOut[0]; naechster = $naechster
    woche = $tageOut
  }
  $script:KalCache = @{ zeit = Get-Date; out = $out; tage = $tage }
  return $out
}


function Invoke-KalenderRoute($ctx, $req, [string]$path) {
  if ($path -notin @('/api/kalender','/api/kalender/status')) { return $false }
  if ($req.HttpMethod -ne 'GET') { Send-Json $ctx @{ok=$false;error='NUR_LESEN'} 405; return $true }
  if ($path -eq '/api/kalender/status') {
    $quellen = @(Get-KalenderQuellen)
    Send-Json $ctx @{ok=$true;angebunden=($quellen.Count -gt 0);kalender=@($quellen | ForEach-Object { @{name=$_.name} })}
  } else {
    try {
      $r = Get-Kalender 7 ($req.QueryString['fresh'] -eq '1')
      $r.vollstaendig = (@($r.kalender | Where-Object {-not $_.ok}).Count -eq 0 -and [bool]$r.ok)
      Send-Json $ctx $r
    } catch { Send-Json $ctx @{ok=$false;error='KALENDER_FEHLER'} 503 }
  }
  return $true
}