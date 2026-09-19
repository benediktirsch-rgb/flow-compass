$ErrorActionPreference='Stop'
function Get-Feld($o,$n,$fallback){if($null -eq $o -or $null -eq $o.$n){return $fallback};return $o.$n}
function Read-Text($p){if(Test-Path -LiteralPath $p){return [IO.File]::ReadAllText($p)};return ''}
. "$PSScriptRoot/../produkt/server/gedaechtnis.ps1"
. "$PSScriptRoot/../produkt/server/avatare.ps1"
$DatenDir=Join-Path $PSScriptRoot ('tmp-avatar-'+[guid]::NewGuid());New-Item -ItemType Directory $DatenDir|Out-Null
$K=[pscustomobject]@{avatars=[pscustomobject]@{dailyCalls=1;masterVersion='v1'}}
function Assert($v,$name){if(-not $v){throw $name};Write-Output "PASS $name"}
function Throws($code,[scriptblock]$run){try{& $run|Out-Null;throw 'DID_NOT_THROW'}catch{Assert ($_.Exception.Message -eq $code) $code}}
try{
 $p=Get-AvatarState;Assert ($p.revision -eq 0 -and $p.values -eq '') 'clean new instance'
 $d=@{op='profile';revision=0;values='Testwert';definition='Erholung';directness='direkt';spirituality='offen';influences=@{john='Test';madeleine='Test'};custom=@();favorites=@('ruhe')}
 $p=Set-AvatarState ([pscustomobject]$d);Assert ($p.revision -eq 1) 'profile stored'
 Throws 'REVISION_CONFLICT' {Set-AvatarState ([pscustomobject]$d)}
 $p=Set-AvatarState ([pscustomobject]@{op='rating';revision=1;id='guide-30';rating='teilweise';note='Beispiel'})
 Assert ((Get-AvatarPrompt 'madeleine' $true).Contains('Sadhguru')) 'rating resolves to guide content'
 Assert (-not (Get-AvatarPrompt 'john' $false).Contains('Testwert')) 'no personal prompt without owner access'
 $p=Set-AvatarState ([pscustomobject]@{op='plan';revision=2;id='ruhe';label='Pause';next='Zehn Minuten';eventId='test-1'})
 $p=Set-AvatarState ([pscustomobject]@{op='plan';revision=2;id='ruhe';label='Pause';next='Zehn Minuten';eventId='test-1'})
 Assert ($p.events.Count -eq 1 -and $p.events[0].status -eq 'geplant') 'idempotent intention, not success'
 $p=Set-AvatarState ([pscustomobject]@{op='result';revision=3;eventId='test-1';status='erledigt';effect='gut'})
 Assert ($p.events[0].status -eq 'erledigt' -and $p.revision -eq 4) 'confirmed outcome persists'
 $customRequest=@{op='profile';revision=4;values='Testwert';definition='Erholung';directness='direkt';spirituality='offen';influences=@{john='Test';madeleine='Test'};custom=@(@{id='custom-test';label='Sterne';definition='Stille'});favorites=@('custom-test')} | ConvertTo-Json -Depth 8 | ConvertFrom-Json
 $p=Set-AvatarState $customRequest;Assert ($p.custom[0].id -eq 'custom-test' -and $p.revision -eq 5) 'JSON custom option survives dictionary conversion'
 $other=Join-Path $DatenDir 'other';$first=$DatenDir;$DatenDir=$other
 Assert ((Get-AvatarState).revision -eq 0) 'other instance has no personal data';$DatenDir=$first
 Assert (-not(Test-AvatarTicket $null)) 'no implicit startup authorization'
 $savedKey=$env:MADELEINE_TICKET_KEY;$env:MADELEINE_TICKET_KEY='synthetic-test-key-not-a-real-secret'
 $exp=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()+300;$h=New-Object Security.Cryptography.HMACSHA256 (,[Text.Encoding]::UTF8.GetBytes($env:MADELEINE_TICKET_KEY))
 $sig=-join($h.ComputeHash([Text.Encoding]::UTF8.GetBytes("madeleine|$exp|123"))|ForEach-Object{$_.ToString('x2')});$h.Dispose()
 Assert (Test-AvatarTicket @{Headers=@{'X-Mad-Ticket'="$exp.123.$sig"}}) 'owner ticket verifies'
 Assert (-not(Test-AvatarTicket @{Headers=@{'X-Mad-Ticket'="$exp.124.$sig"}})) 'wrong identity rejected'
 Reserve-AvatarBudget;Throws 'MODEL_BUDGET' {Reserve-AvatarBudget}
 $env:MADELEINE_TICKET_KEY=$savedKey
}finally{
 $target=[IO.Path]::GetFullPath($DatenDir);$allowed=[IO.Path]::GetFullPath($PSScriptRoot)+[IO.Path]::DirectorySeparatorChar
 if($target.StartsWith($allowed) -and [IO.Path]::GetFileName($target).StartsWith('tmp-avatar-')){Remove-Item -LiteralPath $target -Recurse -Force}
}
