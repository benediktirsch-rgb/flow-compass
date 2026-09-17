# Cloud-Vertretung

Wenn das Claude-Kontingent erschöpft ist, blieb die Textaufbereitung bisher stehen, obwohl der Dienst weiterhin ein Lebenszeichen meldete. Die eigene Instanz kann jetzt bei bekannten Verfügbarkeitsfehlern auf eine separat angemeldete Codex CLI zurückgreifen. Aktivierung ausschließlich über `COMPASS_VERTRETUNG=1`; ohne die Variable bleibt das bisherige Verhalten erhalten.

## Grenzen und Zuständigkeit

- Claude ist primärer Textdienst. Nach einem bekannten Fehler übernimmt Codex für eine Stunde; danach wird Claude erneut versucht. Beide nutzen ihre vorhandene Abo-Anmeldung. Keine neue API-Abrechnung.
- Nur Textaufrufe ohne Werkzeuge werden vertreten. Chat-Aufrufe mit Werkzeugen werden nicht automatisch auf einen zweiten Agenten übertragen.
- `compass-vertretung.service` liest bestehende Schnittstellen alle 15 Minuten nach Ende des vorigen Laufs. Die Modellaufbereitung erfolgt höchstens stündlich. Der Timer startet nach einem Neustart erneut.
- Es gibt einen lokalen Dateilock und genau einen schreibenden Compass-Server. Der Collector ändert weder `stapel.json` direkt noch Hub-Spiegel, Quellsysteme, Benutzerantworten oder Entscheidungen. Er veröffentlicht über `POST /api/john/stapel`.
- Browser erhalten die letzte erfolgreiche Veröffentlichung innerhalb einer Stunde sofort. Eine explizite Aktualisierung bleibt möglich. Unbekannte/doppelte Kennungen, erledigte/vertagte Punkte sowie leere/ungültige Modellantworten überschreiben den letzten Stapel nicht.
- Der getrennte Desktop-Monitor dient der Betriebsabstimmung und Fehlerklärung. Er soll nicht dieselben Quellen nochmals pflegen.

## Datenversorgung

Der Collector nutzt Jira, beide bestehenden Trello-Boards, Antworten, Checkins, Pool, Tower, Ausgabe und Kalender. Die bisherigen privaten Kalenderfeeds werden über eine root-lesbare systemd-EnvironmentFile bereitgestellt. Feed-Adressen gehören weder in Git noch in Logs. Die Kalenderimplementierung stammt aus dem bisherigen lokalen Server; lokale Titelergänzungen zu Frei/Gebucht-Feeds werden nicht übernommen.

Postfach und Slack haben noch keinen geprüften Cloud-Zugang und werden als nicht angebunden ausgewiesen. Die vorhandene Jira-Schnittstelle liefert maximal 100 Vorgänge; dieser Grenzfall wird im Quellenstatus ausgewiesen. Cloud-Dateien wie Pipeline/Profil sind vorhandene Bestände, keine live synchronisierten Quellen. Der Collector bewahrt vorhandene Stapelpunkte als Bestand, kann aber keinen vollständigen Import aller lokal gepflegten Rückfragen behaupten.

## Betrieb

Dateien: `produkt/server/vertretung.ps1`, `produkt/server/kalender.ps1`, `wolkenserver/collector.py`, Timer/Service im selben Ordner. Collector-Code unter `/opt/compass-vertretung`; Zustand und private Snapshots unter `/var/lib/compass-server/daten/vertretung`, Verzeichnis 0700, Dateien 0600. Der Service läuft als `compass`, ohne eigene Quellschlüssel, und nutzt nur den bestehenden lokalen Server.

`GET /api/vertretung` zeigt je Quelle den letzten Versuch, letzten Erfolg und Fehler sowie Modellanbieter und Veröffentlichung. Nach 45 Minuten ohne erfolgreichen Abruf gilt eine Quelle beim Statusabruf als veraltet. Zeitstempel sind keine Garantie durchgängiger Verfügbarkeit. Scheitern beide Modelle, bleibt die letzte erfolgreiche Veröffentlichung erhalten.

Der laufende Betrieb wurde auf der eigenen Instanz aktiviert; Kundeninstanzen wurden nicht neu gestartet. Vor späteren Standard-Deploys muss dieser Branch übernommen oder die Abweichung bewusst erhalten werden. Die zusätzliche Kalender-EnvironmentFile und der Timer werden nicht vom bisherigen allgemeinen Deploy neu provisioniert.

## Prüfungen

- PowerShell-Parser für die Serverdateien.
- `tests/vertretung.test.ps1`: Primärbetrieb, Quota-Fallback, Wartefrist, Wiederaufnahme, Werkzeuggrenze, Opt-in, unbekannte Fehler, beide Anbieter ausgefallen.
- `tests/collector_test.py <Pfad zu collector.py>` unter Linux: stabile Kennungen, erledigte Karten, fehlgeschlagene Quellen ohne falschen Erfolgszeitpunkt, beschädigter Status, Veröffentlichung ausschließlich über bestehende API und Stundenfrist.
- `tests/kalender.test.ps1`: ICS-Escaping, Serien, Ausnahmen, Dauer und fehlgeschlagene Quelle, auch unter Linux pwsh.
- Reale Cloud-Probe: erschöpftes Claude-Kontingent führte zu Codex-Text, validierter Stapel wurde über die bestehende HTTPS-Schnittstelle gelesen; beide Kalenderfeeds lieferten Daten.

## Rücknahme

Timer mit `systemctl disable --now compass-vertretung.timer` abschalten; gegebenenfalls laufenden Collector kontrolliert stoppen. `Environment=COMPASS_VERTRETUNG=0` in der eigenen systemd-Drop-in setzen, daemon-reload und ausschließlich den eigenen Compass-Dienst neu starten. Damit entfällt auch der zusätzliche Kalender-Router. Die vor dem Rollout gesicherte Serverdatei liegt unter `/var/backups/compass-vertretung/`. Benutzerantworten und Geschäftsdaten wurden nicht ersetzt.
