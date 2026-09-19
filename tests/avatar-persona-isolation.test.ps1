$ErrorActionPreference='Stop'
function Assert($v,$n){if(-not $v){throw $n};Write-Output "PASS $n"}
function Read-Text($p){''}
function Get-MadeleinePrivat{$null}
function Get-MadVerein{$null}
function Get-BeraterrundeDatei{'synthetic'}
function Test-AvatarTicket($r){$true}
function Get-AvatarPrompt($avatar,$personal){'AVATAR-ONLY-MARKER'}
$DatenDir=Join-Path $PSScriptRoot ('tmp-avatar-persona-'+[guid]::NewGuid());New-Item -ItemType Directory $DatenDir | Out-Null
$MadeleineDir=$DatenDir;$StandardPersona='Existing persona';$NutzerName='Synthetic';$CoachName='Coach';$Sprache='de'
try{
 foreach($item in @(@('compass-server.ps1','Build-System'),@('madeleine.ps1','Build-SystemMadeleine'))){
  $tokens=$null;$errors=$null
  $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot ('../produkt/server/'+$item[0])),[ref]$tokens,[ref]$errors)
  Assert ($errors.Count -eq 0) ($item[0]+' parses')
  $fn=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $item[1]},$true)
  . ([scriptblock]::Create($fn.Extent.Text))
  $ordinary=& $item[1]
  $avatar=& $item[1] $true
  Assert (-not $ordinary.text.Contains('AVATAR-ONLY-MARKER') -and $ordinary.geladen -notcontains 'master/avatar') ($item[1]+' keeps ordinary persona unchanged')
  Assert ($avatar.text.Contains('AVATAR-ONLY-MARKER') -and $avatar.geladen -contains 'master/avatar') ($item[1]+' adds avatar persona only on explicit opt-in')
 }
}finally{
 $target=[IO.Path]::GetFullPath($DatenDir);$allowed=[IO.Path]::GetFullPath($PSScriptRoot)+[IO.Path]::DirectorySeparatorChar
 if($target.StartsWith($allowed) -and [IO.Path]::GetFileName($target).StartsWith('tmp-avatar-persona-')){Remove-Item -LiteralPath $target -Recurse -Force}
}
