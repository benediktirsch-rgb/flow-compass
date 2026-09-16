# madeleine-anmelden.ps1 — Codex auf dem Wolkenserver einmalig mit Benes ChatGPT-Konto anmelden (16.09.2026)
#
#   Madeleine denkt seit dem 16.09.2026 auf wolke (produkt\server\madeleine.ps1). Codex braucht dort eine eigene
#   Anmeldung — nicht die Datei von diesem Rechner: teilten sich beide dieselbe auth.json, meldete die eine Seite
#   beim Erneuern die andere ab. Also Gerätecode: das Skript öffnet eine SSH-Sitzung, Codex zeigt eine Adresse
#   und einen Code, du bestätigst ihn im Browser mit deinem ChatGPT-Konto. Fertig — danach nie wieder.
#
#   Aufruf:   powershell -NoProfile -ExecutionPolicy Bypass -File wolkenserver\madeleine-anmelden.ps1
#             … -Status     nur nachsehen, ob Codex dort angemeldet ist
param(
  [string]$Server = '',
  [string]$Schluessel = (Join-Path $env:USERPROFILE '.ssh\id_ed25519_wolke'),
  [switch]$Status
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $Server) {
  $st = Join-Path $repo 'site\.publish-state\wolke.json'
  if (Test-Path $st) { $Server = [string](([IO.File]::ReadAllText($st, [Text.Encoding]::UTF8) | ConvertFrom-Json).server) }
}
if (-not $Server) { throw 'Kein Server bekannt — -Server <IP> angeben.' }
$opt = @('-i', $Schluessel, '-o', 'StrictHostKeyChecking=accept-new')
if ($Status) {
  & ssh.exe @opt "root@$Server" "su - compass -c '~/.local/bin/codex login status'"
  return
}
Write-Host 'Gleich erscheinen eine Adresse und ein Code. Adresse im Browser öffnen, mit deinem ChatGPT-Konto anmelden, Code bestätigen.'
& ssh.exe -t @opt "root@$Server" "su - compass -c '~/.local/bin/codex login --device-auth'"
Write-Host ''
& ssh.exe @opt "root@$Server" "su - compass -c '~/.local/bin/codex login status'"
Write-Host 'Wenn dort „Logged in using ChatGPT“ steht: im Compass bei Madeleine auf ↻ — sie antwortet jetzt vom Server.'
