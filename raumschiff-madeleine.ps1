# raumschiff-madeleine.ps1 — Fragen aus dem Finanz-Raumschiff an Madeleine geben und die Antwort zurücktragen
#
#   Warum es das gibt (07.09.2026, Bene: „Bau sie bitte auch für meinen Vater und mich im Raumschiff
#   ein, mit Kontextwissen."): Madeleine denkt auf diesem Rechner (GPT über die Codex CLI, john-server
#   /api/madeleine). Das Raumschiff läuft auf dem Webspace, und Martin sitzt an einem ganz anderen
#   Rechner — dorthin kommt niemand von hier, und von dort niemand hierher. Also derselbe Weg wie beim
#   Compass-Briefkasten: drüben wird gefragt, hier wird gedacht, drüben steht die Antwort.
#
#       GET  madeleine.php?offen=1  → offene Fragen samt Lagebild der fragenden Rolle
#       POST /api/madeleine         → Madeleine antwortet (Minuten, kein Sekundengeschäft)
#       POST madeleine.php          → Antwort eintragen; die Seite holt sie von selbst ab
#
#   Das Lagebild kommt fertig vom Raumschiff und ist dort schon auf die Rolle zugeschnitten: Martin
#   bekommt Verträge, Darlehen und die offenen Fragen, keine Kontostände. Dieses Skript reicht es
#   unverändert weiter und legt nur die Schranke dazu, wer da schreibt — es soll nicht zwei Stellen
#   geben, an denen entschieden wird, was jemand sehen darf.
#
#   Reihenfolge ist Absicht: erst antworten lassen, dann eintragen. Bricht etwas ab, bleibt die Frage
#   offen und der nächste Lauf nimmt sie wieder mit. Eine Frage wird höchstens zweimal beantwortet
#   (madeleine.php nimmt die zweite Lieferung an und wirft sie weg), nie verschluckt.
#
#   Zugang: FINANZ_TOKEN als User-Umgebungsvariable (Kopf X-Finanz-Token), derselbe Ausweis, mit dem
#   tools/raumschiff-privat.py den Kontenlauf hochlädt.
#
#   powershell -ExecutionPolicy Bypass -File raumschiff-madeleine.ps1  [-Register|-Unregister|-Leise]
param(
  [string]$Url     = 'https://vishnuartists.com/raumschiff/madeleine.php',
  [string]$JohnApi = 'http://localhost:8787',
  [int]$Minuten    = 10,
  [int]$MaxProLauf = 3,
  # Nur zum Pruefen gegen eine lokale Kopie des Raumschiffs (php -S). Im Betrieb leer lassen —
  # dann kommt der Ausweis aus der Umgebungsvariable und steht in keiner Kommandozeile.
  [string]$Token   = '',
  [switch]$Register,
  [switch]$Unregister,
  [switch]$Leise
)
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$log  = Join-Path $repo 'raumschiff-madeleine.log'
$task = 'Vishnu Raumschiff Madeleine'

function Log($m) {
  $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $m
  try { Add-Content -Path $log -Value $line -Encoding UTF8 } catch { }
  if (-not $Leise) { Write-Host $line }
}

if ($Register) {
  $act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`" -Leise"
  $tr1 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(3) -RepetitionInterval (New-TimeSpan -Minutes $Minuten)
  $tr2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  # ExecutionTimeLimit grosszuegig: eine Antwort von Madeleine dauert Minuten, drei koennen es zusammen sein.
  $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -RunOnlyIfNetworkAvailable
  Register-ScheduledTask -TaskName $task -Action $act -Trigger @($tr1, $tr2) -Settings $set -Description 'Beantwortet Fragen aus dem Finanz-Raumschiff mit Madeleine (GPT ueber Codex) und traegt die Antwort dort ein.' -Force | Out-Null
  Log "Aufgabe '$task' registriert (alle $Minuten Min + bei Anmeldung)."; return
}
if ($Unregister) { Unregister-ScheduledTask -TaskName $task -Confirm:$false; Log "Aufgabe '$task' entfernt."; return }

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

# $ausweis heisst absichtlich nicht $token: PowerShell unterscheidet keine Gross-/Kleinschreibung,
# $token und der Parameter $Token waeren dieselbe Variable — und ein „$token = $null" davor haette
# den uebergebenen Wert stillschweigend geloescht.
$ausweis = $null
if ($Token -and $Token.Trim().Length -ge 16) { $ausweis = $Token.Trim() }
else {
  foreach ($scope in @('User', 'Process')) {
    $t = [Environment]::GetEnvironmentVariable('FINANZ_TOKEN', $scope)
    if ($t -and $t.Trim().Length -ge 16) { $ausweis = $t.Trim(); break }
  }
}
if (-not $ausweis) { Log 'FINANZ_TOKEN fehlt — ohne Ausweis bleibt der Briefkasten zu.'; return }
$kopf = @{ 'X-Finanz-Token' = $ausweis }

# Wer darf was fragen. Die Schranke steht schon serverseitig in madeleine.php ($SICHT, rsm_lagebild);
# hier steht sie noch einmal in Worten, damit Madeleine sie im Ton haelt und nicht aus ihrem eigenen
# Wissen ergaenzt, was auf der Seite bewusst fehlt.
$WER = @{
  kapitaen  = @{ name = 'Bene'
                 hinweis = 'Bene fragt aus dem Finanz-Raumschiff, seinem eigenen Cockpit. Er sieht dort alles: Konten, GmbH, Verein, Luxemburg, Vertraege. Antworte wie im Compass.' }
  vertraege = @{ name = 'Martin'
                 hinweis = @'
Martin Irsch fragt — Benes Vater, 75 Jahre, im Raumschiff zustaendig fuer Vertraege und Darlehen. Er ist kein Finanzmensch und liest hier zum ersten Mal ein Cockpit.

Was gilt, ohne Ausnahme:
- Er sieht Vertraege, Vorsorge, Darlehen, die Wohnung, Berlin, Guerstling und die offenen Fragen F1-F12. Kontostaende, Depot, Gehaltshoehe und die Firmenzahlen sieht er NICHT. Nenne ihm keine, auch nicht beilaeufig, auch nicht aus deinem eigenen Wissen, und auch nicht gerundet. Wird danach gefragt: sag freundlich, dass das bei Bene liegt.
- Sprich ihn mit Du an, in kurzen Saetzen ohne Fachjargon. Was eine Restschuld, eine Zinsbindung oder eine verdeckte Gewinnausschuettung ist, erklaerst du in einem Nebensatz.
- Sein Beitrag ist Wissen, das in keiner Datei steht. Wenn seine Frage an einer der offenen Fragen haengt, sag ihm konkret, welches Dokument er suchen soll und welche Zahl daraus gebraucht wird.
- Hoechstens sechs Saetze oder eine kurze Liste. Keine Aufgaben verteilen, keine Entscheidungen fuer Bene treffen, nichts versenden.
'@ }
}

# 1) Was liegt drueben? Keine Verbindung ist kein Fehler, sondern ein spaeterer Lauf.
try {
  $liste = Invoke-RestMethod -Uri ($Url + '?offen=1') -Headers $kopf -TimeoutSec 25 -UseBasicParsing
} catch {
  Log "Raumschiff nicht erreichbar: $($_.Exception.Message)"; return
}
if (-not $liste -or -not $liste.ok) { Log 'Raumschiff antwortet, aber nicht mit ok — FINANZ_TOKEN gegen f/feedback-config.php pruefen.'; return }
$offen = @($liste.offen)
if ($offen.Count -eq 0) { if (-not $Leise) { Log 'Keine Frage offen.' }; return }

# 2) Laeuft Madeleine ueberhaupt? Sonst gar nicht erst fragen — die Frage bleibt liegen und
#    kommt beim naechsten Lauf wieder, statt eine Fehlermeldung als Antwort einzutragen.
try {
  $st = Invoke-RestMethod -Uri ($JohnApi + '/api/madeleine/status') -TimeoutSec 20 -UseBasicParsing
} catch {
  Log "john-server laeuft nicht — $($offen.Count) Frage(n) bleiben liegen."; return
}
if (-not $st.key) { Log "Codex nicht angemeldet ($($st.hint)) — $($offen.Count) Frage(n) bleiben liegen."; return }

$gut = 0; $fehler = 0
foreach ($f in ($offen | Select-Object -First $MaxProLauf)) {
  $rolle = [string]$f.rolle
  if (-not $WER.ContainsKey($rolle)) { Log "unbekannte Rolle '$rolle' bei $($f.id) — uebersprungen."; $fehler++; continue }
  try {
    # Der Faden derselben Rolle als Verlauf: frueher gefragt, frueher beantwortet. Ohne ihn faengt
    # jede Frage bei null an, und Martin muesste jedes Mal erklaeren, worum es geht.
    $msgs = @()
    foreach ($v in @($f.verlauf)) {
      $msgs += @{ role = 'user';      content = [string]$v.frage }
      $msgs += @{ role = 'assistant'; content = [string]$v.antwort }
    }
    $msgs += @{ role = 'user'; content = [string]$f.frage }

    $body = @{ messages = $msgs; context = [string]$f.lagebild; fragt = $WER[$rolle] } | ConvertTo-Json -Depth 8 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($body)
    $ant = Invoke-RestMethod -Uri ($JohnApi + '/api/madeleine') -Method Post -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 330 -UseBasicParsing
    # Kein Ternaer — PowerShell 5.1 kennt ihn nicht und faellt schon beim Einlesen aus.
    if (-not $ant -or $ant.error) { $grund = $(if ($ant.hint) { $ant.hint } else { $ant.error }); throw "Madeleine: $grund" }
    $text = [string]$ant.text
    if (-not $text.Trim()) { throw 'Madeleine antwortet leer' }

    $zurueck = @{ id = [string]$f.id; antwort = $text; modell = [string]$ant.model } | ConvertTo-Json -Depth 4 -Compress
    $zb = [Text.Encoding]::UTF8.GetBytes($zurueck)
    $ok = Invoke-RestMethod -Uri $Url -Method Post -Headers $kopf -Body $zb -ContentType 'application/json; charset=utf-8' -TimeoutSec 30 -UseBasicParsing
    if (-not $ok -or -not $ok.ok) { throw "Raumschiff nimmt die Antwort nicht: $($ok.fehler)" }
    $gut++
    Log ("beantwortet: {0} ({1}, {2} Zeichen) — {3}" -f $f.id, $WER[$rolle].name, $text.Length, ([string]$f.frage).Substring(0, [Math]::Min(60, ([string]$f.frage).Length)))
  } catch {
    $fehler++
    Log ("bleibt offen: {0} — {1}" -f $f.id, $_.Exception.Message)
  }
}
Log ("{0} Frage(n) beantwortet, {1} offen geblieben." -f $gut, $fehler)
