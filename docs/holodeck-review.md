# Holodeck — Regie-Review (12.09.2026)

Gelesen: `holodeck-engine/cinema.js`, `cinema.css`, `scenes.js`, `production.js`, die Anbindung in
`compass-gespraechsraum.js`, `docs/holodeck-film.md`; Assets gezählt und drei Stills angesehen
(Empfang, Bar scene-02, Goa scene-13). Blickwinkel: Regisseur, Schwerpunkt Video und Figuren.

## Was steht — und das ist viel

- 30 Stills, alle 1672×941, ein konsistenter Cast über fünf Orte, sechs Stimmungen. Der Empfang mit
  Picard vor der Tür zur Bar ist ein echtes Establishing Shot: Licht, Blickführung, Lotus als Marke.
- Die Dramaturgie hat Akte: 01 Ankommen · 02 Verstehen · 03 Entscheiden · 04 Weitergehen. Das ist mehr
  Struktur, als die meisten „KI-Räume“ je bekommen.
- Die Regie-Bibliothek (`scenes.js` mit Brennweite, Kamerabewegung, Dauer; `production.js` mit
  Stimm-, Musik- und Mix-Anweisungen) ist eine saubere Vorproduktion.
- Die Doku lügt nicht: „Filmstills, keine fertigen Videos“. Das ist die richtige Haltung.

## Die Diagnose in einem Satz

Das ist ein wunderschönes Storyboard, das sich für einen Film hält. Was tatsächlich läuft, ist ein
JPEG mit einem 34-Sekunden-Ken-Burns — für jede der 30 Szenen dieselbe Bewegung — und darunter ein
Textfeld, in dem „John spricht“ steht. Die Figuren auf dem Bild wissen davon nichts.

## A · Video-Integration

1. **Eine Kamerabewegung für 30 Szenen.** `cinema.css:2` fährt jedes Bild mit `scale(1)→1.035,
   translateX(-.6%)` — egal ob `scenes.js` „24 mm · langsame Annäherung“ oder „50 mm · Blickwechsel“
   sagt. Die Regie steht im Datensatz, treibt aber nichts an. Kleinster Eingriff: je Szene drei
   CSS-Variablen (`--pan-from`, `--pan-to`, `--pan-origin`) aus `motion` ableiten — Annäherung =
   Push-in auf die Gesichter, Blickwechsel = seitliche Drift, Ruhe = fast still. Dann erzählt die
   Kamera schon etwas, bevor ein einziges Video existiert.

2. **Jeder Übergang ist derselbe Dissolve.** `shot()` (`cinema.js:59`) macht immer 1 s Opacity-Fade.
   Ein Stimmungswechsel am selben Ort ist ein Schnitt, ein Ortswechsel ein Dissolve, der göttliche
   Moment darf ein Weißblitz sein. Das ist eine Zeile Parameter (`shot(name, alt, {cut:'hart'|'weich'|'blitz'})`).

3. **Es gibt keinen Video-Haken.** Kein `<video>`, kein Manifest, kein Fallback. Sobald Astra oder ein
   Generator den ersten Clip für scene-07 liefert, muss Code angefasst werden. Vorschlag: `shot()`
   quellenagnostisch machen — `holodeck-assets/manifest.json` mit `{ "scene-07": { "video": "scene-07.mp4",
   "poster": "scene-07.avif", "loop": [2.0, 22.5] } }`; gibt es `video`, wird `<video muted playsinline
   loop autoplay poster=…>` gemountet, sonst das Still. Die `duration` aus `scenes.js` (24–26 s) ist
   bereits die Cliplänge. Das ist der eine Umbau, der das Holodeck vom Storyboard zum Film macht,
   ohne dass danach je wieder jemand cinema.js öffnen muss.

4. **Der Projektor stottert.** 122 MB PNG, 2,3 MB pro Still, keine Vorlade-Logik. Der erste Ortswechsel
   nach dem Eintreten wartet auf ein Bild, das noch nicht da ist — im Kino nennt man das Filmriss.
   PNG ist für Fotografie das falsche Format: AVIF/WebP bringt ~150–300 KB bei gleicher Wirkung,
   und die nächste wahrscheinliche Szene (Default-Shot des gewählten Orts, Szene ±1 in der Bibliothek)
   gehört mit `new Image()` vorgeladen, während Picard noch spricht.

5. **Der Bildausschnitt ist Zufall.** `object-fit:cover` auf `clamp(500px,72vh,900px)` — auf einem
   breiten Monitor werden Köpfe abgeschnitten, auf dem Handy steht `object-position:66%` für alle.
   Ein Film hat ein Format. Entweder Letterbox auf 16:9 (die Stills sind exakt 16:9) oder je Szene
   ein Anker (`focus: [0.62, 0.35]`), auf den `object-position` zeigt. Die Anker braucht Punkt B.3
   ohnehin.

6. **Kein Ton — obwohl die ganze Tonregie geschrieben ist.** `production.js` beschreibt Kontrabass und
   Meeresatmosphäre; im Raum ist es still. Es braucht keine lizenzierte Musik, um 80 % der Wirkung zu
   bekommen: ein loopbarer Raumton pro Ort (Bar-Gemurmel, Kaminknistern, Brandung, Wind, Piazza) —
   das sind fünf Dateien à 30 s — und ein WebAudio-Gain, das unter Sprache auf −12 dB duckt.
   `setSpeaker()` weiß bereits, wann jemand spricht; das Ducking ist eine Zeile dort.

## B · Interaktion der Avatare

1. **Die Bewegungs- und Garderoben-Panels tun im Kino nichts.** `setOutfit(){}` und `setAction(){}`
   (`cinema.js:95`) sind leere Stummel, aber `motionControls()` und `wardrobeControls()`
   (`compass-gespraechsraum.js:147,192`) stehen weiter im Dialog. Bene stellt „Tanzen“ ein, das Bild
   bleibt stehen, keine Rückmeldung. Ein Knopf, der nichts tut, ist schlimmer als kein Knopf.
   Entweder im Kino-Modus ausblenden, oder — besser — die Auswahl auf eine Szene abbilden
   („Feier“ + Goa → scene-16).

2. **„John spricht“ steht unter dem Bild statt auf ihm.** `setSpeaker` schreibt nur den Text in die
   Meta-Zeile. Auf dem Bild passiert nichts. Cheapest big win: je Szene die Position von John und
   Madeleine (zwei Koordinaten), dann beim Sprechen ein sanfter Push von 3 % mit `transform-origin`
   auf den Sprecher, die andere Bildhälfte 10 % dunkler — das ist ein Rack-Focus, und plötzlich
   „schaut“ der Film dahin, wo geredet wird.

3. **Untertitel laufen nicht mit der Stimme.** `SpeechSynthesisUtterance` liefert `onboundary` mit
   Wortgrenzen. Damit kann `.cinema-caption` das Gesagte wortweise unter den Sprecher legen — wie
   ein Untertitel, nicht wie ein Statusfeld. Das ist die Lippensynchronität, die ohne Video möglich
   ist, und sie kostet zwanzig Zeilen.

4. **Zwei Figuren, eine Stimme.** `compass-gespraechsraum.js:280` fällt für beide auf
   `voices.find(localService) || voices[0]` zurück — wählt Bene nichts, sprechen John und Madeleine
   mit derselben Browserstimme. Rate-Unterschied ist 0.96 zu 1.0, Pitch identisch. Mindestens: der
   Fallback schließt die Stimme der jeweils anderen Figur aus; John `pitch .85 rate .94`, Madeleine
   `pitch 1.1 rate 1.02`; Picard `pitch .9 rate .93` ist schon gesetzt.

5. **Kein Atem zwischen den Sprechern.** `speakNext()` reiht die Züge nahtlos aneinander. Beim
   Sprecherwechsel 400–600 ms Pause, an Satzenden 150 ms — das ist der Schnittrhythmus eines
   Dialogs. Ohne Pause klingt es wie ein Anrufbeantworter.

6. **Man kann niemanden ansprechen.** Die einzige Interaktion mit den Figuren ist „Mit dieser
   Stimmung ins Gespräch“. Das Formular kennt `recipient` (beide/john/madeleine), aber vom Bild aus
   führt kein Weg dorthin. Mit den Ankern aus B.2: Klick auf Madeleine → `recipient='madeleine'`,
   Caption „Du wendest Dich an Madeleine“. Das ist die Geste, die aus Kulisse Gegenüber macht.

7. **Der Eintritt ist ein Schnitt, kein Gang.** `arrive()` (`cinema.js:74`) blendet den Titel aus,
   wartet 2,2 s auf einem stehenden Picard und tauscht dann hart das Bild. Besser: der Push-in auf
   Picards Geste läuft während seiner Begrüßung weiter, und der Dissolve zur Bar setzt ein, wenn
   `guideSpeech.onend` feuert — nicht nach einem festen Timer. Dann führt Picard tatsächlich hinein.

## C · Was die Illusion sofort bricht (kleine Fixes)

- `cinema.js:56`: „Filmstill · 1672 × 941 px“ steht mitten im Kino. Kein Film zeigt seine Pixel.
  Dort gehört die Szene hin: „50 mm · Halbtotale · Bar“.
- `cinema.js:68`: `getVoices()` ist in Chrome beim ersten Aufruf leer → Picards Begrüßung meldet
  „keine Browserstimme“, obwohl es welche gibt. Der Gesprächsraum hört auf `voiceschanged`, das Kino nicht.
- `cinema.js:58`: Fällt ein Still aus, lädt `bar.png` — das Bild der alten Fotoporträt-Ansicht. Zwei
  Bildsprachen in einem Raum. Fallback sollte `cinema-bar.png` sein.
- `cinema.js:92`: Tab-Wechsel während der 2,2 s Intro wirft Bene zurück an den Empfang.
- `cinema.js:75`: Themenwahl hängt am Hostnamen `bene.vaikuntha.eu` — die Werkzeuge laufen auf
  `*.vishnuartists.com`. Besser über `options` hereinreichen.

## D · Reihenfolge

Was heute Nachmittag geht und morgen sichtbar ist:

1. Sprecher-Anker + Rack-Focus + Klick-auf-Figur (B.2, B.6) — eine Datei `scene-anchors.json`.
2. Untertitel per `onboundary` (B.3).
3. Stimmen trennen + Atempausen (B.4, B.5).
4. Kamerabewegung aus `motion` ableiten + Schnittarten (A.1, A.2).
5. Raumton je Ort mit Ducking (A.6).
6. Leere Panels im Kino-Modus verstecken (B.1), die vier kleinen Fixes aus C.

Was bleibt und Geld oder Zugänge braucht: Video-Manifest + erste generierte Clips (A.3), Formate
AVIF + Vorladen (A.4), Premium-Stimmen. Das Manifest lässt sich vorher bauen — dann ist der Tag, an
dem der erste Clip kommt, ein Datei-Upload und kein Umbau.

## E · Live-Probe 12.09.2026 (john-server :8787, Tür :8788, In-App-Browser)

- **Upload bestätigt:** `site/.publish-state/bene.json` führt alle 56 Holodeck-Bilder und die neun Engine-Dateien —
  Astras „30 Filmszenen plus sechs Charakterbilder live“ stimmt für bene.; die Team-Instanzen und die Demo
  tragen nichts davon (richtig so, `build-compass.ps1:148`).
- **Eintritt funktioniert:** Empfang → „Erst einmal ankommen“ → nach 2,2 s scene-02, Kapitel „02 / VERSTEHEN“,
  Caption „Nimm Dir einen Moment.“, Themenkarten sichtbar. Keine Konsolenfehler.
- **Ladefolge ist verkehrt:** `paintScene()` malt zuerst die Fotoporträt-Ansicht und lädt dabei
  `john-/bene-/mona-wardrobe-v2.png` + `bar.png` (7,4 MB) — der john-server arbeitet seriell, also warten
  `scenes.js`/`production.js` und `cinema-welcome.png` dahinter. Beim ersten Öffnen stand 3,5 s lang die
  Porträt-Ansicht, danach ein schwarzer Kinorahmen, dann Picard. Der Vorhang geht auf, bevor der Film da ist.
  → Bei `use3d` gar nicht erst die Porträts malen; dunkle Bühne + Poster, bis `cinema.js` da ist.
- **Garderoben-Auswahl ist im Kino tot:** „John Garderobe“ auf „CEO“ gestellt → Bild unverändert, kein Hinweis
  (bestätigt B.1). `motionControls()`/`startMotions()` werden nirgends aufgerufen — ~60 Zeilen toter Code.
- **Stimmen hier:** drei deutsche Microsoft-Stimmen (Hedda, Katja, Stefan). `fillVoices()` verteilt nach Index,
  also John/Madeleine/Picard verschieden — bei Sprachen mit nur ein oder zwei Stimmen (Hindi!) fällt das
  zusammen, und bei „Stimme wählen“ leer greift für beide derselbe `localService`-Fallback (B.4).
- **Nicht getestet:** Mikrofon (kein Audio im In-App-Browser), Picards Sprachbegrüßung, echter Gesprächszug
  („Eintreten & Gespräch beginnen“ sendet sofort einen Auftrag an die Tür — bewusst nicht ausgelöst).
