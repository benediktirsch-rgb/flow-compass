param([string]$Server="$PSScriptRoot/../produkt/server/compass-server.ps1")
$ErrorActionPreference = 'Stop'
$previous = $env:COMPASS_VERTRETUNG
$config = [IO.Path]::GetTempFileName()
function Assert($value, $name) {
  if (-not $value) { throw $name }
  Write-Output ('PASS: ' + $name)
}
try {
  # Invalid configuration stops supported runtimes before any data files or listener exist.
  [IO.File]::WriteAllText($config, '{invalid-json')
  foreach ($enabled in @('1', '0')) {
    $env:COMPASS_VERTRETUNG = $enabled
    $failure = ''
    try { & $Server -Konfig $config -Backend ohne }
    catch { $failure = $_.Exception.Message }
    if ($enabled -eq '1' -and $PSVersionTable.PSVersion.Major -lt 7) {
      Assert ($failure -like 'COMPASS_POWERSHELL_7_REQUIRED:*' -and $failure -like '*pwsh -File*') 'unsupported opt-in rejected before configuration with launch instruction'
    } else {
      Assert ($failure -like 'compass-server.json*JSON:*') ('supported runtime reaches configuration validation; opt-in=' + $enabled)
    }
  }
} finally {
  $env:COMPASS_VERTRETUNG = $previous
  Remove-Item -LiteralPath $config -Force
}
