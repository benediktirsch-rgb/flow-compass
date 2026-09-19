$ErrorActionPreference='Stop'
function Assert($value,$name){if(-not $value){throw $name};Write-Output "PASS $name"}
$server=Join-Path $PSScriptRoot '../produkt/server'
# Load just the real chat functions, never start a server or contact a provider.
foreach($item in @(@('compass-server.ps1','Coach-Chat'),@('madeleine.ps1','Madeleine-Chat'))){
 $tokens=$null;$errors=$null
 $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $server $item[0]),[ref]$tokens,[ref]$errors)
 Assert ($errors.Count -eq 0) ($item[0]+' parses')
 $fn=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $item[1]},$true)
 . ([scriptblock]::Create($fn.Extent.Text))
}
function Assert-Backend{'cli'}
function Build-System{@{text='synthetic';geladen=@()}}
function Build-SystemMadeleine{@{text='synthetic';geladen=@()}}
function Format-CliVerlauf($messages,$context){'synthetic'}
function Format-MadeleineVerlauf($messages,$context,$fragt){'synthetic'}
function Invoke-ClaudeCli($system,$prompt,$options){$script:turns=$options.maxTurns;@{text='ok'}}
function Invoke-CodexCli($prompt,$options){@{text='ok'}}
function Split-MadeleineNotiz($text){@{text=$text;notizen=@()}}
$script:used=0;$script:limit=20
function Reserve-AvatarBudget{if($script:used -ge $script:limit){throw 'MODEL_BUDGET'};$script:used++}
$messages=@(@{role='user';content='synthetic'})
Coach-Chat $messages '' | Out-Null
Assert ($script:turns -eq 8 -and $script:used -eq 0) 'ordinary John keeps eight turns and no avatar debit'
Madeleine-Chat $messages '' $null | Out-Null
Assert ($script:used -eq 0) 'ordinary Madeleine does not debit avatars'
Coach-Chat $messages '' $true | Out-Null
Assert ($script:turns -eq 3 -and $script:used -eq 1) 'avatar John keeps three turns and one debit'
Madeleine-Chat $messages '' $null $true | Out-Null
Assert ($script:used -eq 2) 'avatar Madeleine debits once'
$script:used=20
foreach($avatar in @('john','madeleine')){
 $blocked=$false
 try{if($avatar -eq 'john'){Coach-Chat $messages '' $true | Out-Null}else{Madeleine-Chat $messages '' $null $true | Out-Null}}catch{if($_.Exception.Message -eq 'MODEL_BUDGET'){$blocked=$true}else{throw}}
 Assert $blocked ($avatar+' avatar respects exhausted budget')
}
# The advisor round uses these same default call signatures (John/Madeleine/John).
Coach-Chat $messages '' | Out-Null
Madeleine-Chat $messages '' $null | Out-Null
Coach-Chat $messages '' | Out-Null
Assert ($script:used -eq 20 -and $script:turns -eq 8) 'ordinary advisor calls work after avatar budget exhaustion'

# Exercise the actual authenticated route, with synthetic identity/body and no model calls.
. (Join-Path $server 'avatare.ps1')
function Test-AvatarTicket($request){$true}
function Read-JsonBody($ctx,$valid,$fallback){$valid.Value=$true;return $script:body}
function Send-Json($ctx,$data,$code){$script:response=$data}
function Get-AvatarMaster{@{}}
function Get-AvatarState{@{}}
function Coach-Chat($messages,$context,[bool]$avatarRequest=$false){$script:routed=$avatarRequest;@{text='ok'}}
function Madeleine-Chat($messages,$context,$fragt,[bool]$avatarRequest=$false){$script:routed=$avatarRequest;@{text='ok'}}
$MadeleineAn=$true
foreach($avatar in @('john','madeleine')){
 $script:routed=$false;$script:body=@{op='chat';avatar=$avatar;messages=$messages}
 Invoke-AvatareRoute $null @{HttpMethod='POST';ContentLength64=100;ContentType='application/json'} '/api/avatare' | Out-Null
 Assert ($script:routed -and $script:response.ok) ($avatar+' authenticated avatar route opts in')
}
