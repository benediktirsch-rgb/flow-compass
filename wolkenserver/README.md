# Wolkenserver — der Compass-Server rund um die Uhr

Der Compass auf **bene.vishnuartists.com** sprach bis zum 14.09.2026 nur mit dem john-server auf dem
Windows-Rechner (`http://localhost:8787`). Rechner zu, Deckel zu — Coach, Stapel, Trello und Jira weg.
Der Wolkenserver ist ein kleiner Linux-Server, auf dem das neutrale **Compass-Server-Paket aus
`produkt/server`** unter PowerShell 7 als Dienst läuft. Der Compass zeigt standardmäßig dorthin; der
Rechner-John bleibt über `?john=http://localhost:8787` erreichbar.

Was der Wolkenserver kann: Coach-Chat, Zwei-Satz-Bilanz, Stapel, Trello (beide Boards), Jira.
Was er **nicht** kann (antwortet `NICHT_IM_PAKET`, der Compass zeigt das an): Kalender, Postfach, Slack,
Wächter, Sicherung, Finanzen, Trichter, Checkins, Boards, Git-Freigabe, Madeleine, Ausgabe — alles, was an
Outlook, `C:\dev` und Windows hängt, bleibt am Rechner.

## Was Bene einmal tut (drei Dinge, ~15 Minuten)

1. **Server anlegen** — Hetzner Cloud (console.hetzner.cloud): Projekt → „Server hinzufügen“ →
   Standort Falkenstein oder Nürnberg · Image **Ubuntu 24.04** · Typ **CX22** (2 vCPU, 4 GB, ~4,50 €/Monat) ·
   SSH-Key: den Inhalt von `C:\Users\bened\.ssh\id_ed25519_wolke.pub` einfügen · sonst nichts. IPv4 notieren.
2. **Claude-Abo für den Server freischalten** — in PowerShell auf diesem Rechner:
   ```
   claude setup-token
   ```
   (Browser öffnet sich, Anmeldung mit dem Max-Abo, gibt einen langlebigen Token `sk-ant-oat01-…` aus), dann
   ```
   [Environment]::SetEnvironmentVariable('WOLKE_CLAUDE_TOKEN','<token>','User')
   ```
   Der Name ist absichtlich nicht `CLAUDE_CODE_OAUTH_TOKEN` — sonst würde das lokale Claude Code auf diesen
   Token umsteigen. Das Deploy-Skript trägt ihn auf dem Server unter dem richtigen Namen ein.
3. **DNS (kann auch später kommen)** — im KAS die Zone `vishnuartists.com`: A-Record `wolke` → IPv4 des Servers.
   Bis dahin läuft alles unter `<ip-mit-bindestrichen>.sslip.io` mit echtem Zertifikat.

## Dann: ein Befehl von diesem Rechner

```
powershell -NoProfile -ExecutionPolicy Bypass -File C:\dev\persoenliches-dashboard\wolkenserver\deploy-wolkenserver.ps1 -Server <IPv4>
```

Sobald der DNS-Eintrag steht, einmal mit `-Hostname wolke.vishnuartists.com` nachfahren — Caddy holt dann das
Zertifikat für den richtigen Namen, die Adresse in `wolke.json` wird umgestellt.

Das Skript (`deploy-wolkenserver.ps1`):
- baut einen Staging-Ordner: Paket, `compass-server.json` (Name Bene, Coach John, Trello-Kurzlinks und
  Jira-Site aus `dashboard.html`, Projekt VA), `env` (Trello-/Jira-Schlüssel und der Claude-Token aus den
  Benutzer-Umgebungsvariablen — nie ausgegeben, nie im Repo), `daten\` (aus `C:\dev\john`: `CLAUDE.md` →
  `persona.md`, `PROFIL.md`, `pipeline.md`, `TASKS.md`, `kanaele.md`, `PERSOENLICHKEIT.md`);
- lädt ihn per scp nach `root@<server>:/tmp/compass-deploy` und lässt dort `install.sh` laufen
  (PowerShell 7, Caddy, ufw, Benutzer `compass`, Claude Code, systemd-Dienst, Caddyfile);
- prüft von außen `https://<host>/<pfad>/api/john/status` und schreibt `site\.publish-state\wolke.json`
  (gitignored) mit `api`, `erreichbar`, `paket`;
- `build-compass.ps1` liest diese Datei und setzt die Adresse in die eigene Instanz ein
  (`const JOHN_API = … || 'https://wolke…/t-…'`); `publish-compass.ps1` lädt sie spätestens 30 Minuten später
  nach bene.vishnuartists.com hoch. Sofort: `powershell -ExecutionPolicy Bypass -File publish-compass.ps1`.

Der erste Lauf dauert 2–4 Minuten (Paketquellen, Claude-Code-Installer). Jeder weitere Lauf ist ein
Abgleich: neues Paket, neue Persona, neue Schlüssel — der Dienst startet neu, `TASKS.md` und die
Coaching-Notizen auf dem Server bleiben stehen (der Coach schreibt sie dort selbst).

## Team- und Kundeninstanzen (seit 15.09.2026)

Jede Instanz aus `instanzen\<slug>` bekommt auf dem Wolkenserver einen eigenen Dienst
`compass-server@<slug>` (eigener Port ab 8791, eigener Datenordner `/var/lib/compass-server/instanzen/<slug>/daten`,
eigene Schlüsseldatei `/etc/compass-server/instanzen/<slug>.env`) und einen eigenen geheimen Pfad bei Caddy.
Aufnehmen: `deploy-wolkenserver.ps1 -Instanz "Philipp Heitz"` — danach steht sie in `wolke.json`, läuft bei jedem
Deploy mit, und `api:` in `instanzen\<slug>\compass\instanz.js` zeigt auf ihre Adresse; `publish-compass.ps1`
baut das ein. Name, Trello-Kurzlinks und Jira-Site kommen aus der `instanz.js`.

**KI je Person, nicht über Benes Rechnung:** der Coach einer Instanz läuft erst, wenn die Person ihren eigenen
`claude setup-token` liefert. Bene trägt ihn als `WOLKE_CLAUDE_TOKEN_<SLUG>` ein (Slug groß, Bindestrich →
Unterstrich, z. B. `WOLKE_CLAUDE_TOKEN_PHILIPP_HEITZ`) und deployt erneut. Bis dahin steht die Instanz auf
`backend: ohne` — Board, Stapel aus Dateien und die ehrlichen „nicht angebunden“-Hinweise laufen trotzdem.
Trello- und Jira-Schlüssel der Person: noch nicht vorgesehen (die Instanz meldet `NO_KEY`); nächster Schritt.

Stand 15.09.2026: philipp-heitz (8791), jan (8792), marwan (8793), florian (8794), domingo (8795) laufen, alle
`ohne`. Martin hat keinen Compass (nur Portal) und deshalb keine Instanz.

## Nachsehen und betreiben

| Was | Wie |
|---|---|
| Zustand (Dienst, Logbuch, Antwort von außen) | `deploy-wolkenserver.ps1 -Status` |
| Logbuch live | `ssh -i ~\.ssh\id_ed25519_wolke root@<server> journalctl -u compass-server -f` |
| Dienst neu starten | `ssh … systemctl restart compass-server` |
| Paket/Persona/Schlüssel aktualisieren | `deploy-wolkenserver.ps1` (ohne Parameter, nimmt `wolke.json`) |
| Geheimen Pfad neu würfeln | `pfad` aus `site\.publish-state\wolke.json` löschen, erneut deployen, Compass neu bauen |
| Zurück zum Rechner-John (nur dieser Browser) | Compass-Adresse mit `?john=http://localhost:8787` öffnen; `?john=` ohne Wert löscht es |
| Wolkenserver ganz abschalten | `wolke.json` löschen → nächster Build zeigt wieder auf localhost |

Auf dem Server: Code `/opt/compass-server/`, Daten `/var/lib/compass-server/daten/` (Besitz `compass`),
Konfiguration `/etc/compass-server/compass-server.json`, Schlüssel `/etc/compass-server/env` (600, root),
Caddy `/etc/caddy/Caddyfile`, Zugriffs-Log `/var/log/caddy/wolke.log`.

## Sicherheit — so ist es gebaut

- Der Compass-Server hat keine eigene Anmeldung. Er lauscht nur auf `localhost:8787`; nach außen kommt er
  ausschließlich über Caddy (TLS, Let's Encrypt) unter einem **geheimen Pfadanfang** (`/t-<26 Zeichen>/`),
  den nur die gebaute Instanz kennt (sie liegt hinter der Tür von bene.vishnuartists.com). Alles andere auf
  dem Host antwortet 404.
- Firewall: 22, 80, 443. SSH nur mit Schlüssel (`id_ed25519_wolke`, angelegt 14.09.2026, kein Passwort).
- Schlüssel liegen nur in `/etc/compass-server/env` (nur root) — der Dienst bekommt sie über systemd.
  Der Claude-Token rechnet über Benes Abo ab, nie über die API (`ANTHROPIC_API_KEY` wird nicht übertragen).
- Was auf dem Server liegt, ist Benes Coaching-Kontext (Persona, Profil, Pipeline, Aufgaben). Bene digital
  und Johns Rezeption (hotel-vaikuntha.de/john) sind davon getrennt und unberührt.

## Ehrlich: was noch nicht gelaufen ist

Auf einem echten Linux-Server ist das Ganze noch nicht gelaufen — es gibt hier kein WSL und kein Docker.
Geprüft am 14.09.2026: das gepatchte Paket unter Windows PowerShell 5.1 (Start, `/api/john/status`,
`NICHT_IM_PAKET`, `/__stop`, Vorlagen werden angelegt), die Wortprüfung des Pakets, `build-compass.ps1` mit
und ohne Adresse, das Deploy-Skript bis zum fertigen Staging-Ordner. Der erste Lauf gegen den Server ist
also der Test von `install.sh`: bricht er ab, steht der Grund in der Ausgabe, und `-Status` zeigt das
Logbuch des Dienstes. Bekannte Stellen mit Rest-Risiko: `claude auth status` kennt den setup-token
vielleicht nicht (der Server behandelt den Token dann trotzdem als angemeldet und meldet erst beim ersten
Chat `NO_LOGIN`, falls er nicht gilt); die Host-Prüfung des HttpListeners unter Linux (Caddy setzt deshalb
`Host: localhost:8787`).
