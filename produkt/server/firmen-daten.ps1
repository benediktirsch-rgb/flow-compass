# firmen-daten.ps1 — Firmensicht für den Compass-Server (16.09.2026)
#
#   Wird von compass-server.ps1 per Dot-Source geladen, wenn diese Datei neben ihm liegt. Liefert:
#     GET  /api/finanzen              Kontostand, Deckung, Monatsergebnis, Belege, Entscheidungen samt Stimmen, GF-Sync
#     POST /api/finanzen/entscheidung eine Stimme — immer unter dem Namen aus firma.stimme, nie aus dem Browser
#     GET  /api/nutzer                aktive Nutzer, neue Registrierungen, Aktivitäten
#     GET  /api/pool                  offene Bewerbungen und Einsätze im Freelancer-Pool
#     GET  /api/trichter              dieselben Menschen als eine Liste „wartet auf eine Entscheidung“
#     GET  /api/traffic (+ /api/vishnu als alter Name, den der Compass anfragt)  Website-Aufrufe gestern
#
#   Konfiguration in compass-server.json (alles leer = Modul aus, die Endpunkte antworten NO_FIRMA):
#     "firma": { "stimme": "Vorname Nachname", "finanzUrl": "https://…/finanzlauf/", "nutzerUrl": "https://…/nutzer-kpi.php",
#                "poolUrl": "https://…/pool-api.php", "pflegeUrl": "https://…/portal-admin.php?v=bewerbungen",
#                "statsUrl": "https://…/stats.php" }
#   Ausweis gegenüber der Website: SHA-256 des Tokens aus der Umgebungsvariable FINANZ_TOKEN (Kopf X-Finanz-Token).
#   Der Token selbst verlässt diesen Server nie, und nichts hiervon landet in einer Datei.
#
#   Gegenstück: dieselben Funktionen im persönlichen Server des Erfinders (dort mit Vereins-Bahn im Trichter).
#   Ändert sich dort die Form einer Antwort, gehört sie hier nachgezogen — der Compass liest beide gleich.
#   DATENSCHUTZ wie dort: von Personen im Pool verlassen nur id, Anzeigename und erste Mailadresse diese
#   Funktionen; Namen gehen nur zur Laufzeit an die Karte, nie in eine *-data.js.

$FirmaK        = Get-Feld $K 'firma' $null
$FirmaStimme   = [string](Get-Feld $FirmaK 'stimme' '')
$FinanzUrl     = [string](Get-Feld $FirmaK 'finanzUrl' '')
$NutzerUrl     = [string](Get-Feld $FirmaK 'nutzerUrl' '')
$PoolUrl       = [string](Get-Feld $FirmaK 'poolUrl' '')
$PortalAdminUrl = [string](Get-Feld $FirmaK 'pflegeUrl' '')
$StatsUrl      = [string](Get-Feld $FirmaK 'statsUrl' '')
if ($FinanzUrl -and -not $FinanzUrl.EndsWith('/')) { $FinanzUrl += '/' }
$FirmaAn       = [bool]($FinanzUrl -or $NutzerUrl -or $PoolUrl -or $StatsUrl -or (Get-Feld $FirmaK 'towerUrl' ''))
$FinanzCacheSec = 300; $NutzerCacheSec = 900; $PoolCacheSec = 300; $StatsCacheSec = 3600; $FirmaTimeoutSec = 12

function Get-FirmaAus([string]$was) {
  @{ ok = $false; error = 'NO_FIRMA'; hint = "Firmensicht nicht eingerichtet: firma.$was in compass-server.json fehlt." }
}
function Get-FinanzToken {
  $t = [Environment]::GetEnvironmentVariable('FINANZ_TOKEN', 'User')
  if (-not $t) { $t = $env:FINANZ_TOKEN }
  ([string]$t) -replace '\s', ''
}
function Get-FinanzAusweis([string]$token) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($token)) | ForEach-Object { $_.ToString('x2') }) } finally { $sha.Dispose() }
}
function Get-FirmaFehler($err, [string]$quelle) {
  $e = $err.Exception; while ($e.InnerException) { $e = $e.InnerException }
  $code = $null; try { $code = [int]$err.Exception.Response.StatusCode } catch { }
  @{ ok = $false; status = $code
     error = $(if ($code -eq 401) { 'AUTH_INVALID' } elseif ($code -eq 403) { 'FORBIDDEN' } elseif ($code -eq 503) { 'NO_DB' } else { 'UNREACHABLE' })
     hint = $(if ($code -eq 401) { "Die Website weist FINANZ_TOKEN ab (401) — Token hier und auf der Website sind nicht dasselbe?" }
              elseif ($code -eq 503) { 'Die Website erreicht ihre Datenbank nicht — nicht dieser Server.' }
              else { "$quelle nicht erreichbar: " + $e.Message }) }
}
function Invoke-Firma([string]$url, [string]$token) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $h = @{}; if ($token) { $h['X-Finanz-Token'] = (Get-FinanzAusweis $token) }
  Invoke-RestMethod -Uri $url -Method Get -TimeoutSec $FirmaTimeoutSec -Headers $h -UserAgent 'Flow-Compass-Server/1.0'
}
$NoKeyFirma = @{ ok = $false; error = 'NO_KEY'; hint = 'FINANZ_TOKEN fehlt in der Umgebung dieses Servers.' }

# ---------- Finanzen ----------
$script:FinanzCache = @{ zeit = $null; out = $null }
function Get-Finanzen([bool]$fresh) {
  if (-not $FinanzUrl) { return (Get-FirmaAus 'finanzUrl') }
  $cc = $script:FinanzCache
  if (-not $fresh -and $cc.out -and $cc.zeit -and ((Get-Date) - $cc.zeit).TotalSeconds -lt $FinanzCacheSec) { return $cc.out }
  $token = Get-FinanzToken
  if (-not $token) { return $NoKeyFirma }
  try { $r = Invoke-Firma ($FinanzUrl + 'kpi.php?voll=1') $token } catch { return (Get-FirmaFehler $_ 'kpi.php') }
  if (-not $r.ok) { return @{ ok = $false; error = 'UNREACHABLE'; hint = 'kpi.php antwortet ohne ok' } }
  $ent = @()
  foreach ($x in @($r.entscheidungen)) {
    if (-not $x) { continue }
    $st = @{}
    foreach ($p in @($x.stimmen.PSObject.Properties)) { if ($p) { $st[$p.Name] = @{ wahl = $p.Value.wahl; kommentar = [string]$p.Value.kommentar; zeit = [string]$p.Value.zeit; spaeter = [string]$p.Value.spaeter } } }
    $ent += , @{ id = [string]$x.id; titel = [string]$x.titel; frage = [string]$x.frage; warum = [string]$x.warum
                 optionen = @($x.optionen | ForEach-Object { [string]$_ }); empfehlung = [int]$x.empfehlung
                 stimmen = $st; einig = [bool]$x.einig
                 umsetzung = $(if ($x.umsetzung) { @{ status = [string]$x.umsetzung.status; notiz = [string]$x.umsetzung.notiz } } else { $null }) }
  }
  $z = [bool]$r.zahlen
  $out = @{ ok = $true; stand = (Get-Date).ToString('o'); cacheSec = $FinanzCacheSec
            url = $FinanzUrl; urlStrategie = ($FinanzUrl + 'strategie.php'); urlSync = ($FinanzUrl + 'sync.php'); urlLauf = ($FinanzUrl + 'lauf.php')
            # „ich“ ist die Person dieses Servers, nicht der Name, unter dem die Website den Token kennt —
            # sonst hielte der Compass fremde Stimmen für die eigenen.
            ich = $(if ($FirmaStimme) { $FirmaStimme } else { [string]$r.ich })
            teilnehmer = @($r.teilnehmer | ForEach-Object { [string]$_ })
            zahlen = $z; stichtag = [string]$r.stichtag; ausgewertet = [string]$r.ausgewertet
            kontostand = $(if ($z) { [double]$r.kontostand } else { $null })
            deckung = $(if ($z -and $null -ne $r.deckung) { [double]$r.deckung } else { $null })
            ergebnis = $(if ($z) { [double]$r.ergebnis } else { $null }); vormonat = $(if ($z -and $null -ne $r.vormonat) { [double]$r.vormonat } else { $null })
            monat = [string]$r.monat; kosten = $(if ($z) { [double]$r.kosten } else { $null }); einnahmen = $(if ($z) { [double]$r.einnahmen } else { $null })
            warnung = [bool]$r.warnung
            verlauf = @(@($r.verlauf) | Where-Object { $_ } | ForEach-Object { @{ monat = [string]$_.monat; kontostand = [double]$_.kontostand; ergebnis = [double]$_.ergebnis
                         einnahmen = [double]$_.einnahmen; ausgaben = [double]$_.ausgaben; deckung = $(if ($null -ne $_.deckung) { [double]$_.deckung } else { $null }) } })
            belege = @{ offen = [int]$r.belege.offen; gesamt = [int]$r.belege.gesamt }
            entscheidungen = $ent
            agenda = @(@($r.agenda) | Where-Object { $_ } | ForEach-Object { @{ id = [string]$_.id; text = [string]$_.text; wer = [string]$_.wer } })
            sync = $(if ($r.sync) { @{ titel = [string]$r.sync.titel; naechster = [string]$r.sync.naechster; von = [string]$r.sync.von; bis = [string]$r.sync.bis; takt = [int]$r.sync.takt_wochen } } else { $null })
            lux = $(if ($r.lux) { @{ bar = [double]$r.lux.bar; forderung = [double]$r.lux.forderung_gmbh; stichtag = [string]$r.lux.stichtag } } else { $null })
            fristen = @(@($r.fristen) | Where-Object { $_ } | ForEach-Object { @{ datum = [string]$_.datum; titel = [string]$_.titel } }) }
  $script:FinanzCache = @{ zeit = Get-Date; out = $out }
  $out
}
function Send-Finanzstimme($in) {
  if (-not $FinanzUrl) { return (Get-FirmaAus 'finanzUrl') }
  if (-not $FirmaStimme) { return @{ ok = $false; error = 'NO_STIMME'; hint = 'firma.stimme fehlt in compass-server.json — ohne Namen stimmt dieser Server nicht ab.' } }
  $token = Get-FinanzToken
  if (-not $token) { return $NoKeyFirma }
  $id = [string]$in.id
  if ($id -notmatch '^E[0-9]{1,2}$') { return @{ ok = $false; error = 'BAD_ID' } }
  # Der Name kommt aus der Konfiguration — ein `als` aus dem Browser wird bewusst nicht gelesen.
  $body = @{ typ = 'entscheidung'; id = $id; als = $FirmaStimme }
  if ($in.PSObject.Properties['wahl'])      { $body.wahl = $in.wahl }
  if ($in.PSObject.Properties['kommentar']) { $body.kommentar = [string]$in.kommentar }
  if ($in.PSObject.Properties['spaeter'])   { $body.spaeter = $true }
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $r = Invoke-RestMethod -Uri ($FinanzUrl + 'api.php') -Method Post -TimeoutSec $FirmaTimeoutSec -ContentType 'application/json; charset=utf-8' `
           -Headers @{ 'X-Finanz-Token' = (Get-FinanzAusweis $token) } -UserAgent 'Flow-Compass-Server/1.0' `
           -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress)))
  } catch {
    $f = Get-FirmaFehler $_ 'api.php'
    if ($f.error -eq 'FORBIDDEN') { $f.hint = "Die Website nimmt Stimmen von diesem Server (noch) nicht an. Abstimmen geht direkt auf $($FinanzUrl)strategie.php"; $f.url = $FinanzUrl + 'strategie.php' }
    return $f
  }
  $script:FinanzCache = @{ zeit = $null; out = $null }
  Write-Host ("[{0}] Finanzen: Stimme {1}" -f (Get-Date -Format 'HH:mm:ss'), $id) -ForegroundColor Green
  @{ ok = [bool]$r.ok; stand = $r.stand }
}

# ---------- Nutzerzahlen ----------
$script:NutzerCache = @{ zeit = $null; out = $null }
function Get-Nutzer([bool]$fresh) {
  if (-not $NutzerUrl) { return (Get-FirmaAus 'nutzerUrl') }
  $cc = $script:NutzerCache
  if (-not $fresh -and $cc.out -and $cc.zeit -and ((Get-Date) - $cc.zeit).TotalSeconds -lt $NutzerCacheSec) { return $cc.out }
  $token = Get-FinanzToken
  if (-not $token) { return $NoKeyFirma }
  try { $r = Invoke-Firma ($NutzerUrl + '?voll=1') $token } catch { return (Get-FirmaFehler $_ 'nutzer-kpi.php') }
  if (-not $r.ok) { return @{ ok = $false; error = 'UNREACHABLE'; hint = 'nutzer-kpi.php antwortet ohne ok' } }
  $mAktiv  = $(if ($r.aktiv)  { @{ heute = [int]$r.aktiv.heute; t7 = [int]$r.aktiv.t7; t30 = [int]$r.aktiv.t30; offen = [int]$r.aktiv.offen } } else { $null })
  $mKonten = $(if ($r.konten) { @{ gesamt = [int]$r.konten.gesamt; mitLogin = $(if ($null -ne $r.konten.mitLogin) { [int]$r.konten.mitLogin } else { $null }) } } else { $null })
  $mNeu = $null
  if ($r.neu) {
    $mNeu = @{ h24 = [int]$r.neu.h24.selbst; t7 = [int]$r.neu.t7.selbst; t30 = [int]$r.neu.t30.selbst; vor30 = [int]$r.neu.vor30.selbst
               gepflegt24 = [int]$r.neu.h24.gepflegt; gepflegt30 = [int]$r.neu.t30.gepflegt
               ereignis30 = $(if ($null -ne $r.neu.ereignis30) { [int]$r.neu.ereignis30 } else { $null })
               quellen = @(@($r.neu.quellen30) | Where-Object { $_ } | ForEach-Object { @{ quelle = [string]$_.quelle; n = [int]$_.n; selbst = [bool]$_.selbst } }) }
  }
  $mHit = $(if ($r.hitliste) { @{ gesamt = [int]$r.hitliste.gesamt; vor30 = [int]$r.hitliste.vor30
                                  nachArt = @(@($r.hitliste.nachArt) | Where-Object { $_ } | ForEach-Object { @{ art = [string]$_.art; n = [int]$_.n } }) } } else { $null })
  $out = @{ ok = $true; stand = (Get-Date).ToString('o'); cacheSec = $NutzerCacheSec; gemessen = [string]$r.stand
            konten = $mKonten; neu = $mNeu; aktiv = $mAktiv; hitliste = $mHit
            fehlt = @(@($r.fehlt) | ForEach-Object { [string]$_ })
            personen = @(@($r.personen) | Where-Object { $_ } | ForEach-Object { @{ name = [string]$_.name; n = [int]$_.n; zuletzt = [string]$_.zuletzt } })
            neueste  = @(@($r.neueste)  | Where-Object { $_ } | ForEach-Object { @{ name = [string]$_.name; quelle = [string]$_.quelle; erstellt = [string]$_.erstellt } }) }
  $script:NutzerCache = @{ zeit = Get-Date; out = $out }
  $out
}

# ---------- Freelancer-Pool ----------
# Reihenfolge trägt Bedeutung (was kommt nach was) — deshalb [ordered]. Gegenstück: VF_BEWERBUNG_STUFEN in portal-lib.php.
$script:PoolStufen = [ordered]@{
  pool = [ordered]@{ eingereicht = 'Profil eingegangen'; gespraech = 'Kennenlerngespräch'; geprueft = 'Profil & Unterlagen geprüft'
                     vertrag = 'Kooperationsvertrag'; aufgenommen = 'Im Kollektiv'; abgesagt = 'Nicht zustande gekommen' }
  einsatz = [ordered]@{ vorgeschlagen = 'Angebot vorgelegt'; eingereicht = 'Profil eingereicht'; vorgestellt = 'Beim Kunden vorgestellt'
                        gespraech = 'Gespräch vereinbart'; angebot = 'Angebot liegt vor'; einsatz = 'Im Einsatz'
                        abgeschlossen = 'Einsatz abgeschlossen'; abgesagt = 'Nicht zustande gekommen' }
}
function Get-PoolNaechste([string]$art, [string]$status) {
  if (-not $script:PoolStufen.Contains($art)) { return @() }
  $tab = $script:PoolStufen[$art]; $keys = @($tab.Keys); $i = [Array]::IndexOf($keys, $status); $raus = @()
  for ($k = 0; $k -lt $keys.Count; $k++) {
    if ($keys[$k] -eq 'abgesagt') { continue }
    if ($i -ge 0 -and $k -le $i) { continue }
    $raus += , @{ status = [string]$keys[$k]; text = [string]$tab[$keys[$k]] }
  }
  $raus += , @{ status = 'abgesagt'; text = [string]$tab['abgesagt'] }
  @($raus)
}
$script:PoolCache = @{ zeit = $null; out = $null }
function Get-Pool([bool]$fresh) {
  if (-not $PoolUrl) { return (Get-FirmaAus 'poolUrl') }
  $cc = $script:PoolCache
  if (-not $fresh -and $cc.out -and $cc.zeit -and ((Get-Date) - $cc.zeit).TotalSeconds -lt $PoolCacheSec) { return $cc.out }
  $token = Get-FinanzToken
  if (-not $token) { return $NoKeyFirma }
  # Die offenen Vorgänge sind die Zahl, um die es geht — fällt dieser Abruf aus, fällt die ganze Antwort aus.
  try { $rb = Invoke-Firma ($PoolUrl + '?was=bewerbungen&offen=1') $token } catch { return (Get-FirmaFehler $_ 'pool-api.php') }
  $kpi = $null; $fehlt = @()
  try { $rk = Invoke-Firma ($PoolUrl + '?was=kpi') $token; if ($rk.ok) { $kpi = $rk.kpi } else { $fehlt += 'kpi' } } catch { $fehlt += 'kpi' }
  $personen = @(); $pAgg = $null
  try {
    $rp = Invoke-Firma ($PoolUrl + '?was=personen') $token
    $mitSkill = 0; $mitZert = 0; $mitVerf = 0; $mitPortal = 0; $mitProfil = 0; $mitMail = 0
    foreach ($p in @($rp.personen)) {
      if (-not $p) { continue }
      $personen += , @{ id = [int]$p.id; name = [string]$p.anzeigename; mail = [string]$p.mail }
      if (@($p.skills).Count) { $mitSkill++ }; if (@($p.zertifikate).Count) { $mitZert++ }; if ($p.verfuegbarkeit) { $mitVerf++ }
      if ($p.portal_am) { $mitPortal++ }; if ($p.profil_am) { $mitProfil++ }; if ([string]$p.mail) { $mitMail++ }
    }
    $pAgg = @{ gesamt = @($rp.personen).Count; mitSkill = $mitSkill; mitZertifikat = $mitZert
               mitVerfuegbarkeit = $mitVerf; mitPortal = $mitPortal; mitProfil = $mitProfil; mitMail = $mitMail }
  } catch { $fehlt += 'personen' }
  $offen = @()
  foreach ($b in @($rb.bewerbungen)) {
    if (-not $b) { continue }
    $mail = ''; $tr = @($personen | Where-Object { $_.id -eq [int]$b.person_id }); if ($tr.Count) { $mail = [string]$tr[0].mail }
    $offen += , @{ id = [int]$b.id; personId = [int]$b.person_id; name = [string]$b.anzeigename; mail = $mail
                   art = [string]$b.art; status = [string]$b.status; rolle = [string]$b.rolle
                   kunde = [string]$b.kunde; ort = [string]$b.ort; ab = [string]$b.ab
                   erstellt = [string]$b.erstellt; geaendert = [string]$b.geaendert }
  }
  $out = @{ ok = $true; stand = (Get-Date).ToString('o'); cacheSec = $PoolCacheSec
            url = $PoolUrl; urlPflege = $PortalAdminUrl
            kpi = $kpi; personen = @($personen); personenZahlen = $pAgg
            offen = @($offen); offenN = @($offen).Count; fehlt = @($fehlt) }
  $script:PoolCache = @{ zeit = Get-Date; out = $out }
  $out
}
function Get-TrichterTage([string]$zeit) {
  if (-not $zeit) { return $null }
  $d = [datetime]::MinValue
  if (-not [datetime]::TryParse($zeit, [ref]$d)) { return $null }
  [int][Math]::Floor(((Get-Date) - $d).TotalDays)
}
# Nur die beiden Pool-Bahnen (kollektiv, einsatz) — eine Vereins-Bahn gibt es auf diesem Server nicht,
# darum steht „verein“ weder in quellen noch in fehlt.
function Get-Trichter([bool]$fresh) {
  $p = Get-Pool $fresh
  if (-not $p.ok) { return @{ ok = $true; stand = (Get-Date).ToString('o'); wartende = @(); n = 0
                              nachBahn = @{ ankommen = 0; kollektiv = 0; einsatz = 0 }; aeltesteTage = $null; doppelt = 0
                              quellen = @(); fehlt = @('pool'); kpi = $null; personenZahlen = $null; urlPflege = $PortalAdminUrl
                              poolFehler = @{ error = [string]$p.error; hint = [string]$p.hint }; vereinFehler = $null } }
  $wartende = @()
  foreach ($b in @($p.offen)) {
    if (-not $b) { continue }
    $bahn = 'kollektiv'; if ($b.art -eq 'einsatz') { $bahn = 'einsatz' }
    $stufenText = ''
    if ($script:PoolStufen.Contains([string]$b.art)) { $tab = $script:PoolStufen[[string]$b.art]; if ($tab.Contains([string]$b.status)) { $stufenText = [string]$tab[[string]$b.status] } }
    if (-not $stufenText) { $stufenText = [string]$b.status }
    $wartende += , @{ schluessel = 'pool-' + [int]$b.id; bahn = $bahn; haus = 'Pool'
                      id = [int]$b.id; personId = [int]$b.personId; name = [string]$b.name; mail = [string]$b.mail
                      seit = [string]$b.erstellt; tage = (Get-TrichterTage ([string]$b.erstellt)); liegtTage = (Get-TrichterTage ([string]$b.geaendert))
                      was = $stufenText; stufe = [string]$b.status; art = [string]$b.art; rolle = [string]$b.rolle; kunde = [string]$b.kunde
                      naechste = @(Get-PoolNaechste ([string]$b.art) ([string]$b.status)); auchBekannt = $null }
  }
  $wartende = @($wartende | Sort-Object @{ Expression = { if ($null -eq $_.tage) { -1 } else { $_.tage } }; Descending = $true })
  $aeltest = $null
  foreach ($w in $wartende) { if ($null -ne $w.tage -and ($null -eq $aeltest -or $w.tage -gt $aeltest)) { $aeltest = $w.tage } }
  @{ ok = $true; stand = (Get-Date).ToString('o'); wartende = @($wartende); n = @($wartende).Count
     nachBahn = @{ ankommen = 0; kollektiv = @($wartende | Where-Object { $_.bahn -eq 'kollektiv' }).Count; einsatz = @($wartende | Where-Object { $_.bahn -eq 'einsatz' }).Count }
     aeltesteTage = $aeltest; doppelt = 0; quellen = @('pool'); fehlt = @()
     kpi = $p.kpi; personenZahlen = $p.personenZahlen; urlPflege = $PortalAdminUrl; poolFehler = $null; vereinFehler = $null }
}

# ---------- Website-Aufrufe ----------
# Gemessen wird GESTERN — ein angefangener Tag sähe neben einem vollen wie ein Einbruch aus.
$script:StatsCache = @{ zeit = $null; out = $null }
function Get-Traffic([bool]$fresh) {
  if (-not $StatsUrl) { return (Get-FirmaAus 'statsUrl') }
  $cc = $script:StatsCache
  if (-not $fresh -and $cc.out -and $cc.zeit -and ((Get-Date) - $cc.zeit).TotalSeconds -lt $StatsCacheSec) { return $cc.out }
  try { $r = Invoke-Firma $StatsUrl '' } catch { return (Get-FirmaFehler $_ 'stats.php') }
  if (-not $r -or -not $r.days) { return @{ ok = $false; error = 'NO_DATA'; hint = 'stats.php antwortet ohne Tagessummen.' } }
  $tage = @()
  foreach ($p in @($r.days.PSObject.Properties)) {
    if (-not $p) { continue }
    $n = 0
    if ($p.Value -is [int] -or $p.Value -is [long] -or $p.Value -is [double]) { $n = [int]$p.Value }
    elseif ($p.Value -and $p.Value.PSObject.Properties['v']) { $n = [int]$p.Value.v }
    $tage += , @{ tag = [string]$p.Name; n = $n }
  }
  $tage = @($tage | Sort-Object { $_.tag })
  $heuteStr = (Get-Date).ToString('yyyy-MM-dd')
  $vollTage = @($tage | Where-Object { $_.tag -lt $heuteStr })
  $gestern = $(if ($vollTage.Count) { $vollTage[-1] } else { $null })
  $vor7 = @($vollTage | Select-Object -Last 8 | Select-Object -First 7)
  $schnitt7 = $null; $abweichung = $null
  if ($vor7.Count) {
    $schnitt7 = [Math]::Round((@($vor7 | ForEach-Object { $_.n }) | Measure-Object -Average).Average, 1)
    if ($gestern -and $schnitt7 -gt 0) { $abweichung = [int][Math]::Round((($gestern.n - $schnitt7) / $schnitt7) * 100) }
  }
  $heute = @($tage | Where-Object { $_.tag -eq $heuteStr })
  $top = @(@($r.pages) | Select-Object -First 5 | ForEach-Object { @{ path = [string]$_.path; titel = [string]$_.title; views = [int]$_.views } })
  $out = @{ ok = $true; stand = (Get-Date).ToString('o'); quelle = $StatsUrl; cacheSec = $StatsCacheSec; seit = [string]$r.seit
            traffic = @{ tag = $(if ($gestern) { $gestern.tag } else { $null }); aufrufe = $(if ($gestern) { $gestern.n } else { $null })
                         heute = $(if ($heute.Count) { $heute[0].n } else { $null })
                         schnitt7 = $schnitt7; abweichung = $abweichung
                         reihe7 = @($vor7 | ForEach-Object { @{ tag = $_.tag; n = $_.n } })
                         tageGemessen = $tage.Count; topSeiten = $top } }
  $script:StatsCache = @{ zeit = Get-Date; out = $out }
  $out
}

# ---------- Tower (Matching und Ausschreibungen) ----------
# Die Tower-Seite legt ihre Summen als stand.json hinter ihre Tür (nur Aggregate, keine Namen). Gelesen wird
# mit dem Maschinenschlüssel der Tür (Kopf X-Vf-Key, Umgebungsvariable TOWER_GATE_KEY). Ohne Schlüssel leitet die
# Tür zur Anmeldung um — das wird als NO_KEY gemeldet, nie als leerer Stand. Form wie der persönliche Server.
$TowerUrl = [string](Get-Feld $FirmaK 'towerUrl' '')
if ($TowerUrl -and -not $TowerUrl.EndsWith('/')) { $TowerUrl += '/' }
$script:TowerCache = @{ zeit = $null; out = $null }
function Get-Tower([bool]$fresh) {
  if (-not $TowerUrl) { return (Get-FirmaAus 'towerUrl') }
  $cc = $script:TowerCache
  if (-not $fresh -and $cc.out -and $cc.zeit -and ((Get-Date) - $cc.zeit).TotalSeconds -lt 900) { return $cc.out }
  $key = ([string]$env:TOWER_GATE_KEY) -replace '\s', ''
  if (-not $key) { return @{ ok = $false; error = 'NO_KEY'; hint = 'TOWER_GATE_KEY fehlt in der Umgebung dieses Servers.'; url = $TowerUrl } }
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $r = Invoke-WebRequest -Uri ($TowerUrl + 'stand.json') -Headers @{ 'X-Vf-Key' = $key } -MaximumRedirection 0 -TimeoutSec $FirmaTimeoutSec -UseBasicParsing -ErrorAction Stop
  } catch {
    $code = $null; try { $code = [int]$_.Exception.Response.StatusCode } catch { }
    if ($code -eq 302 -or $code -eq 301) { return @{ ok = $false; error = 'AUTH_INVALID'; hint = 'Die Tür lehnt TOWER_GATE_KEY ab (Umleitung zur Anmeldung).'; url = $TowerUrl } }
    $f = Get-FirmaFehler $_ 'stand.json'; $f.url = $TowerUrl; return $f
  }
  if ([int]$r.StatusCode -ne 200) { return @{ ok = $false; error = 'AUTH_INVALID'; hint = "Die Tür antwortet $([int]$r.StatusCode) statt der Zahlen."; url = $TowerUrl } }
  try { $s = ([Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())) | ConvertFrom-Json }
  catch { return @{ ok = $false; error = 'BAD_JSON'; hint = 'stand.json nicht lesbar.'; url = $TowerUrl } }
  $alter = $null; $d = [datetime]::MinValue
  if ([datetime]::TryParse([string]$s.stand, [ref]$d)) { $alter = [Math]::Round(((Get-Date) - $d).TotalHours, 1) }
  $pool = $null
  if ($s.pool) { $pool = @{}; foreach ($f in 'pool','verfuegbar','offen','im_einsatz','angebote_90','platziert_90','abgesagt_90') { if ($s.pool.PSObject.Properties[$f]) { $pool[$f] = $s.pool.$f } } }
  $out = @{ ok = $true; stand = [string]$s.stand; alterStd = $alter; url = $TowerUrl; quelle = 'tuer'
            ledger = $s.ledger; pool = $pool; fehlt = @(@($s.fehlt) | Where-Object { $_ } | ForEach-Object { [string]$_ }) }
  $script:TowerCache = @{ zeit = Get-Date; out = $out }
  $out
}

# Router-Hilfe: $true, wenn der Pfad hier beantwortet wurde. compass-server.ps1 ruft sie vor seinem 404.
function Invoke-FirmaRoute($ctx, $req, [string]$path) {
  $fresh = ($req.QueryString['fresh'] -eq '1')
  switch ($path) {
    '/api/finanzen'  { Send-Json $ctx (Get-Finanzen $fresh) 200; return $true }
    '/api/nutzer'    { Send-Json $ctx (Get-Nutzer $fresh) 200; return $true }
    '/api/pool'      { Send-Json $ctx (Get-Pool $fresh) 200; return $true }
    '/api/trichter'  { Send-Json $ctx (Get-Trichter $fresh) 200; return $true }
    '/api/traffic'   { Send-Json $ctx (Get-Traffic $fresh) 200; return $true }
    '/api/tower'     { Send-Json $ctx (Get-Tower $fresh) 200; return $true }
    '/api/vishnu'    { Send-Json $ctx (Get-Traffic $fresh) 200; return $true }
    '/api/finanzen/entscheidung' {
      if ($req.HttpMethod -ne 'POST') { Send-Json $ctx @{ ok = $false; error = 'NUR_POST' } 405; return $true }
      $ok = $false; $in = Read-JsonBody $ctx ([ref]$ok); if (-not $ok) { return $true }
      if (-not $in) { Send-Json $ctx @{ ok = $false; error = 'NO_BODY' } 400; return $true }
      Send-Json $ctx (Send-Finanzstimme $in) 200; return $true
    }
  }
  $false
}
