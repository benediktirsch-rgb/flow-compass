# john-mcp.ps1 — Johns Werkzeuge als MCP-Server (stdio) für Claude Code im Kopflos-Modus.
#
# Warum (07.09.2026): John läuft über `claude -p` auf dem Claude-Abo statt über die API. Claude Code
# kennt Johns Werkzeuge (notiz_speichern, aufgabe_anlegen) nicht — es bekommt sie über diesen
# MCP-Server, den es selbst je Anfrage startet (Konfiguration schreibt john-server.ps1 nach
# _puffer\john-mcp-<ticks>.json). Ein Prozess je Anfrage, kein Zustand, keine Netzverbindung:
# JSON-RPC-Zeilen auf stdin, Antworten auf stdout — beides UTF-8 ohne BOM.
#
# Warum nicht im Server selbst: john-server.ps1 arbeitet seriell (eine Anfrage nach der anderen).
# Während er auf claude.exe wartet, könnte er keinen zweiten HTTP-Aufruf beantworten — ein
# MCP-Endpunkt im Server würde sich selbst blockieren.
#
#   -JohnDir  Ordner mit TASKS.md und coaching\   -Log  Datei, in die je Werkzeugaufruf der Name kommt
#             (der Server liest sie nach dem Lauf und zeigt „✎ notiz_speichern“ im Compass an)
param([string]$JohnDir = 'C:\dev\john', [string]$Log = '')
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8; [Console]::OutputEncoding = $utf8
$in  = New-Object IO.StreamReader ([Console]::OpenStandardInput(), $utf8)
$out = New-Object IO.StreamWriter ([Console]::OpenStandardOutput(), $utf8)
$out.AutoFlush = $true; $out.NewLine = "`n"
. (Join-Path $PSScriptRoot 'john-tools.ps1')
function Send($obj) { $out.WriteLine(($obj | ConvertTo-Json -Depth 20 -Compress)) }

while ($null -ne ($line = $in.ReadLine())) {
  if (-not $line.Trim()) { continue }
  try { $m = $line | ConvertFrom-Json } catch { continue }
  $hasId = ($m.PSObject.Properties.Name -contains 'id'); $id = $m.id
  switch ([string]$m.method) {
    'initialize' {
      $pv = $(if ($m.params -and $m.params.protocolVersion) { [string]$m.params.protocolVersion } else { '2025-06-18' })
      Send @{ jsonrpc = '2.0'; id = $id; result = @{ protocolVersion = $pv; capabilities = @{ tools = @{} }; serverInfo = @{ name = 'john'; version = '1.0' } } }
    }
    'notifications/initialized' { }
    'ping' { Send @{ jsonrpc = '2.0'; id = $id; result = @{} } }
    'tools/list' {
      $liste = @($Tools | ForEach-Object { @{ name = $_.name; description = $_.description; inputSchema = $_.input_schema } })
      Send @{ jsonrpc = '2.0'; id = $id; result = @{ tools = $liste } }
    }
    'tools/call' {
      $name = [string]$m.params.name; $inp = $m.params.arguments
      $fehler = $false
      try { $txt = Invoke-Tool $name $inp } catch { $txt = "Fehler: $($_.Exception.Message)"; $fehler = $true }
      if ($Log) { try { [IO.File]::AppendAllText($Log, "$name`n", $utf8) } catch { } }
      Send @{ jsonrpc = '2.0'; id = $id; result = @{ content = @(@{ type = 'text'; text = [string]$txt }); isError = $fehler } }
    }
    default { if ($hasId) { Send @{ jsonrpc = '2.0'; id = $id; error = @{ code = -32601; message = "Unbekannte Methode: $($m.method)" } } } }
  }
}
