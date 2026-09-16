# Umgebungen: lokal, Staging, Prod (seit 15.09.2026)

Der Flow Compass hatte bis zum 15.09.2026 genau zwei Zustände: die Arbeitskopie auf Benes Rechner
und die Live-Adresse. Die geplante Aufgabe „Vishnu Flow Compass publish“ lud alle 30 Minuten den
Arbeitsstand hoch — jede halbfertige Änderung an `dashboard.html` war eine halbe Stunde später live,
auf bene., in der Demo und in den Team-Instanzen. Seitdem gibt es drei Stufen. Die Regeln stehen in
`stufen.json`, die eine Stelle, die `publish-compass.ps1`, `build-stufe.ps1` und
`wolkenserver/deploy-wolkenserver.ps1` lesen.

## Die drei Stufen

| Stufe | Was dort liegt | Web (KAS, Apache + PHP) | Compass-Server (wolke) | Wer füllt sie |
|---|---|---|---|---|
| **lokal** | die Arbeitskopie, roh | `.claude/launch.json` unter `C:\dev`: `compass-dev` (8796), `compass-staging` (18797, PHP-Server auf `site/staging/bene`) | john-server 8787 (Prod-Daten!) oder `john-test` 8790 | die Session |
| **staging** | der Arbeitsstand, auch uncommittet — gekennzeichnet | `staging-<sub>.vishnuartists.com` aus `site/staging/<sub>/` | `compass-server@staging`, Port 8789, eigener Pfad, eigener Datenordner `/var/lib/compass-server/instanzen/staging/daten` | `publish-compass.ps1`, alle 30 Min, ohne Freigabe |
| **prod** | der freigegebene Stand | `bene.`, `demo.`, `<vorname>.vishnuartists.com` | `compass-server` (8787) und `compass-server@<slug>` (8791 ff.) | `publish-compass.ps1` — mit `prod.freigabe = "commit"` nur aus einer sauberen Arbeitskopie |

Ein Ziel je Ursprung bleibt: Staging-Ziele sind eigene Subdomains mit eigenem Dokumentenverzeichnis,
eigener Tür (`gate.php`, eigenes `gate-secret.php`) und eigenem localStorage. Ein Staging-Cookie öffnet
nie eine Prod-Tür. Wer hinein darf, ist auf Staging dieselbe Liste wie auf Prod (`gate-config.php`
wird gespiegelt) — Staging ist kein zweites Berechtigungssystem.

## Was Staging nie tut

- **In Prod-Daten schreiben.** Der Staging-Compass zeigt auf `compass-server@staging`; der Coach schreibt
  dort in eine eigene `TASKS.md` und eigene Coaching-Notizen. Gibt es den Dienst nicht, zeigt der Build
  auf eine Adresse, die es nicht gibt (`kein-staging-server.invalid`) — nie auf den Prod-Server.
- **Checkins abliefern.** `/api/checkin` gibt es im Compass-Server-Paket nicht (`NICHT_IM_PAKET`), der
  Briefkasten auf `staging-bene.` wird von keiner Aufgabe abgeholt. Ein Morgencheck auf Staging ist
  ein Test, keine Übergabe — der Balken sagt das.
- **Als die echte App auftreten.** `build-stufe.ps1` setzt einen Balken unten auf jede Seite,
  `[STAGING]` vor den Titel, `noindex`, und das Manifest heißt „Staging · …“ mit bernsteinfarbenem
  Symbol — installiert man beide, liegen zwei unterscheidbare Apps auf dem Startbildschirm.
- **Prod aufhalten.** Jeder Staging-Fehler wird nur geloggt; Prod läuft weiter.

## Was Prod seit dem 15.09. kann: Freigabe = Commit

`stufen.json › prod.freigabe`:

- `sofort` — wie bis zum 16.09.2026: jeder Lauf baut Prod aus der Arbeitskopie. Staging und Prod tragen
  dann denselben Stand, eine halbe Stunde versetzt; Staging ist dann nur die Vorschau mit Balken.
- `commit` (**gilt seit 16.09.2026**, Benes Entscheidung E2) — Prod (eigene Instanz, Demo-Commit, Team-Instanzen) wird nur ausgerollt, wenn
  `git status --porcelain --untracked-files=no` leer ist. Uncommittete Arbeit an getrackten Dateien
  hält Prod an; Staging trägt den Stand derweil, und das Log sagt, welche Dateien warten. Die
  gitignorierte Datenschicht (Checkins, `*-data.js`, `instanz.js`, `portal.js`) zählt nicht als
  Änderung und fließt weiter sofort — Inhalte brauchen keine Freigabe, Code schon.
  Freigeben = Commit auf `main`: über den Freigabe-Dialog im Compass (Karte „📦 Pakete warten auf
  Freigabe“, `POST /api/git`), `git-flow.ps1 -Modus freigeben` oder von Hand.
  Einmalig übersteuern: `publish-compass.ps1 -Erzwingen`.

Der Wechsel auf `commit` war Benes Entscheidung (Rückfrage `staging-freigabe-commit`, Abendcheck 15.09.,
eingeschaltet am 16.09., nachdem die Subdomains im KAS standen): er ändert den Alltag — eine Codeänderung
erreicht bene. erst nach dem Commit, nicht mehr nach 30 Minuten. Liegt Arbeit einer anderen Session
uncommittet herum, wartet Prod auf deren Freigabe (Karte „📦 Pakete warten auf Freigabe“ im Compass).

## Aufrufe

```
publish-compass.ps1                    # alles: Staging bauen + hochladen, dann Prod nach Regel
publish-compass.ps1 -Stufe staging     # nur Staging (Prod bleibt unangetastet, keine Demo-Commits)
publish-compass.ps1 -Stufe prod        # nur Prod, ohne Staging-Builds
publish-compass.ps1 -Erzwingen         # Prod trotz uncommitteter Arbeit (nur mit freigabe = commit relevant)
publish-compass.ps1 -NurBauen          # alles bauen, nichts hochladen
wolkenserver\deploy-wolkenserver.ps1 -Staging   # Staging-Dienst auf wolke anlegen (einmalig; danach läuft er mit)
wolkenserver\deploy-wolkenserver.ps1 -Status    # Dienste und Antworten von außen, inkl. Staging
build-stufe.ps1 -Ordner site\staging\bene -Stufe staging -Prod https://bene.vishnuartists.com/
```

## Was auf dem KAS von Hand passiert (nur Bene)

`publish-compass.ps1` legt die Ordner `/staging-bene.vishnuartists.com/` und
`/staging-demo.vishnuartists.com/` im Webspace an und füllt sie — auch bevor die Subdomain existiert.
Außerhalb eines Dokumentenverzeichnisses sind sie von außen nicht erreichbar. Im KAS je Ziel:
Subdomain `staging-bene` (bzw. `staging-demo`) anlegen → als Dokumentenverzeichnis den vorhandenen
Ordner wählen → SSL (Let's Encrypt) einschalten. Ab dann läuft die Tür, weil `.htaccess` und
`gate.php` schon drin liegen; `weiter.php` lässt `*.vishnuartists.com` als Rücksprungziel zu.
**Erledigt am 16.09.2026** — beide Adressen antworten (staging-bene. → Anmeldung, staging-demo. → 200 mit Balken).

Nachgezogen: `_tools\domain-uebersicht.ps1 › $PRUEFEN` (16.09.). Offen: `john-server.ps1 › -WachtSeiten`
(Staging-Zeilen mit `geschuetzt = $true`) — die Session „ECC-Befunde umsetzen“ trägt dort gerade die Instanzen ein,
die Staging-Zeilen kommen mit demselben Paket. Deploy-Wächter-Paare bekommt Staging bewusst nicht: es trägt
den Arbeitsstand, nicht HEAD — ein Vergleich gegen HEAD wäre dort immer „alt“.

## Wo Staging noch fehlt (Stand 15.09.2026)

Die Stufe ist für den Compass gebaut. Cockpit (`flow-cockpit`, `publish-cockpit.ps1` → `va.` und
`demo./cockpit/`), Website (`vishnuartists-website-redesign`, Workflow → `vishnuartists.com`),
Tower (`publish-tower.ps1`), Johns Rezeption (`john-agent`, `hotel-vaikuntha.de/john/`), Vaikuntha
(WordPress) und das Porsche-Cockpit (GitHub Pages) haben weiter nur lokal und Prod. Das Muster ist
dasselbe: `stufen.json`-Regel, `staging-<sub>`-Ziel, Kennzeichnung, Freigabe = Commit. Reihenfolge
und offene Entscheidungen: `C:\dev\übergaben\2026-09-15-staging\staging-architektur.html` und die
Confluence-Seite „Umgebungen und Staging“ im VA-Space.
