<#
  john-server-aufgabe.ps1 — der John-Server bleibt von selbst an (31.08.2026)

  Warum
    Bis hierher startete der Server nur über die Verknüpfung im Autostart-Ordner
    (John-Server.lnk → john-server.cmd, sichtbares Fenster). Wird das Fenster
    geschlossen, stürzt der Server ab oder wacht der Rechner ohne neue Anmeldung
    auf, ist er weg — und bleibt weg bis zur nächsten Anmeldung. Genau das ist am
    31.08. abends passiert: der Abendcheck lief, die Übergabe fand niemanden
    („Nicht übergeben: Failed to fetch").

  Was diese Aufgabe tut
    Geplante Aufgabe „John Server": startet den Server bei der Anmeldung UND
    versucht es danach alle 5 Minuten wieder. Läuft er schon, passiert nichts —
    dafür sorgt MultipleInstances = IgnoreNew, nicht ein eigener Portcheck. Es
    kann also nie ein zweiter Server entstehen, der um Port 8787 streitet.

  Zwei Dinge sind hier nicht verhandelbar
    1) ExecutionTimeLimit = 0 (unbegrenzt). Mit einem Zeitlimit beendet der
       Aufgabenplaner nach Ablauf den ganzen Prozessbaum — er würde also den
       laufenden Server abschießen, den er gerade bewachen soll.
    2) LogonType = Interactive („nur wenn angemeldet"). Der Server spiegelt nach
       H: (Google Drive) und liest die User-Umgebungsvariablen
       (ANTHROPIC_API_KEY, TRELLO_*, GCAL_ICS, VA_BASIC). Beides gibt es in
       Sitzung 0 nicht — als Dienst „auch ohne Anmeldung" liefe er halb blind.

  Bedienung
    -Register     Aufgabe anlegen/erneuern und die Autostart-Verknüpfung beiseite
                  legen (umbenannt, nicht gelöscht — sonst starten zwei Server).
    -Unregister   Aufgabe entfernen; die Verknüpfung kommt zurück.
    -Status       Läuft die Aufgabe, läuft der Server, antwortet Port 8787.
    -Jetzt        Aufgabe sofort einmal starten (statt bis zu 5 Minuten warten).

  Von Hand anhalten: http://localhost:8787/__stop aufrufen oder
  schtasks /end /tn "John Server" — die Aufgabe startet ihn spätestens in 5 Min
  wieder. Für längere Ruhe: schtasks /change /tn "John Server" /disable
#>
param(
  [switch]$Register,
  [switch]$Unregister,
  [switch]$Status,
  [switch]$Jetzt,
  [switch]$Wacht,
  [switch]$RegisterWacht,
  [switch]$UnregisterWacht,
  [int]$Port = 8787,
  [int]$AlleMinuten = 5,
  [int]$WachtSchwelle = 3,
  [int]$WachtTimeoutSec = 15
)

$ErrorActionPreference = 'Stop'
$Name    = 'John Server'
$Ordner  = Split-Path -Parent $MyInvocation.MyCommand.Path
$Server  = Join-Path $Ordner 'john-server.ps1'
$Autost  = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup\John-Server.lnk'
$AutostAus = "$Autost.aus"

function Aufgabe { Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue }

function PortAntwortet {
  $c = New-Object Net.Sockets.TcpClient
  try {
    $a = $c.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $a.AsyncWaitHandle.WaitOne(1500)) { return $false }
    $c.EndConnect($a); return $true
  } catch { return $false } finally { $c.Close() }
}

function ZeigeStatus {
  $t = Aufgabe
  if ($t) {
    $i = Get-ScheduledTaskInfo -TaskName $Name
    "Aufgabe   : vorhanden, Zustand $($t.State)"
    "Letzter   : $($i.LastRunTime) → Ergebnis $($i.LastTaskResult)"
    "Naechster : $($i.NextRunTime)"
  } else {
    "Aufgabe   : nicht eingerichtet (-Register)"
  }
  # -File verlangen: sonst zaehlt jedes fremde PowerShell-Fenster mit, in dessen
  # Befehlszeile zufaellig „john-server.ps1" vorkommt (z. B. dieses Skript selbst).
  $lauf = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
          Where-Object { $_.CommandLine -and $_.CommandLine -like '*-File*john-server.ps1*' }
  if ($lauf) { "Server    : laeuft (PID $($lauf.ProcessId -join ', '))" } else { "Server    : laeuft nicht" }
  if (PortAntwortet) { "Port $Port : antwortet" } else { "Port $Port : keine Antwort" }
  if (Test-Path $Autost)    { "Autostart : Verknuepfung aktiv (waere ein zweiter Server — -Register legt sie beiseite)" }
  elseif (Test-Path $AutostAus) { "Autostart : beiseite gelegt ($([IO.Path]::GetFileName($AutostAus)))" }
  else { "Autostart : keine Verknuepfung" }
}

if ($Unregister) {
  if (Aufgabe) { Unregister-ScheduledTask -TaskName $Name -Confirm:$false; "Aufgabe '$Name' entfernt." }
  else { "Aufgabe '$Name' war nicht eingerichtet." }
  if ((Test-Path $AutostAus) -and -not (Test-Path $Autost)) {
    Rename-Item $AutostAus -NewName ([IO.Path]::GetFileName($Autost))
    "Autostart-Verknuepfung wieder aktiv."
  }
  return
}

if ($Status) { ZeigeStatus; return }

# --- Haenger-Wacht (03.09.2026) -----------------------------------------------
#
# Die Aufgabe oben holt einen ABGESTUERZTEN Server zurueck. Einen BLOCKIERTEN holt sie nie:
# MultipleInstances=IgnoreNew sieht eine laufende Instanz und verwirft den Start, und weil
# ExecutionTimeLimit=0 gilt (aus gutem Grund, siehe Kopf), greift auch der Planer nicht ein.
# Blockaden sind aber der wahrscheinlichere Ausfall — ein HttpClient mit langem Timeout, ein
# TLS-Handschlag ohne Zeitbremse, ein haengendes DriveFS oder ein `git push`, das auf eine
# Eingabe wartet. Der Server ist dann am Leben, haelt den Port offen und antwortet trotzdem nicht.
#
# Darum ein HTTP-Test statt eines TCP-Tests: TcpClient bekommt bei einem blockierten
# HttpListener weiterhin eine Verbindung. Erst eine ausbleibende ANTWORT beweist den Haenger.
#
# Und darum ein Zaehler statt eines Sofort-Kills: der Board-Bau nach einem Checkin blockiert den
# seriellen Loop legitim (10-30 s, im Schlechtfall laenger). Erst `-WachtSchwelle` Fehlschlaege
# in Folge gelten als Haenger. Beendet wird nur — neu startet die regulaere Aufgabe.
$WachtName  = 'John Server Wacht'
$WachtState = 'C:\dev\_tools\john-wacht-state.txt'
$WachtLog   = 'C:\dev\_tools\john-wacht.log'

function WachtLog($m) {
  $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $m
  try { Add-Content -Path $WachtLog -Value $line -Encoding UTF8 } catch { }
  Write-Host $line
}

# Der Filter muss scharf sein: dieser Waechter BEENDET, was er findet. Beim ersten Test hat er
# den eigenen Aufrufer mitgezaehlt — eine Sitzung, die den Dateinamen nur in ihrer Befehlszeile
# stehen hatte (genau die Falle, vor der der Kommentar bei ZeigeStatus warnt, hier aber mit
# Folgen). Drei Bedingungen: mit -File gestartet, nicht mit -Command (so laufen Werkzeuge und
# Konsolen), und nie der eigene Prozess.
function ServerProzesse {
  $datei = [IO.Path]::GetFileName($Server)
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and
      $_.ProcessId -ne $PID -and
      $_.CommandLine -notlike '*-Command*' -and
      $_.CommandLine -like '*-File*' -and
      $_.CommandLine -like "*$datei*"
    }
}

function AntwortetHttp {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/john/status" -TimeoutSec $WachtTimeoutSec -UseBasicParsing
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500)
  } catch {
    # Eine HTTP-Fehlerantwort ist trotzdem eine Antwort: der Loop dreht sich, das ist kein Haenger.
    try { if ($_.Exception.Response) { return $true } } catch { }
    return $false
  }
}

if ($UnregisterWacht) {
  if (Get-ScheduledTask -TaskName $WachtName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $WachtName -Confirm:$false; "Aufgabe '$WachtName' entfernt."
  } else { "Aufgabe '$WachtName' war nicht eingerichtet." }
  return
}

if ($RegisterWacht) {
  $act = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$($MyInvocation.MyCommand.Path)`" -Wacht"
  $tr  = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 2)
  # Hier ist ein Zeitlimit richtig (anders als beim Server selbst): dieser Lauf dauert Sekunden.
  $set = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
  $prc = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $WachtName -Action $act -Trigger $tr -Settings $set -Principal $prc -Force `
    -Description 'Erkennt einen blockierten john-server (Port offen, aber keine Antwort) und beendet ihn, damit die Aufgabe "John Server" ihn neu starten kann. Startet selbst nichts.' | Out-Null
  "Aufgabe '$WachtName' eingerichtet — alle 2 Minuten, Schwelle $WachtSchwelle Fehlschlaege."
  return
}

if ($Wacht) {
  $lauf = @(ServerProzesse)
  if (-not $lauf.Count) {
    # Kein Prozess da: das ist ein Absturz, nicht ein Haenger — dafuer ist die andere Aufgabe zustaendig.
    if (Test-Path $WachtState) { Remove-Item $WachtState -Force -ErrorAction SilentlyContinue }
    return
  }
  if (AntwortetHttp) {
    if (Test-Path $WachtState) { Remove-Item $WachtState -Force -ErrorAction SilentlyContinue }
    return
  }
  $n = 0
  if (Test-Path $WachtState) { try { $n = [int](Get-Content -LiteralPath $WachtState -Raw -Encoding UTF8).Trim() } catch { $n = 0 } }
  $n++
  if ($n -lt $WachtSchwelle) {
    [IO.File]::WriteAllText($WachtState, "$n", (New-Object Text.UTF8Encoding($false)))
    WachtLog "Keine Antwort ($n von $WachtSchwelle) — noch kein Eingriff."
    return
  }
  $pids = ($lauf | ForEach-Object { $_.ProcessId }) -join ', '
  WachtLog "Haenger bestaetigt nach $n Versuchen — beende PID $pids. Die Aufgabe '$Name' startet in <= $AlleMinuten Min neu."
  foreach ($p in $lauf) {
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch { WachtLog "  PID $($p.ProcessId) liess sich nicht beenden: $($_.Exception.Message)" }
  }
  Remove-Item $WachtState -Force -ErrorAction SilentlyContinue
  # Nicht selbst starten: sonst gaebe es zwei Starter und irgendwann zwei Server um Port 8787.
  return
}

if ($Jetzt) {
  if (-not (Aufgabe)) { throw "Aufgabe '$Name' ist nicht eingerichtet — erst -Register." }
  Start-ScheduledTask -TaskName $Name
  "Aufgabe gestartet."
  return
}

if ($Register) {
  if (-not (Test-Path $Server)) { throw "john-server.ps1 nicht gefunden: $Server" }

  # Kein -OpenBrowser: ein Neustart im Hintergrund soll nicht ungefragt ein Fenster aufreissen.
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Server`"" `
    -WorkingDirectory $Ordner

  $tLogon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"

  # Wiederholung unbegrenzt. Das Repetition-Objekt entsteht in PS 5.1 nur, wenn
  # -RepetitionInterval gleich beim Anlegen mitkommt (sonst ist es $null und jedes
  # Setzen laeuft ins Leere). Duration bleibt leer = „ohne Ende"; -RepetitionDuration
  # mit [TimeSpan]::MaxValue schlaegt je nach Build fehl.
  $tTakt = New-ScheduledTaskTrigger -Once -At (Get-Date).Date `
    -RepetitionInterval (New-TimeSpan -Minutes $AlleMinuten)
  $tTakt.Repetition.Duration          = ''
  $tTakt.Repetition.StopAtDurationEnd = $false

  $settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -DontStopOnIdleEnd `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive -RunLevel Limited

  if (Aufgabe) { Unregister-ScheduledTask -TaskName $Name -Confirm:$false }
  Register-ScheduledTask -TaskName $Name -Action $action -Trigger @($tLogon, $tTakt) `
    -Settings $settings -Principal $principal `
    -Description "Haelt den John-/Cockpit-Server auf Port $Port am Leben: bei der Anmeldung und alle $AlleMinuten Minuten. Laeuft er schon, passiert nichts (IgnoreNew)." | Out-Null
  "Aufgabe '$Name' eingerichtet: Anmeldung + alle $AlleMinuten Minuten."

  if (Test-Path $Autost) {
    if (Test-Path $AutostAus) { Remove-Item $AutostAus -Force }
    Rename-Item $Autost -NewName ([IO.Path]::GetFileName($AutostAus))
    "Autostart-Verknuepfung beiseite gelegt (sonst starten zwei Server) — -Unregister holt sie zurueck."
  }

  if (-not (PortAntwortet)) { Start-ScheduledTask -TaskName $Name; "Server war aus — jetzt gestartet." }
  ''
  ZeigeStatus
  return
}

ZeigeStatus
