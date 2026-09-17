param([string]$Module = "$PSScriptRoot/../produkt/server/kalender.ps1")
$ErrorActionPreference='Stop'
. $Module
$sample=@'
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-series
DTSTART;TZID=Europe/Berlin:20260917T100000
DTEND;TZID=Europe/Berlin:20260917T110000
RRULE:FREQ=DAILY;COUNT=3
EXDATE;TZID=Europe/Berlin:20260918T100000
SUMMARY:Test\, Termin
END:VEVENT
END:VCALENDAR
'@
$events=@(ConvertFrom-IcsText $sample 'test')
if ($events.Count -ne 1 -or $events[0].titel -ne 'Test, Termin') { throw 'ICS parse failed' }
$ev=$events[0]
$dates=@(Get-IcsKandidaten $ev (ConvertFrom-Rrule $ev.rrule) ([datetime]'2026-09-21'))
if ($dates.Count -ne 3 -or $ev.exdate.Count -ne 1) { throw 'recurrence failed' }
if ((Get-IcsDauer $ev).TotalMinutes -ne 60) { throw 'duration failed' }
$script:KalCache = @{zeit=$null;out=$null;tage=0}
function Get-KalenderQuellen { @(@{name='test';url='https://invalid.test';quelle='fixture'}) }
function Get-IcsText($url) { throw 'fixture failure' }
$r=Get-Kalender 7 $true
if (@($r.kalender | Where-Object {-not $_.ok}).Count -ne 1) { throw 'source failure not preserved' }
'PASS: ICS escaping, timezone date, recurrence, exclusions, duration and source failure'
