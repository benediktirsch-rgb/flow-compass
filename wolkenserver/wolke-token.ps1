# wolke-token.ps1 — Schlüssel einer Person für den Wolkenserver eintragen (15.09.2026)
#   Eingaben bleiben unsichtbar, Leerzeichen/Zeilenumbrüche werden entfernt (Falle vom 15.09.: ein Leerzeichen aus dem
#   Terminal-Umbruch → API 401), Muster wird geprüft, dann Benutzer-Umgebungsvariable setzen und deployen.
#     powershell -NoProfile -ExecutionPolicy Bypass -File wolkenserver\wolke-token.ps1 -Person jan            # Claude-Token
#     … -Person jan -Art trello     # TRELLO_JAN_KEY + TRELLO_JAN_TOKEN (ein Trello-Konto für Privat- und Arbeitsboard)
#     … -Person jan -Art jira       # JIRA_JAN_EMAIL + JIRA_JAN_TOKEN (+ optional JIRA_JAN_SITE, sonst Site aus instanz.js)
#   Personen: bene (WOLKE_CLAUDE_TOKEN bzw. TRELLO_PRIVAT_*/JIRA_*), philipp-heitz, jan, marwan, florian, domingo.
#   -KeinDeploy: nur setzen. Werte werden nie ausgegeben, nie in eine Datei geschrieben.
param(
  [Parameter(Mandatory = $true)][ValidateSet('bene','philipp-heitz','jan','marwan','florian','domingo')][string]$Person,
  [ValidateSet('claude','trello','jira')][string]$Art = 'claude',
  [switch]$KeinDeploy
)
$sv = ($Person.ToUpper() -replace '[^A-Z0-9]', '_')
function Geheim([string]$frage) {
  $sec = Read-Host -AsSecureString ($frage + ' (Eingabe bleibt unsichtbar), dann Enter')
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { $v = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  return ($v -replace '\s', '')
}
function Setze([string]$name, [string]$wert, [string]$muster, [string]$erwartet) {
  if ($wert -notmatch $muster) { Write-Host ("{0}: das sieht nicht richtig aus (Laenge {1}, erwartet {2}). Nichts gesetzt." -f $name, $wert.Length, $erwartet) -ForegroundColor Yellow; exit 1 }
  [Environment]::SetEnvironmentVariable($name, $wert, 'User')
  Write-Host ("{0} gesetzt (Laenge {1})." -f $name, $wert.Length) -ForegroundColor Green
}
switch ($Art) {
  'claude' {
    $name = if ($Person -eq 'bene') { 'WOLKE_CLAUDE_TOKEN' } else { "WOLKE_CLAUDE_TOKEN_$sv" }
    Setze $name (Geheim "Claude-Token fuer $Person einfuegen") '^sk-ant-oat01-[A-Za-z0-9_\-]{40,}$' 'sk-ant-oat01-...'
  }
  'trello' {
    $k = if ($Person -eq 'bene') { 'TRELLO_PRIVAT_KEY' } else { "TRELLO_${sv}_KEY" }
    $t = if ($Person -eq 'bene') { 'TRELLO_PRIVAT_TOKEN' } else { "TRELLO_${sv}_TOKEN" }
    Setze $k (Geheim "Trello-API-Key fuer $Person einfuegen") '^[a-f0-9]{32}$' '32 Hex-Zeichen von trello.com/power-ups/admin'
    Setze $t (Geheim "Trello-Token fuer $Person einfuegen") '^[A-Za-z0-9]{60,}$' 'Token aus dem Autorisierungslink (read,write, expiration=never)'
  }
  'jira' {
    $e = if ($Person -eq 'bene') { 'JIRA_EMAIL' } else { "JIRA_${sv}_EMAIL" }
    $t = if ($Person -eq 'bene') { 'JIRA_TOKEN' } else { "JIRA_${sv}_TOKEN" }
    $mail = (Read-Host "Atlassian-E-Mail fuer $Person") -replace '\s', ''
    Setze $e $mail '^[^@\s]+@[^@\s]+\.[^@\s]+$' 'E-Mail-Adresse des Atlassian-Kontos'
    Setze $t (Geheim "Jira-API-Token fuer $Person einfuegen") '^[A-Za-z0-9_\-=+/]{20,}$' 'API-Token von id.atlassian.com/manage-profile/security/api-tokens'
  }
}
if ($KeinDeploy) { return }
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'deploy-wolkenserver.ps1')
