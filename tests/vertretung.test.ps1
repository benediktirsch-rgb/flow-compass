param([string]$Module = "$PSScriptRoot/../produkt/server/vertretung.ps1")
$ErrorActionPreference = 'Stop'
. $Module
function Save-VertretungModell($zustand,$anbieter,$grund) { $script:state = "$zustand/$anbieter" }
function Invoke-ClaudeCliPrimary($systemText,$prompt,$o) {
  $script:primaryCalls++
  if ($script:primaryError) { throw $script:primaryError }
  return @{text='primary';model='claude'}
}
function Invoke-CodexCli($prompt,$o) {
  $script:backupCalls++
  if ($script:backupError) { throw $script:backupError }
  return @{text='backup';model='test'}
}
function Reset-Test {
  $env:COMPASS_VERTRETUNG='1'; $script:VertretungBis=[datetime]::MinValue
  $script:primaryCalls=0; $script:backupCalls=0; $script:primaryError=''; $script:backupError=''
}
function Assert($value,$label) { if (-not $value) { throw "FAIL: $label" }; Write-Output "PASS: $label" }
Reset-Test
$r=Invoke-ClaudeCli 's' 'p' @{tools=$false}
Assert ($r.text -eq 'primary' -and $script:backupCalls -eq 0) 'healthy primary'
Reset-Test; $script:primaryError="CLI: You have hit your monthly spend limit"
$r=Invoke-ClaudeCli 's' 'p' @{tools=$false}
Assert ($r.text -eq 'backup' -and $script:state -eq 'bereit/codex') 'quota activates backup'
$r=Invoke-ClaudeCli 's' 'p' @{tools=$false}
Assert ($script:primaryCalls -eq 1 -and $script:backupCalls -eq 2) 'primary cooldown'
$script:VertretungBis=(Get-Date).AddSeconds(-1); $script:primaryError=''
$r=Invoke-ClaudeCli 's' 'p' @{tools=$false}
Assert ($r.text -eq 'primary') 'primary recovery'
Reset-Test; $script:primaryError='LIMIT'
try { Invoke-ClaudeCli 's' 'p' @{tools=$true}; throw 'unexpected success' } catch { Assert ($_.Exception.Message -eq 'LIMIT' -and $script:backupCalls -eq 0) 'tool actions never delegated' }
Reset-Test; $script:primaryError='LIMIT'; $env:COMPASS_VERTRETUNG='0'
try { Invoke-ClaudeCli 's' 'p' @{tools=$false}; throw 'unexpected success' } catch { Assert ($_.Exception.Message -eq 'LIMIT' -and $script:backupCalls -eq 0) 'other instances unchanged' }
Reset-Test; $script:primaryError='invalid prompt'
try { Invoke-ClaudeCli 's' 'p' @{tools=$false}; throw 'unexpected success' } catch { Assert ($_.Exception.Message -eq 'invalid prompt' -and $script:backupCalls -eq 0) 'unknown errors not hidden' }
Reset-Test; $script:primaryError='LIMIT'; $script:backupError='CODEX_LIMIT'
try { Invoke-ClaudeCli 's' 'p' @{tools=$false}; throw 'unexpected success' } catch { Assert ($_.Exception.Message -eq 'CODEX_LIMIT' -and $script:state -eq 'nicht_verfuegbar/codex') 'both providers unavailable reported honestly' }

$DatenDir = Join-Path ([IO.Path]::GetTempPath()) ('compass-test-' + [guid]::NewGuid())
$testDir = New-Item -ItemType Directory -Path (Join-Path $DatenDir 'vertretung')
function Send-Json($ctx,$value,$code) { $script:response=$value }
try {
  $data=@{quellen=@{neu=@{status='aktuell';letzterErfolg=[DateTimeOffset]::Now.ToString('o')};alt=@{status='aktuell';letzterErfolg=[DateTimeOffset]::Now.AddHours(-2).ToString('o')}}}
  [IO.File]::WriteAllText((Join-Path $testDir 'status.json'), ($data | ConvertTo-Json -Depth 6))
  $null=Invoke-VertretungRoute $null @{HttpMethod='GET'} '/api/vertretung'
  Assert ($script:response.status.quellen.neu.status -eq 'aktuell') 'JSON date remains current'
  Assert ($script:response.status.quellen.alt.status -eq 'veraltet') 'old JSON date marked stale'
} finally {
  Remove-Item -LiteralPath (Join-Path $testDir 'status.json') -Force
  Remove-Item -LiteralPath $testDir -Force
  Remove-Item -LiteralPath $DatenDir -Force
}