# Holodeck: bestätigter Auftragsstopp

Vorschlag für Claudes Prüfung vom 15.09.2026. **Keine Serverimplementierung, kein Deploy.**
Verbindliche Spezifikation vor Implementierung: `john-agent/docs/protokoll.md`, Abschnitt
„Holodeck: Wolken-Coach und Avatar-Ausgabe“, Branch `astra/holodeck-protokoll-tests`.

Heute beendet `coach-door.js` nur den Empfang der laufenden `/api/john`-Anfrage.
Der Client zeigt dies ehrlich an. Ein abgebrochener HTTP-Request bestätigt keinen
beendeten Modellprozess. Diese Kennzeichnung bleibt bis zur Abnahme erhalten.

Die vorgeschlagene Erweiterung legt mit `POST /api/holodeck/jobs` einen Auftrag an,
fragt ihn mit `GET /api/holodeck/jobs/{jobId}` ab und fordert mit
`POST /api/holodeck/jobs/{jobId}/cancel` den Stopp an. Der HTTP-Prozess nimmt nur an
und liefert Status; ein begrenzter Worker führt John aus. Status und Cancel müssen
auch während des Modellaufrufs erreichbar sein. Keine zweite Persona und kein neuer Anbieter.

Claude setzt die Prozessverwaltung für den vorhandenen CLI-Backend um:

1. Authentisierte Instanz an Auftrag binden; Herkunft und Größen vor Annahme prüfen.
2. requestId deduplizieren, parallele Arbeit begrenzen und Überlast ausdrücklich melden.
3. Worker und Kindprozesse pro Auftrag erfassen, Timeout und Cancel auf denselben
   Beendigungspfad führen. Keine anderen Sessions oder Dienste beenden.
4. `cancel_requested` sofort zurückgeben; `cancelled` erst nach bestätigter Entfernung
   aus der Warteschlange oder beendetem Prozessbaum. completed bleibt completed.
5. Ergebnisse kurzzeitig im Speicher halten und nach Neustart Verlust ausdrücklich
   melden. Keine Gesprächsinhalte in Betriebslogs.
6. Erst nach folgenden Prüfungen `capabilities.holodeckJobs=1` und
   `capabilities.cancelJob=true` aktivieren. Alter `/api/john`-Vertrag bleibt bestehen.

Abnahme: Cancel in queued und running; doppeltes Cancel; Rennen zwischen Antwort und
Cancel; fremde Instanz/ID; doppelte requestId mit gleichem bzw. anderem Inhalt;
unerreichbarer Client; Laufzeitüberschreitung; Dienstneustart; Status während Modellarbeit;
keine übrig gebliebenen Kindprozesse. Browser verwirft späte Antworten nach Abbruch.

Server, Zugänge und Instanzen stehen ausschließlich auf Infrastruktur-Wikiseite 2771189762.
