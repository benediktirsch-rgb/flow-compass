# Git-Workflow für die Flow-Cockpit-Repos (Porsche `cs-carsales-flow-cockpit` + `analytics-dashboard`)

Stand 18.08.2026. Gilt für Menschen **und** Claude-Sessions. Kurzfassung ganz unten.

## Was passiert war (damit klar ist, warum die Regeln gelten)

Am 17./18.08. standen im Porsche-Repo staged Löschungen von Dateien, die niemand löschen wollte
(`okrmap.json`, `pihistory.json`, `miro-okr-sync.yml/.mjs`, `docs/okr-goals-import.md`), dazu
„Phantom“-Änderungen an `data/*.json`, und der Arbeitsbaum hielt Datenstände vom 14.08., während HEAD
auf dem 18.08. stand. Ein normaler `git add -A && git commit` hätte die Löschungen ins Remote gepusht.
Drei Ursachen, die sich verstärkt haben:

1. **Google Drive (DriveFS, Laufwerk H:) als Repo-Speicherort.** DriveFS liefert Git zeitweise falsche
   Dateigrößen/Zeitstempel (Index: 16384 Byte, Datei: 69673 Byte, `ino/dev=0`), hydriert Dateien
   verzögert und legt `desktop.ini` in jeden Ordner — **auch in `.git/refs/`**: dann bricht `git fetch`
   mit „bad object refs/desktop.ini … did not send all necessary objects“ ab (18.08.: 254 bzw. 100 Stück
   in `.git`). Git meldet außerdem Dateien als geändert, die byteidentisch sind — die „EOL-Phantome“ seit Juli.
2. **Zeilenenden/BOM.** `core.autocrlf=true` (global) gegen `.gitattributes` (`eol=lf`) plus PowerShell
   `Set-Content`/`Out-File` (UTF-8-BOM + CRLF) → CRLF/BOM in getrackten Dateien, ständige
   „CRLF will be replaced by LF“-Warnungen, Stashes voller Nicht-Änderungen.
3. **Der Workaround war das eigentliche Problem:** Um 1+2 zu umgehen, wurde per Plumbing committet
   (`git write-tree` mit Temp-Index → `git commit-tree -p origin/main` → `git rebase --quit` →
   `git update-ref refs/heads/main` → push). Damit **wandert HEAD, aber Index und Arbeitsbaum bleiben
   stehen**: neue Dateien fehlen im Index (→ „D“ + „??“ im Status), der Arbeitsbaum hält alte
   Datenstände (→ „Phantome“), das Reflog hat leere Meldungen. Jeder folgende normale Commit nimmt
   das alles mit.

## Regeln

### R1 — Arbeitskopie außerhalb von Google Drive
Kanonische Arbeitskopien: **`C:\dev\cs-carsales-flow-cockpit`** und **`C:\dev\analytics-dashboard`**
(Geschwisterordner — `build-starter.ps1` liest `../cs-carsales-flow-cockpit/cockpit.html`).
GitHub ist die Synchronisation, nicht Drive. Die Kopien unter `H:\Meine Ablage\…\claude-code\` sind
nur noch Lese-/Übergangsstand; wer dort committet, hält sich an R2–R6 (Hooks sind auch dort aktiv).

### R2 — Nur Porcelain, kein Plumbing
Erlaubt: `git pull --ff-only` (bei Stunden-Sync-Race: `git pull --rebase --autostash`),
`git add <datei …>`, `git commit`, `git push`.
**Verboten:** `write-tree`, `commit-tree`, `update-ref`, `rebase --quit` als „Commit ohne Checkout“,
`git add -A` / `git add .` in diesen Repos, `push --force`.

### R3 — Vor jedem Commit `git status --short` lesen
Erwartet: nur die eigenen Dateien als ` M`/`A `. Steht dort `D ` (staged Löschung) oder etwas
Fremdes → **nicht committen**, sondern `git reset -q` (Index = HEAD) und nur die eigenen Dateien
neu adden. Der Hook `.githooks/pre-commit` bricht bei Löschungen, generierten Daten, CRLF/BOM und
veraltetem Index ab (Übersteuern nur bewusst: `ALLOW_DELETE=1` / `ALLOW_DATA=1` / `ALLOW_EOL=1`).

### R4 — Generierte Daten nie lokal schreiben oder committen
`data/*.json` (Porsche) und `site/va/va-data.json` (VA) erzeugt der GitHub-Workflow (stündlich).
Lokal nur lesen. Wer den Sync repariert, committet das Skript, nicht die Daten (Ausnahme bewusst
mit `ALLOW_DATA=1`, z. B. Erstdaten eines neuen Teams).

### R5 — Zeilenenden & Encoding
`.gitattributes`: `* text=auto eol=lf`, Binärdateien explizit. Lokal `core.autocrlf=false`
(`git config core.autocrlf false`). PowerShell schreibt Dateien nur so:
`[IO.File]::WriteAllText($pfad, $text.Replace("`r`n","`n"), (New-Object Text.UTF8Encoding($false)))`
— nie `Set-Content`/`Out-File` für getrackte Dateien. Ausnahme: `.ps1`-Skripte behalten ihr UTF-8-BOM
(PowerShell 5.1 liest sie sonst als ANSI und zerlegt Umlaute). Zeigt `git ls-files --eol` `w/crlf`
oder `w/mixed`: `git add --renormalize <datei>` bzw. `sed -i 's/\r$//' <datei>`.

### R6 — Mehrere Sessions parallel
Vor Beginn `git pull --ff-only`. Nur die eigenen Dateien anfassen; wenn eine andere Session dieselbe
Datei bearbeitet (Status ` M` auf einer Datei, die man nicht angefasst hat) → nicht mit-committen.
Baut ein Repo aus dem anderen (VA aus Porsche): erst bauen, wenn die Quelle committet und ruhig ist.

## Einrichtung einer Arbeitskopie (einmalig)
```bash
git clone git@github.com:porsche-customer/cs-carsales-flow-cockpit.git C:/dev/cs-carsales-flow-cockpit
git clone https://github.com/benediktirsch-rgb/analytics-dashboard.git C:/dev/analytics-dashboard
cd C:/dev/cs-carsales-flow-cockpit && git config core.autocrlf false && git config core.hooksPath .githooks
cd C:/dev/analytics-dashboard     && git config core.autocrlf false && git config core.hooksPath .githooks
```

## Wenn es doch wieder komisch aussieht (Reparatur)
```bash
git status --short                # D-Zeilen? fremde M-Zeilen?
git reset -q                      # Index := HEAD (Arbeitsbaum bleibt)
git update-index --refresh        # Stat-Cache neu (DriveFS)
git diff --stat                   # nur eigene Aenderungen?  -> git add <datei> ; git commit
git stash list                    # alte Stashes: git stash show --stat; leer = Phantom -> drop
find .git -name desktop.ini -delete   # Drive-Muell aus .git (bricht sonst fetch/fsck) — nur auf H: noetig
git fsck --connectivity-only
```

## Kurzfassung
Arbeiten in `C:\dev\…` · `pull --ff-only` · nur eigene Dateien `add` · `status` lesen · kein `add -A`,
kein Plumbing · `data/*.json` nie lokal · UTF-8 ohne BOM, LF · Hook meckert = hinschauen, nicht übersteuern.
