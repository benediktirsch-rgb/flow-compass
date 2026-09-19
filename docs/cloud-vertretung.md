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

Postfach und Slack werden durch `compass-connectors.timer` stündlich nach Abschluss des vorherigen Laufs direkt aus der Wolke gelesen. Die vorhandene ChatGPT-Anmeldung und verbundenen Apps werden verwendet. Ein fehlendes `codex-code-mode-host` wurde aus derselben offiziellen Codex-Version mit SHA-256-Prüfung ergänzt. Die Routine deaktiviert standardmäßig Apps und deren Werkzeuge und aktiviert ausschließlich die benannten Lese-Werkzeuge der jeweiligen Quelle. Shell, Websuche und Unteragenten sind deaktiviert. [Konfigurationsreferenz](https://learn.chatgpt.com/docs/config-file/config-sample).

Die private Datei `vertretung/connector-scope.json` enthält die bisherigen Konten und kuratierten Kanäle, keine Zugangsschlüssel. Das Mail-Fenster beträgt 60 Tage, Slack 30 Tage. Pagination und relevante Threads werden gelesen; nur Metadaten und selbst formulierte Zusammenfassungen werden als Snapshot gespeichert. Ungültige/unvollständige Ergebnisse ersetzen keinen vorherigen Erfolg. Beide ersten Quellenläufe wurden erfolgreich geprüft. Ein zunächst zurückgewiesener Mail-Lauf wurde erst nach erfolgreicher Wiederholung als aktuell gemeldet.

`/api/postfach` und `/api/slack` liefern diese privaten Snapshots an die vorhandenen Compass-Karten. Stand, Alter und Fehler bleiben sichtbar; nach zwei Stunden gilt der Stand als veraltet. Der Collector nimmt wartende Punkte mit stabilen Quellkennungen in die Aufbereitung auf. Der allgemeine Quellenlauf liest alle 15 Minuten, erzeugt damit aber keinen neuen Gmail-/Slack-Quellstand.

Der lokale Rückfragen- und Entscheidungsbestand wurde einmal vollständig privat importiert. Fehlende lokale Antworten wurden über `/api/antworten` ergänzt; vorhandene Cloud-Antworten wurden nicht überschrieben. `/api/rueckfragen` führt den Import, Cloud-Antworten und aktuelle Rezeptionsfragen zusammen. Beantwortetes und zurückgezogene Fragen werden nicht neu vorgelegt. Neue Fragen sollen künftig über die Rezeption laufen; neue Änderungen an lokalen Dateien werden nicht automatisch kontinuierlich synchronisiert.

Jira lädt im Opt-in-Betrieb alle Folgeseiten über `nextPageToken`; wiederholte Cursor, fehlende Schlussseite und überschrittene Zeitgrenze brechen ab, ohne den erfolgreichen Cache zu ersetzen. [Jira-Schnittstelle](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/). Cloud-Dateien wie Pipeline/Profil bleiben vorhandene Bestände. `quellenAbrufeVollstaendig` bezeichnet die angeschlossenen Abrufe; `datenVollstaendig` bleibt bewusst false, da damit keine vollständige Synchronisierung aller lokalen Arbeitsdaten nachgewiesen ist.

## Betrieb

### Laufzeitvoraussetzungen

Der opt-in-Betrieb mit `COMPASS_VERTRETUNG=1` braucht **PowerShell 7** (`pwsh`), auch unter Windows. Das gilt insbesondere für die Kalender- und Rückfragenmodule; deren JSON-Verarbeitung verwendet `ConvertFrom-Json -AsHashtable`. Der Server prüft die Version vor dem Lesen der Konfiguration und dem Laden von Modulen und bricht unter Windows PowerShell 5.1 mit `COMPASS_POWERSHELL_7_REQUIRED` und einer Startanleitung ab. Ohne das Opt-in bleibt der bisherige Start mit Windows PowerShell 5.1 möglich.

Die vier Python-Dienste `collector.py`, `connectors.py`, `decisions.py` und `cloud_monitor.py` sind für den **Linux-Cloudbetrieb** gebaut. Sie verwenden `fcntl.flock` für exklusive Dateisperren und systemd für den Betrieb. Ihre vier Python-Tests müssen ebenfalls unter Linux laufen; ein Importfehler für `fcntl` unter Windows bedeutet eine nicht unterstützte Testumgebung, keinen fehlgeschlagenen Cloudlauf. Die Sperren dürfen nicht für einen Windows-Test durch wirkungslose Ersatzfunktionen ersetzt werden.

Dateien: `produkt/server/vertretung.ps1`, `produkt/server/kalender.ps1`, `wolkenserver/collector.py`, Timer/Service im selben Ordner. Collector-Code unter `/opt/compass-vertretung`; Zustand und private Snapshots unter `/var/lib/compass-server/daten/vertretung`, Verzeichnis 0700, Dateien 0600. Der Service läuft als `compass`, ohne eigene Quellschlüssel, und nutzt nur den bestehenden lokalen Server.

`GET /api/vertretung` zeigt je Quelle den letzten Versuch, letzten Erfolg und Fehler sowie Modellanbieter und Veröffentlichung. Nach 45 Minuten ohne erfolgreichen Abruf gilt eine Quelle beim Statusabruf als veraltet. Zeitstempel sind keine Garantie durchgängiger Verfügbarkeit. Scheitern beide Modelle, bleibt die letzte erfolgreiche Veröffentlichung erhalten.

Der laufende Betrieb wurde auf der eigenen Instanz aktiviert; Kundeninstanzen wurden nicht neu gestartet. Vor späteren Standard-Deploys muss dieser Branch übernommen oder die Abweichung bewusst erhalten werden. Die zusätzliche Kalender-EnvironmentFile und beide Timer werden nicht vom bisherigen allgemeinen Deploy neu provisioniert. Connector-Service, Scope und Import müssen bei einer Neuinstallation separat übernommen werden. Die Cloud ist für diese neuen Quellen-Snapshots zuständig; der Desktop-Monitor startet keine zweite Quellenpflege. Auf Anweisung des Nutzers wird ohne Claude-Review weitergearbeitet; die Übergabe dient dem späteren Wiedereinstieg.

## Prüfungen

- PowerShell-Parser für die Serverdateien.
- `tests/runtime.test.ps1` unter Windows PowerShell 5.1 und PowerShell 7: frühe, verständliche Ablehnung des Opt-ins auf 5.1, weiterhin erreichbare Konfigurationsprüfung ohne Opt-in und unter PowerShell 7. Kein Dienststart und keine echten Daten.
- `tests/jira-pages.test.ps1` unter beiden PowerShell-Versionen: Folgeseiten, wiederholte Cursor und Erhalt des erfolgreichen Caches. Die Mock-Vorgänge haben dieselbe Objektform wie `ConvertFrom-Json`.
- `tests/vertretung.test.ps1`: Primärbetrieb, Quota-Fallback, Wartefrist, Wiederaufnahme, Werkzeuggrenze, Opt-in, unbekannte Fehler, beide Anbieter ausgefallen.
- `tests/collector_test.py <Pfad zu collector.py>` unter Linux: stabile Kennungen, erledigte Karten, fehlgeschlagene Quellen ohne falschen Erfolgszeitpunkt, beschädigter Status, Veröffentlichung ausschließlich über bestehende API und Stundenfrist.
- `tests/kalender.test.ps1`: ICS-Escaping, Serien, Ausnahmen, Dauer und fehlgeschlagene Quelle, auch unter Linux pwsh.
- Zusätzlich: sieben Rückfragen-/Snapshot-Tests, fünf Connector-Validierungsprüfungen, drei Jira-Paginationstests sowie verifizierte Lese-Werkzeugfreigabe.
- Reale Cloud-Probe: erschöpftes Claude-Kontingent führte zu Codex-Text, validierter Stapel wurde über die bestehende HTTPS-Schnittstelle gelesen; beide Kalenderfeeds lieferten Daten.

## Rücknahme

Beide Timer mit `systemctl disable --now compass-vertretung.timer compass-connectors.timer` abschalten; gegebenenfalls laufenden Collector kontrolliert stoppen. `Environment=COMPASS_VERTRETUNG=0` in der eigenen systemd-Drop-in setzen, daemon-reload und ausschließlich den eigenen Compass-Dienst neu starten. Damit entfällt auch der zusätzliche Kalender-Router. Die vor dem Rollout gesicherte Serverdatei liegt unter `/var/backups/compass-vertretung/`. Benutzerantworten und Geschäftsdaten wurden nicht ersetzt.
