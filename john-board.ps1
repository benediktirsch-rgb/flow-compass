<#
  john-board.ps1 — Morgenboard und Abendboard (02.09.2026, Bene: „bau es so")

  Warum
    Am 28.08. und 01.09. entstand abends von Hand ein „Morgenboard": eine ruhige, dunkle Seite mit dem
    Einen, der Übergabe aus dem Abend, Zahlen über Nacht, einer Weisheit, den Routinen und den offenen
    Rückfragen. Beide lagen als Artifact irgendwo bei claude.ai — der Compass wusste nichts davon.
    Hier baut der john-server das Board selbst, direkt nach dem Eingang des Checkins (POST /api/checkin):
    Abendcheck → boards\<datum>-abend.html, Morgencheck → boards\<datum>-morgen.html.

  Zutaten (alles, was der Server ohnehin hat — jede Quelle darf einzeln ausfallen, dann steht „n/v"):
    checkins\<datum>-<art>.json  (dieser und der vorige Checkin), Get-Kalender (mit Porsche-Titeln),
    Get-JiraKpi + Get-JiraMeine, Get-Verein (vaikuntha.eu), vishnuartists.com/stats.php, Get-Postfach,
    Get-Slack, Get-Routinen, Get-Wetter, rhythmus-data.js › rueckfragen (Wortlaut der offenen Fragen).
    Die zwei erzählenden Teile („Das fällt mir auf", Weisheit, erster Schritt) kommen über EINEN
    Claude-Aufruf in Johns Stimme (Build-System + Call-Claude aus john-server.ps1) als JSON. Fällt er
    aus, steht das Board trotzdem — ohne Kommentar, mit einer ehrlichen Zeile dazu.

  Ablage
    boards\ neben diesem Skript, gitignored (Telefonnummern, Namen). Ausgeliefert unter
    http://localhost:8787/boards/<datum>-<art>.html; boards\archiv\ hält die zwei Handfassungen.
    GET /api/board                       → Liste + jüngstes Board
    GET /api/board?art=morgen&datum=…    → gibt es das Board? (der Compass fragt nach dem Checkin nach)
    GET /api/board?…&bauen=1             → jetzt (neu) bauen, z. B. zum Prüfen

  Wird von john-server.ps1 per Dot-Sourcing geladen — alle Funktionen dort sind hier sichtbar.
#>

$script:BoardDir = Join-Path $PSScriptRoot 'boards'
$script:BoardWt  = @('Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag')
$script:BoardWtK = @('So','Mo','Di','Mi','Do','Fr','Sa')
$script:BoardMon = @('','Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember')

function ConvertTo-BoardEsc([string]$s) { return [System.Net.WebUtility]::HtmlEncode([string]$s) }

# Ticket-Kennungen im Text verlinken (VA-13534, STA-485, VAEV-150, AGILE-…); alles andere bleibt Text.
function ConvertTo-BoardText([string]$s) {
  $e = ConvertTo-BoardEsc $s
  return [regex]::Replace($e, '\b(VA|STA|VAEV|AGILE)-(\d{2,6})\b', {
    param($m)
    $site = $(if ($m.Groups[1].Value -eq 'AGILE') { 'porschedigital.atlassian.net' } else { 'vishnuartists.atlassian.net' })
    "<a class=""ticket"" href=""https://$site/browse/$($m.Value)"">$($m.Value)</a>"
  })
}

function Get-BoardDatumLang([datetime]$d) { return ('{0},<br>{1}. {2} {3}' -f $script:BoardWt[[int]$d.DayOfWeek], $d.Day, $script:BoardMon[$d.Month], $d.Year) }
function Get-BoardDatumKurz([datetime]$d) { return ('{0} {1:dd.MM.}' -f $script:BoardWtK[[int]$d.DayOfWeek], $d) }
function Get-BoardKw([datetime]$d) { return [Globalization.CultureInfo]::InvariantCulture.Calendar.GetWeekOfYear($d, [Globalization.CalendarWeekRule]::FirstFourDayWeek, [DayOfWeek]::Monday) }

function Get-BoardCheckin([string]$datum, [string]$art) {
  $f = Join-Path (Join-Path $PSScriptRoot 'checkins') "$datum-$art.json"
  if (-not (Test-Path -LiteralPath $f)) { return $null }
  try { return ((Get-Content -LiteralPath $f -Raw -Encoding UTF8) | ConvertFrom-Json) } catch { return $null }
}
# Der jüngste Checkin einer Art VOR einem Datum (bis zu 4 Tage zurück — übers Wochenende hinweg).
function Get-BoardVorigerCheckin([datetime]$vor, [string]$art, [bool]$einschliesslich = $false) {
  $start = $(if ($einschliesslich) { 0 } else { 1 })
  for ($i = $start; $i -le 4; $i++) {
    $c = Get-BoardCheckin ($vor.AddDays(-$i).ToString('yyyy-MM-dd')) $art
    if ($c) { return $c }
  }
  return $null
}

# Wortlaut der offenen Rückfragen aus rhythmus-data.js (die Kennungen kommen mit dem Checkin).
function Get-BoardRueckfragen([string[]]$ids) {
  $out = @()
  if (-not $ids -or -not $ids.Count) { return $out }
  $src = Read-Text (Join-Path $PSScriptRoot 'rhythmus-data.js')
  foreach ($id in $ids) {
    if (-not $id) { continue }
    $frage = $id; $opt = @()
    $m = [regex]::Match($src, "id:'" + [regex]::Escape($id) + "'[\s\S]{0,1500}?frage:'((?:[^'\\]|\\.)*)'")
    if ($m.Success) {
      $frage = $m.Groups[1].Value -replace '\\(.)', '$1'
      $rest = $src.Substring($m.Index, [Math]::Min(2500, $src.Length - $m.Index))
      $o = [regex]::Match($rest, "optionen:\[((?:[^\]\\]|\\.)*)\]")
      if ($o.Success) { $opt = @([regex]::Matches($o.Groups[1].Value, "'((?:[^'\\]|\\.)*)'") | ForEach-Object { $_.Groups[1].Value -replace '\\(.)', '$1' }) }
    }
    $out += , @{ id = $id; frage = $frage; optionen = $opt }
  }
  return $out
}

# vishnuartists.com/stats.php live (dasselbe Beacon wie in kennzahlen-data.js beschrieben): Tagessummen + Top-Seiten.
function Get-BoardVaTraffic {
  $cts = New-Object Threading.CancellationTokenSource(8000)
  $res = $Http.GetAsync('https://vishnuartists.com/stats.php', $cts.Token).GetAwaiter().GetResult()
  if (-not $res.IsSuccessStatusCode) { throw "HTTP $([int]$res.StatusCode)" }
  $j = ($res.Content.ReadAsStringAsync().GetAwaiter().GetResult()) | ConvertFrom-Json
  $heuteStr = (Get-Date).ToString('yyyy-MM-dd')
  $tage = @()
  foreach ($p in @($j.days.PSObject.Properties)) { if ($p) { $tage += , @{ tag = $p.Name; n = [int]$p.Value.v } } }
  $tage = @($tage | Sort-Object { $_.tag })
  $voll = @($tage | Where-Object { $_.tag -lt $heuteStr })
  $gestern = $(if ($voll.Count) { $voll[-1] } else { $null })
  $vor7 = @($voll | Select-Object -Last 8 | Select-Object -First 7)
  $schnitt = $null; $abw = $null
  if ($vor7.Count) {
    $schnitt = [Math]::Round((@($vor7 | ForEach-Object { $_.n }) | Measure-Object -Average).Average, 1)
    if ($gestern -and $schnitt -gt 0) { $abw = [int][Math]::Round((($gestern.n - $schnitt) / $schnitt) * 100) }
  }
  $heute = @($tage | Where-Object { $_.tag -eq $heuteStr })
  return @{ ok = $true; tag = $(if ($gestern) { $gestern.tag } else { $null }); aufrufe = $(if ($gestern) { $gestern.n } else { $null })
            heute = $(if ($heute.Count) { $heute[0].n } else { $null }); schnitt7 = $schnitt; abweichung = $abw
            top = @(@($j.pages) | Sort-Object { -[int]$_.views } | Select-Object -First 3 | ForEach-Object { @{ path = [string]$_.path; titel = [string]$_.title; views = [int]$_.views } }) }
}

function Get-BoardWetterText([int]$code) {
  if ($code -eq 0) { return 'klar' }
  if ($code -le 2) { return 'leicht bewölkt' }
  if ($code -eq 3) { return 'bedeckt' }
  if ($code -le 48) { return 'Nebel' }
  if ($code -le 57) { return 'Niesel' }
  if ($code -le 67) { return 'Regen' }
  if ($code -le 77) { return 'Schnee' }
  if ($code -le 82) { return 'Schauer' }
  if ($code -le 86) { return 'Schneeschauer' }
  return 'Gewitter'
}

# ---------- Zutaten sammeln: jede Quelle darf ausfallen ----------
function Get-BoardDaten([string]$art, [string]$datum) {
  $tag = [datetime]::ParseExact($datum, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
  $fehler = @()
  $hol = { param($name, $sb) try { & $sb } catch { $script:__bf += , "$name`: $($_.Exception.Message)"; $null } }
  $script:__bf = @()

  $checkin = Get-BoardCheckin $datum $art
  # Gegenstück: das Morgenboard braucht den letzten Abendcheck (gestern), das Abendboard den Morgencheck von heute.
  $gegen = $(if ($art -eq 'morgen') { Get-BoardVorigerCheckin $tag 'abend' } else { Get-BoardCheckin $datum 'morgen' })
  $gegenTag = $(if ($gegen -and $gegen.datum) { [string]$gegen.datum } else { $null })
  $fragenIds = @()
  if ($checkin -and $checkin.offen) { $fragenIds = @($checkin.offen | ForEach-Object { [string]$_ } | Where-Object { $_ }) }
  $rueckfragen = Get-BoardRueckfragen $fragenIds

  # Kalender: das Morgenboard zeigt heute, das Abendboard morgen.
  $kalTag = $(if ($art -eq 'morgen') { $tag } else { $tag.AddDays(1) })
  $kal = & $hol 'Kalender' { Get-Kalender 9 $false }
  $kalHeute = $null; $kalWeiter = @()
  if ($kal -and $kal.ok) {
    $kalHeute = @($kal.woche | Where-Object { $_.datum -eq $kalTag.ToString('yyyy-MM-dd') }) | Select-Object -First 1
    $kalWeiter = @($kal.woche | Where-Object { $_.datum -gt $kalTag.ToString('yyyy-MM-dd') } | Select-Object -First 3)
  }

  $jira = & $hol 'Jira-KPI' { Get-JiraKpi $false }
  $meine = & $hol 'Jira-Vorgänge' { Get-JiraMeine $false }
  $inArbeit = @(); $laden = @(); $faellig = @()
  if ($meine -and $meine.ok) {
    $jetzt = Get-Date
    foreach ($i in @($meine.issues)) {
      $akt = $null; try { $akt = [datetime]::Parse([string]$i.aktiv).ToLocalTime() } catch { }
      $alter = $(if ($akt) { [int][Math]::Floor(($jetzt - $akt).TotalDays) } else { $null })
      $e = @{ key = $i.key; titel = $i.titel; status = $i.status; alter = $alter; due = $i.due }
      if ($i.kategorie -eq 'indeterminate') { $inArbeit += , $e }
      if ($alter -ne $null -and $alter -gt 90) { $laden += , $e }
      if ($i.due) { try { $d = [datetime]::ParseExact([string]$i.due, 'yyyy-MM-dd', $null); if ($d -le $tag.AddDays(3)) { $e.dueTage = [int]($d - $tag).TotalDays; $faellig += , $e } } catch { } }
    }
    $inArbeit = @($inArbeit | Sort-Object { -[int]$_.alter })
    $faellig  = @($faellig | Sort-Object { $_.dueTage })
  }

  $vk = & $hol 'vaikuntha.eu' { Get-Verein $false }
  $va = & $hol 'vishnuartists.com' { Get-BoardVaTraffic }
  $post = & $hol 'Postfach' { Get-Postfach }
  $slack = & $hol 'Slack' { Get-Slack }

  $rout = & $hol 'Routinen' { Get-Routinen $false }
  $laeufe = @()
  if ($rout -and $rout.ok) {
    $von = $(if ($art -eq 'morgen') { Get-Date } else { (Get-Date).Date.AddHours(18) })
    $bis = $kalTag.AddDays(1).AddHours(6)
    foreach ($r in @($rout.routinen)) {
      if (-not $r.naechster) { continue }
      $n = $null; try { $n = [datetime]::Parse([string]$r.naechster).ToLocalTime() } catch { continue }
      if ($n -lt $von -or $n -gt $bis) { continue }
      $laeufe += , @{ zeit = $n; name = $r.name; wirkung = $r.wirkung; art = $r.art; zustand = $r.zustand }
    }
    $laeufe = @($laeufe | Sort-Object { $_.zeit })
  }

  $wet = & $hol 'Wetter' { Get-Wetter $false }
  $wetter = $null
  if ($wet -and $wet.ok) { $wetter = @($wet.tage | Where-Object { $_.datum -eq $kalTag.ToString('yyyy-MM-dd') }) | Select-Object -First 1 }

  return @{
    art = $art; datum = $datum; tag = $tag; kalTag = $kalTag
    checkin = $checkin; gegen = $gegen; gegenTag = $gegenTag; rueckfragen = $rueckfragen
    kalender = $kalHeute; kalWeiter = $kalWeiter; kalQuellen = $(if ($kal -and $kal.ok) { @($kal.kalender) } else { @() })
    jira = $jira; inArbeit = $inArbeit; ladenhueter = $laden; faellig = $faellig
    vk = $vk; va = $va; postfach = $post; slack = $slack; laeufe = $laeufe; wetter = $wetter
    fehler = @($script:__bf)
  }
}

# ---------- Die erzählenden Teile: ein Claude-Aufruf in Johns Stimme, Antwort als JSON ----------
function Get-BoardErzaehlung($d) {
  $apiKey = Get-ApiKey
  if (-not $apiKey) { throw 'NO_KEY' }
  $sys = Build-System
  $system = @(@{ type = 'text'; text = $sys.text; cache_control = @{ type = 'ephemeral' } })
  # Nur das Nötige in den Datenblock — keine Rohtexte der Mails, keine Adressen.
  $kurz = @{
    art = $d.art; datum = $d.datum; wochentag = $script:BoardWt[[int]$d.tag.DayOfWeek]
    checkin = $(if ($d.checkin) { @{ fokus = $d.checkin.fokus; auftrag = $d.checkin.auftrag; wahl = $d.checkin.wahl; antworten = $d.checkin.antworten; entschieden = $d.checkin.entschieden } } else { $null })
    voriger = $(if ($d.gegen) { @{ datum = $d.gegen.datum; art = $d.gegen.art; fokus = $d.gegen.fokus; wahl = $d.gegen.wahl; antworten = $d.gegen.antworten } } else { $null })
    termine = $(if ($d.kalender) { @($d.kalender.termine | ForEach-Object { @{ zeit = $_.zeit; titel = $_.titel; kal = $_.kal; vorlaeufig = $_.vorlaeufig } }) } else { $null })
    freiStunden = $(if ($d.kalender) { $d.kalender.freiStunden } else { $null })
    luecken = $(if ($d.kalender) { $d.kalender.luecken } else { $null })
    jira = $(if ($d.jira -and $d.jira.ok) { @{ offen = $d.jira.offen; erledigtHeute = $d.jira.doneHeute; erledigtGestern = $d.jira.doneGestern; erledigt7 = $d.jira.done7; leadP50 = $d.jira.leadP50 } } else { $null })
    inArbeit = @{ anzahl = $d.inArbeit.Count; aeltesteTage = $(if ($d.inArbeit.Count) { $d.inArbeit[0].alter } else { $null }); aelteste = $(if ($d.inArbeit.Count) { $d.inArbeit[0].key + ' ' + $d.inArbeit[0].titel } else { $null }) }
    ladenhueter = $d.ladenhueter.Count
    faellig = @($d.faellig | ForEach-Object { @{ key = $_.key; titel = $_.titel; inTagen = $_.dueTage } })
    vaikuntha = $(if ($d.vk -and $d.vk.ok) { @{ aufrufeGestern = $d.vk.traffic.aufrufe; schnitt7 = $d.vk.traffic.schnitt7; abweichungProzent = $d.vk.traffic.abweichung; mitglieder = $d.vk.mitglieder.gesamt; neu30 = $d.vk.mitglieder.neu30 } } else { $null })
    vishnuartists = $(if ($d.va -and $d.va.ok) { @{ aufrufeGestern = $d.va.aufrufe; schnitt7 = $d.va.schnitt7; abweichungProzent = $d.va.abweichung; heuteBisJetzt = $d.va.heute } } else { $null })
    postfachWartet = $(if ($d.postfach -and $d.postfach.ok) { $d.postfach.zusammenfassung.wartet } else { $null })
    slackWartet = $(if ($d.slack -and $d.slack.ok) { $d.slack.zusammenfassung.wartet } else { $null })
    rueckfragenOffen = @($d.rueckfragen | ForEach-Object { $_.frage })
    wetter = $(if ($d.wetter) { @{ tmax = $d.wetter.tmax; tmin = $d.wetter.tmin; regenProzent = $d.wetter.regenProz; lage = (Get-BoardWetterText $d.wetter.code) } } else { $null })
    quellenAusgefallen = $d.fehler
  }
  $daten = ($kurz | ConvertTo-Json -Depth 8)
  $wann = $(if ($d.art -eq 'morgen') { 'heute' } else { 'morgen' })
  $auftrag = @"
Du schreibst die erzählenden Teile für Benedikts $(if ($d.art -eq 'morgen') { 'Morgenboard' } else { 'Abendboard' }) — eine ruhige Seite, die er $(if ($d.art -eq 'morgen') { 'jetzt am Morgen' } else { 'heute Abend und morgen früh' }) liest. Johns Stimme: ein ruhiger Mentor, sanft im Ton, bestimmt in der Sache; er stellt fest, statt anzutreiben, wertet nicht, beschönigt nichts.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt dieser Form (keine Einleitung, keine Code-Zäune):
{
  "schritt": "Erster Schritt für „das Eine" $wann — ein konkreter Satz, mit Uhrzeit, wenn der Kalender ein Fenster hergibt; ohne das Eine: leerer String",
  "lage": "Ein Satz, der den Tag einordnet ($(if ($d.art -eq 'morgen') { 'wie voll ist er, wo liegt das Fenster für das Eine' } else { 'wie der Tag geschlossen wurde und was morgen trägt' }))",
  "auffall": ["Absatz 1 zu dem, was in den Zahlen auffällt (mit Zahlen, mit Vorbehalt, wo die Datenlage dünn ist)", "Absatz 2, anderes Thema — oder weglassen"],
  "weisheit": [
    {"zitat": "ein echtes Zitat aus Bhagavad Gita, Dhammapada, Upanishaden, Stoa, Bibel, Laotse oder Rumi", "quelle": "genaue Stelle, z. B. Bhagavad Gita 2.47", "bezug": "zwei Sätze, die das Zitat auf den $(if ($d.art -eq 'morgen') { 'heutigen' } else { 'morgigen' }) Tag beziehen"},
    {"zitat": "…", "quelle": "…", "bezug": "…"}
  ]
}
Regeln: Deutsch, Du-Form, keine Anrede, keine Emojis. Zahlen nennen statt umschreiben; fehlt eine Zahl (null) oder ist eine Quelle ausgefallen, sag das ruhig, statt etwas zu erfinden. Keine Esoterik-Floskeln („Energie", „Universum", „loslassen"), keine Kalenderweisheiten — die Zitate müssen echt sein und die Stelle stimmen; bist du dir beim Wortlaut nicht sicher, gib den Sinn wieder und schreibe „(sinngemäß)" hinter die Quelle. Insgesamt höchstens 260 Wörter.

Datenblock (JSON, vom john-server erzeugt):
$daten
"@
  $body = @{ model = $Model; max_tokens = 1600; system = $system; messages = @(@{ role = 'user'; content = $auftrag })
             output_config = @{ effort = 'medium' }; fallbacks = 'default' }
  $r = Call-Claude $apiKey $body
  if ($r.stop_reason -eq 'refusal') { throw 'refusal' }
  $text = (($r.content | Where-Object { $_.type -eq 'text' } | ForEach-Object { $_.text }) -join ' ').Trim()
  $text = $text -replace '^\s*```(?:json)?\s*', '' -replace '\s*```\s*$', ''
  $a = $text.IndexOf('{'); $z = $text.LastIndexOf('}')
  if ($a -lt 0 -or $z -le $a) { throw 'Antwort ohne JSON' }
  $o = $text.Substring($a, $z - $a + 1) | ConvertFrom-Json
  return @{ schritt = [string]$o.schritt; lage = [string]$o.lage
            auffall = @(@($o.auffall) | Where-Object { $_ } | ForEach-Object { [string]$_ })
            weisheit = @(@($o.weisheit) | Where-Object { $_ -and $_.zitat } | ForEach-Object { @{ zitat = [string]$_.zitat; quelle = [string]$_.quelle; bezug = [string]$_.bezug } })
            model = $r.model; usage = $r.usage }
}

# ---------- HTML ----------
$script:BoardCss = @'
  :root{--ink:#12100e;--ink-2:#191612;--ink-3:#211d18;--line:#332c23;--line-soft:#262119;--text:#eae3d7;--text-2:#b3a894;--text-3:#8a8071;
    --gold:#d9a441;--gold-dim:#8e6c2c;--good:#7fa663;--warn:#c9773f;
    --serif:"Fraunces",Georgia,"Times New Roman",serif;--sans:"Karla","Helvetica Neue",Arial,sans-serif;--mono:"IBM Plex Mono","SFMono-Regular",Consolas,monospace}
  *{box-sizing:border-box}
  body{background:var(--ink);color:var(--text);font-family:var(--sans);font-size:16px;line-height:1.6;margin:0;padding:0 20px 96px;-webkit-font-smoothing:antialiased}
  .wrap{max-width:720px;margin:0 auto}
  a{color:var(--gold);text-decoration:none;border-bottom:1px solid var(--gold-dim)}
  a:hover{border-bottom-color:var(--gold)}
  a:focus-visible{outline:2px solid var(--gold);outline-offset:3px;border-radius:2px}
  header{padding:56px 0 34px;border-bottom:1px solid var(--line)}
  .kicker{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);margin:0 0 14px}
  h1{font-family:var(--serif);font-weight:400;font-size:clamp(34px,7vw,48px);line-height:1.05;margin:0;letter-spacing:-.01em}
  .datum{margin:12px 0 0;font-family:var(--mono);font-size:13px;color:var(--text-2);letter-spacing:.04em}
  section{padding:38px 0;border-bottom:1px solid var(--line-soft)}
  section:last-of-type{border-bottom:0}
  h2{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--text-3);font-weight:500;margin:0 0 20px}
  h3{font-family:var(--serif);font-weight:600;font-size:19px;margin:0 0 6px;line-height:1.3}
  p{margin:0 0 12px;max-width:62ch}
  p:last-child{margin-bottom:0}
  .muted{color:var(--text-2)}
  .small{font-size:14px}
  .eine{background:var(--ink-2);border-left:3px solid var(--gold);padding:32px 28px;margin:38px 0 0}
  .eine .h2gold{color:var(--gold)}
  .eine-titel{font-family:var(--serif);font-weight:600;font-size:clamp(24px,5vw,32px);line-height:1.2;margin:0 0 16px}
  .schritt{font-size:17px;margin:0 0 14px;max-width:56ch}
  .warum{font-size:14px;color:var(--text-2);margin:0;max-width:56ch}
  .ticket{font-family:var(--mono);font-size:12px;color:var(--gold);border:1px solid var(--gold-dim);border-radius:3px;padding:2px 7px;white-space:nowrap}
  .uebergabe{display:flex;flex-direction:column;gap:22px}
  .u-zeile{display:grid;grid-template-columns:130px 1fr;gap:18px;align-items:start}
  .u-label{font-family:var(--mono);font-size:12px;letter-spacing:.08em;color:var(--text-3);text-transform:uppercase;padding-top:3px}
  ul.clean{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:7px}
  ul.clean li{padding-left:18px;position:relative}
  ul.clean li::before{content:"";position:absolute;left:0;top:.62em;width:6px;height:1px;background:var(--gold-dim)}
  .offen{color:var(--text-3);font-style:italic}
  .zahlen{display:flex;flex-direction:column;margin-bottom:26px}
  .z{display:grid;grid-template-columns:1fr auto auto;gap:14px;align-items:baseline;padding:11px 0;border-bottom:1px solid var(--line-soft)}
  .z:last-child{border-bottom:0}
  .z-name{font-size:15px}
  .z-wert{font-family:var(--mono);font-size:17px;font-variant-numeric:tabular-nums;color:var(--text)}
  .z-delta{font-family:var(--mono);font-size:12px;font-variant-numeric:tabular-nums;color:var(--text-3);min-width:74px;text-align:right}
  .z-delta.runter{color:var(--warn)}
  .z-delta.hoch{color:var(--good)}
  .seiten{display:grid;grid-template-columns:1fr;gap:20px;margin-bottom:26px}
  @media(min-width:560px){.seiten{grid-template-columns:1fr 1fr}}
  .seiten h4{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);margin:0 0 10px;font-weight:500}
  .seiten ol{margin:0;padding-left:20px;font-size:14px;color:var(--text-2);display:flex;flex-direction:column;gap:5px}
  .seiten ol span{font-family:var(--mono);color:var(--text-3);font-size:12px}
  .auffall{border-top:1px solid var(--line);padding-top:22px}
  .auffall h4{font-family:var(--serif);font-size:17px;font-weight:600;margin:0 0 10px;color:var(--gold)}
  blockquote{margin:0 0 14px;padding:0 0 0 20px;border-left:1px solid var(--gold-dim);font-family:var(--serif);font-size:20px;line-height:1.45;color:var(--text);max-width:54ch}
  blockquote + .quelle{font-family:var(--mono);font-size:12px;color:var(--text-3);margin:-6px 0 16px 21px;letter-spacing:.03em}
  .zitat-block + .zitat-block{margin-top:30px}
  .jobs{display:flex;flex-direction:column}
  .job{display:grid;grid-template-columns:96px 1fr;gap:16px;padding:10px 0;border-bottom:1px solid var(--line-soft);font-size:15px;align-items:baseline}
  .job:last-child{border-bottom:0}
  .job-zeit{font-family:var(--mono);font-size:12px;color:var(--text-3);letter-spacing:.04em}
  .job.heute .job-zeit{color:var(--gold)}
  .job.spaeter{color:var(--text-2)}
  .job .tag{font-family:var(--mono);font-size:11px;color:var(--text-3);margin-left:8px}
  .frage{margin-bottom:28px}
  .frage:last-child{margin-bottom:0}
  .frage p{margin-bottom:12px}
  .optionen{display:flex;flex-wrap:wrap;gap:8px}
  .opt{font-size:14px;border:1px solid var(--line);border-radius:3px;padding:7px 12px;background:var(--ink-3);color:var(--text-2)}
  .opt b{color:var(--text);font-weight:500}
  footer{padding:34px 0 0;font-family:var(--mono);font-size:11px;color:var(--text-3);letter-spacing:.05em;line-height:1.8}
  .nav{display:flex;gap:18px;flex-wrap:wrap;margin-top:18px;font-family:var(--mono);font-size:12px}
'@

function Add-BoardZahl($sb, [string]$name, $wert, [string]$delta, [string]$klasse) {
  $w = $(if ($null -eq $wert -or [string]$wert -eq '') { 'n/v' } else { [string]$wert })
  [void]$sb.AppendLine(('<div class="z"><div class="z-name">{0}</div><div class="z-wert">{1}</div><div class="z-delta{3}">{2}</div></div>' -f (ConvertTo-BoardEsc $name), (ConvertTo-BoardEsc $w), (ConvertTo-BoardEsc $delta), $(if ($klasse) { ' ' + $klasse } else { '' })))
}
function Get-BoardDelta($abw) {
  if ($null -eq $abw) { return @{ t = '—'; k = '' } }
  $n = [int]$abw
  return @{ t = $(if ($n -gt 0) { "+$n %" } else { "$n %" }); k = $(if ($n -le -25) { 'runter' } elseif ($n -ge 25) { 'hoch' } else { '' }) }
}

function ConvertTo-BoardHtml($d, $erz, [string]$erzFehler) {
  $art = $d.art; $tag = [datetime]$d.tag; $kalTag = [datetime]$d.kalTag
  $morgens = ($art -eq 'morgen')
  $c = $d.checkin; $g = $d.gegen
  # Hilfs-Scriptblöcke: NICHT $E/$T nennen — PowerShell-Variablen sind nicht case-sensitiv, und die
  # Schleifen unten heißen $e und $t; die hätten die Blöcke überschrieben (02.09., erster Bau).
  $esc = { param($s) ConvertTo-BoardEsc $s }
  $txt = { param($s) ConvertTo-BoardText $s }
  $sb = New-Object Text.StringBuilder
  $titel = $(if ($morgens) { 'Morgenboard' } else { 'Abendboard' })
  $jetzt = Get-Date
  [void]$sb.AppendLine('<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">')
  [void]$sb.AppendLine(('<title>{0} {1}</title>' -f $titel, $tag.ToString('dd.MM.yyyy')))
  [void]$sb.AppendLine('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>')
  [void]$sb.AppendLine('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Karla:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">')
  [void]$sb.AppendLine('<style>' + $script:BoardCss + '</style></head><body><div class="wrap">')

  # Kopf
  $entst = $(if ($morgens) { 'nach dem Morgencheck' } else { 'nach dem Abendcheck' })
  [void]$sb.AppendLine(('<header><p class="kicker">{0}</p><h1>{1}</h1><p class="datum">KW {2} · erstellt {3} {4} {5}</p></header>' -f $titel, (Get-BoardDatumLang $tag), (Get-BoardKw $tag), (Get-BoardDatumKurz $jetzt), $jetzt.ToString('HH:mm'), $entst))

  # Das Eine
  $eine = ''; $eineQuelle = ''
  if ($morgens) {
    if ($c -and [string]$c.fokus) { $eine = [string]$c.fokus; $eineQuelle = 'aus dem Morgencheck' }
    elseif ($g -and $g.antworten -and [string]$g.antworten.morgen) { $eine = [string]$g.antworten.morgen; $eineQuelle = 'aus dem Abendcheck von gestern — der Morgencheck hat es noch nicht bestätigt' }
  } else {
    if ($c -and $c.antworten -and [string]$c.antworten.morgen) { $eine = [string]$c.antworten.morgen; $eineQuelle = 'so im Abendcheck festgelegt' }
  }
  [void]$sb.AppendLine('<div class="eine">')
  [void]$sb.AppendLine(('<h2 class="h2gold">{0}</h2>' -f $(if ($morgens) { '🌅 Das Eine heute' } else { '🌅 Das Eine morgen' })))
  if ($eine) {
    [void]$sb.AppendLine(('<p class="eine-titel">{0}</p>' -f (& $txt $eine)))
    if ($erz -and $erz.schritt) { [void]$sb.AppendLine(('<p class="schritt">{0}</p>' -f (& $txt $erz.schritt))) }
    $warum = @()
    if ($eineQuelle) { $warum += $eineQuelle }
    if ($morgens -and $c -and [string]$c.auftrag) { $warum += ('Übergabe an Claude: ' + [string]$c.auftrag) }
    if ($warum.Count) { [void]$sb.AppendLine(('<p class="warum">{0}</p>' -f (& $txt ($warum -join ' · ')))) }
  } else {
    [void]$sb.AppendLine(('<p class="eine-titel muted">{0}</p>' -f $(if ($morgens) { 'Noch nicht gesetzt.' } else { 'Für morgen ist noch nichts gesetzt.' })))
    [void]$sb.AppendLine('<p class="warum">Der Checkin hat kein „Eines" mitgebracht — der nächste Morgencheck fragt danach.</p>')
  }
  if ($erz -and $erz.lage) { [void]$sb.AppendLine(('<p class="warum" style="margin-top:14px">{0}</p>' -f (& $txt $erz.lage))) }
  [void]$sb.AppendLine('</div>')

  # Übergabe / Tagesschluss
  $optText = { param($v) $s = [string]$v; if (-not $s) { return '' }; return ($s -replace '^[^\p{L}\p{N}]+', '').Trim() }
  if ($morgens) {
    [void]$sb.AppendLine('<section><h2>Übergabe aus dem Abendcheck' + $(if ($d.gegenTag) { ' · ' + (& $esc (Get-BoardDatumKurz ([datetime]$d.gegenTag))) } else { '' }) + '</h2><div class="uebergabe">')
    if ($g) {
      $w = $g.wahl; $a = $g.antworten
      $bil = $(if ($w -and $w.bilanz) { (& $optText $w.bilanz) } else { '' })
      [void]$sb.AppendLine(('<div class="u-zeile"><div class="u-label">Tagesbilanz</div><div>{0}</div></div>' -f $(if ($bil) { (& $txt $bil) + $(if ([string]$g.fokus) { ' — <span class="muted">' + (& $txt ([string]$g.fokus)) + '</span>' } else { '' }) } else { '<span class="offen">keine Bilanz gezogen</span>' })))
      [void]$sb.AppendLine(('<div class="u-zeile"><div class="u-label">Abgelegt</div><div>{0}</div></div>' -f $(if ($a -and [string]$a.ablegen) { (& $txt ([string]$a.ablegen)) } else { '<span class="offen">nichts bewusst liegen gelassen</span>' })))
      $abend = @(); if ($w -and $w.erholung) { $abend += (& $optText $w.erholung) }; if ($w -and $w.projekt) { $abend += (& $optText $w.projekt) }
      [void]$sb.AppendLine(('<div class="u-zeile"><div class="u-label">Der Abend</div><div>{0}</div></div>' -f $(if ($abend.Count) { (& $esc ($abend -join ' · ')) } else { '<span class="offen">nicht festgehalten</span>' })))
      if ($a -and [string]$a.morgen -and $eine -and ([string]$a.morgen).Trim() -ne $eine.Trim()) {
        [void]$sb.AppendLine(('<div class="u-zeile"><div class="u-label">Abends geplant</div><div class="muted">{0} <span class="offen">— heute Morgen anders entschieden</span></div></div>' -f (& $txt ([string]$a.morgen))))
      }
    } else { [void]$sb.AppendLine('<div class="offen">Kein Abendcheck der letzten vier Tage gefunden — der Tag beginnt ohne Übergabe.</div>') }
    [void]$sb.AppendLine('</div></section>')
  } else {
    [void]$sb.AppendLine('<section><h2>Tag geschlossen</h2><div class="uebergabe">')
    if ($c) {
      $w = $c.wahl; $a = $c.antworten
      $bil = $(if ($w -and $w.bilanz) { (& $optText $w.bilanz) } else { '' })
      $heuteEine = $(if ([string]$c.fokus) { [string]$c.fokus } elseif ($g -and [string]$g.fokus) { [string]$g.fokus } else { '' })
      [void]$sb.AppendLine(('<div class="u-zeile"><div class="u-label">Tagesbilanz</div><div>{0}</div></div>' -f $(if ($bil) { (& $txt $bil) + $(if ($heuteEine) { ' — <span class="muted">' + (& $txt $heuteEine) + '</span>' } else { '' }) } else { '<span class="offen">keine Bilanz gezogen</span>' })))
      [void]$sb.AppendLine(('<div class="u-zeile"><div class="u-label">Abgelegt</div><div>{0}</div></div>' -f $(if ($a -and [string]$a.ablegen) { (& $txt ([string]$a.ablegen)) } else { '<span class="offen">nichts bewusst liegen gelassen</span>' })))
      [void]$sb.AppendLine(('<div class="u-zeile"><div class="u-label">Dein Abend</div><div>{0}</div></div>' -f $(if ($w -and $w.erholung) { (& $esc (& $optText $w.erholung)) } else { '<span class="offen">nicht festgehalten</span>' })))
      [void]$sb.AppendLine(('<div class="u-zeile"><div class="u-label">Privatprojekt</div><div>{0}</div></div>' -f $(if ($w -and $w.projekt) { (& $esc (& $optText $w.projekt)) } else { '<span class="offen">nicht festgehalten</span>' })))
      if ($g -and [string]$g.auftrag) { [void]$sb.AppendLine(('<div class="u-zeile"><div class="u-label">Claude hatte</div><div class="muted">{0}</div></div>' -f (& $txt ([string]$g.auftrag)))) }
    } else { [void]$sb.AppendLine('<div class="offen">Kein Abendcheck für diesen Tag gefunden.</div>') }
    [void]$sb.AppendLine('</div></section>')
  }

  # Entschieden
  $ent = @(); if ($c -and $c.entschieden) { $ent = @($c.entschieden | Where-Object { $_ -and $_.frage }) }
  if ($ent.Count) {
    [void]$sb.AppendLine(('<section><h2>Entschieden {0}</h2><ul class="clean">' -f $(if ($morgens) { 'heute Morgen' } else { 'heute' })))
    foreach ($e in $ent) { [void]$sb.AppendLine(('<li>{0} <span class="muted">→ {1}</span></li>' -f (& $txt ([string]$e.frage)), (& $txt ([string]$e.antwort)))) }
    [void]$sb.AppendLine('</ul></section>')
  }

  # Termine
  $k = $d.kalender
  [void]$sb.AppendLine(('<section><h2>{0}</h2>' -f $(if ($morgens) { 'Termine heute' } else { 'Morgen im Kalender · ' + (& $esc (Get-BoardDatumKurz $kalTag)) })))
  if ($k) {
    $alle = @(@($k.ganztags) + @($k.termine))
    if ($alle.Count) {
      [void]$sb.AppendLine('<div class="jobs">')
      foreach ($t in $alle) {
        $z = $(if ($t.ganztags) { 'ganztägig' } else { [string]$t.zeit })
        $tags = @()
        if ($t.kal) { $tags += [string]$t.kal }
        if ($t.vorlaeufig) { $tags += 'vorläufig' }
        if ($t.ohneTitel -and -not $t.frei) { $tags += 'Titel nicht freigegeben' }
        if ($t.frei) { $tags += 'zählt als frei' }
        [void]$sb.AppendLine(('<div class="job {3}"><div class="job-zeit">{0}</div><div>{1}{2}</div></div>' -f (& $esc $z), (& $txt ([string]$t.titel)), $(if ($tags.Count) { ' <span class="tag">' + (& $esc ($tags -join ' · ')) + '</span>' } else { '' }), $(if ($t.frei -or $t.ganztags) { 'spaeter' } else { 'heute' })))
      }
      [void]$sb.AppendLine('</div>')
    } else { [void]$sb.AppendLine('<p class="muted">Nichts im Kalender — der Tag gehört dem Einen.</p>') }
    $lk = @(@($k.luecken) | ForEach-Object { '{0}–{1}' -f $_.von, $_.bis })
    [void]$sb.AppendLine(('<p class="muted small" style="margin-top:16px">{0} h frei im Arbeitsfenster{1}.{2}</p>' -f (& $esc ([string]$k.freiStunden)), $(if ($lk.Count) { ' · freie Blöcke ' + (& $esc ($lk -join ', ')) } else { '' }), $(if ($d.wetter) { ' Wetter: ' + (& $esc (Get-BoardWetterText $d.wetter.code)) + (', {0}–{1} °C' -f [Math]::Round($d.wetter.tmin), [Math]::Round($d.wetter.tmax)) + $(if ($null -ne $d.wetter.regenProz -and $d.wetter.regenProz -ge 30) { ', Regen ' + $d.wetter.regenProz + ' %' } else { '' }) + '.' } else { '' })))
    if ($d.kalWeiter.Count) {
      $wk = @($d.kalWeiter | ForEach-Object { '{0} {1} T · {2} h frei' -f (Get-BoardDatumKurz ([datetime]::ParseExact($_.datum, 'yyyy-MM-dd', $null))), $_.n, $_.freiStunden })
      [void]$sb.AppendLine(('<p class="muted small">Danach: {0}.</p>' -f (& $esc ($wk -join ' · '))))
    }
  } else { [void]$sb.AppendLine('<p class="offen">Kalender in diesem Lauf nicht erreichbar.</p>') }
  [void]$sb.AppendLine('</section>')

  # Zahlen
  [void]$sb.AppendLine(('<section><h2>{0}</h2><div class="zahlen">' -f $(if ($morgens) { 'Zahlen über Nacht' } else { 'Zahlen des Tages' })))
  $j = $d.jira
  if ($j -and $j.ok) {
    Add-BoardZahl $sb 'Offene Tickets (dir zugewiesen)' $j.offen ('erledigt 7 T: ' + $j.done7) ''
    Add-BoardZahl $sb $(if ($morgens) { 'Erledigt gestern' } else { 'Erledigt heute' }) $(if ($morgens) { $j.doneGestern } else { $j.doneHeute }) $(if ($j.leadP50) { 'Lead P50 ' + $j.leadP50 + ' T' } else { '' }) ''
  } else { Add-BoardZahl $sb 'Jira' $null 'nicht erreichbar' '' }
  Add-BoardZahl $sb 'In Arbeit hängend' $d.inArbeit.Count $(if ($d.inArbeit.Count) { 'ältestes ' + $d.inArbeit[0].alter + ' T' } else { '—' }) ''
  Add-BoardZahl $sb 'Ladenhüter (>90 Tage ohne Update)' $d.ladenhueter.Count $(if ($d.ladenhueter.Count) { $d.ladenhueter[0].key } else { '—' }) ''
  if ($d.vk -and $d.vk.ok) { $dl = Get-BoardDelta $d.vk.traffic.abweichung; Add-BoardZahl $sb ('vaikuntha.eu · Aufrufe ' + $(if ($d.vk.traffic.tag) { ([datetime]$d.vk.traffic.tag).ToString('dd.MM.') } else { 'gestern' })) $d.vk.traffic.aufrufe $dl.t $dl.k }
  else { Add-BoardZahl $sb 'vaikuntha.eu · Aufrufe' $null 'n/v' '' }
  if ($d.va -and $d.va.ok) { $dl = Get-BoardDelta $d.va.abweichung; Add-BoardZahl $sb ('vishnuartists.com · Aufrufe ' + $(if ($d.va.tag) { ([datetime]$d.va.tag).ToString('dd.MM.') } else { 'gestern' })) $d.va.aufrufe $dl.t $dl.k
    if (-not $morgens -and $null -ne $d.va.heute) { Add-BoardZahl $sb 'vishnuartists.com · heute bis jetzt' $d.va.heute ('Ø ' + $d.va.schnitt7) '' } }
  else { Add-BoardZahl $sb 'vishnuartists.com · Aufrufe' $null 'n/v' '' }
  if ($d.postfach -and $d.postfach.ok) { Add-BoardZahl $sb 'Postfach · warten auf Antwort' $d.postfach.zusammenfassung.wartet $(if ($d.postfach.zusammenfassung.aeltesteTage) { 'älteste ' + $d.postfach.zusammenfassung.aeltesteTage + ' T' } else { '' }) '' }
  if ($d.slack -and $d.slack.ok) { Add-BoardZahl $sb 'Slack · warten auf Antwort' $d.slack.zusammenfassung.wartet $(if ($d.slack.zusammenfassung.aeltesteTage) { 'älteste ' + $d.slack.zusammenfassung.aeltesteTage + ' T' } else { '' }) '' }
  [void]$sb.AppendLine('</div>')
  if (($d.vk -and $d.vk.ok -and @($d.vk.traffic.topSeiten).Count) -or ($d.va -and $d.va.ok -and @($d.va.top).Count)) {
    [void]$sb.AppendLine('<div class="seiten">')
    if ($d.vk -and $d.vk.ok -and @($d.vk.traffic.topSeiten).Count) {
      [void]$sb.AppendLine('<div><h4>Top 3 · vaikuntha.eu</h4><ol>')
      foreach ($p in @($d.vk.traffic.topSeiten | Select-Object -First 3)) { [void]$sb.AppendLine(('<li>{0} <span>{1}</span></li>' -f (& $esc $(if ($p.titel) { ($p.titel -replace '\s*[-–—]\s*Vaikuntha\s*$', '') } else { $p.path })), $p.views)) }
      [void]$sb.AppendLine('</ol></div>')
    }
    if ($d.va -and $d.va.ok -and @($d.va.top).Count) {
      [void]$sb.AppendLine('<div><h4>Top 3 · vishnuartists.com</h4><ol>')
      foreach ($p in @($d.va.top)) { [void]$sb.AppendLine(('<li>{0} <span>{1}</span></li>' -f (& $esc $(if ($p.titel) { ($p.titel -replace '\s*[·—-]\s*Vishnu Artists.*$', '') } else { $p.path })), $p.views)) }
      [void]$sb.AppendLine('</ol></div>')
    }
    [void]$sb.AppendLine('</div>')
  }
  if ($d.faellig.Count) {
    $fl = @()
    foreach ($x in @($d.faellig | Select-Object -First 5)) {
      $wann = $(if ($x.dueTage -lt 0) { ' (überfällig)' } elseif ($x.dueTage -eq 0) { ' (heute)' } else { ' (in ' + $x.dueTage + ' T)' })
      $fl += ((& $txt ($x.key + ' ' + $x.titel)) + $wann)
    }
    [void]$sb.AppendLine('<p class="small muted">Fällig in den nächsten drei Tagen: ' + ($fl -join ' · ') + '</p>')
  }
  [void]$sb.AppendLine('<div class="auffall"><h4>Das fällt mir auf</h4>')
  if ($erz -and $erz.auffall.Count) { foreach ($p in $erz.auffall) { [void]$sb.AppendLine(('<p>{0}</p>' -f (& $txt $p))) } }
  else { [void]$sb.AppendLine(('<p class="offen">{0}</p>' -f (& $esc $(if ($erzFehler) { "Kein Kommentar in diesem Lauf: $erzFehler" } else { 'Kein Kommentar in diesem Lauf.' })))) }
  [void]$sb.AppendLine('</div></section>')

  # Weisheit
  if ($erz -and $erz.weisheit.Count) {
    [void]$sb.AppendLine(('<section><h2>{0}</h2>' -f $(if ($morgens) { 'Weisheit für heute' } else { 'Weisheit für morgen' })))
    foreach ($z in $erz.weisheit) {
      [void]$sb.AppendLine(('<div class="zitat-block"><blockquote>{0}</blockquote><p class="quelle">{1}</p>{2}</div>' -f (& $esc $z.zitat), (& $esc $z.quelle), $(if ($z.bezug) { '<p class="muted small">' + (& $txt $z.bezug) + '</p>' } else { '' })))
    }
    [void]$sb.AppendLine('</section>')
  }

  # Routinen
  [void]$sb.AppendLine(('<section><h2>{0}</h2>' -f $(if ($morgens) { 'Was heute ohne dich läuft' } else { 'Was über Nacht und morgen ohne dich läuft' })))
  if ($d.laeufe.Count) {
    [void]$sb.AppendLine('<div class="jobs">')
    foreach ($l in $d.laeufe) {
      $z = [datetime]$l.zeit
      $heuteKl = ($z.Date -eq $jetzt.Date)
      [void]$sb.AppendLine(('<div class="job {0}"><div class="job-zeit">{1} {2}</div><div>{3}{4}</div></div>' -f $(if ($heuteKl) { 'heute' } else { 'spaeter' }), $script:BoardWtK[[int]$z.DayOfWeek], $z.ToString('HH:mm'), (& $esc $l.name), $(if ($l.wirkung) { ' <span class="muted small">— ' + (& $esc $l.wirkung) + '</span>' } else { '' })))
    }
    [void]$sb.AppendLine('</div>')
  } else { [void]$sb.AppendLine('<p class="muted">Keine Routine im Fenster — außer diesem Board läuft nichts von allein.</p>') }
  [void]$sb.AppendLine('</section>')

  # Rückfragen
  if ($d.rueckfragen.Count) {
    [void]$sb.AppendLine('<section><h2>Offene Rückfragen</h2>')
    $n = 0
    foreach ($q in $d.rueckfragen) {
      $n++
      [void]$sb.AppendLine(('<div class="frage"><p><strong>{0} · {1}</strong></p>' -f $n, (& $txt $q.frage)))
      if ($q.optionen.Count) {
        [void]$sb.AppendLine('<div class="optionen">')
        $b = 0; foreach ($o in $q.optionen) { $b++; [void]$sb.AppendLine(('<span class="opt"><b>{0}</b> {1}</span>' -f [char](64 + $b), (& $esc $o))) }
        [void]$sb.AppendLine('</div>')
      }
      [void]$sb.AppendLine('</div>')
    }
    [void]$sb.AppendLine('<p class="muted small">Entscheiden im Compass: Ritual „Rückfragen von Claude".</p></section>')
  }

  # Fuß
  $quellen = @('Jira ' + $(if ($j -and $j.site) { $j.site } else { 'vishnuartists.atlassian.net' }), 'vaikuntha.eu KPI-API', 'vishnuartists.com/stats.php', ('Kalender ' + (@($d.kalQuellen | ForEach-Object { $_.name }) -join '+')), 'Postfach', 'Slack', 'Routinen', 'open-meteo')
  [void]$sb.AppendLine(('<footer>Quellen: {0}<br>Stand {1} · john-server.ps1 → john-board.ps1{2}{3}' -f (& $esc ($quellen -join ' · ')), $jetzt.ToString('dd.MM.yyyy, HH:mm'), $(if ($erz -and $erz.model) { ' · Kommentar: ' + (& $esc $erz.model) } else { '' }), $(if ($d.fehler.Count) { '<br>Nicht erreichbar in diesem Lauf: ' + (& $esc ($d.fehler -join ' · ')) } else { '' })))
  [void]$sb.AppendLine('<div class="nav"><a href="/dashboard.html">← Flow Compass</a><a href="/api/board">Alle Boards</a></div></footer>')
  [void]$sb.AppendLine('</div></body></html>')
  return $sb.ToString()
}

# ---------- Bauen und ablegen ----------
function Build-Board([string]$art, [string]$datum, [bool]$mitClaude = $true) {
  if ($art -ne 'morgen' -and $art -ne 'abend') { throw "Board-Art '$art' unbekannt (morgen|abend)" }
  if ($datum -notmatch '^\d{4}-\d{2}-\d{2}$') { throw "Datum '$datum' unbrauchbar" }
  if (-not (Test-Path $script:BoardDir)) { New-Item -ItemType Directory -Force $script:BoardDir | Out-Null }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $d = Get-BoardDaten $art $datum
  $erz = $null; $erzFehler = ''
  if ($mitClaude) {
    # Zwei Versuche: am 02.09. blieb ein Lauf ohne Kommentar (API-Aussetzer), der nächste ging in 24 s durch.
    # Der Grund landet in boards\_fehler.log — der Server läuft aus der geplanten Aufgabe ohne Konsole,
    # ein Write-Host verpufft dort.
    foreach ($versuch in 1, 2) {
      try { $erz = Get-BoardErzaehlung $d; $erzFehler = ''; break }
      catch {
        $erzFehler = $_.Exception.Message
        Write-Host "  Board-Kommentar fehlt (Versuch $versuch): $erzFehler" -ForegroundColor Yellow
        try { [IO.File]::AppendAllText((Join-Path $script:BoardDir '_fehler.log'), ("{0} {1}-{2} Versuch {3}: {4}`n" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $datum, $art, $versuch, $erzFehler), (New-Object Text.UTF8Encoding($false))) } catch { }
        if ($versuch -eq 1) { Start-Sleep -Seconds 3 }
      }
    }
  } else { $erzFehler = 'ohne Claude gebaut (bauen=2)' }
  $html = ConvertTo-BoardHtml $d $erz $erzFehler
  $name = "$datum-$art.html"
  $ziel = Join-Path $script:BoardDir $name
  [IO.File]::WriteAllText($ziel, $html.Replace("`r`n", "`n"), (New-Object Text.UTF8Encoding($false)))
  Write-Host ("[{0}] Board -> boards\{1} ({2} s{3}{4})" -f (Get-Date -Format 'HH:mm:ss'), $name, [Math]::Round($sw.Elapsed.TotalSeconds, 1), $(if ($erz) { ', mit Kommentar' } else { ', ohne Kommentar' }), $(if ($d.fehler.Count) { ', ausgefallen: ' + ($d.fehler.Count) } else { '' })) -ForegroundColor Green
  return @{ ok = $true; art = $art; datum = $datum; datei = "boards\$name"; url = "/boards/$name"; sekunden = [Math]::Round($sw.Elapsed.TotalSeconds, 1)
            kommentar = [bool]$erz; kommentarFehler = $erzFehler; ausgefallen = @($d.fehler); stand = (Get-Date).ToString('o') }
}

function Get-BoardListe {
  $liste = @()
  if (Test-Path $script:BoardDir) {
    foreach ($f in @(Get-ChildItem -LiteralPath $script:BoardDir -Filter '*.html' -File | Sort-Object Name -Descending)) {
      $m = [regex]::Match($f.Name, '^(\d{4}-\d{2}-\d{2})-(morgen|abend)\.html$')
      if (-not $m.Success) { continue }
      $liste += , @{ datum = $m.Groups[1].Value; art = $m.Groups[2].Value; url = "/boards/$($f.Name)"; datei = "boards\$($f.Name)"; stand = $f.LastWriteTime.ToString('o') }
    }
    $arch = Join-Path $script:BoardDir 'archiv'
    if (Test-Path $arch) {
      foreach ($f in @(Get-ChildItem -LiteralPath $arch -Filter '*.html' -File | Sort-Object Name -Descending)) {
        $m = [regex]::Match($f.Name, '^(\d{4}-\d{2}-\d{2})-(morgen|abend)')
        $liste += , @{ datum = $(if ($m.Success) { $m.Groups[1].Value } else { '' }); art = $(if ($m.Success) { $m.Groups[2].Value } else { '' }); url = "/boards/archiv/$($f.Name)"; datei = "boards\archiv\$($f.Name)"; archiv = $true; stand = $f.LastWriteTime.ToString('o') }
      }
    }
  }
  $liste = @($liste | Sort-Object { $_.datum + '|' + $(if ($_.art -eq 'abend') { '2' } else { '1' }) } -Descending)
  return @{ ok = $true; anzahl = $liste.Count; neuestes = $(if ($liste.Count) { $liste[0] } else { $null }); boards = $liste }
}

# Übersichtsseite (GET /api/board ohne Parameter im Browser): dieselbe Optik, eine Liste.
function ConvertTo-BoardIndexHtml($liste) {
  $sb = New-Object Text.StringBuilder
  [void]$sb.AppendLine('<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Boards</title>')
  [void]$sb.AppendLine('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Karla:wght@400;500&family=IBM+Plex+Mono:wght@400&display=swap"><style>' + $script:BoardCss + '</style></head><body><div class="wrap">')
  [void]$sb.AppendLine('<header><p class="kicker">Boards</p><h1>Morgen- und<br>Abendboards</h1><p class="datum">' + $liste.anzahl + ' Boards · neueste zuerst</p></header>')
  [void]$sb.AppendLine('<section><div class="jobs">')
  foreach ($b in @($liste.boards)) {
    $dt = $null; try { $dt = [datetime]::ParseExact($b.datum, 'yyyy-MM-dd', $null) } catch { }
    [void]$sb.AppendLine(('<div class="job {3}"><div class="job-zeit">{0}</div><div><a href="{1}">{2}</a>{4}</div></div>' -f $(if ($dt) { (ConvertTo-BoardEsc (Get-BoardDatumKurz $dt)) } else { '' }), $b.url, $(if ($b.art -eq 'abend') { 'Abendboard' } elseif ($b.art -eq 'morgen') { 'Morgenboard' } else { (ConvertTo-BoardEsc $b.datei) }), $(if ($b.archiv) { 'spaeter' } else { 'heute' }), $(if ($b.archiv) { '<span class="tag">Handfassung, Archiv</span>' } else { '' })))
  }
  if (-not @($liste.boards).Count) { [void]$sb.AppendLine('<p class="muted">Noch kein Board — das erste entsteht nach dem nächsten Checkin.</p>') }
  [void]$sb.AppendLine('</div></section><footer><div class="nav"><a href="/dashboard.html">← Flow Compass</a></div></footer></div></body></html>')
  return $sb.ToString()
}
