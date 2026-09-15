# wolke-token.ps1 — Anmelde-Token einer Person für den Wolkenserver eintragen (15.09.2026)
#   Die Person führt auf dem eigenen Rechner `claude setup-token` aus und schickt Bene den Wert per Direktnachricht.
#   Bene startet dieses Skript, fügt den Token ein (unsichtbar), das Skript entfernt Leerzeichen/Zeilenumbrüche
#   (Falle vom 15.09.: ein Leerzeichen aus dem Terminal-Umbruch → API 401 „OAuth access token is invalid“),
#   prüft das Muster, setzt die Benutzer-Umgebungsvariable und deployt.
#     powershell -NoProfile -ExecutionPolicy Bypass -File wolkenserver\wolke-token.ps1 -Person jan
#   Personen: bene (WOLKE_CLAUDE_TOKEN), philipp-heitz, jan, marwan, florian, domingo (WOLKE_CLAUDE_TOKEN_<SLUG>).
#   -KeinDeploy: nur setzen. Der Token wird nie ausgegeben, nie in eine Datei geschrieben.
param(
  [Parameter(Mandatory = $true)][ValidateSet('bene','philipp-heitz','jan','marwan','florian','domingo')][string]$Person,
  [switch]$KeinDeploy
)
$name = if ($Person -eq 'bene') { 'WOLKE_CLAUDE_TOKEN' } else { 'WOLKE_CLAUDE_TOKEN_' + ($Person.ToUpper() -replace '[^A-Z0-9]', '_') }
$sec = Read-Host -AsSecureString ("Token fuer {0} einfuegen (Eingabe bleibt unsichtbar), dann Enter" -f $Person)
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try { $tok = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$tok = $tok -replace '\s', ''
if ($tok -notmatch '^sk-ant-oat01-[A-Za-z0-9_\-]{40,}$') {
  Write-Host ("Das sieht nicht nach einem setup-token aus (Laenge {0}, erwartet sk-ant-oat01-...). Nichts gesetzt." -f $tok.Length) -ForegroundColor Yellow
  exit 1
}
[Environment]::SetEnvironmentVariable($name, $tok, 'User')
Write-Host ("{0} gesetzt (Laenge {1})." -f $name, $tok.Length) -ForegroundColor Green
$tok = $null
if ($KeinDeploy) { return }
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'deploy-wolkenserver.ps1')
