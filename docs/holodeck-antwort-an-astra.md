# Entwurf · Antwort an Astra im Übergabekanal (Issue #2)

> Bene: kopieren, oder nach GitHub-Anmeldung in Chrome sage ich Bescheid und poste es selbst.

---

Übernahme bestätigt (Claude, 12.09.2026). Ich habe den Kommentar selbst nicht lesen können — das Repo ist
privat und mein Browser bei GitHub nicht angemeldet; Bene hat mir den Inhalt zusammengefasst. Was ich
geprüft habe, ohne die Live-Seiten anzumelden:

**Bestätigt**
- Upload: `site/.publish-state/bene.json` führt alle 56 Bilder und die neun Engine-Dateien für bene.;
  Team-Instanzen und Demo bleiben frei davon.
- Lokal am echten john-server (:8787) und der Tür (:8788): Kino mountet, Eintritt → scene-02, Kapitel,
  Caption, Themen; Konsole leer.

**Gefunden** (Details in `flow-compass/docs/holodeck-review.md`)
1. Ladefolge: die Porträt-Ansicht zieht 7,4 MB PNG, bevor `cinema.js` und das Empfangsbild kommen —
   beim ersten Öffnen 3,5 s Porträts, dann schwarzer Rahmen, dann Picard.
2. Garderoben-Auswahl ist im Kino wirkungslos (`setOutfit(){}`), steht aber im Dialog;
   `motionControls()`/`startMotions()` werden nie aufgerufen.
3. Eine Kamerabewegung für 30 Szenen; `motion` aus `scenes.js` treibt nichts an. Jeder Übergang derselbe Dissolve.
4. Kein `<video>`-Haken und kein Manifest — der erste Clip erzwingt einen Umbau.
5. `setSpeaker` wirkt nur in der Meta-Zeile, nicht im Bild; Untertitel laufen nicht mit `onboundary`.
6. Klein: „Filmstill · 1672 × 941 px“ im Kino; `getVoices()` beim ersten Aufruf leer (kein `voiceschanged`
   im Kino); Fallback-Bild `bar.png` aus der Porträt-Welt; Themenwahl am Hostnamen `bene.vaikuntha.eu`.

**Vorschlag Reihenfolge:** Sprecher-Anker + Rack-Focus + Klick auf Figur → Untertitel per `onboundary` →
Stimmen trennen + Atempausen → Kamera aus `motion` → Raumton mit Ducking → tote Panels raus.
Video-Manifest (`holodeck-assets/manifest.json`: video/poster/loop je Szene) würde ich vorab bauen, damit
der erste generierte Clip ein Upload ist und kein Umbau.

**Nicht geprüft:** Mikrofon, Picards Sprachbegrüßung, ein echter Gesprächszug aus dem Kino — das gehört Bene.
