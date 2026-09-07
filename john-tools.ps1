# john-tools.ps1 — Johns zwei Werkzeuge (Notiz festhalten, Aufgabe anlegen).
# Eine Datei, zwei Nutzer (07.09.2026): john-server.ps1 ruft Invoke-Tool direkt (API-Weg mit tool_use),
# john-mcp.ps1 bietet dieselben Werkzeuge Claude Code als MCP-Server an (Abo-Weg). Beide erwarten
# $JohnDir im aufrufenden Scope (Ordner mit TASKS.md und coaching\).
$Tools = @(
  @{ name = 'notiz_speichern'; description = 'Hängt eine Coaching-Notiz (Erkenntnis, Entscheidung, Feedback von Benedikt) mit Datum an john/coaching/cockpit-notizen.md an. Nutze es, wenn Benedikt etwas entscheidet, dir Feedback gibt oder etwas Neues über seine Ziele/Situation erzählt.';
     input_schema = @{ type = 'object'; properties = @{ text = @{ type = 'string'; description = 'Die Notiz in 1–3 Sätzen, in Benedikts Sinne formuliert.' } }; required = @('text') } },
  @{ name = 'aufgabe_anlegen'; description = 'Fügt eine offene Aufgabe (mit optionaler Deadline) an john/TASKS.md an. Nutze es, wenn im Gespräch ein konkretes Todo für Benedikt oder dich entsteht.';
     input_schema = @{ type = 'object'; properties = @{ text = @{ type = 'string'; description = 'Aufgabe als Checkbox-Zeile ohne führendes "- [ ]".' }; deadline = @{ type = 'string'; description = 'Optional, z. B. 2026-08-22.' } }; required = @('text') } }
)
function Invoke-Tool($name, $inp) {
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
  switch ($name) {
    'notiz_speichern' {
      $f = Join-Path $JohnDir 'coaching\cockpit-notizen.md'
      if (-not (Test-Path (Split-Path $f))) { New-Item -ItemType Directory -Force (Split-Path $f) | Out-Null }
      if (-not (Test-Path $f)) { [IO.File]::WriteAllText($f, "# Cockpit-Notizen (John)`n`nNotizen aus der Chat-Bubble im Cockpit — neueste unten.`n", [Text.UTF8Encoding]::new($false)) }
      [IO.File]::AppendAllText($f, "`n- **$stamp** — $($inp.text)`n", [Text.UTF8Encoding]::new($false))
      return "Notiz gespeichert in john/coaching/cockpit-notizen.md ($stamp)."
    }
    'aufgabe_anlegen' {
      $f = Join-Path $JohnDir 'TASKS.md'
      $line = "- [ ] $($inp.text)"; if ($inp.deadline) { $line += " (bis $($inp.deadline))" }; $line += " · via John-Bubble $stamp"
      [IO.File]::AppendAllText($f, "`n$line`n", [Text.UTF8Encoding]::new($false))
      return "Aufgabe angelegt in john/TASKS.md: $($inp.text)"
    }
    default { return "Unbekanntes Tool: $name" }
  }
}
