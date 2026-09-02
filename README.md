# Flow Compass

Persönliches Kanban-Cockpit für **eine** Person (Flight Level 1): das Eine des Tages, Morgen- und
Abendcheck, Mein Board (Personal Kanban), Kennzahlen mit Zielband, Kalender, Postfach- und
Slack-Rückstand, Rückfragen, ein Coach („John“) und nach jedem Checkin ein Morgen- bzw.
Abendboard. Verkauft wird eine **eingerichtete Instanz inkl. Coaching** — Preise, Kette und
Übergabe: [docs/compass-onboarding.md](docs/compass-onboarding.md).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `dashboard.html` | der Compass (eine Datei: Oberfläche, Rituale, Board, Kennzahlen) |
| `compass-edit.js`, `compass-i18n.js` | Bearbeiten im Browser · Oberfläche in Deutsch/English/العربية |
| `kennzahlen.html`, `kundenlage.html`, `fonts/`, `fonts.css` | Begleitseiten und Schriften |
| `john-server.ps1` | lokaler Server (Port 8787): liefert den Compass aus und bündelt die Quellen — Kalender (ICS), Jira, Trello, Postfach, Slack, Seiten-Wächter, Sicherungen, Routinen, Wetter, Checkins, Rückfragen, John (Claude API) |
| `john-board.ps1` | Morgen-/Abendboard nach jedem Checkin (`boards/`, lokal) |
| `john-server-aufgabe.ps1` | geplante Aufgabe „John Server“: hält den Server an |
| `build-compass.ps1` | baut die **eigene** Instanz nach `site/compass/` (lokal, nicht im Repo) |
| `build-compass-produkt.ps1` | baut die anonymisierte **Demo** (`site/compass-demo/`) oder mit `-Instanz "<Kunde>"` eine Kundeninstanz (`instanzen/<slug>/`, gitignored). Bricht ab, wenn ein Anker fehlt oder Persönliches in einer Ausgabedatei steht — nie die Prüfung entschärfen |
| `publish-compass.ps1` | geplante Aufgabe: baut beides, lädt die eigene Instanz per FTPS hoch, committet und pusht die Demo |
| `produkt/compass/` | Produktschicht: `instanz.example.js` (Vorlage), `compass-produkt.js/.css`, Einrichtungs-Assistent, Kennzahlenseite der Demo |
| `aufraeumen-refresh.ps1`, `sprint-rollover.ps1` | Jira-Helfer (Aufräum-Karte, Sprint-Anlage) |
| `docs/` | Onboarding-Kette, Compass ⇄ Cockpit, Git-Regeln |

**Nicht im Repo** (siehe `.gitignore`): die persönliche Datenschicht (`*-data.js`, Initiative),
`checkins/`, `boards/`, `anfragen/`, Zugangsdaten, `site/compass/` (eigene Instanz), `instanzen/`.

## Eigene Instanz starten

1. Datenschicht anlegen: `dashboard-data.js`, `kennzahlen-data.js`, `rhythmus-data.js`,
   `ki-trainer-data.js`, `aufraeumen-data.js`, `kundenlage-data.js` neben `dashboard.html` —
   Vorlage ist der Demo-Build (`site/compass-demo/*-data.js`) bzw. `produkt/compass/instanz.example.js`.
2. Schlüssel nur als User-Umgebungsvariablen: `ANTHROPIC_API_KEY` (John), `GCAL_ICS`
   (Kalender), `TRELLO_*`, `JIRA_EMAIL`/`JIRA_TOKEN`, optional `VAIKUNTHA_TOKEN`, `VA_BASIC`.
3. `john-server.cmd` starten → http://localhost:8787/dashboard.html. Dauerhaft:
   `john-server-aufgabe.ps1 -Register`.

## Demo und Kundeninstanzen

```
powershell -NoProfile -ExecutionPolicy Bypass -File build-compass-produkt.ps1                    # → site/compass-demo/
powershell -NoProfile -ExecutionPolicy Bypass -File build-compass-produkt.ps1 -Instanz "Muster GmbH"   # → instanzen/muster-gmbh/
```

`git push origin main` → `.github/workflows/deploy.yml` spielt `site/compass-demo/` nach
vishnu-artists.de/compass-demo/ (Secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`).
Die eigene Instanz lädt `publish-compass.ps1` per FTPS hoch (User-Umgebungsvariablen
`VA_FTP_HOST`, `VA_FTP_USER`, `VA_FTP_PASS`).

## Git-Regeln

Nur Porcelain (`pull --ff-only` → `add <datei>` → `commit` → `push`), kein `add -A`. Einmalig je Klon:

```
git config core.autocrlf false && git config core.hooksPath .githooks
```

Der Hook `.githooks/pre-commit` stoppt ungewollte Löschungen, Zugangsdaten und CRLF/BOM.
`.ps1` bleiben UTF-8 **mit** BOM (PowerShell 5.1), alles andere UTF-8 ohne BOM, LF.

Schwester-Repo: **flow-cockpit** (Team-Cockpit, Flight Level 1–3). Der Compass nimmt
`?cockpit=<URL>` und schaltet mit einer Taste auf das Team-Board um.
