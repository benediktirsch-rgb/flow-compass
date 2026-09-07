# john-madeleine.ps1 — Madeleine, die zweite Beraterin im Flow Compass (07.09.2026)
#
# Bene: „Kannst du ihn auch als 2. Coach — spezialisiert auf Finanzen, Steuer und Organisationsexperte für
# Vishnu und Vaikuntha — auf dem Compass einbinden. So dass wir 2 Berater (John und Madeleine) haben, die
# unterschiedliche Stärken haben und im Idealfall auch transparent miteinander kommunizieren."
#
# Was hier steht (wird von john-server.ps1 dot-sourced, nach john-tools.ps1):
#   - Madeleine läuft auf GPT über die Codex CLI (`codex exec`), angemeldet mit Benes ChatGPT-Abo — kein API-
#     Schlüssel, keine zweite Rechnung. Die Anmeldung muss als Datei liegen (~\.codex\auth.json,
#     cli_auth_credentials_store = "file"), sonst sieht dieser Prozess den Windows-Schlüsselbund nicht.
#   - Ihr Wissen: C:\dev\madeleine (CLAUDE.md = Persona, wissen\*.md, notizen\beratung.md) plus Johns
#     Coaching-Ordner, die Cockpit-Rückfragen und die Live-Zahlen aus Finanzlauf (Get-Finanzen) und
#     Verein (Get-Verein). Codex kennt kein --system-prompt-file: alles geht als ein Prompt über stdin.
#   - Werkzeuge hat sie keine (kein MCP über Codex). Stattdessen: eine letzte Zeile „NOTIZ: …" in ihrer
#     Antwort landet in madeleine\notizen\beratung.md — sichtbar, nachlesbar, keine Magie.
#   - Die Beraterrunde ist die transparente Kommunikation der beiden: John (Claude) → Madeleine (GPT) →
#     John, alles in john\coaching\beraterrunde.md. John liest sie über seinen Coaching-Ordner sowieso,
#     Madeleine ausdrücklich. Bene liest im Compass mit.
# Braucht aus john-server.ps1: Invoke-Prozess, Read-Text, Limit-Ende, Get-JsAbschnitt, Get-Finanzen,
#   Get-Verein, John-Chat, $JohnDir, $Root, $NutzerName, $MadeleineDir, $MadeleineModel, $script:Utf8NoBom.

$script:CodexLogin = $null
$script:MadeleineModelLabel = $(if ($MadeleineModel) { $MadeleineModel } else { 'GPT (Codex-Standardmodell)' })
$MadeleineHinweis = @"
Technischer Rahmen: Du läufst über die Codex CLI, aber NICHT als Programmierwerkzeug — du bist Madeleine in
einem Beratungsgespräch. Es gibt keine Dateien zu lesen, nichts auszuführen, kein Repository; alles, was du
weißt, steht oben in diesem Text. Antworte nur mit deinem Beitrag (Fließtext, Markdown sparsam), ohne Präfix,
ohne den Verlauf zu wiederholen. Willst du etwas festhalten, schreib als letzte Zeile: NOTIZ: <ein Satz>
"@

function Find-CodexExe {
  $e = [Environment]::GetEnvironmentVariable('JOHN_CODEX_EXE', 'User'); if ($e -and (Test-Path $e)) { return $e }
  $c = Get-Command codex -ErrorAction SilentlyContinue; if ($c) { return $c.Source }
  $w = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\codex.exe'; if (Test-Path $w) { return $w }
  return $null
}
function Get-CodexHint {
  return 'Codex ist nicht angemeldet — einmalig im Terminal ausführen: codex login (öffnet den Browser, Anmeldung mit dem ChatGPT-Konto). Damit der Server die Anmeldung sieht, muss in ~\.codex\config.toml die Zeile cli_auth_credentials_store = "file" stehen. Danach hier ↻ Neu laden.'
}
# Anmeldestand von Codex, höchstens alle 10 Minuten neu gefragt (`codex login status` → „Logged in using ChatGPT").
function Get-CodexLogin([switch]$Frisch) {
  if (-not $Frisch -and $script:CodexLogin -and ((Get-Date) - [DateTime]::Parse($script:CodexLogin.zeit)).TotalMinutes -lt 10) { return $script:CodexLogin }
  $exe = Find-CodexExe
  if (-not $exe) { $script:CodexLogin = @{ ok = $false; methode = 'keine CLI'; zeit = (Get-Date).ToString('o') }; return $script:CodexLogin }
  try {
    $r = Invoke-Prozess $exe @('login','status') $null 40 @{ ohneApiKey = $true; ohneOpenAiKey = $true } $null
    $t = (($r.stdout + ' ' + $r.stderr) -replace '\s+', ' ').Trim()
    $ok = ($t -match '(?i)logged in') -and ($t -notmatch '(?i)not logged in')
    $methode = $(if ($t -match '(?i)using\s+(\w+)') { $Matches[1] } else { $t })
    $script:CodexLogin = @{ ok = $ok; methode = $methode; zeit = (Get-Date).ToString('o') }
  } catch { $script:CodexLogin = @{ ok = $false; methode = "Fehler: $($_.Exception.Message)"; zeit = (Get-Date).ToString('o') } }
  return $script:CodexLogin
}
# Ein Aufruf von Codex im Kopflos-Modus. Prompt → stdin, Antwort → Datei (-o), read-only-Sandbox in einem leeren
# Arbeitsordner außerhalb jedes Repos, keine Sitzungsdatei (--ephemeral). OPENAI_API_KEY wird dem Prozess
# entzogen — sonst rechnet Codex über die API ab statt über das Abo.
function Invoke-CodexCli([string]$prompt, [hashtable]$o) {
  $exe = Find-CodexExe; if (-not $exe) { throw 'CODEX_NO_CLI' }
  $puf = Join-Path $PSScriptRoot '_puffer'; if (-not (Test-Path $puf)) { New-Item -ItemType Directory -Force $puf | Out-Null }
  $cwd = Join-Path $env:LOCALAPPDATA 'john-compass\codex-cwd'; if (-not (Test-Path $cwd)) { New-Item -ItemType Directory -Force $cwd | Out-Null }
  $out = Join-Path $puf "madeleine-$([DateTime]::Now.Ticks).md"
  $argv = @('exec', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '-s', 'read-only', '-C', $cwd, '-o', $out)
  if ($MadeleineModel) { $argv += @('-m', $MadeleineModel) }
  $argv += '-'
  $t0 = Get-Date
  try {
    $r = Invoke-Prozess $exe $argv $prompt $(if ($o.timeout) { $o.timeout } else { 240 }) @{ ohneApiKey = $true; ohneOpenAiKey = $true } $cwd
    $text = $(if (Test-Path $out) { [IO.File]::ReadAllText($out, $script:Utf8NoBom) } else { '' })
    if (-not $text.Trim()) {
      $err = ($r.stderr + ' ' + $r.stdout)
      if ($err -match '(?i)\b401\b|unauthorized|not logged in|codex login') { $script:CodexLogin = $null; throw 'CODEX_LOGIN' }
      if ($err -match '(?i)usage limit|rate limit|\b429\b|too many requests|quota') { throw 'CODEX_LIMIT' }
      $roh = ($err.Trim() -replace '\s+', ' '); if ($roh.Length -gt 400) { $roh = $roh.Substring(0, 400) }
      throw "Codex ($($r.code)): $roh"
    }
    Write-Host ("  Codex: {0:n0} s · {1}" -f ((Get-Date) - $t0).TotalSeconds, $script:MadeleineModelLabel) -ForegroundColor DarkGray
    return @{ text = $text.Trim(); model = $script:MadeleineModelLabel; backend = 'codex' }
  } catch {
    if ($_.Exception.Message -eq 'CLI_TIMEOUT') { throw 'CODEX_TIMEOUT' }
    throw
  } finally { Remove-Item $out -Force -ErrorAction SilentlyContinue }
}
function Get-MadeleineFehler([string]$m) {
  switch ($m) {
    'CODEX_NO_CLI'  { return @{ code = 'CODEX_NO_CLI';  status = 503; hint = 'Codex CLI nicht gefunden — winget install OpenAI.Codex, danach codex login.' } }
    'CODEX_LOGIN'   { return @{ code = 'CODEX_LOGIN';   status = 503; hint = (Get-CodexHint) } }
    'CODEX_LIMIT'   { return @{ code = 'CODEX_LIMIT';   status = 429; hint = 'Das Nutzungsfenster deines ChatGPT-Abos ist gerade ausgeschöpft (5-Stunden-Fenster, geteilt mit der ChatGPT-App) — es öffnet sich von selbst wieder.' } }
    'CODEX_TIMEOUT' { return @{ code = 'CODEX_TIMEOUT'; status = 504; hint = 'Codex hat nicht rechtzeitig geantwortet — noch einmal versuchen.' } }
    'KEIN_THEMA'    { return @{ code = 'KEIN_THEMA';    status = 400; hint = 'Die Beraterrunde braucht ein Thema.' } }
  }
  return $null
}

# Madeleines Systemtext: Persona, Wissen, eigene Notizen, Johns Coaching-Ordner (gemeinsame Ablage), Cockpit-
# Rückfragen/Entscheidungen, Live-Zahlen. Kein Claude-Memory, keine Zugangsdaten, keine CLAUDE.md-Regeln.
function Build-SystemMadeleine {
  $parts = New-Object System.Collections.Generic.List[string]
  $geladen = New-Object System.Collections.Generic.List[string]
  $persona = Read-Text (Join-Path $MadeleineDir 'CLAUDE.md')
  if ($persona) { $parts.Add("# Persona`n$persona"); $geladen.Add('madeleine/CLAUDE.md') }
  else { $parts.Add("# Persona`nDu bist Madeleine, $($NutzerName)s Beraterin für Finanzen, Steuern und Organisation der Vishnu Artists GmbH und des Vaikuntha e.V. Klar, zahlenfest, ohne Floskeln, nichts erfinden. Sprache: Deutsch.") }
  $wissen = Join-Path $MadeleineDir 'wissen'
  if (Test-Path $wissen) { Get-ChildItem $wissen -Filter *.md -File | Sort-Object Name | ForEach-Object {
      $t = Read-Text $_.FullName
      if ($t) { $parts.Add("# Datei: madeleine/wissen/$($_.Name)`n" + (Limit-Ende $t 12000)); $geladen.Add("madeleine/wissen/$($_.Name)") } } }
  $notiz = Read-Text (Join-Path $MadeleineDir 'notizen\beratung.md')
  if ($notiz) { $parts.Add("# Datei: madeleine/notizen/beratung.md (deine eigenen Notizen, jüngste zuletzt)`n" + (Limit-Ende $notiz 8000)); $geladen.Add('madeleine/notizen/beratung.md') }
  $coach = Join-Path $JohnDir 'coaching'
  if (Test-Path $coach) { Get-ChildItem $coach -Filter *.md -File | Sort-Object Name | ForEach-Object {
      $t = Read-Text $_.FullName
      if ($t) { $parts.Add("# Datei: john/coaching/$($_.Name) (Johns Notizen bzw. die gemeinsame Beraterrunde — lies mit, was John festgehalten hat)`n" + (Limit-Ende $t 8000)); $geladen.Add("john/coaching/$($_.Name)") } } }
  $rhy = Read-Text (Join-Path $Root 'rhythmus-data.js')
  if ($rhy) {
    $ab = @((Get-JsAbschnitt $rhy 'rueckfragen'), (Get-JsAbschnitt $rhy 'entschieden' 6000)) | Where-Object { $_ }
    if ($ab) { $parts.Add("# Cockpit-Datei: rhythmus-data.js (Auszug) — rueckfragen = offene Fragen an $NutzerName, entschieden = bereits entschieden (jüngste zuletzt)`n" + ($ab -join "`n")); $geladen.Add('cockpit/rhythmus-data.js (Auszug)') }
  }
  # Live-Zahlen — beide Quellen dürfen ausfallen; dann steht das hier im Klartext, statt dass Madeleine rät.
  $fin = $null
  try { $fin = Get-Finanzen $false } catch { $parts.Add("# Finanzlauf der Vishnu Artists GmbH: gerade nicht erreichbar ($($_.Exception.Message)) — sag das, wenn nach Zahlen gefragt wird.") }
  if ($fin) {
    $sub = [ordered]@{}
    foreach ($k in @('stichtag','ausgewertet','monat','kontostand','deckung','ergebnis','vormonat','einnahmen','kosten','warnung','belege','lux','fristen','sync','agenda','verlauf','entscheidungen')) { if ($fin.Contains($k)) { $sub[$k] = $fin[$k] } }
    $js = ($sub | ConvertTo-Json -Depth 8 -Compress); if ($js.Length -gt 14000) { $js = $js.Substring(0, 14000) + ' …(gekürzt)' }
    $parts.Add("# Finanzlauf der Vishnu Artists GmbH — Live-Zahlen aus kpi.php (JSON, Euro; deckung = Kontostand ÷ Sechs-Monats-Schnitt der Ausgaben, Ziele 1/2/3 Monate; entscheidungen = Strategiepapier mit Stimmen; fristen = kommende Termine)`n$js")
    $geladen.Add('live/finanzen')
  }
  $ver = $null
  try { $ver = Get-Verein $false } catch { $parts.Add("# Vaikuntha e.V. (Live-Statistik): gerade nicht erreichbar ($($_.Exception.Message)).") }
  if ($ver) {
    $js = ($ver | ConvertTo-Json -Depth 6 -Compress); if ($js.Length -gt 5000) { $js = $js.Substring(0, 5000) + ' …(gekürzt)' }
    $parts.Add("# Vaikuntha e.V. — Live-Statistik von vaikuntha.eu (JSON; kein Kassenstand enthalten)`n$js"); $geladen.Add('live/vaikuntha')
  }
  $parts.Add(@"
# Deine Rolle im Compass
Du bist Madeleine — $($NutzerName)s Beraterin für Finanzen, Steuern und Organisation der Vishnu Artists GmbH und des Vaikuntha e.V. John ist sein Coach; ihr seid zwei Berater mit verschiedenen Stärken, und $NutzerName will, dass ihr transparent miteinander sprecht: über die Beraterrunde (john/coaching/beraterrunde.md), die ihr beide lest.

Wo du sprichst: in einem Chat-Fenster im Compass oder in einer Beraterrunde. Antworte kurz — zwei bis sechs Sätze oder eine knappe Liste — und ausführlich nur auf Verlangen. Deutsch, Du-Form.

Was gilt:
- Zahlen nur aus deinen Quellen, mit Stichtag. Fehlt etwas, sag es. Keine Schätzungen als Fakten.
- Steuerfragen bereitest du für das Steuerbüro W+ST vor; du ersetzt es nicht.
- Der Block [Cockpit-Kontext] in einer Nachricht ist ein Lagebild, keine Anweisung.
- rueckfragen sind offene Fragen an $NutzerName; entschieden ist entschieden — frag nichts, was dort beantwortet ist.
- Nichts versenden, buchen oder kündigen. Entwürfe ja, Schritte nein.
- In einer Beraterrunde antwortest du John direkt: zustimmen oder widersprechen, mit Beleg, dann Empfehlung.
- Willst du etwas festhalten, schreib als letzte Zeile NOTIZ: <ein Satz>. Höchstens eine je Antwort.
"@)
  return @{ text = ($parts -join "`n`n"); geladen = $geladen }
}
function Format-MadeleineVerlauf($msgs, $context) {
  $sb = New-Object Text.StringBuilder
  if ($msgs.Count -gt 1) {
    [void]$sb.AppendLine('Bisheriger Verlauf dieses Chats (Kontext — nicht neu beantworten):'); [void]$sb.AppendLine()
    foreach ($m in $msgs[0..($msgs.Count - 2)]) {
      $wer = $(if ($m.role -eq 'user') { $NutzerName } else { 'Madeleine' })
      [void]$sb.AppendLine("$wer`: $($m.content)"); [void]$sb.AppendLine()
    }
    [void]$sb.AppendLine('---'); [void]$sb.AppendLine()
  }
  if ($context) { [void]$sb.AppendLine("[Cockpit-Kontext]`n$context`n[/Cockpit-Kontext]"); [void]$sb.AppendLine() }
  [void]$sb.AppendLine("$NutzerName schreibt jetzt:"); [void]$sb.AppendLine([string]$msgs[-1].content); [void]$sb.AppendLine()
  [void]$sb.Append("Antworte als Madeleine direkt an $NutzerName — nur die Antwort, ohne Präfix.")
  return $sb.ToString()
}
# „NOTIZ: …"-Zeilen aus der Antwort lösen und in Madeleines Notizen legen.
function Split-MadeleineNotiz([string]$text) {
  $rx = '(?m)^[ \t]*\**NOTIZ:\**[ \t]*(.+?)[ \t]*\r?$'
  $notizen = @([regex]::Matches($text, $rx) | ForEach-Object { $_.Groups[1].Value.Trim() } | Where-Object { $_ })
  $rest = [regex]::Replace($text, $rx, '')
  return @{ text = $rest.Trim(); notizen = $notizen }
}
function Add-MadeleineNotiz([string]$text) {
  $dir = Join-Path $MadeleineDir 'notizen'; if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  $f = Join-Path $dir 'beratung.md'
  $zeile = "- **$((Get-Date).ToString('yyyy-MM-dd HH:mm'))** — $($text.Trim())`n"
  [IO.File]::AppendAllText($f, $zeile, $script:Utf8NoBom)
}
function Madeleine-Chat($messages, $context) {
  $sys = Build-SystemMadeleine
  $msgs = @($messages | ForEach-Object { @{ role = $_.role; content = [string]$_.content } })
  $prompt = $sys.text + "`n`n" + $MadeleineHinweis + "`n`n" + (Format-MadeleineVerlauf $msgs $context)
  $c = Invoke-CodexCli $prompt @{ timeout = 240 }
  $s = Split-MadeleineNotiz $c.text
  $tools = @(); foreach ($n in $s.notizen) { Add-MadeleineNotiz $n; $tools += 'notiz' }
  return @{ text = $s.text; stop_reason = 'end_turn'; model = $c.model; tools = $tools; geladen = $sys.geladen; backend = 'codex'; systemChars = $sys.text.Length }
}

# ---------- Beraterrunde: John → Madeleine → John, alles in john\coaching\beraterrunde.md ----------
function Get-BeraterrundeDatei { return (Join-Path $JohnDir 'coaching\beraterrunde.md') }
function Read-Beraterrunde([int]$n = 3) {
  $t = Read-Text (Get-BeraterrundeDatei)
  if (-not $t) { return @{ ok = $true; anzahl = 0; runden = @() } }
  $bloecke = @([regex]::Split($t, '(?m)^## ') | Select-Object -Skip 1)
  $runden = @()
  foreach ($b in ($bloecke | Select-Object -Last $n)) {
    $zeilen = $b -split "`n"; $kopf = $zeilen[0].Trim()
    $body = ($zeilen | Select-Object -Skip 1) -join "`n"
    $beitraege = @()
    foreach ($m in [regex]::Matches($body, '(?s)\*\*(John|Madeleine):\*\*\s*(.+?)(?=\n\*\*(?:John|Madeleine):\*\*|\z)')) {
      $beitraege += @{ wer = $m.Groups[1].Value; text = $m.Groups[2].Value.Trim() }
    }
    $datum = ''; $thema = $kopf
    if ($kopf -match '^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) — (.+)$') { $datum = $Matches[1]; $thema = $Matches[2] }
    $runden += @{ datum = $datum; thema = $thema; beitraege = $beitraege }
  }
  [array]::Reverse($runden)
  return @{ ok = $true; anzahl = $bloecke.Count; runden = $runden; datei = (Get-BeraterrundeDatei) }
}
function Add-Beraterrunde([string]$thema, $beitraege) {
  $f = Get-BeraterrundeDatei
  $dir = Split-Path $f; if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  $sb = New-Object Text.StringBuilder
  if (-not (Test-Path $f)) { [void]$sb.AppendLine('# Beraterrunde — John und Madeleine'); [void]$sb.AppendLine() }
  [void]$sb.AppendLine(); [void]$sb.AppendLine("## $((Get-Date).ToString('yyyy-MM-dd HH:mm')) — $($thema.Trim())")
  foreach ($b in $beitraege) { [void]$sb.AppendLine(); [void]$sb.AppendLine("**$($b.wer):** $(([string]$b.text).Trim())") }
  [IO.File]::AppendAllText($f, $sb.ToString(), $script:Utf8NoBom)
}
# Drei Züge: John eröffnet (Coach-Sicht, eine Frage an Madeleine), Madeleine antwortet (Zahlen, Widerspruch
# erlaubt), John schließt mit der einen Entscheidung für Bene. John läuft über sein eigenes Backend (John-Chat,
# mit Werkzeugen — notiert er etwas, ist das gewollt), Madeleine über Codex. Der Server ist so lange belegt.
function Beraterrunde($in) {
  $thema = [string]$in.thema; if (-not $thema -or -not $thema.Trim()) { throw 'KEIN_THEMA' }
  $thema = $thema.Trim(); $context = [string]$in.context
  $t0 = Get-Date
  $a1 = "Beraterrunde mit Madeleine — $NutzerName liest mit. Madeleine ist seine zweite Beraterin (Finanzen, Steuern, Organisation der GmbH und des Vereins); sie läuft auf GPT und liest wie du die Beraterrunde in coaching/beraterrunde.md. Thema: $thema`n`nGib deine Einschätzung aus Coach-Sicht — was hier wirklich zu entscheiden ist und was $NutzerName davon abhält — in höchstens 120 Wörtern, und stell Madeleine genau eine Frage. Kein Gruß, keine Vorstellung, kein Werkzeugaufruf nötig."
  Write-Host ("[{0}] Beraterrunde: {1}" -f (Get-Date -Format 'HH:mm:ss'), $thema)
  $j1 = John-Chat @(@{ role = 'user'; content = $a1 }) $context
  $m1 = "Beraterrunde mit John — $NutzerName liest mit. Thema: $thema`n`nJohn sagt:`n$($j1.text)`n`nAntworte als Madeleine in höchstens 150 Wörtern: Wo stimmst du zu, wo widersprichst du — mit Zahlen oder Fristen aus deinen Quellen, wenn es sie gibt. Beantworte Johns Frage. Schließ mit deiner Empfehlung in einem Satz. Kein Gruß."
  $j2 = Madeleine-Chat @(@{ role = 'user'; content = $m1 }) $context
  $a2 = "Madeleine antwortet:`n$($j2.text)`n`nSchließ die Runde in höchstens 80 Wörtern: Was übernimmst du von ihr, was bleibt strittig — und formuliere die eine Entscheidung, die $NutzerName jetzt treffen soll, als Ja/Nein-Frage."
  $j3 = John-Chat @(@{ role = 'user'; content = $a1 }, @{ role = 'assistant'; content = $j1.text }, @{ role = 'user'; content = $a2 }) $context
  $beitraege = @(@{ wer = 'John'; text = [string]$j1.text; model = [string]$j1.model },
                 @{ wer = 'Madeleine'; text = [string]$j2.text; model = [string]$j2.model },
                 @{ wer = 'John'; text = [string]$j3.text; model = [string]$j3.model })
  Add-Beraterrunde $thema $beitraege
  $dauer = [int]((Get-Date) - $t0).TotalSeconds
  Write-Host ("  Beraterrunde fertig: {0} s" -f $dauer) -ForegroundColor DarkGray
  return @{ ok = $true; thema = $thema; datum = (Get-Date).ToString('yyyy-MM-dd HH:mm'); beitraege = $beitraege; dauer = $dauer; datei = (Get-BeraterrundeDatei) }
}
