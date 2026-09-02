<#
  sprint-rollover.ps1 — hält auf Jira-Board 73 immer die laufende + die nächsten
  N Kalenderwochen als Sprints "Vishnu Sprint KWxx" vor (Bene, 17.08.2026).

  Idempotent: existiert ein aktiver oder zukünftiger Sprint mit exakt diesem Namen,
  wird nichts angelegt. Datumsmuster wie bisher: Start Mo 13:50Z, Ende Folge-Mo 02:29Z.

  Zugangsdaten (NIE im Repo, NIE auf dem Server): %USERPROFILE%\.claude\secrets\jira.env
     JIRA_EMAIL=benedikt@vishnuartists.com
     JIRA_TOKEN=<Atlassian-API-Token, erstellt unter id.atlassian.com/manage-profile/security/api-tokens>
  Die Datei legt Bene selbst an (Claude fasst keine Zugangsdaten an).

  Aufruf:  powershell -File sprint-rollover.ps1            → anlegen, was fehlt
           powershell -File sprint-rollover.ps1 -DryRun    → nur zeigen
           powershell -File sprint-rollover.ps1 -Weeks 4   → Vorlauf ändern (Standard 3)
  Wird montags von der Claude-Routine "sprint-rollover-montag" ausgeführt.
#>
param([int]$Weeks = 3, [switch]$DryRun)

$ErrorActionPreference = 'Stop'
$Base  = 'https://vishnuartists.atlassian.net'
$Board = 73
$EnvFile = Join-Path $env:USERPROFILE '.claude\secrets\jira.env'

if (-not (Test-Path $EnvFile)) {
  Write-Output "FEHLT: $EnvFile (JIRA_EMAIL=... / JIRA_TOKEN=...) — Token unter id.atlassian.com/manage-profile/security/api-tokens erstellen und dort eintragen."
  exit 2
}
$cfg = @{}
Get-Content $EnvFile | ForEach-Object { if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$') { $cfg[$matches[1]] = $matches[2] } }
if (-not $cfg['JIRA_EMAIL'] -or -not $cfg['JIRA_TOKEN']) { Write-Output "FEHLT: JIRA_EMAIL/JIRA_TOKEN in $EnvFile"; exit 2 }

$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$($cfg['JIRA_EMAIL']):$($cfg['JIRA_TOKEN'])"))
$H = @{ Authorization = "Basic $auth"; Accept = 'application/json'; 'Content-Type' = 'application/json' }

# vorhandene aktive + zukünftige Sprints
$existing = @(); $start = 0
do {
  $r = Invoke-RestMethod -Uri "$Base/rest/agile/1.0/board/$Board/sprint?state=active,future&maxResults=50&startAt=$start" -Headers $H -Method Get
  $existing += $r.values; $start += 50
} while (-not $r.isLast -and $r.values.Count -gt 0)
$names = @($existing | ForEach-Object { $_.name })

# Zielwochen: laufende ISO-Woche + N Folgewochen (UTC-Montag)
$now = (Get-Date).ToUniversalTime().Date
$offset = (([int]$now.DayOfWeek + 6) % 7)          # Mo=0 … So=6
$monday = $now.AddDays(-$offset)
$cal = [System.Globalization.CultureInfo]::InvariantCulture.Calendar
$created = @(); $skipped = @()
for ($i = 0; $i -le $Weeks; $i++) {
  $mo = $monday.AddDays(7 * $i)
  $kw = $cal.GetWeekOfYear($mo.AddDays(3), [System.Globalization.CalendarWeekRule]::FirstFourDayWeek, [DayOfWeek]::Monday)  # ISO-8601 (Donnerstag-Regel)
  $name = 'Vishnu Sprint KW{0:D2}' -f $kw
  if ($names -contains $name) { $skipped += $name; continue }
  $body = @{
    name = $name; originBoardId = $Board; goal = ''
    startDate = $mo.AddHours(13).AddMinutes(50).ToString("yyyy-MM-dd'T'HH:mm:ss.000'Z'")
    endDate   = $mo.AddDays(7).AddHours(2).AddMinutes(29).AddSeconds(46).ToString("yyyy-MM-dd'T'HH:mm:ss.000'Z'")
  }
  if ($DryRun) { $created += "$name (dry) $($body.startDate) → $($body.endDate)"; continue }
  $res = Invoke-RestMethod -Uri "$Base/rest/agile/1.0/sprint" -Headers $H -Method Post -Body ($body | ConvertTo-Json -Compress)
  $created += "$name (id $($res.id)) $($body.startDate) → $($body.endDate)"; $names += $name
}

Write-Output ("Stand {0}: vorhanden = {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), (($existing | ForEach-Object { "$($_.name)#$($_.id)/$($_.state)" }) -join ', '))
Write-Output ("übersprungen (existiert): {0}" -f ($skipped -join ', '))
Write-Output ("angelegt: {0}" -f ($(if ($created) { $created -join ' | ' } else { '—' })))
