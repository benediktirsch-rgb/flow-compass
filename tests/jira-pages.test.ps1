param([string]$Server="$PSScriptRoot/../produkt/server/compass-server.ps1")
$ErrorActionPreference='Stop'
$t=$null;$e=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $Server),[ref]$t,[ref]$e)
if($e.Count){throw 'Parse error'}
$f=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-JiraMeine'},$true)
Invoke-Expression $f.Extent.Text
function Get-JiraAuth {return @{site='example.invalid'}}
function Assert-JiraAuth {}
# Match ConvertFrom-Json: issue objects must expose properties in PowerShell 5.1 too.
function Invoke-JiraJson($auth,$path,$body){$script:calls++;if($script:broken){return @{issues=@();nextPageToken='repeat';isLast=$false}};if($body.nextPageToken){return @{issues=@([pscustomobject]@{key='T-2';fields=[pscustomobject]@{summary='second'}});isLast=$true}};return @{issues=@([pscustomobject]@{key='T-1';fields=[pscustomobject]@{summary='first'}});nextPageToken='page2';isLast=$false}}
function Assert($v,$n){if(-not $v){throw $n};Write-Output ('PASS: '+$n)}
$env:COMPASS_VERTRETUNG='1';$script:calls=0;$script:JiraMeineCache=@{}
$r=Get-JiraMeine $true
Assert ($r.anzahl -eq 2 -and $r.seiten -eq 2 -and $r.vollstaendig) 'all Jira pages collected'
$script:broken=$true
try{$null=Get-JiraMeine $true;throw 'unexpected'}catch{Assert ($_.Exception.Message -eq 'JIRA_PAGINATION_UNVOLLSTAENDIG') 'repeated cursor rejected'}
Assert ($script:JiraMeineCache.out.anzahl -eq 2) 'failed scan preserves successful cache'
