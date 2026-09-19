# Gemeinsame Avatare: Master und persönliche Profile

John und Madlene erscheinen als Begleiterleiste und FAB. Der Compass enthält zusätzlich die erweiterten Abendoptionen im Ritual und den Einstieg im Einrichtungsassistenten. Website, Raumschiff und CRM laden dieselbe Oberfläche über vf.js; Cockpit und Portal über avatare-loader.js. /wegweiser.html öffnet die 30 bewertbaren Denkimpulse.

## Daten und Verhalten

`produkt/server/avatar-master-v1.json` enthält ausschließlich die ausrollbare Persönlichkeit. `avatars.masterVersion` pinnt die Version. Persönliche Werte, Definitionen, Denkimpulse, Bewertungen und maximal 300 Rückmeldungen liegen ausschließlich in `DatenDir/avatar-profile.json` der jeweiligen Wolkeninstanz. Eine neue Instanz beginnt ohne persönliche Einträge. Master-Updates kopieren niemals dieses Profil. Persönliche Denkimpulse werden nur mit gültigem Besitzerticket in den Modellkontext aufgenommen.

Auswahl → zwei kurze Reaktionen → bearbeitbarer nächster Schritt → bestätigtes Vorhaben → Rückmeldung zur Umsetzung und Wirkung. Erst die ausdrückliche Erledigung gilt als Erfolg. Häufigkeit, Aktualität und hilfreiche Wirkung beeinflussen die Reihenfolge; Favoriten bleiben oben. Eigene Definitionen sind gleichberechtigte Optionen. Die Routine benötigt keine Modellaufrufe.

John: realistischer Unternehmer, Klarheit, Sicherheit und Gegenprüfung. Madlene: spirituelle Seele, Coach, CFO und scharfe Kritikerin. Kant/Nietzsche beziehungsweise Veden/Buddha/Sadhguru sind persönliche Denkimpulse für Bene, kein erzwungener Master für andere Menschen. „Ariean“ bleibt bis zur Klärung unzugeordnet.

## Betrieb und Veröffentlichung

1. Serverpaket inklusive avatare.ps1, avatar-master-v1.json und avatar-guides.json ausrollen; pro Instanz eigenen Datenordner und eigenen MADELEINE_TICKET_KEY verwenden.
2. Website-Assets und avatare-api.php ausrollen. avatare-config.example.php als private avatare-config.php einrichten: bestätigte CRM-Person-ID explizit auf ihre Wolkeninstanz und deren Besitzerticket-Schlüssel abbilden. Kein Standardnutzer. Keine Schlüssel im Frontend. Erlaubte Cockpit-/Portal-Ursprünge einzeln eintragen.
3. Compass und Cockpit aus den jeweiligen Builds veröffentlichen. Ohne Zuordnung zeigt die UI eine Vorschau und deaktiviert das Speichern. Bestehende Website-Rollen werden nicht erweitert.
4. Bene-Denkimpulse über Mein Kompass eintragen; bestehende Profile nicht durch eine Vorlage überschreiben. Auf einem zweiten Konto prüfen, dass keine Bene-Daten erscheinen.
5. Master-Version nur nach Prüfung hochsetzen. Für einen Rücksprung die alte Master-Datei behalten und masterVersion zurücksetzen. Vor Schemaänderungen persönliche Daten sichern und separat migrieren.

Quellcode der gemeinsamen Oberfläche: Flow Compass. Verteilen mit `node tools/sync-avatare.mjs <website-repository>`; Kopien nicht unabhängig verändern.

## Verbrauch und Grenzen

Standardmäßig maximal 20 neue John-/Madlene-Gespräche pro Instanz und UTC-Tag. `avatars.dailyCalls=0` deaktiviert diese Gespräche. Reservierung erfolgt vor dem Aufruf, auch fehlgeschlagene Aufrufe zählen. Kurzer Gesprächskontext, höchstens drei Agenten-Turns. Abendreaktionen, Sortierung, Bewertungen und Speicherung sind deterministisch. Das begrenzt diese neuen Gespräche, nicht sämtliche Hintergrundprozesse oder das gesamte Anbieter-Konto; keine Garantie gegen Nachkäufe. Bestehende Provider bleiben unverändert.

## Validierung

Node-Tests für Reihenfolge, Zeitgewichtung, ehrliches Feedback und Master-Isolation. PowerShell-Tests für getrennte Instanzen, Revisionen, Tickets, Bewertungen, Vorhaben und Budget. Produkt-Wortprüfung und Build, PHP-/JS-/PowerShell-Syntax. Browserprüfung gegen synthetische lokale Daten: Plan speichern, Umsetzung bestätigen, eigene Option speichern, Philosophie bewerten. Keine Modellaufrufe für diese Prüfungen.

Die Änderungen benötigen koordinierten Rollout in drei Repositories. Quellcode und lokale Tests allein bedeuten noch keine veröffentlichte und konfigurierte Produktion. Claude-Review separat dokumentieren.
