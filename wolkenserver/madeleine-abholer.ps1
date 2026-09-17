# madeleine-abholer.ps1 — Fragen aus dem Finanz-Raumschiff auf dem Wolkenserver beantworten (17.09.2026)
#
#   Bene, 16.09.2026: „Keine Abhängigkeiten von lokalen Rechner in der Zukunft." Bis heute holte
#   madeleine-abholen.ps1 auf Benes Rechner die Fragen von Bene und Martin aus dem Raumschiff
#   (vishnuartists.com/raumschiff/madeleine.php) und ließ sie vom lokalen john-server beantworten.
#   Jetzt läuft dasselbe hier: systemd-Timer madeleine-abholer.timer, alle 10 Minuten, als Benutzer compass.
#
#   Ausweise (aus /etc/compass-server/env, nie in einer Datei des Repos):
#     MADELEINE_RAUMSCHIFF_TOKEN  gilt nur in raumschiff/madeleine.php (Website: $MADELEINE_TOKEN) — nicht der
#                                 FINANZ_TOKEN, der laut Governance vom 16.09. nicht auf diesen Server gehört
#     MADELEINE_TICKET_KEY        signiert das Ticket, das der eigene Server für /api/madeleine verlangt
#
#   Reihenfolge wie lokal: erst antworten lassen, dann eintragen. Scheitert etwas, bleibt die Frage offen und
#   der gescheiterte Versuch wird drüben gezählt (nach drei gibt sie auf). Die Schranke, wer was sehen darf,
#   steht serverseitig im Lagebild des Raumschiffs — hier steht sie nur noch einmal in Worten.
param(
  [string]$Url = 'https://vishnuartists.com/raumschiff/madeleine.php',
  [string]$Api = 'http://localhost:8787',
  [int]$MaxProLauf = 3
)
$ErrorActionPreference = 'Stop'
function Log([string]$m) { Write-Host ("{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $m) }

$tok = ([string]$env:MADELEINE_RAUMSCHIFF_TOKEN).Trim()
$key = ([string]$env:MADELEINE_TICKET_KEY).Trim()
if ($tok.Length -lt 32) { Log 'MADELEINE_RAUMSCHIFF_TOKEN fehlt — nichts zu tun (Raumschiff-Fragen holt der lokale Abholer).'; return }
if ($key.Length -lt 16) { Log 'MADELEINE_TICKET_KEY fehlt — Madeleine lässt ohne Ticket niemanden herein.'; return }

function Get-Hex([byte[]]$b) { -join ($b | ForEach-Object { $_.ToString('x2') }) }
$sha = [Security.Cryptography.SHA256]::Create()
$kopfRs = @{ 'X-Finanz-Token' = (Get-Hex $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($tok))) }
function Get-Ticket {
  $exp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 600
  $h = New-Object Security.Cryptography.HMACSHA256 (,[Text.Encoding]::UTF8.GetBytes($key))
  try { $sig = Get-Hex $h.ComputeHash([Text.Encoding]::UTF8.GetBytes("madeleine|$exp|0")) } finally { $h.Dispose() }
  return "$exp.0.$sig"
}

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

function Hole-Antwort([string]$frage, $verlauf, [string]$kontext, $fragt) {
  $msgs = @()
  foreach ($v in @($verlauf)) {
    if (-not [string]$v.frage) { continue }
    $msgs += @{ role = 'user'; content = [string]$v.frage }
    $msgs += @{ role = 'assistant'; content = [string]$v.antwort }
  }
  $msgs += @{ role = 'user'; content = $frage }
  $body = [Text.Encoding]::UTF8.GetBytes((@{ messages = $msgs; context = $kontext; fragt = $fragt } | ConvertTo-Json -Depth 8 -Compress))
  $ant = Invoke-RestMethod -Uri "$Api/api/madeleine" -Method Post -Body $body -ContentType 'application/json; charset=utf-8' -Headers @{ 'X-Mad-Ticket' = (Get-Ticket) } -TimeoutSec 330
  if (-not $ant -or $ant.error) { throw "Madeleine: $(if ($ant.hint) { $ant.hint } else { $ant.error })" }
  $text = [string]$ant.text
  if (-not $text.Trim()) { throw 'Madeleine antwortet leer' }
  return @{ text = $text; modell = [string]$ant.model }
}

try { $st = Invoke-RestMethod -Uri "$Api/api/madeleine/status" -TimeoutSec 60 } catch { Log "Compass-Server antwortet nicht: $($_.Exception.Message)"; return }
if (-not $st.key) { Log 'Codex auf diesem Server nicht angemeldet — nichts abgeholt (wolkenserver\madeleine-anmelden.ps1).'; return }

$liste = $null
try { $liste = Invoke-RestMethod -Uri ($Url + '?offen=1') -Headers $kopfRs -TimeoutSec 25 }
catch { Log "Raumschiff nicht erreichbar: $($_.Exception.Message)"; return }
if (-not $liste.ok) { Log 'Raumschiff antwortet nicht mit ok — MADELEINE_TOKEN auf der Website gesetzt (Repo-Secret + Deploy)?'; return }

$gut = 0; $fehler = 0
foreach ($f in (@($liste.offen) | Select-Object -First $MaxProLauf)) {
  $rolle = [string]$f.rolle
  if (-not $WER.ContainsKey($rolle)) { Log "unbekannte Rolle '$rolle' bei $($f.id) — übersprungen."; $fehler++; continue }
  $grund = ''
  try {
    $a = Hole-Antwort ([string]$f.frage) $f.verlauf ([string]$f.lagebild) $WER[$rolle]
    $zb = [Text.Encoding]::UTF8.GetBytes((@{ id = [string]$f.id; antwort = $a.text; modell = $a.modell } | ConvertTo-Json -Depth 4 -Compress))
    $ok = Invoke-RestMethod -Uri $Url -Method Post -Headers $kopfRs -Body $zb -ContentType 'application/json; charset=utf-8' -TimeoutSec 30
    if (-not $ok -or -not $ok.ok) { throw "Raumschiff nimmt die Antwort nicht: $($ok.fehler)" }
    $gut++
    Log ("beantwortet: {0} ({1}, {2} Zeichen)" -f $f.id, $WER[$rolle].name, $a.text.Length)
  } catch { $grund = $_.Exception.Message }
  if ($grund) {
    $fehler++
    Log ("bleibt offen: {0} — {1}" -f $f.id, $grund)
    try {
      $fb = [Text.Encoding]::UTF8.GetBytes((@{ id = [string]$f.id; fehler = $grund } | ConvertTo-Json -Depth 3 -Compress))
      Invoke-RestMethod -Uri $Url -Method Post -Headers $kopfRs -Body $fb -ContentType 'application/json; charset=utf-8' -TimeoutSec 20 | Out-Null
    } catch { }
  }
}
if ($gut -or $fehler) { Log ("{0} Frage(n) beantwortet, {1} nicht." -f $gut, $fehler) }
