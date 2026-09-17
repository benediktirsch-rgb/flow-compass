param([string]$Module="$PSScriptRoot/../produkt/server/rueckfragen.ps1")
. $Module
$DatenDir=Join-Path ([IO.Path]::GetTempPath()) ('compass-questions-'+[guid]::NewGuid())
$dir=New-Item -ItemType Directory (Join-Path $DatenDir 'vertretung')
function Read-Antworten { return @{answered=@{a='done';ts='2026-09-17'}} }
function Invoke-MadeleneHub { if($script:fail){throw 'OFFLINE'}; return @{ok=$true;rueckfragen=@(@{id='remote';status='offen';frage='Remote?'},@{id='closed';status='beantwortet';antwort=@{a='Done'}})} }
function Assert($v,$name){if(-not $v){throw $name};Write-Output ('PASS: '+$name)}
try {
 $data=@{quellstand='2026-09-17';rueckfragen=@(@{id='open';frage='Open?'},@{id='answered'},@{id='decided'},@{id='closed'});entschieden=,@('2026-09-17','decided','Yes')}
 $file=Join-Path $dir 'rueckfragen-import.json'
 [IO.File]::WriteAllText($file,($data|ConvertTo-Json -Depth 8))
 $r=Get-CloudRueckfragen
 Assert ($r.vollstaendig -and @($r.rueckfragen).Count -eq 2) 'merge local and live questions'
 Assert (@($r.rueckfragen.id) -contains 'remote') 'live reception included'
 Assert (@($r.rueckfragen.id) -notcontains 'answered' -and @($r.rueckfragen.id) -notcontains 'decided' -and @($r.rueckfragen.id) -notcontains 'closed') 'answers and decisions never reasked'
 $script:fail=$true;$r=Get-CloudRueckfragen
 Assert (-not $r.vollstaendig -and -not $r.rezeptionErreichbar) 'outage reported'
 function Send-Json($ctx,$data,$code){$script:response=$data;$script:httpCode=$code}
 $snapshot=Join-Path $dir 'slack-connector.json'
 $sample=@{ok=$true;stand=[DateTimeOffset]::Now.ToString('o');zusammenfassung=@{};wartend=@(@{art='antwort';seit=[DateTimeOffset]::Now.AddDays(-3).ToString('o');kanalId='C1';ts='123.456'})}
 [IO.File]::WriteAllText($snapshot,($sample|ConvertTo-Json -Depth 8))
 $null=Invoke-RueckfragenRoute $null @{HttpMethod='GET'} '/api/slack'
 Assert ($script:response.ok -and $script:response.frisch -and $script:response.wartend[0].tage -ge 3) 'connector snapshot dates and freshness'
 Assert ($script:response.wartend[0].url -eq 'https://app.slack.com/archives/C1/p123456') 'stable message link'
 $null=Invoke-RueckfragenRoute $null @{HttpMethod='POST'} '/api/slack'
 Assert ($script:httpCode -eq 405) 'source endpoint is read only'
 Remove-Item -LiteralPath $snapshot -Force
} finally {Remove-Item -LiteralPath $file -Force;Remove-Item -LiteralPath $dir -Force;Remove-Item -LiteralPath $DatenDir -Force}