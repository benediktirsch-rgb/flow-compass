# john-ausgabe.ps1 — die Erfolgs-Ausgabe im Kompass-Kino (11.09.2026)
#
# Bene: „als ein Chefredakteur der Bildzeitung agieren und hier aktuelle gute Nachrichten und Erfolge
# feuern. Abwechslungsreich mit Morgen- und Abendausgabe."
#
# Was hier steht (wird von john-server.ps1 dot-sourced, nach john-systembild.ps1):
#   - Die Folie „Anerkennung" lebte von einer Hand-Liste in dashboard-data.js, die seit dem 21.08. niemand
#     nachzog — am 11.09. stand dort noch „Wohnung gestrichen · 20.08.". Jetzt sammelt der Server die
#     Erfolge selbst, und zwar nur aus Quellen, die nicht lügen können: Commits aller Repos unter C:\dev
#     (ohne die automatischen), erledigte Jira-Vorgänge, Entscheidungen aus den Checkins, der Seiten-Wächter.
#   - Daraus macht EIN Claude-Aufruf eine Boulevard-Ausgabe: Schlagzeile, Dachzeile, Störer, drei bis vier
#     Meldungen, „Kompass meint". Jede Meldung muss auf Belege aus der Faktenliste zeigen, und jede Zahl im
#     Text muss in den Fakten vorkommen — sonst fliegt sie raus (Test-Ausgabe). Boulevard im Ton, nicht in
#     der Wahrheit.
#   - Zwei Ausgaben am Tag: Morgenausgabe (04–16 Uhr, Zeitraum ab gestern früh) und Abendausgabe (ab 16 Uhr,
#     Zeitraum heute). Samstag und Sonntag ist Wochenendausgabe: Wochenbilanz, Tonfall „Pause verdient".
#   - Ohne Modell steht trotzdem eine Ausgabe da (New-AusgabeEntwurf): dieselben Fakten, Schlagzeilen aus
#     einem festen Vorrat, der je Ausgabe wechselt. Der Compass zeigt sie sofort und bittet dann per POST
#     um die Redaktion — der Aufruf dauert 10–40 s, der Server ist so lange belegt, deshalb nur einmal je
#     Ausgabe (Cache ausgaben.json, gitignored) und noch einmal, wenn seither deutlich mehr passiert ist.
# Braucht aus john-server.ps1: Invoke-ClaudeCli, Call-Claude, John-TextOpenAI, Get-Backend, Get-ApiKey,
#   Get-JiraKpi, $script:WachtCache, $NutzerName, $script:Utf8NoBom.

$script:AusgabeDatei = Join-Path $PSScriptRoot 'ausgaben.json'
$script:Ausgaben = $null
$script:AusgabeFaktenCache = @{ key = ''; zeit = $null; out = $null }
$script:AusgabeRepoWurzel = Split-Path $PSScriptRoot -Parent
$script:AusgabeRepoNamen = @{
  'persoenliches-dashboard' = 'Flow Compass'; 'flow-cockpit' = 'Vishnu Cockpit'
  'vishnuartists-website-redesign' = 'vishnuartists.com'; 'vaikuntha' = 'Vaikuntha'
  'john' = 'Karriere'; 'john-agent' = 'John'; 'cs-carsales-flow-cockpit' = 'Porsche-Cockpit'
  'bene-routinen' = 'Routinen'
}
# Was kein Erfolg ist, sondern ein Automat: Builds, Spiegel, Datenläufe, Takt-Läufe, Sammelcommits
# („coaching: 2 geaendert, 0 neu"). Ein Blatt, das „14 Commits!" feiert, von denen elf ein Zeitplan
# geschrieben hat, wäre genau die Sorte Erfolg, die niemanden motiviert.
$script:AusgabeRauschen = '(?i)automatischer build|adress-(ue|ü)bersicht|: \d+ geaendert, \d+ neu$|takt-lauf|^merge\b|^wip\b|va-data\.json|datenlauf|^revert\b'

function Get-AusgabeKurz([string]$s, [int]$n) {
  $t = ([string]$s).Trim() -replace '\s+', ' '
  if ($t.Length -gt $n) { $t = $t.Substring(0, $n - 1).TrimEnd() + '…' }
  return $t
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
  $tage = @('So','Mo','Di','Mi','Do','Fr','Sa')
  return @{ key = ($tag.ToString('yyyy-MM-dd') + '-' + $art); art = $art; name = $name; wochenende = $wochenende
            tag = $tag.ToString('yyyy-MM-dd'); datum = ($tage[$wt] + ' ' + $tag.ToString('dd.MM.yyyy'))
            von = $von.ToString('o'); vonDt = $von; zeitraum = $zeitraum }
}

# ---------- Fakten ----------
function Get-AusgabeCommits([datetime]$von) {
  $liste = New-Object System.Collections.ArrayList
  $altEap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $altEnc = $null; try { $altEnc = [Console]::OutputEncoding; [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
  try {
    foreach ($d in @(Get-ChildItem $script:AusgabeRepoWurzel -Directory -ErrorAction SilentlyContinue)) {
      if ($d.Name -like '_*' -or $d.Name -eq 'analytics-dashboard') { continue }
      if (-not (Test-Path (Join-Path $d.FullName '.git'))) { continue }
      $bereich = $(if ($script:AusgabeRepoNamen.ContainsKey($d.Name)) { $script:AusgabeRepoNamen[$d.Name] } else { $d.Name })
      $roh = & git -C $d.FullName -c i18n.logOutputEncoding=UTF-8 log --no-merges ('--since=' + $von.ToString('yyyy-MM-ddTHH:mm:ss')) '--pretty=format:%ad%x1f%s' '--date=iso-strict' -n 80 2>$null
      foreach ($z in @($roh)) {
        if (-not $z) { continue }
        $t = ([string]$z).Split([char]0x1f)
        if ($t.Count -lt 2) { continue }
        $s = $t[1].Trim()
        if (-not $s -or $s -match $script:AusgabeRauschen) { continue }
        $wann = $null; try { $wann = [DateTime]::Parse($t[0]) } catch {}
        if ($wann -and $wann -lt $von) { continue }
        [void]$liste.Add(@{ bereich = $bereich; titel = $s; wann = $wann })
      }
    }
  } finally {
    $ErrorActionPreference = $altEap
    if ($altEnc) { try { [Console]::OutputEncoding = $altEnc } catch {} }
  }
  return @($liste | Sort-Object { $_.wann } -Descending)
}

function Get-AusgabeCheckins([datetime]$von) {
  $out = @{ entscheidungen = @(); rituale = @(); bilanz = @() }
  # Dieselbe Entscheidung steht oft in zwei Dateien (Rückfragen-Runde und danach im Abendcheck) — einmal zählen.
  $gesehen = New-Object 'System.Collections.Generic.HashSet[string]'
  $dir = Join-Path $PSScriptRoot 'checkins'
  if (-not (Test-Path $dir)) { return $out }
  foreach ($f in @(Get-ChildItem $dir -Filter '*.json' -File -ErrorAction SilentlyContinue)) {
    if ($f.Name -notmatch '^(\d{4}-\d{2}-\d{2})-([a-z]+)\.json$') { continue }
    $art = $Matches[2]
    try { $d = [datetime]::ParseExact($Matches[1], 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture) } catch { continue }
    if ($d -lt $von.Date) { continue }
    $j = $null
    try { $j = [IO.File]::ReadAllText($f.FullName, $script:Utf8NoBom) | ConvertFrom-Json } catch { continue }
    $empf = $f.LastWriteTime
    try { $empf = [datetime]::ParseExact([string]$j.empfangen, 'yyyy-MM-dd HH:mm', [Globalization.CultureInfo]::InvariantCulture) } catch {}
    if ($empf -lt $von) { continue }
    $out.rituale += , @{ art = $art; titel = [string]$j.titel; wann = $empf }
    foreach ($e in @($j.entschieden)) {
      if ($e -and [string]$e.antwort -and $gesehen.Add(([string]$e.frage + '|' + [string]$e.antwort))) {
        $out.entscheidungen += , @{ frage = (Get-AusgabeKurz $e.frage 150); antwort = (Get-AusgabeKurz $e.antwort 110); wann = $empf }
      }
    }
    if ($art -eq 'abend' -and $j.antworten -and [string]$j.antworten.bilanz) {
      $out.bilanz += , (Get-AusgabeKurz $j.antworten.bilanz 140)
    }
  }
  return $out
}

function Get-AusgabeJira([datetime]$von) {
  $k = $null
  try { $k = Get-JiraKpi $false } catch { return @{ ok = $false; liste = @() } }
  $liste = @()
  foreach ($i in @($k.zuletzt)) {
    $w = $null
    try { $w = [datetime]::ParseExact([string]$i.erledigt, 'dd.MM. HH:mm', [Globalization.CultureInfo]::InvariantCulture) } catch {}
    if ($w -and $w -gt (Get-Date).AddDays(1)) { $w = $w.AddYears(-1) }   # Jahreswechsel
    if ($w -and $w -ge $von) { $liste += , @{ key = [string]$i.key; titel = (Get-AusgabeKurz $i.titel 110); wann = $w } }
  }
  # `zuletzt` hält höchstens acht — stehen alle acht im Zeitraum, waren es womöglich mehr.
  return @{ ok = $true; liste = $liste; mehr = ($liste.Count -ge 8) }
}

function Get-AusgabeFakten($lage, [bool]$fresh = $false) {
  $cc = $script:AusgabeFaktenCache
  if (-not $fresh -and $cc.out -and $cc.key -eq $lage.key -and ((Get-Date) - $cc.zeit).TotalSeconds -lt 300) { return $cc.out }
  $von = $lage.vonDt
  $commits = @(Get-AusgabeCommits $von)
  $ck = Get-AusgabeCheckins $von
  $jira = Get-AusgabeJira $von
  $wacht = $null
  $wc = $script:WachtCache
  if ($wc -and $wc.out -and $wc.out.zusammenfassung) { $wacht = $wc.out.zusammenfassung }   # nur aus dem Cache: kein Netzabruf für eine Schlagzeile

  $fakten = New-Object System.Collections.ArrayList
  $i = 0
  foreach ($c in ($commits | Select-Object -First 30)) {
    $i++
    [void]$fakten.Add(@{ id = "c$i"; art = 'commit'; bereich = $c.bereich; text = $c.titel
                         wann = $(if ($c.wann) { $c.wann.ToString('dd.MM. HH:mm') } else { '' }) })
  }
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
  foreach ($b in $ck.bilanz) { $i++; [void]$fakten.Add(@{ id = "b$i"; art = 'bilanz'; bereich = 'Abendcheck'; text = "Tagesbilanz in eigenen Worten: $b"; wann = '' }) }
  $rit = @($ck.rituale)
  if ($rit.Count) {
    $namen = @($rit | ForEach-Object { $_.titel } | Where-Object { $_ } | Select-Object -Unique)
    [void]$fakten.Add(@{ id = 'r1'; art = 'ritual'; bereich = 'Rhythmus'; text = ("$($rit.Count) Rituale abgeschlossen: " + ($namen -join ', ')); wann = '' })
  }
  if ($wacht -and $wacht.alsGut -and $wacht.gesamt) {
    $zt = $(if ($null -ne $wacht.zertMinTage) { ", Zertifikate noch mindestens $($wacht.zertMinTage) Tage gültig" } else { '' })
    [void]$fakten.Add(@{ id = 'w1'; art = 'waechter'; bereich = 'Seiten'; text = "Alle $($wacht.gesamt) überwachten Seiten erreichbar$zt"; wann = '' })
  }

  $bereiche = @($commits | ForEach-Object { $_.bereich } | Select-Object -Unique)
  $zahlen = [ordered]@{
    commits = $commits.Count; bereiche = $bereiche.Count; jira = @($jira.liste).Count
    entscheidungen = @($ck.entscheidungen).Count; checkins = $rit.Count
  }
  $gesamt = $commits.Count + @($jira.liste).Count + @($ck.entscheidungen).Count
  $out = @{ fakten = @($fakten); zahlen = $zahlen; gesamt = $gesamt; bereiche = $bereiche
            jiraMehr = [bool]$jira.mehr; jiraOk = [bool]$jira.ok
            commitsNachBereich = @($commits | Group-Object { $_.bereich } | Sort-Object Count -Descending |
                                   ForEach-Object { @{ bereich = $_.Name; n = $_.Count; titel = @($_.Group | Select-Object -First 3 | ForEach-Object { $_.titel }) } }) }
  $script:AusgabeFaktenCache = @{ key = $lage.key; zeit = Get-Date; out = $out }
  return $out
}

# ---------- Ablage ----------
function Read-Ausgaben {
  if ($script:Ausgaben) { return $script:Ausgaben }
  $leer = @{ version = 1; ausgaben = @{} }
  if (-not (Test-Path $script:AusgabeDatei)) { $script:Ausgaben = $leer; return $leer }
  try {
    $d = [IO.File]::ReadAllText($script:AusgabeDatei, $script:Utf8NoBom) | ConvertFrom-Json
    $a = @{}
    foreach ($p in @($d.ausgaben.PSObject.Properties)) { if ($p) { $a[$p.Name] = $p.Value } }
    $script:Ausgaben = @{ version = 1; ausgaben = $a }
  } catch { $script:Ausgaben = $leer }
  return $script:Ausgaben
}
function Save-Ausgaben {
  $s = Read-Ausgaben
  $keys = @($s.ausgaben.Keys | Sort-Object -Descending | Select-Object -First 30)
  $neu = @{}; foreach ($k in $keys) { $neu[$k] = $s.ausgaben[$k] }
  $s.ausgaben = $neu
  try { [IO.File]::WriteAllText($script:AusgabeDatei, ($s | ConvertTo-Json -Depth 12), $script:Utf8NoBom) }
  catch { Write-Host "  Ausgabe nicht gespeichert: $($_.Exception.Message)" -ForegroundColor DarkYellow }
}
function Get-AusgabeZuletzt([string]$ohneKey) {
  $s = Read-Ausgaben
  return @($s.ausgaben.Keys | Where-Object { $_ -ne $ohneKey } | Sort-Object -Descending | Select-Object -First 6 |
           ForEach-Object { [string]$s.ausgaben[$_].ausgabe.schlagzeile } | Where-Object { $_ })
}

# ---------- Entwurf ohne Modell ----------
# Feste Vorräte, gewählt über den Schlüssel der Ausgabe: jede Ausgabe sieht anders aus, dieselbe
# Ausgabe bleibt beim Neuladen gleich. {n} = Zahl der Erfolge, {w} = Zeitraum, {name} = Vorname.
$script:AusgabeKoepfe = @(
  'WAHNSINN! {n} ERFOLGE {W}', '{name} LIEFERT AB!', 'DA IST DAS DING!', 'SO GEHT ANPACKEN!',
  'DER {n}-TREFFER-TAG!', 'HAKEN DRAN! {n}-MAL!', 'NICHT ZU STOPPEN!', 'VOLLTREFFER {W}!'
)
$script:AusgabeStoerer = @('EXKLUSIV', 'SENSATION', 'KNALLER', 'RIESEN-JUBEL', 'EXTRABLATT', 'BREAKING')
$script:AusgabeKommentare = @{
  morgen = @('Gestern gebaut, heute benutzt — genau so wächst ein System.', 'Der Vorsprung von gestern ist der Anlauf für heute. Erst das Eine, dann der Rest.', 'Wer so in den Tag startet, darf ruhig einmal kurz stolz sein. Dann los.')
  abend  = @('Wer so abliefert, darf jetzt die Füße hochlegen.', 'Feierabend ist auch eine Leistung — und heute ist sie verdient.', 'Mehr muss heute nicht. Der Rest hat bis morgen Zeit.')
  wochenende = @('Die Woche steht. Jetzt ist Wochenende — die Zahlen ruhen bis Montag.', 'Genug gebaut für eine Woche. Familie, Sport, Erholung haben jetzt Vorfahrt.')
}
function Get-AusgabeWahl($liste, [string]$key, [int]$salz) {
  $h = 0; foreach ($ch in ($key + $salz).ToCharArray()) { $h = ($h * 31 + [int]$ch) % 1000003 }
  return $liste[$h % $liste.Count]
}
function New-AusgabeEntwurf($lage, $f) {
  $n = [int]$f.gesamt
  $W = $(switch ($lage.art) { 'morgen' { if ($lage.zeitraum -eq 'seit Freitag') { 'SEIT FREITAG' } else { 'SEIT GESTERN' } } default { 'HEUTE' } })
  if ($lage.wochenende) { $W = 'DIESE WOCHE' }
  $meld = @()
  foreach ($g in @($f.commitsNachBereich | Select-Object -First 3)) {
    $titel = $(if ($g.n -gt 1) { "$($g.bereich): $($g.n) Neuerungen" } else { "$($g.bereich) legt nach" })
    $meld += , @{ titel = $titel; text = (($g.titel | ForEach-Object { Get-AusgabeKurz $_ 80 }) -join ' · '); quellen = @($g.titel) }
  }
  $jf = @($f.fakten | Where-Object { $_.art -eq 'jira' })
  if ($jf.Count -and $meld.Count -lt 4) {
    $meld += , @{ titel = $(if ($jf.Count -gt 1) { "$($jf.Count) Tickets vom Tisch" } else { 'Ticket erledigt' }); text = (($jf | Select-Object -First 2 | ForEach-Object { $_.text }) -join ' · '); quellen = @($jf | ForEach-Object { $_.text }) }
  }
  $ef = @($f.fakten | Where-Object { $_.art -eq 'entscheidung' })
  if ($ef.Count -and $meld.Count -lt 4) {
    $meld += , @{ titel = $(if ($ef.Count -gt 1) { "$($ef.Count) Entscheidungen getroffen" } else { 'Entscheidung gefallen' }); text = (Get-AusgabeKurz $ef[0].text 160); quellen = @($ef | ForEach-Object { $_.text }) }
  }
  if ($n -eq 0) {
    $kopf = 'RUHIGER TAG — AUCH DAS IST ERLAUBT'
    $unter = "Keine Commits, keine erledigten Tickets, keine Entscheidungen $($lage.zeitraum). Ruhe ist auch Fortschritt."
    $stoer = 'RUHE'
  } else {
    $kopf = (Get-AusgabeWahl $script:AusgabeKoepfe $lage.key 1).Replace('{n}', [string]$n).Replace('{W}', $W).Replace('{name}', $NutzerName.ToUpperInvariant())
    $teile = @()
    if ($f.zahlen.commits) { $teile += "$($f.zahlen.commits) Neuerungen in $($f.zahlen.bereiche) $(if ($f.zahlen.bereiche -eq 1) { 'Bereich' } else { 'Bereichen' })" }
    if ($f.zahlen.jira) { $teile += $(if ($f.zahlen.jira -eq 1) { "1 Ticket erledigt" } else { "$($f.zahlen.jira) Tickets erledigt" }) }
    if ($f.zahlen.entscheidungen) { $teile += $(if ($f.zahlen.entscheidungen -eq 1) { "1 Entscheidung" } else { "$($f.zahlen.entscheidungen) Entscheidungen" }) }
    $unter = ($teile -join ', ') + " — $($lage.zeitraum)."
    $stoer = Get-AusgabeWahl $script:AusgabeStoerer $lage.key 2
  }
  $kArt = $(if ($lage.wochenende) { 'wochenende' } else { $lage.art })
  $zahl = $null
  if ($f.zahlen.commits) { $zahl = @{ wert = [string]$f.zahlen.commits; text = 'Neuerungen ausgeliefert' } }
  elseif ($f.zahlen.entscheidungen) { $zahl = @{ wert = [string]$f.zahlen.entscheidungen; text = 'Entscheidungen getroffen' } }
  return @{
    dachzeile = "Das hast du $($lage.zeitraum) geschafft"; schlagzeile = $kopf; unterzeile = $unter; stoerer = $stoer
    meldungen = $meld; kurz = @(); zahl = $zahl
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
  $zahlen = @($f.zahlen.GetEnumerator() | ForEach-Object { "$($_.Key) = $($_.Value)" }) -join ', '
  $zuletzt = @(Get-AusgabeZuletzt $lage.key)
  $zl = $(if ($zuletzt.Count) { ($zuletzt | ForEach-Object { "- $_" }) -join "`n" } else { '(noch keine)' })
  $ton = $(if ($lage.wochenende) { 'Wochenbilanz — Tonfall: Pause verdient, Wochenende hat Vorfahrt (keine Arbeitsaufträge).' }
           elseif ($lage.art -eq 'morgen') { 'Was gestern und über Nacht passiert ist — Tonfall: Anpfiff für den Tag.' }
           else { 'Bilanz des heutigen Tages — Tonfall: Feierabend-Jubel.' })
  $stil = Get-AusgabeWahl $script:AusgabeStilmittel $lage.key 4
  $jhinweis = $(if ($f.jiraMehr) { ' (Jira: mindestens so viele, die Liste ist gekappt — schreib „mindestens" oder nenne keine Zahl)' } else { '' })
  return @"
AUSGABE: $($lage.name), $($lage.datum). Zeitraum: $($lage.zeitraum).
LESER: $NutzerName — Du-Form, der Kommentar spricht $NutzerName direkt an.
TONFALL: $ton
STILMITTEL FÜR DIE SCHLAGZEILE HEUTE: $stil
ZULETZT GEDRUCKTE SCHLAGZEILEN (keine davon wiederholen, auch nicht sinngemäß; anderer Einstieg):
$zl

ZAHLEN (nur diese Zahlen darfst du verwenden, als Ziffern):$jhinweis
$zahlen

FAKTEN (id [Bereich, Zeit] Beleg):
$zeilen

So baust du die Ausgabe:
- Commit-Titel sind Technik-Deutsch. Übersetze sie in das, was jetzt geht, was vorher nicht ging —
  sachlich richtig, nur nicht trocken. Mehrere Commits zum selben Thema sind EINE Meldung.
- Wähle die 3 bis 4 stärksten Geschichten, nicht die neuesten. Ein Automat ist kein Erfolg.
- Ist ein Beleg mehrdeutig (wer hat wem was geschrieben?), bleib nah am Wortlaut, statt eine Richtung zu raten.
- "schlagzeile": höchstens 46 Zeichen, GROSSBUCHSTABEN, mit Wucht.
- "dachzeile": höchstens 60 Zeichen, normale Schreibung, führt zur Schlagzeile hin.
- "unterzeile": höchstens 140 Zeichen, sagt in einem Satz, worum es geht.
- "stoerer": ein bis zwei Wörter in Großbuchstaben, höchstens 14 Zeichen (z. B. EXKLUSIV, SENSATION).
- "meldungen": 3 bis 4, je {"titel" höchstens 44 Zeichen im Boulevard-Stil, "text" höchstens 170 Zeichen,
  "belege": ["c1","c4"] — nur ids aus der Faktenliste}.
- "kurz": bis zu 3 Einzeiler (höchstens 90 Zeichen) für den Rest, je {"text","belege":[…]}.
- "zahl": die Zahl des Tages aus ZAHLEN, {"wert":"…","text":"… höchstens 30 Zeichen"}.
- "kommentar": der Kommentar des Blatts OHNE das Präfix „Kompass meint" (das setzt die Seite davor), 1–2 Sätze, höchstens 200 Zeichen, augenzwinkernd und warm.
Gibt es kaum Fakten, dann ist das die Geschichte: ein ruhiger Tag — nichts aufblasen.

Antworte NUR mit diesem JSON, ohne Erklärung, ohne Code-Zaun:
{"dachzeile":"…","schlagzeile":"…","unterzeile":"…","stoerer":"…","meldungen":[{"titel":"…","text":"…","belege":["c1"]}],"kurz":[{"text":"…","belege":["j1"]}],"zahl":{"wert":"…","text":"…"},"kommentar":"…"}
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
  foreach ($m in @($o.meldungen)) {
    if (-not $m) { continue }
    $bel = @(@($m.belege) | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $ids.ContainsKey($_) } | Select-Object -Unique)
    $titel = Get-AusgabeKurz $m.titel 52; $text = Get-AusgabeKurz $m.text 200
    if (-not $bel.Count -or -not $titel) { continue }
    if (-not (Test-AusgabeZahlen "$titel $text" $erlaubt)) { continue }
    $meld += , @{ titel = $titel; text = $text; quellen = @($bel | ForEach-Object { $ids[$_].text }) }
    if ($meld.Count -ge 4) { break }
  }
  if ($f.gesamt -gt 0 -and $meld.Count -lt 1) { return $null }
  $kurz = @()
  foreach ($k in @($o.kurz)) {
    if (-not $k) { continue }
    $bel = @(@($k.belege) | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $ids.ContainsKey($_) })
    $t = Get-AusgabeKurz $k.text 100
    if (-not $bel.Count -or -not $t -or -not (Test-AusgabeZahlen $t $erlaubt)) { continue }
    $kurz += , @{ text = $t; quellen = @($bel | ForEach-Object { $ids[$_].text }) }
    if ($kurz.Count -ge 3) { break }
  }
  $kopf = Get-AusgabeKurz $o.schlagzeile 56
  if (-not $kopf -or -not (Test-AusgabeZahlen $kopf $erlaubt)) { return $null }
  $leer = { param($s) if (Test-AusgabeZahlen $s $erlaubt) { $s } else { '' } }
  $zahl = $null
  if ($o.zahl -and [string]$o.zahl.wert) {
    $zw = Get-AusgabeKurz $o.zahl.wert 8
    if (($f.zahlen.Values | ForEach-Object { [string]$_ }) -contains $zw -and $zw -ne '0') {
      $zahl = @{ wert = $zw; text = (& $leer (Get-AusgabeKurz $o.zahl.text 34)) }
    }
  }
  return @{
    dachzeile = (& $leer (Get-AusgabeKurz $o.dachzeile 70)); schlagzeile = $kopf.ToUpperInvariant()
    unterzeile = (& $leer (Get-AusgabeKurz $o.unterzeile 160)); stoerer = (Get-AusgabeKurz (([string]$o.stoerer).ToUpperInvariant()) 16)
    meldungen = $meld; kurz = $kurz; zahl = $zahl; kommentar = (& $leer (Get-AusgabeKurz ([string]$o.kommentar -replace '^\s*Kompass meint:?\s*', '') 230))
  }
}

function Invoke-AusgabeRedaktion($lage, $f) {
  $auftrag = Build-AusgabeAuftrag $lage $f
  $roh = ''; $modell = ''
  $backend = Get-Backend
  if ($backend -eq 'cli') {
    $c = Invoke-ClaudeCli $script:AusgabeSystem $auftrag @{ tools = $false; maxTurns = 1; effort = 'low'; timeout = 240 }
    $roh = ([string]$c.text).Trim(); $modell = [string]$c.model
  } elseif ($backend -eq 'openai') {
    $c = John-TextOpenAI @{ text = $script:AusgabeSystem } $auftrag
    $roh = ([string]$c.text).Trim(); $modell = [string]$c.model
  } else {
    $apiKey = Get-ApiKey
    if (-not $apiKey) { throw 'NO_KEY' }
    $body = @{ model = $Model; max_tokens = 2000; system = @(@{ type = 'text'; text = $script:AusgabeSystem })
               messages = @(@{ role = 'user'; content = $auftrag }); output_config = @{ effort = 'low' }; fallbacks = 'default' }
    $r = Call-Claude $apiKey $body
    if ($r.stop_reason -eq 'refusal') { return @{ ok = $false; error = 'REFUSAL' } }
    $roh = (($r.content | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join "`n").Trim()
    $modell = [string]$r.model
  }
  $a = $roh.IndexOf('{'); $z = $roh.LastIndexOf('}')
  if ($a -lt 0 -or $z -le $a) { return @{ ok = $false; error = 'KEIN_JSON' } }
  $o = $null
  try { $o = $roh.Substring($a, $z - $a + 1) | ConvertFrom-Json } catch { return @{ ok = $false; error = 'JSON_KAPUTT' } }
  $aus = Test-Ausgabe $o $lage $f
  if (-not $aus) { return @{ ok = $false; error = 'VERWORFEN' } }
  return @{ ok = $true; ausgabe = $aus; model = $modell }
}

# GET: was gerade gilt. Liegt die redigierte Ausgabe vor, kommt sie; sonst der Entwurf und die Bitte,
# die Redaktion anzustoßen. `veraltet`: seit der Redaktion ist deutlich mehr passiert (≥ 3 Erfolge
# und älter als 90 Minuten) — dann darf der Compass einmal nachfordern.
function Get-Ausgabe([bool]$fresh = $false) {
  $lage = Get-AusgabeLage (Get-Date)
  $f = Get-AusgabeFakten $lage $fresh
  $s = Read-Ausgaben
  $lageOut = @{ key = $lage.key; art = $lage.art; name = $lage.name; datum = $lage.datum; zeitraum = $lage.zeitraum; von = $lage.von; wochenende = $lage.wochenende }
  if ($s.ausgaben.ContainsKey($lage.key)) {
    $c = $s.ausgaben[$lage.key]
    $alter = $(try { ((Get-Date) - [datetime]::Parse([string]$c.erzeugt)).TotalMinutes } catch { 0 })
    $veraltet = ([int]$f.gesamt -ge ([int]$c.gesamt + 3) -and $alter -gt 90)
    return @{ ok = $true; lage = $lageOut; ausgabe = $c.ausgabe; redaktion = $true; erzeugt = [string]$c.erzeugt
              model = [string]$c.model; veraltet = $veraltet; gesamt = $f.gesamt; zahlen = $f.zahlen }
  }
  return @{ ok = $true; lage = $lageOut; ausgabe = (New-AusgabeEntwurf $lage $f); redaktion = $false
            erzeugt = (Get-Date).ToString('o'); gesamt = $f.gesamt; zahlen = $f.zahlen; veraltet = $false }
}

# POST: die Redaktion. Scheitert das Modell, bleibt der Entwurf stehen und die Antwort sagt warum.
function Build-Ausgabe([bool]$fresh = $false) {
  $lage = Get-AusgabeLage (Get-Date)
  $s = Read-Ausgaben
  $f = Get-AusgabeFakten $lage $true
  if (-not $fresh -and $s.ausgaben.ContainsKey($lage.key)) {
    $c = $s.ausgaben[$lage.key]
    $alter = $(try { ((Get-Date) - [datetime]::Parse([string]$c.erzeugt)).TotalMinutes } catch { 0 })
    if (-not ([int]$f.gesamt -ge ([int]$c.gesamt + 3) -and $alter -gt 90)) { return Get-Ausgabe }
  }
  $t0 = Get-Date
  Write-Host ("[{0}] Erfolgs-Ausgabe {1}: {2} Fakten" -f (Get-Date -Format 'HH:mm:ss'), $lage.key, @($f.fakten).Count)
  if ($f.gesamt -eq 0 -and -not @($f.fakten).Count) {
    $r = @{ ok = $true; ausgabe = (New-AusgabeEntwurf $lage $f); model = 'ohne Modell (keine Fakten)' }
  } else {
    $r = Invoke-AusgabeRedaktion $lage $f
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
