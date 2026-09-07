# briefkasten-abholen.ps1 — liegengebliebene Übergaben vom Webspace ins checkins-Verzeichnis holen
#
#   Warum es das gibt (07.09.2026): der Compass schickt jeden Checkin an den john-server auf diesem
#   Rechner. Läuft der gerade nicht, kommt nichts an — am 07.09. lief er den ganzen Vormittag nicht,
#   und Morgencheck wie Wochenstart waren abends nirgends zu finden. Auf einem Handy ist es immer so:
#   dort zeigt localhost auf das Handy selbst. Seither wirft der Compass eine gescheiterte Übergabe in
#   den Briefkasten der Tür (gate.php ? briefkasten, läuft auf dem Webspace und damit immer), und
#   dieses Skript leert ihn: holen → an POST /api/checkin geben → erst dann drueben löschen.
#
#   Reihenfolge ist Absicht. Gelöscht wird nur, was hier wirklich angekommen ist; läuft der john-server
#   nicht, bleibt der Brief liegen und der nächste Lauf versucht es wieder. Ein Brief geht damit
#   höchstens doppelt ein (POST /api/checkin legt die ältere Fassung nach checkins\_alt), nie verloren.
#
#   Zugang: Maschinenschlüssel der Tür, User-Umgebungsvariable VA_GATE_KEY (Kopf X-Vf-Key) — derselbe,
#   mit dem der john-server das Team-Cockpit liest. Er muss in gate-config.php der Subdomain stehen.
#
#   powershell -ExecutionPolicy Bypass -File briefkasten-abholen.ps1  [-Register|-Unregister|-Leise]
param(
  [string]$Url      = 'https://bene.vishnuartists.com/gate.php',
  [string]$JohnApi  = 'http://localhost:8787',
  [int]$Minuten     = 10,
  [switch]$Register,
  [switch]$Unregister,
  [switch]$Leise
)
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$log  = Join-Path $repo 'briefkasten.log'
$task = 'Vishnu Compass Briefkasten'

function Log($m) {
  $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $m
  try { Add-Content -Path $log -Value $line -Encoding UTF8 } catch { }
  if (-not $Leise) { Write-Host $line }
}

if ($Register) {
  $act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`" -Leise"
  $tr1 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes $Minuten)
  $tr2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -RunOnlyIfNetworkAvailable
  Register-ScheduledTask -TaskName $task -Action $act -Trigger @($tr1, $tr2) -Settings $set -Description 'Holt liegengebliebene Compass-Uebergaben aus dem Briefkasten der Tuer und gibt sie an den john-server.' -Force | Out-Null
  Log "Aufgabe '$task' registriert (alle $Minuten Min + bei Anmeldung)."; return
}
if ($Unregister) { Unregister-ScheduledTask -TaskName $task -Confirm:$false; Log "Aufgabe '$task' entfernt."; return }

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$key = $null
foreach ($scope in @('User', 'Process')) {
  $k = [Environment]::GetEnvironmentVariable('VA_GATE_KEY', $scope)
  if ($k -and $k.Trim().Length -ge 16) { $key = $k.Trim(); break }
}
if (-not $key) { Log 'VA_GATE_KEY fehlt — ohne Maschinenschluessel bleibt der Briefkasten zu.'; return }
$kopf = @{ 'X-Vf-Key' = $key }

# 1) Was liegt drueben? Ist die Tuer nicht erreichbar, ist das kein Fehler, sondern ein spaeterer Lauf.
try {
  $liste = Invoke-RestMethod -Uri ($Url + '?briefkasten=liste') -Headers $kopf -TimeoutSec 20 -UseBasicParsing
} catch {
  Log "Briefkasten nicht erreichbar: $($_.Exception.Message)"; return
}
if (-not $liste -or -not $liste.ok) { Log 'Tuer antwortet, aber nicht mit ok — VA_GATE_KEY gegen gate-config.php pruefen.'; return }
$briefe = @($liste.briefe)
if ($briefe.Count -eq 0) { if (-not $Leise) { Log 'Briefkasten leer.' }; return }

# 2) Jeden Brief holen, an den john-server geben, erst dann drueben loeschen.
$gut = 0; $fehler = 0
foreach ($b in $briefe) {
  $name = [string]$b.brief
  try {
    $hol = Invoke-RestMethod -Uri ($Url + '?briefkasten=hol&brief=' + [Uri]::EscapeDataString($name)) -Headers $kopf -TimeoutSec 20 -UseBasicParsing
    if (-not $hol -or -not $hol.ok -or -not $hol.nutzlast) { throw 'Brief unlesbar' }
    $json = $hol.nutzlast | ConvertTo-Json -Depth 12 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $ant = Invoke-RestMethod -Uri ($JohnApi + '/api/checkin') -Method Post -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 60 -UseBasicParsing
    if (-not $ant -or $ant.ok -eq $false) { throw "john-server lehnt ab: $($ant.error)" }
    # Erst jetzt weg — wer vorher loescht, verliert den Checkin, wenn der Server gerade nicht mag.
    Invoke-RestMethod -Uri ($Url + '?briefkasten=weg&brief=' + [Uri]::EscapeDataString($name)) -Headers $kopf -TimeoutSec 20 -UseBasicParsing | Out-Null
    $gut++
    Log ("angekommen: {0} → {1}" -f $name, $ant.datei)
  } catch {
    $fehler++
    Log ("liegt weiter: {0} — {1}" -f $name, $_.Exception.Message)
  }
}
Log ("{0} Brief(e) abgeholt, {1} liegen geblieben." -f $gut, $fehler)
