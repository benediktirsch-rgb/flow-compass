# Holodeck: Filmszenen und mehrsprachiges Gespräch

Das Holodeck verwendet fotografische Szenen mit Kamera-Pan und Überblendung. Ein Empfang mit Picard führt zu fünf Orten. Eine Bibliothek enthält 30 einzeln inszenierte Bildmotive und 30 eigene Dialogauftakte: Ruhe, Business, Feier, Flirt, Konflikt und Erkenntnis an jedem Ort.

Die Bilder sind Filmstills, keine fertigen Videos oder Animationen der dargestellten Menschen. Die Oberfläche zeigt die tatsächlichen Pixelmaße. Produktionslängen und Kamerabewegungen in der Regie beschreiben den späteren Film, keine bereits vorhandene Aufnahme. Frei begehbare 3D-Figuren sind damit nicht umgesetzt.

## Charaktere und Bildablage

Gesichtsreferenzen für John und die dunkelhaarige Madeleine wurden vom Betreiber freigegeben. Die Garderoben verwenden dieselben Vorlagen. Die Statur des eigenen Avatars folgt den gelieferten schlanken, sportlichen Referenzen. Tageslooks betreffen die alternative Fotoporträt-Ansicht; Filmszenen behalten ihre inszenierten Kostüme.

Alle persönlichen Bilder liegen ausschließlich in gitignorierten `holodeck-assets/`-Verzeichnissen und hinter den bestehenden Zugangsschranken. Die Rezeption erhält weder Bilder noch Gesprächssätze. Ein neuer Benutzer für Vishnu wurde nicht angelegt.

## Dialog und Ton

Die 30 Szenen enthalten ausdrücklich gekennzeichnete Drehbuchtexte. Sie sind keine tatsächlichen Antworten der Agenten. Erst „Mit dieser Stimmung ins Gespräch“ sendet einen sichtbaren Rollen- und Szenenauftrag an die bestehende lokale Tür. Reine Szenenwechsel senden nichts. Eine Szene kann keinen realen Erfolg oder eine erfolgte Handlung bestätigen.

Deutsch, Englisch, Hindi, Italienisch und Französisch sind auswählbar. Erkennung, Sprachauftrag und Ausgabe folgen derselben Auswahl. Es werden nur verfügbare Browserstimmen dieser Sprache angeboten; fehlende Stimmen werden benannt. Mikrofon und Sprachdienst benötigen bewusste Aktivierung. Das Mikrofon pausiert während Modelllauf und Sprachausgabe; Stoppen beendet Ausgabe und den lokalen Lauf. Schließen, Hintergrund und Verbindungsfehler beenden den Sprachmodus. Keine automatische Audioaufnahme beim Öffnen.

Gewünschtes Casting: Madeleine warm und verführerisch mit französischem Akzent; John lässig, sonor und humorvoll mit der deutschen Travolta-Synchronwirkung als Referenz; Picard ruhig und würdevoll. Diese Eigenschaften sind Produktionsregie, keine Behauptung verfügbarer Original- oder Schauspielerstimmen. Eine professionelle Voice-Engine und Lippensynchronität sind noch nicht angebunden.

Musikregie: Jazz an der Bar, akustische Wärme in der Hütte, organischer Downtempo in Goa, zurückhaltende weite Instrumentierung in den Anden und Nylongitarre/Klavier in Rom. Jede Stimmung erhält eigene Dynamik. Sprache hat Vorrang; im fertigen Mix wird Musik unter Dialog abgesenkt. Es sind noch keine Musikaufnahmen angeschlossen.

## Darstellung und Schnittstelle

- `compass-gespraechsraum.js`: Gespräch, lokale Tür, Stimmen, Garderobe und Gäste.
- `holodeck-engine/cinema.js` und `cinema.css`: Bildansicht und Inszenierung.
- `holodeck-engine/scenes.js`: 30 Szenen mit Dialog und Kameraregie.
- `holodeck-engine/production.js`: Musik- und Stimmregie.

API unverändert: `/raum` und `/stopp`. Der Empfang kann nach bewusstem Eintritt eine datierte Gesprächseröffnung senden, sofern keine Nachricht oder kein Lauf offen ist. Schließen während des Intros verhindert diese Sendung. Vereinskontext und persönlicher Kontext bleiben getrennt. Ein eingeladener Gast wird als KI-Rolle durch John dargestellt, kein zusätzlicher Gastprozess.

Besondere Momente: eigene Vishnu-Rolle, Madeleine als Brahma, John als Shiva. Inspiration ist selten und begrenzt. Feier nur bei bewusster Bestätigung des Nutzers. Sinngemäße Gita-Verse enthalten Quellenlinks.

## Weiterführende Produktion

Für einen echten Film fehlen Videoerzeugung, konsistentes Bewegungsspiel, professionelles mehrsprachiges Casting, Musikaufnahme und Dialogsynchronisierung. Die Bild- und Regiebibliothek ist die Vorproduktion dafür. Provider-Zugänge und Kosten müssen vor bezahlten Aufträgen geklärt werden; Schlüssel gehören ausschließlich auf den Server.
