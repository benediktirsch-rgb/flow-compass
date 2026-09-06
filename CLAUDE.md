# Flow Compass — Regeln für Sessions in diesem Repo

Dieses Repo ist der **Produktcode** des Flow Compass (persönliches Kanban-Cockpit, Flight Level 1).
Seit dem 02.09.2026 getrennt vom Team-Cockpit (Repo `flow-cockpit`) und von der Website
(`vishnuartists-website-redesign`, Ordner `vishnu-artists.de/`). Persönliche Arbeitsnotizen des
Betreibers liegen in `CLAUDE.local.md` (nicht im Repo).

## Was wo liegt
- `dashboard.html` — der Compass. Eine Datei: Oberfläche, Rituale (Morgencheck, Abendcheck,
  Wochenstart, Rückschau, Rückfragen), Mein Board (Personal Kanban), Kennzahlen-Blüten, Kalender,
  Postfach, Slack, Wächter, John. Sichtbarer Text entsteht fast überall zur Laufzeit aus JS.
- `compass-i18n.js` — Sprach-Overlay (Deutsch/English/العربية) auf dem gerenderten Text; Schlüssel ist
  der deutsche Quelltext. Jeder Teil einer zusammengesetzten Zeile muss auflösbar sein, sonst bleibt
  die Zeile deutsch. `compass-edit.js` — Bearbeiten im Browser.
- `compass-focus.js` — Focus View (seit 06.09.2026): zweites, schlankes Frontend für Leute, die keine
  Analytics-Menschen sind. Kopf und Checkin-Leiste bleiben, darunter drei lernende Einstiegskacheln
  (Klicks mit 14 Tagen Halbwertszeit, Hysterese, 📌 anheften) und eine Bühne für genau eine Karte.
  Umschalter „◎ Einfach / ▦ Alles“, Taste S (E gehört dem Editier-Modus), `?ansicht=focus|voll`,
  `?go=<kachel>`; neue Nutzer ohne Verlauf starten dort. Zustand lokal unter `compassFocus`.
- `john-server.ps1` (Port 8787) — liefert den Compass aus und bündelt alle Quellen unter `/api/…`:
  Kalender (ICS, Serientermine, Titel-Wörterbuch für Frei/Gebucht-Feeds), Jira, Trello, Postfach
  (`postfach.json`), Slack (`slack.json`), Seiten-Wächter, Sicherungen, Routinen, Wetter, Vereins-Puls,
  Checkins (`checkins/`), Rückfragen-Gedächtnis (`antworten.json`), Vorlieben, John (Claude API).
  Der Server arbeitet **seriell** (`GetContext()` in einer Schleife): jede Quelle braucht Timeouts
  und Cache, sonst blockiert eine tote Quelle das ganze Cockpit.
- `john-board.ps1` — Morgen-/Abendboard nach jedem Checkin (`boards/`, lokal), ein Claude-Aufruf für
  die erzählenden Teile; jede Quelle darf ausfallen, das Board sagt es im Fuß.
- `john-server-aufgabe.ps1` — geplante Aufgabe „John Server“ (bei Anmeldung + alle 5 Min,
  `MultipleInstances=IgnoreNew`, kein Zeitlimit, nur interaktiv).
- `build-compass.ps1` → `site/compass/` (eigene Instanz, lokal, per FTPS hochgeladen);
  `build-compass-produkt.ps1` → `site/compass-demo/` (Demo, im Repo, per Workflow live) oder
  `-Instanz "<Kunde>"` → `instanzen/<slug>/` (gitignored). **Der Produkt-Build bricht ab**, wenn ein
  Anker in `dashboard.html` fehlt oder die Wortprüfung Persönliches in einer Ausgabedatei findet —
  Anker nachziehen, nie die Prüfung entschärfen. `publish-compass.ps1` = geplante Aufgabe
  „Vishnu Flow Compass publish“ (alle 30 Min): baut beides, lädt die eigene Instanz hoch,
  committet und pusht die Demo.
- `produkt/compass/` — Produktschicht (Instanz-Konfiguration `instanz.example.js`, Einrichtungs-
  Assistent, Karte „Verbundene Werkzeuge“, eigene Kennzahlenseite). `docs/` — Onboarding-Kette,
  Compass ⇄ Cockpit, Git-Regeln.

## Nicht verhandelbar
1. **Nichts Persönliches ins Repo.** Datenschicht (`*-data.js`, Initiative), `checkins/`, `boards/`,
   `anfragen/`, `site/compass/`, `instanzen/`, Zugangsdaten stehen in `.gitignore` und bleiben dort.
   Nie Namen, Adressen, Betreffzeilen oder Kanalnamen in eine `*-data.js` oder in `site/compass-demo/`.
2. **Schlüssel nur als User-Umgebungsvariablen** (`ANTHROPIC_API_KEY`, `GCAL_ICS`, `TRELLO_*`,
   `JIRA_*`, `VA_BASIC`, `VAIKUNTHA_TOKEN`, `VA_FTP_*`), nie in Dateien. Der Server liest sie live.
3. **Encoding:** `.ps1` UTF-8 **mit** BOM (PowerShell 5.1), alles andere UTF-8 ohne BOM, LF.
   Getrackte Dateien nie mit `Set-Content`/`Out-File` schreiben, nur `[IO.File]::WriteAllText` mit
   `UTF8Encoding($false)`; `Get-Content -Raw` immer mit `-Encoding UTF8`.
4. **Git nur Porcelain:** `pull --ff-only` → `add <datei>` → `commit` → `push`; kein `add -A`, kein
   Plumbing, kein `push --force`. Vor jedem Commit `git status --short` lesen. Hook
   `.githooks/pre-commit` (aktiv über `core.hooksPath`) blockt Löschungen, Zugangsdaten, CRLF/BOM.
   Parallele Sessions melden sich mit `C:\dev\_tools\git-flow.ps1 -Modus claim` an.
5. **Keine erfundenen Kacheln:** jede Kennzahl kommt aus einer echten Quelle oder wird gar nicht
   gezeigt. Fehlt eine Quelle, sagt die Karte das im Klartext („nicht angebunden“ ≠ „Server aus“).
6. **Prüfen vor dem Melden:** `Parser::ParseFile` über jede geänderte `.ps1`, `node --check` bzw.
   `new Function(src)` über den Inline-Skriptblock von `dashboard.html`, Endpunkte am laufenden
   Server (Neustart nötig, der Server lädt Code nur beim Start), Karte im Browser gegenlesen.

## Begriffe und Ton
Du-Form, deutsche Anführungszeichen „…“, Begriffe: Morgencheck, Abendcheck, das Eine, Mein Board,
Rückfragen, Wochenstart, Wochen-Rückschau. Compass = Flight Level 1, Cockpit = Flight Level 1–3;
beide verlinken sich (`?cockpit=<URL>` hier, `?compass=<URL>` dort).
