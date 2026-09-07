# Compass-Server

Der Compass-Server läuft auf **deinem** Rechner und bringt den Compass mit deiner KI und deinen
Quellen zusammen — Coach, Stapel, Trello, Jira. Die KI läuft auf **deinem** Konto, nie auf dem
des Anbieters. Nichts verlässt den Rechner außer den Aufrufen an deine KI und an Trello/Jira,
die du selbst angebunden hast.

## Start in drei Schritten

1. Ordner entpacken (z. B. nach `Dokumente\compass-server`).
2. `compass-server.json` öffnen und bei `"name"` deinen Vornamen eintragen.
3. `start-compass-server.cmd` doppelklicken. Ein Fenster geht auf und bleibt offen; der Browser
   zeigt die Statusseite unter http://localhost:8787.

Dann im Compass unter **⚙️ Einrichtung → Dein Coach** den Weg wählen; die Server-Adresse
steht auf `http://localhost:8787`. Der Coach meldet sich, sobald der Compass den Server erreicht.

Voraussetzung: Windows 10/11 mit PowerShell 5.1 (ist an Bord). Nichts weiter zu installieren —
außer Claude Code, wenn du den ersten Weg gehst.

## Drei Wege zur KI — und ein vierter

| Weg | Was du brauchst | Kosten |
|---|---|---|
| **Claude-Abo** (empfohlen) | Claude Code auf diesem Rechner, einmal angemeldet | dein Abo (Pro oder Max), kein Guthaben |
| **API-Schlüssel** | einen Schlüssel aus der Anthropic-Konsole | nach Verbrauch, über dein Konto |
| **Ohne KI** | nichts | keine |
| **Anderer Anbieter** | einen OpenAI-kompatiblen Endpunkt (ChatGPT, Mistral, Groq, lokales Ollama …) | bei deinem Anbieter |

Der Server wählt den Weg selbst (`"backend": "auto"`): Claude Code, wenn es da ist; sonst der
Anthropic-Schlüssel, wenn er gesetzt ist; sonst der andere Anbieter, wenn `JOHN_KI_KEY` gesetzt
ist; sonst ohne KI. Fest einstellen: `"backend": "cli"`, `"api"`, `"anbieter"` oder `"ohne"` in
`compass-server.json` — oder ohne Neustart über die Benutzer-Umgebungsvariable `COMPASS_BACKEND`.

### Weg 1 — Claude-Abo über Claude Code

Claude Code ist die Kommandozeile von Claude. Der Server ruft sie je Anfrage im Hintergrund auf
(„Kopflos-Modus“); abgerechnet wird über dein Abo.

1. Falls Claude Code noch nicht da ist, in PowerShell:
   ```
   irm https://claude.ai/install.ps1 | iex
   ```
   Hast du die Claude-Desktop-App, findet der Server deren Claude Code von selbst.
2. Einmalig anmelden — öffnet den Browser, Anmeldung mit deinem Claude-Konto:
   ```
   claude auth login
   ```
   Prüfen: `claude auth status` (muss `loggedIn: true` zeigen).
3. Server starten. Auf der Statusseite steht dann „Claude Code (Abo) — angemeldet als …“.

Ein vorhandener `ANTHROPIC_API_KEY` wird diesem Aufruf bewusst **nicht** mitgegeben — sonst
würde Claude Code doch über die API abrechnen. Ist das Nutzungsfenster deines Abos ausgeschöpft,
sagt der Compass das (LIMIT) und arbeitet bis dahin aus den Dateien.

Liegt die claude.exe an einem ungewöhnlichen Ort: Benutzer-Umgebungsvariable `COMPASS_CLAUDE_EXE`
auf den vollen Pfad setzen.

### Weg 2 — eigener API-Schlüssel

1. Schlüssel in der Anthropic-Konsole erzeugen (console.anthropic.com → API Keys) und Guthaben
   hinterlegen.
2. Als Benutzer-Umgebungsvariable setzen (PowerShell, einmalig, wirkt ohne Neustart des Servers):
   ```
   [Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', 'sk-ant-…', 'User')
   ```
   Alternativ die Datei `api-key.txt` neben `compass-server.ps1` anlegen — eine Zeile, nur der
   Schlüssel. Diese Datei nie weitergeben und nie in einen synchronisierten Ordner legen.
3. `"backend": "api"` in `compass-server.json` (oder `auto` lassen, wenn kein Claude Code da ist).

Ist das Guthaben aufgebraucht, meldet der Compass NO_CREDIT — aufladen unter Plans & Billing,
der Server läuft weiter.

### Weg 3 — ohne KI

`"backend": "ohne"`. Board, Rituale, Kennzahlen und Rückfragen laufen wie gewohnt; der Stapel ist
eine einfache Liste. Trello und Jira funktionieren trotzdem. Den Coach klemmst du später an,
indem du das Backend umstellst.

### Weg 4 — anderer KI-Anbieter (OpenAI-kompatibel)

Jeder Endpunkt, der die OpenAI-Schnittstelle spricht (`/chat/completions`): OpenAI selbst, Mistral,
Groq, ein lokales Ollama. Drei Benutzer-Umgebungsvariablen, wirken ohne Neustart:

```
[Environment]::SetEnvironmentVariable('JOHN_KI_KEY',   '<schlüssel>',                 'User')
[Environment]::SetEnvironmentVariable('JOHN_KI_URL',   'https://api.openai.com/v1',   'User')
[Environment]::SetEnvironmentVariable('JOHN_KI_MODEL', 'gpt-4.1',                     'User')
```

Adresse und Modell dürfen auch unter `"anbieter"` in `compass-server.json` stehen; der Schlüssel
nie. Ollama: Adresse `http://localhost:11434/v1`, Schlüssel beliebig (z. B. `ollama`). Die
Werkzeuge des Coachs (Notiz, Aufgabe) brauchen ein Modell mit Funktionsaufrufen; kleine lokale
Modelle liefern sie manchmal nicht — der Chat läuft dann trotzdem, nur ohne Notizen.

## Was der Coach weiß — der Ordner `daten\`

Beim ersten Start legt der Server `daten\` neben dem Skript an:

| Datei | Was sie ist |
|---|---|
| `persona.md` | wie der Coach spricht und was er über dich wissen soll. `{{name}}` wird durch deinen Namen ersetzt. |
| `TASKS.md` | deine offenen Aufgaben. `(bis 2026-09-30)` macht eine Aufgabe für den Stapel sichtbar. |
| `pipeline.md` | optional: eine Markdown-Tabelle mit Vorgängen und einer Datumsspalte — Fälligkeiten landen im Stapel. |
| weitere `*.md` | alles, was der Coach kennen soll: Profil, Ziele, Projekte. Jede Datei hier liest er bei jeder Anfrage. |
| `coaching\notizen.md` | seine eigenen Notizen (schreibt er, wenn du etwas entscheidest). |
| `stapel.json` | Stand des Stapels (schreibt der Server). |
| `auftraege\` | Aufträge, die du aus dem Stapel an deine KI-Session gibst. |

Die Dateien sind klein und bleiben klein — was der Coach je Anfrage mitbekommt, siehst du auf der
Statusseite („Der Coach kennt …“).

## Trello anbinden (optional)

1. In `compass-server.json` unter `trello` je Board den Kurzlink eintragen — die acht Zeichen
   aus der Board-Adresse `https://trello.com/b/<kurzlink>/…` (die ganze Adresse geht auch).
   Die Schlüssel `privat` und `arbeit` erwartet der Compass; weitere sind möglich.
2. API-Key holen: https://trello.com/power-ups/admin → Power-Up anlegen → API-Schlüssel.
3. Token mit Schreibrecht holen (Board verschieben/anlegen/erledigen), im Browser mit dem
   Trello-Konto des Boards:
   `https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=Flow-Compass&key=<KEY>`
4. Beides als Benutzer-Umgebungsvariablen setzen — Name des Boards in Großbuchstaben:
   ```
   [Environment]::SetEnvironmentVariable('TRELLO_PRIVAT_KEY',   '<key>',   'User')
   [Environment]::SetEnvironmentVariable('TRELLO_PRIVAT_TOKEN', '<token>', 'User')
   ```
   Wirkt ohne Neustart. Alternativ `trello-keys.json` neben dem Skript:
   `{ "privat": {"key":"…","token":"…"}, "arbeit": {…} }`.

## Jira anbinden (optional)

1. API-Token erzeugen: https://id.atlassian.com/manage-profile/security/api-tokens
2. Als Benutzer-Umgebungsvariablen: `JIRA_EMAIL` (deine Atlassian-Mail), `JIRA_TOKEN`,
   `JIRA_SITE` (z. B. `deine-firma.atlassian.net` — oder `jira.site` in `compass-server.json`).
   `jira.projekt` ist das Projektkürzel, in dem der Compass neue Vorgänge anlegt.
3. Alternativ `jira-keys.json` neben dem Skript: `{ "email":"…", "token":"…", "site":"…" }`.

## Was der Server kann — und was nicht

Er beantwortet genau das, was der Compass für Coach, Stapel, Trello und Jira braucht:

```
GET  /api/john/status          Stand der KI-Anbindung, geladene Dateien
POST /api/john                 Chat mit dem Coach
POST /api/john/summary         Zwei-Satz-Bilanz
GET/POST /api/john/stapel      der Stapel (Coach-Feld)
POST /api/john/stapel/stand    Punkt abgeräumt / Wiedervorlage
GET  /api/trello?board=…       Listen + Karten; POST /api/trello/move|card|done
GET  /api/jira/meine           offene Vorgänge; POST /api/jira/transition|issue; GET /api/kpi/jira
```

Alles andere, was ein Compass anfragen kann (Kalender, Postfach, Wächter, Checkins …), ist in
diesem Paket nicht enthalten; der Server antwortet dort mit `NICHT_IM_PAKET`, und der Compass
zeigt das an, statt etwas zu erfinden.

Der Coach hat zwei Werkzeuge: eine Notiz in `daten\coaching\notizen.md` schreiben und eine
Aufgabe in `daten\TASKS.md` anlegen. Keine Shell, keine anderen Dateien, kein Netz.

## Wenn etwas nicht geht

| Meldung im Compass | Ursache | Abhilfe |
|---|---|---|
| Der Coach ist offline | Server läuft nicht | `start-compass-server.cmd` starten; Adresse in ⚙️ prüfen |
| Claude Code ist nicht angemeldet | Weg 1, Anmeldung fehlt | `claude auth login` im Terminal, dann ↻ Neu laden |
| Keine Claude-Code-CLI gefunden | Weg 1, nicht installiert | `irm https://claude.ai/install.ps1 \| iex` oder `COMPASS_CLAUDE_EXE` setzen |
| ANTHROPIC_API_KEY setzen … | Weg 2, Schlüssel fehlt | Variable setzen, Server neu starten |
| NO_CREDIT | Guthaben leer | in der Anthropic-Konsole aufladen |
| LIMIT | Abo-Fenster ausgeschöpft | warten, öffnet sich von selbst |
| kein Trello-Schlüssel | Variablen fehlen | `TRELLO_<BOARD>_KEY/_TOKEN` setzen |
| Trello-Token darf nur lesen | Token ohne Schreibrecht | Token mit `scope=read,write` neu erzeugen |

Port belegt? `"port"` in `compass-server.json` ändern und dieselbe Adresse im Compass eintragen.

Der Server arbeitet seriell: eine Anfrage nach der anderen. Eine lange Coach-Antwort lässt
andere Anfragen kurz warten — das ist so gewollt und hält den Server einfach.

## Aktualisieren

Neue Fassung entpacken, den Ordner `daten\` und `compass-server.json` aus der alten Fassung
übernehmen. Zugangsdaten liegen ohnehin in Umgebungsvariablen.

## Was nicht weitergegeben werden darf

`api-key.txt`, `trello-keys.json`, `jira-keys.json` und der Ordner `daten\` gehören nur dir.
Der Ordner `_puffer\` enthält kurzlebige Arbeitsdateien des Servers und kann jederzeit gelöscht werden.
