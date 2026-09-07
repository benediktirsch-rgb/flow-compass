# coach-tools.ps1 — die zwei Werkzeuge des Coachs (Notiz festhalten, Aufgabe anlegen).
# Eine Datei, zwei Nutzer: compass-server.ps1 ruft Invoke-Tool direkt (API-Weg mit tool_use),
# coach-mcp.ps1 bietet dieselben Werkzeuge Claude Code als MCP-Server an (Abo-Weg).
# Beide erwarten im aufrufenden Scope: $CoachDir (Ordner mit TASKS.md und coaching\) und $NutzerName.
if (-not $NutzerName) { $NutzerName = 'die Person' }
$Tools = @(
  @{ name = 'notiz_speichern'; description = "Hängt eine Coaching-Notiz (Erkenntnis, Entscheidung, Feedback von $NutzerName) mit Datum an daten/coaching/notizen.md an. Nutze es, wenn $NutzerName etwas entscheidet, dir Feedback gibt oder etwas Neues über Ziele oder Situation erzählt.";
     input_schema = @{ type = 'object'; properties = @{ text = @{ type = 'string'; description = 'Die Notiz in 1-3 Sätzen, im Sinne der Person formuliert.' } }; required = @('text') } },
  @{ name = 'aufgabe_anlegen'; description = "Fügt eine offene Aufgabe (mit optionaler Deadline) an daten/TASKS.md an. Nutze es, wenn im Gespräch ein konkretes Todo für $NutzerName oder dich entsteht.";
     input_schema = @{ type = 'object'; properties = @{ text = @{ type = 'string'; description = 'Aufgabe als Checkbox-Zeile ohne führendes "- [ ]".' }; deadline = @{ type = 'string'; description = 'Optional, Datum als JJJJ-MM-TT, z. B. 2026-09-30.' } }; required = @('text') } }
)
function Invoke-Tool($name, $inp) {
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
  $enc = New-Object Text.UTF8Encoding($false)
  switch ($name) {
    'notiz_speichern' {
      $f = Join-Path $CoachDir 'coaching\notizen.md'
      if (-not (Test-Path -LiteralPath (Split-Path $f))) { New-Item -ItemType Directory -Force (Split-Path $f) | Out-Null }
      if (-not (Test-Path -LiteralPath $f)) { [IO.File]::WriteAllText($f, "# Coaching-Notizen`n`nNotizen aus der Chat-Bubble im Compass und aus dem Stapel — neueste unten.`n", $enc) }
      [IO.File]::AppendAllText($f, "`n- **$stamp** — $($inp.text)`n", $enc)
      return "Notiz gespeichert in daten/coaching/notizen.md ($stamp)."
    }
    'aufgabe_anlegen' {
      $f = Join-Path $CoachDir 'TASKS.md'
      if (-not (Test-Path -LiteralPath $f)) { [IO.File]::WriteAllText($f, "# Aufgaben`n", $enc) }
      $line = "- [ ] $($inp.text)"; if ($inp.deadline) { $line += " (bis $($inp.deadline))" }; $line += " · via Coach $stamp"
      [IO.File]::AppendAllText($f, "`n$line`n", $enc)
      return "Aufgabe angelegt in daten/TASKS.md: $($inp.text)"
    }
    default { return "Unbekanntes Werkzeug: $name" }
  }
}
