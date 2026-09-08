# madeleine-abholen.ps1 — Fragen an Madeleine einsammeln, beantworten lassen, Antwort zurücktragen
#
#   Warum es das gibt (07./08.09.2026). Bene: „Bau sie bitte auch für meinen Vater und mich im
#   Raumschiff ein" — und am Tag darauf: „klemm Madelene auch an den Briefkasten an."
#
#   Madeleine denkt auf diesem Rechner (GPT über die Codex CLI, john-server /api/madeleine). Wer sie
#   fragen will, sitzt aber woanders: Martin an seinem eigenen Rechner, Bene manchmal am Handy — und
#   dort zeigt 'localhost' auf das Handy selbst. Also derselbe Weg wie bei den Compass-Übergaben:
#   drüben wird gefragt, hier wird gedacht, drüben steht die Antwort.
#
#   Zwei Briefkästen, ein Lauf:
#     1) Finanz-Raumschiff  vishnuartists.com/raumschiff/madeleine.php   (Ausweis: FINANZ_TOKEN)
#        Fragen von Bene und Martin, jede mit einem Lagebild, das drüben schon auf die Rolle
#        zugeschnitten ist. Dieses Skript reicht es unverändert weiter und legt nur die Schranke
#        dazu, wer da schreibt — es soll nicht zwei Stellen geben, an denen entschieden wird, was
#        jemand sehen darf.
#     2) Compass-Tür        bene.vishnuartists.com/gate.php?briefkasten=…  (Ausweis: VA_GATE_KEY)
#        Fragen aus dem Madeleine-Chat des Compass, die den john-server nicht erreicht haben.
#        Anders als eine Übergabe wird ein solcher Brief nicht gelöscht, sondern bekommt die
#        Antwort hineingeschrieben; abgeräumt wird er, wenn der Compass sie übernommen hat.
#
#   Reihenfolge ist in beiden Fällen Absicht: erst antworten lassen, dann eintragen. Bricht etwas ab,
#   bleibt die Frage offen und der nächste Lauf nimmt sie wieder mit. Scheitert ein Versuch, wird das
#   drüben gezählt — nach drei Anläufen gibt die Frage auf und sagt warum, statt für immer „wartet"
#   zu zeigen und einen der drei Plätze zu belegen.
#
#   powershell -ExecutionPolicy Bypass -File madeleine-abholen.ps1  [-Register|-Unregister|-Leise]
param(
  [string]$Url     = 'https://vishnuartists.com/raumschiff/madeleine.php',
  [string]$GateUrl = 'https://bene.vishnuartists.com/gate.php',
  [string]$JohnApi = 'http://localhost:8787',
  [int]$Minuten    = 10,
  [int]$MaxProLauf = 3,
  # Nur zum Prüfen gegen eine lokale Kopie. Im Betrieb leer lassen — dann kommen die Ausweise aus
  # den Umgebungsvariablen und stehen in keiner Kommandozeile.
  [string]$Token     = '',
  [string]$GateToken = '',
  [switch]$Register,
  [switch]$Unregister,
  [switch]$Leise
)
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$log  = Join-Path $repo 'madeleine-abholen.log'
$task = 'Vishnu Madeleine Abholer'
$alteAufgabe = 'Vishnu Raumschiff Madeleine'   # hieß bis zum 08.09.2026 so, als sie nur das Raumschiff bediente

function Log($m) {
  $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $m
  try { Add-Content -Path $log -Value $line -Encoding UTF8 } catch { }
  if (-not $Leise) { Write-Host $line }
}

if ($Register) {
  # Die Vorgaengerin abraeumen, sonst laufen zwei Aufgaben auf dieselben Briefkaesten.
  try { Unregister-ScheduledTask -TaskName $alteAufgabe -Confirm:$false -ErrorAction Stop; Log "alte Aufgabe '$alteAufgabe' entfernt." } catch { }
  $act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`" -Leise"
  $tr1 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(3) -RepetitionInterval (New-TimeSpan -Minutes $Minuten)
  $tr2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  # ExecutionTimeLimit grosszuegig: eine Antwort von Madeleine dauert Minuten, drei koennen es zusammen sein.
  $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -RunOnlyIfNetworkAvailable
  Register-ScheduledTask -TaskName $task -Action $act -Trigger @($tr1, $tr2) -Settings $set -Description 'Beantwortet Fragen aus dem Finanz-Raumschiff und dem Compass-Briefkasten mit Madeleine (GPT ueber Codex).' -Force | Out-Null
  Log "Aufgabe '$task' registriert (alle $Minuten Min + bei Anmeldung)."; return
}
if ($Unregister) {
  foreach ($t in @($task, $alteAufgabe)) { try { Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction Stop; Log "Aufgabe '$t' entfernt." } catch { } }
  return
}

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

# --- Ausweise. $ausweis/$gate heissen absichtlich nicht wie die Parameter: PowerShell unterscheidet
#     keine Gross-/Kleinschreibung, $token und $Token waeren dieselbe Variable — und ein
#     „$token = $null" davor loeschte den uebergebenen Wert stillschweigend.
function Hole-Umgebung([string]$name) {
  foreach ($scope in @('User', 'Process')) {
    $v = [Environment]::GetEnvironmentVariable($name, $scope)
    if ($v -and $v.Trim().Length -ge 16) { return $v.Trim() }
  }
  return $null
}
$ausweis = $(if ($Token -and $Token.Trim().Length -ge 16) { $Token.Trim() } else { Hole-Umgebung 'FINANZ_TOKEN' })
$gate    = $(if ($GateToken -and $GateToken.Trim().Length -ge 16) { $GateToken.Trim() } else { Hole-Umgebung 'VA_GATE_KEY' })
if (-not $ausweis -and -not $gate) { Log 'Weder FINANZ_TOKEN noch VA_GATE_KEY gesetzt — ohne Ausweis bleiben beide Briefkaesten zu.'; return }

# Geschickt wird der SHA-256, nie der Token selbst — genauso wie tools/raumschiff-privat.py hochlaedt.
# Auf dem Server steht in feedback-config.php der Hash; der rohe Token kam live mit 401 zurueck.
# Der Gate-Schluessel dagegen liegt drueben im Klartext in gate-config.php und wird so geschickt.
$sha = New-Object Security.Cryptography.SHA256Managed
$kopfRs   = $(if ($ausweis) { @{ 'X-Finanz-Token' = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($ausweis))).Replace('-', '').ToLower() } } else { $null })
$kopfGate = $(if ($gate) { @{ 'X-Vf-Key' = $gate } } else { $null })

# Wer darf was fragen. Die Schranke steht schon serverseitig (madeleine.php › rsm_lagebild); hier
# steht sie noch einmal in Worten, damit Madeleine sie im Ton haelt und nicht aus ihrem eigenen
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
  compass   = @{ name = 'Bene'
                 hinweis = 'Bene fragt aus dem Flow Compass. Die Frage lag im Briefkasten, weil dein Rechner in dem Moment nicht erreichbar war — sie kann also ein paar Stunden alt sein. Nimm Bezug darauf, wenn sich seither etwas geaendert haben koennte.' }
}

# --- Eine Frage an Madeleine geben. Wirft, wenn nichts Brauchbares zurueckkommt. -------------------
function Hole-Antwort([string]$frage, $verlauf, [string]$kontext, $fragt) {
  $msgs = @()
  foreach ($v in @($verlauf)) {
    if (-not [string]$v.frage) { continue }
    $msgs += @{ role = 'user';      content = [string]$v.frage }
    $msgs += @{ role = 'assistant'; content = [string]$v.antwort }
  }
  $msgs += @{ role = 'user'; content = $frage }
  $body  = @{ messages = $msgs; context = $kontext; fragt = $fragt } | ConvertTo-Json -Depth 8 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($body)
  $ant = Invoke-RestMethod -Uri ($JohnApi + '/api/madeleine') -Method Post -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 330 -UseBasicParsing
  # Kein Ternaer — PowerShell 5.1 kennt ihn nicht und faellt schon beim Einlesen aus.
  if (-not $ant -or $ant.error) { $grund = $(if ($ant.hint) { $ant.hint } else { $ant.error }); throw "Madeleine: $grund" }
  $text = [string]$ant.text
  if (-not $text.Trim()) { throw 'Madeleine antwortet leer' }
  return @{ text = $text; modell = [string]$ant.model }
}

# --- Laeuft Madeleine ueberhaupt? Sonst gar nicht erst fragen: die Fragen bleiben liegen und kommen
#     beim naechsten Lauf wieder, statt eine Fehlermeldung als Antwort zu bekommen. ----------------
try {
  $st = Invoke-RestMethod -Uri ($JohnApi + '/api/madeleine/status') -TimeoutSec 20 -UseBasicParsing
} catch {
  if (-not $Leise) { Log 'john-server laeuft nicht — nichts abgeholt.' }
  return
}
if (-not $st.key) { Log "Codex nicht angemeldet ($($st.hint)) — nichts abgeholt."; return }

$gut = 0; $fehler = 0; $budget = $MaxProLauf

# ================= 1) Finanz-Raumschiff =================
if ($kopfRs) {
  $liste = $null
  try { $liste = Invoke-RestMethod -Uri ($Url + '?offen=1') -Headers $kopfRs -TimeoutSec 25 -UseBasicParsing }
  catch { Log "Raumschiff nicht erreichbar: $($_.Exception.Message)" }
  if ($liste -and -not $liste.ok) { Log 'Raumschiff antwortet, aber nicht mit ok — FINANZ_TOKEN gegen f/feedback-config.php pruefen.' }
  elseif ($liste) {
    foreach ($f in (@($liste.offen) | Select-Object -First $budget)) {
      if ($budget -le 0) { break }
      $rolle = [string]$f.rolle
      if (-not $WER.ContainsKey($rolle)) { Log "unbekannte Rolle '$rolle' bei $($f.id) — uebersprungen."; $fehler++; continue }
      $budget--
      $grund = ''
      try {
        $a = Hole-Antwort ([string]$f.frage) $f.verlauf ([string]$f.lagebild) $WER[$rolle]
        $zb = [Text.Encoding]::UTF8.GetBytes((@{ id = [string]$f.id; antwort = $a.text; modell = $a.modell } | ConvertTo-Json -Depth 4 -Compress))
        $ok = Invoke-RestMethod -Uri $Url -Method Post -Headers $kopfRs -Body $zb -ContentType 'application/json; charset=utf-8' -TimeoutSec 30 -UseBasicParsing
        if (-not $ok -or -not $ok.ok) { throw "Raumschiff nimmt die Antwort nicht: $($ok.fehler)" }
        $gut++
        Log ("Raumschiff beantwortet: {0} ({1}, {2} Zeichen)" -f $f.id, $WER[$rolle].name, $a.text.Length)
      } catch { $grund = $_.Exception.Message }
      if ($grund) {
        # Den gescheiterten Versuch drueben zaehlen — sonst wartet die Frage fuer immer stumm.
        $fehler++
        Log ("Raumschiff bleibt offen: {0} — {1}" -f $f.id, $grund)
        try {
          $fb = [Text.Encoding]::UTF8.GetBytes((@{ id = [string]$f.id; fehler = $grund } | ConvertTo-Json -Depth 3 -Compress))
          Invoke-RestMethod -Uri $Url -Method Post -Headers $kopfRs -Body $fb -ContentType 'application/json; charset=utf-8' -TimeoutSec 20 -UseBasicParsing | Out-Null
        } catch { }
      }
    }
  }
}

# ================= 2) Compass-Briefkasten an der Tuer =================
if ($kopfGate -and $budget -gt 0) {
  $briefe = $null
  try { $briefe = Invoke-RestMethod -Uri ($GateUrl + '?briefkasten=liste') -Headers $kopfGate -TimeoutSec 25 -UseBasicParsing }
  catch { Log "Tuer nicht erreichbar: $($_.Exception.Message)" }
  if ($briefe -and -not $briefe.ok) { Log 'Tuer antwortet, aber nicht mit ok — VA_GATE_KEY gegen gate-config.php pruefen.' }
  elseif ($briefe) {
    $offen = @(@($briefe.briefe) | Where-Object { $_.art -eq 'madeleine' -and $_.status -eq 'offen' })
    foreach ($b in ($offen | Select-Object -First $budget)) {
      if ($budget -le 0) { break }
      $budget--
      $name = [string]$b.brief
      $grund = ''
      try {
        $hol = Invoke-RestMethod -Uri ($GateUrl + '?briefkasten=hol&brief=' + [Uri]::EscapeDataString($name)) -Headers $kopfGate -TimeoutSec 25 -UseBasicParsing
        if (-not $hol -or -not $hol.ok -or -not $hol.nutzlast) { throw 'Brief unlesbar' }
        $n = $hol.nutzlast
        $a = Hole-Antwort ([string]$n.frage) @() ([string]$n.kontext) $WER['compass']
        $zb = [Text.Encoding]::UTF8.GetBytes((@{ antwort = $a.text; modell = $a.modell } | ConvertTo-Json -Depth 4 -Compress))
        $ok = Invoke-RestMethod -Uri ($GateUrl + '?briefkasten=antwort&brief=' + [Uri]::EscapeDataString($name)) -Method Post -Headers $kopfGate -Body $zb -ContentType 'application/json; charset=utf-8' -TimeoutSec 30 -UseBasicParsing
        if (-not $ok -or -not $ok.ok) { throw "Tuer nimmt die Antwort nicht: $($ok.error)" }
        $gut++
        Log ("Compass beantwortet: {0} ({1} Zeichen)" -f $name, $a.text.Length)
      } catch { $grund = $_.Exception.Message }
      if ($grund) {
        $fehler++
        Log ("Compass bleibt offen: {0} — {1}" -f $name, $grund)
        try {
          $fb = [Text.Encoding]::UTF8.GetBytes((@{ fehler = $grund } | ConvertTo-Json -Depth 3 -Compress))
          Invoke-RestMethod -Uri ($GateUrl + '?briefkasten=antwort&brief=' + [Uri]::EscapeDataString($name)) -Method Post -Headers $kopfGate -Body $fb -ContentType 'application/json; charset=utf-8' -TimeoutSec 20 -UseBasicParsing | Out-Null
        } catch { }
      }
    }
  }
}

if ($gut -or $fehler -or -not $Leise) { Log ("{0} Frage(n) beantwortet, {1} nicht." -f $gut, $fehler) }
