# publish-compass.ps1 — Flow Compass automatisch live bringen (seit 02.09.2026 im Repo flow-compass)
#   1) git pull --ff-only (nur Porcelain, nie Gewalt) — übersprungen, solange kein Remote hängt
#   2) build-compass.ps1          → site/compass/       (die EIGENE Instanz; nicht im Repo)
#   2b) build-compass-produkt.ps1 → site/compass-demo/  (anonymisierte Verkaufs-Demo; im Repo)
#      Scheitert der Produkt-Build (Anker fehlt, Wortprüfung), wird das nur geloggt — die eigene
#      Instanz geht trotzdem live, die alte Demo bleibt stehen.
#   3) eigene Instanz per FTPS nach /vishnu-artists.com/compass/ — nur Dateien, deren Hash sich seit
#      dem letzten Upload geändert hat (site/compass/.publish-state.json). Nie löschen.
#      Zugang ausschließlich aus User-Umgebungsvariablen (nie in Datei oder Kommandozeile):
#        VA_FTP_HOST  z. B. wXXXXXXX.kasserver.com   VA_FTP_USER   VA_FTP_PASS
#      Fehlen sie, wird das geloggt und der Rest läuft weiter.
#   4) hat sich die Demo geändert → git add site/compass-demo → commit → git push origin main
#      (deploy.yml des Repos spielt sie per FTPS nach https://vishnu-artists.de/compass-demo/)
#
#   Warum zwei Wege: die eigene Instanz enthält persönliche Daten und gehört nicht ins Produkt-Repo;
#   die Demo ist Produkt und darf über GitHub laufen. Bis 02.09.2026 lief beides über das Repo
#   analytics-dashboard, das aufgelöst wurde.
#
#   Läuft als geplante Aufgabe „Vishnu Flow Compass publish“ (alle 30 Min + bei Anmeldung).
#   powershell -ExecutionPolicy Bypass -File publish-compass.ps1   (oder -Register / -Unregister / -NurBauen)
param([switch]$Register, [switch]$Unregister, [switch]$NurBauen, [int]$Minuten = 30)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$log  = Join-Path $repo 'publish-compass.log'
$task = 'Vishnu Flow Compass publish'
$fernBasis = '/vishnu-artists.com/compass'
function Log($m) { $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $m; Add-Content -Path $log -Value $line -Encoding UTF8; Write-Host $line }

if ($Register) {
  $act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$($MyInvocation.MyCommand.Path)`""
  $tr1 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes $Minuten)
  $tr2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RunOnlyIfNetworkAvailable
  Register-ScheduledTask -TaskName $task -Action $act -Trigger @($tr1,$tr2) -Settings $set -Description "Baut den Flow Compass (eigene Instanz + Demo) aus $repo, laedt die Instanz per FTPS hoch und pusht die Demo." -Force | Out-Null
  Log "Aufgabe '$task' registriert (alle $Minuten Min + bei Anmeldung) → $($MyInvocation.MyCommand.Path)"; return
}
if ($Unregister) { Unregister-ScheduledTask -TaskName $task -Confirm:$false; Log "Aufgabe '$task' entfernt."; return }

# Log kappen — erst vollständig lesen, DANN schreiben (ein offener Lesestrom beim Schreiben hat
# diesen Lauf am 30.08.2026 stillschweigend getötet). Ein Problem hier darf nichts verhindern.
try {
  if (Test-Path $log) {
    $altzeilen = @([IO.File]::ReadAllLines($log, [Text.Encoding]::UTF8))
    if ($altzeilen.Count -gt 400) { [IO.File]::WriteAllLines($log, $altzeilen[-200..-1], (New-Object Text.UTF8Encoding($false))) }
  }
} catch { Write-Host "Log-Kappen uebersprungen: $($_.Exception.Message)" }

Set-Location $repo
$env:GIT_TERMINAL_PROMPT = '0'
# git.exe explizit (sonst ruft sich die Funktion selbst auf — PowerShell-Namen sind case-insensitiv)
function Git { param([Parameter(ValueFromRemainingArguments)]$a)
  $ErrorActionPreference = 'Continue'
  $out = & git.exe @a 2>&1; $script:gitExit = $LASTEXITCODE; ($out | ForEach-Object { "$_" }) -join "`n" }

# ---------- FTPS (explizit, AUTH TLS) — Muster aus C:\dev\_tools\vaikuntha-ftp.ps1 ----------
function Hole-FtpZugang {
  $z = @{}
  foreach ($k in 'VA_FTP_HOST','VA_FTP_USER','VA_FTP_PASS') {
    $v = [Environment]::GetEnvironmentVariable($k, 'User'); if (-not $v) { $v = [Environment]::GetEnvironmentVariable($k, 'Process') }
    if (-not $v) { return $null }
    $z[$k] = $v.Trim()
  }
  return $z
}
function Neu-FtpAnfrage($zugang, [string]$fernPfad, [string]$methode) {
  $url = 'ftp://' + $zugang.VA_FTP_HOST + $fernPfad
  $a = [Net.FtpWebRequest]::Create($url)
  $a.Credentials = New-Object Net.NetworkCredential($zugang.VA_FTP_USER, $zugang.VA_FTP_PASS)
  $a.EnableSsl = $true; $a.UsePassive = $true; $a.UseBinary = $true; $a.KeepAlive = $false
  $a.Timeout = 30000; $a.ReadWriteTimeout = 60000
  $a.Method = $methode
  return $a
}
function Sichere-FtpOrdner($zugang, [string]$fernPfad) {
  # MKD; „existiert schon“ (550) ist kein Fehler
  try { $r = (Neu-FtpAnfrage $zugang $fernPfad ([Net.WebRequestMethods+Ftp]::MakeDirectory)).GetResponse(); $r.Close() }
  catch { if ("$($_.Exception.Message)" -notmatch '550') { throw } }
}
function Lade-FtpHoch($zugang, [string]$lokal, [string]$fernPfad) {
  $bytes = [IO.File]::ReadAllBytes($lokal)
  $a = Neu-FtpAnfrage $zugang $fernPfad ([Net.WebRequestMethods+Ftp]::UploadFile)
  $a.ContentLength = $bytes.Length
  $s = $a.GetRequestStream(); $s.Write($bytes, 0, $bytes.Length); $s.Close()
  $r = $a.GetResponse(); $r.Close()
}
function Hash([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash }

# 0) Repo-Zustand: laufender Rebase/Merge? dann nichts anfassen
if ((Test-Path '.git\rebase-merge') -or (Test-Path '.git\rebase-apply') -or (Test-Path '.git\MERGE_HEAD')) { Log 'ABBRUCH: Rebase/Merge im Gang.'; return }
$branch = (Git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') { Log "ABBRUCH: Branch ist '$branch', nicht main."; return }
$remote = (Git remote).Trim()
$hatRemote = ($remote -match '(?m)^origin$')

# 1) pull --ff-only (nur mit Remote)
if ($hatRemote) {
  $o = Git pull --ff-only origin main
  if ($gitExit -ne 0) { Log "ABBRUCH: pull --ff-only fehlgeschlagen: $o"; return }
} else { Log 'Hinweis: kein Remote origin — pull/push entfallen, gebaut und hochgeladen wird trotzdem.' }

# 2) eigene Instanz bauen
try { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-compass.ps1') | Out-Null }
catch { Log "ABBRUCH: Build fehlgeschlagen: $($_.Exception.Message)"; return }

# 2b) Demo mitbauen — Fehler nur loggen
$demoOk = $true
try {
  $pb = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'build-compass-produkt.ps1') 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($pb | Select-Object -Last 6) -join ' / ' }
} catch { $demoOk = $false; Log "WARNUNG: Demo-Build (site/compass-demo) fehlgeschlagen, alte Demo bleibt live: $($_.Exception.Message)" }

if ($NurBauen) { Log 'NurBauen: fertig, nichts hochgeladen, nichts committet.'; return }

# 3) eigene Instanz per FTPS hochladen — nur geänderte Dateien, nie löschen
$zugang = Hole-FtpZugang
$eigen = Join-Path $repo 'site\compass'
if (-not $zugang) {
  Log 'WARNUNG: FTP-Zugang fehlt (User-Umgebungsvariablen VA_FTP_HOST / VA_FTP_USER / VA_FTP_PASS) — eigene Instanz nicht hochgeladen.'
} elseif (-not (Test-Path (Join-Path $eigen 'index.html'))) {
  Log 'WARNUNG: site\compass\index.html fehlt — nichts hochzuladen.'
} else {
  $stateDatei = Join-Path $eigen '.publish-state.json'
  $state = @{}
  if (Test-Path $stateDatei) { try { $j = (Get-Content -LiteralPath $stateDatei -Raw -Encoding UTF8) | ConvertFrom-Json; foreach ($p in $j.PSObject.Properties) { $state[$p.Name] = [string]$p.Value } } catch { $state = @{} } }
  $dateien = @(Get-ChildItem -LiteralPath $eigen -Recurse -File -Force | Where-Object { $_.Name -ne '.publish-state.json' })
  $hoch = 0; $fehler = 0; $ordnerDa = @{}
  foreach ($f in $dateien) {
    $rel = $f.FullName.Substring($eigen.Length).TrimStart('\').Replace('\', '/')
    $h = Hash $f.FullName
    if ($state.ContainsKey($rel) -and $state[$rel] -eq $h) { continue }
    try {
      $teile = $rel.Split('/'); $pfad = $fernBasis
      for ($i = 0; $i -lt $teile.Count - 1; $i++) { $pfad = $pfad + '/' + $teile[$i]; if (-not $ordnerDa.ContainsKey($pfad)) { Sichere-FtpOrdner $zugang $pfad; $ordnerDa[$pfad] = $true } }
      Lade-FtpHoch $zugang $f.FullName ($fernBasis + '/' + $rel)
      $state[$rel] = $h; $hoch++
    } catch { $fehler++; Log "FEHLER beim Upload von $rel : $($_.Exception.Message)" }
  }
  try { [IO.File]::WriteAllText($stateDatei, ($state | ConvertTo-Json), (New-Object Text.UTF8Encoding($false))) } catch { }
  Log ("eigene Instanz: {0} Datei(en) hochgeladen, {1} Fehler → https://vishnu-artists.de/compass/" -f $hoch, $fehler)
}

# 4) Demo geändert? committen + pushen (nur die Build-Ausgabe, nie die handgepflegte .htaccess)
if (-not $demoOk) { Log 'Demo nicht gebaut — kein Commit.'; return }
$pfade = @('site/compass-demo', ':(exclude)site/compass-demo/.htaccess')
$st = (Git status --porcelain -- @pfade).Trim()
if (-not $st) { Log 'Demo unverändert — nichts zu committen.'; return }
if ($st -match '(?m)^\s?D ') { Log "ABBRUCH: Löschungen im Demo-Ordner — bitte manuell prüfen:`n$st"; return }
Git add -- @pfade | Out-Null
$stamp = Get-Date -Format 'dd.MM.yyyy HH:mm'
$o = Git -c user.email=benedikt.irsch@gmail.com -c user.name='Benedikt Irsch' commit -q -m "compass-demo: automatischer Build $stamp" -m 'publish-compass.ps1 (geplante Aufgabe)'
if ($gitExit -ne 0) { Log "ABBRUCH: commit fehlgeschlagen (Hook?): $o"; Git reset -q -- @pfade | Out-Null; return }
if (-not $hatRemote) { Log ('Demo committet (' + (Git log --oneline -1).Trim() + '), kein Remote — Push entfällt.'); return }
$o = Git push origin main
if ($gitExit -ne 0) { Log "FEHLER: push fehlgeschlagen — Commit bleibt lokal, nächster Lauf versucht es erneut: $o"; return }
Log ('Demo veröffentlicht: ' + (Git log --oneline -1).Trim() + ' → https://vishnu-artists.de/compass-demo/ (Deploy läuft ~1–2 Min)')
