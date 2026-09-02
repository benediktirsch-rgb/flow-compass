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
  [int]$Port = 8787,
  [int]$AlleMinuten = 5
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
