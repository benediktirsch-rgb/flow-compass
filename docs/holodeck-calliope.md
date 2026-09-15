# Holodeck · Produktionsmappe für Calliope

> Erzeugt am 2026-09-15 von `tools/holodeck-storyboard.mjs` aus `holodeck-engine/scenes.js`, `production.js`, `studio-direction.js`.
> Nichts hier von Hand ändern — Quelle anpassen, Generator neu laufen lassen. Maschinenlesbar: `docs/holodeck-storyboard.json`.

## 1 · Calliope anschließen (Benes Schritt, einmalig)

Calliope (calliopelabs.co) ist ein eigener MCP-Connector, nicht im Claude-Verzeichnis. Anmeldung und Zustimmung kann nur Bene geben.

1. Claude Desktop → **Customize → Connectors** → **+** → **Add custom connector**.
2. Name `Calliope`, URL `https://www.calliopelabs.co/api/mcp` → **Add**.
3. **Connect** → Calliope-Konto anmelden (oder anlegen) → Zustimmung bestätigen.
4. Im Chat **+ → Connectors** → Calliope einschalten.

Gratis-Plan: genau **ein** eigener Connector. Ist der Platz belegt, erst den anderen entfernen.
Für Claude Code (CLI, ohne OAuth-Fenster) bräuchte es einen Calliope-API-Key als User-Umgebungsvariable — nie in einer Datei im Repo.

## 2 · Was kostet was

| Werkzeug | Credits | Wofür hier |
|---|---|---|
| Scriptwriting, Storyboard | keine | diese Mappe prüfen und glätten |
| Video aus Brief / Skript / Sprecher-Audio | ja | die Raum-Clips (Stufe 1–2), der Trailer (Stufe 3) |
| Timeline (split, retime, regenerate), Render, Download | ja | Nachbessern einzelner Clips |

Rate-Limits laut Anbieter: Starter 100/min · 5 000/Tag, Pro ×2, Creator ×4. Die Claude-Nutzungsgrenzen des Gratis-Plans drosseln lange Mehrschritt-Läufe — deshalb **ein Clip je Chat-Runde**, nicht „alle 32 auf einmal“.

## 3 · Der Ablauf, sobald Calliope verbunden ist

1. **Test:** „Nimm `docs/holodeck-storyboard.json`, Szene `scene-02`. Lass Calliope Storyboard und Prompt prüfen (Gratis-Werkzeug), dann **einen** Clip rendern: 10 s, 16:9, stumm, loopbar, Startbild `holodeck-assets/scene-02.png`.“
2. **Herunterladen** (MP4) — der Download ist ein Schritt, den Bene freigibt.
3. **Einbauen:** `powershell -NoProfile -File tools/holodeck-clip-einbauen.ps1 -Szene scene-02 -Clip "<Downloads>/scene-02.mp4" -Optimieren` — prüft Länge, Codec und Größe, legt den Clip in **beide** Asset-Ordner (flow-compass und john-agent) und trägt `video` im Manifest ein. `-Liste` zeigt den Stand, `-Entfernen` nimmt einen Clip wieder heraus (der Raum fällt still aufs Standbild zurück).
4. **Ansehen:** `build-compass.ps1` → john-server :8787 → Holodeck → „An die Bar“. Läuft der Clip, steht unten „Bewegungsclip · keine Live-Lippensynchronität“.
5. **Ausrollen:** `publish-compass.ps1` (oder die Aufgabe „Vishnu Flow Compass publish“ abwarten) — `motion/` und das Manifest gehen mit.
6. Erst dann die nächsten sechs Räume (Stufe 1), dann Stufe 2.

**Offen, bis Calliope verbunden ist:** ob Calliope ein **Startbild** (Image-to-Video) annimmt. Ohne Startbild trifft kein Modell die drei Gesichter — dann taugen die Clips nur für Räume **ohne Menschen** (Empfang vor dem Eintritt, Enterprise-Fenster), und die 30 Szenen bleiben Stills. Das entscheidet sich beim ersten Test-Clip.

## 4 · Regeln für jeden Clip

- Start from the reference frame (the approved still). Keep every person exactly as shown: face, hair, clothing, seat and position. Do not add, remove or replace people.
- No spoken words, no lip movement, no captions, no text, no logos. Dialogue is spoken live by the app on top of the clip.
- Loopable: the last frame must return to the pose and framing of the first frame. The app plays the clip muted in a loop.
- 16:9 landscape, 1920 x 1080, H.264 in MP4, no audio track needed (the app mutes it anyway).
- Photographic, calm, no stylisation, no fast cuts, no camera shake.

## 5 · Chargen

### Stufe 0 · Skript und Storyboard — Credits: keine

Diese Mappe. Calliopes Gratis-Werkzeuge (Scriptwriting, Storyboard) dürfen sie prüfen und in Benes Stimme glätten — das kostet nichts.

Szenen: cinema-welcome, enterprise-lounge, scene-01, scene-02, scene-03, scene-04, scene-05, scene-06, scene-07, scene-08, scene-09, scene-10, scene-11, scene-12, scene-13, scene-14, scene-15, scene-16, scene-17, scene-18, scene-19, scene-20, scene-21, scene-22, scene-23, scene-24, scene-25, scene-26, scene-27, scene-28, scene-29, scene-30

### Stufe 1 · Die sieben Räume — Credits: 7 Clips à 10 s

Ein Clip je Platz plus Empfang. Das sind die Bilder, die bei jedem Besuch laufen — hier lohnt jeder Credit. Erst EINEN Test-Clip (scene-02) rendern, einbauen, im Raum ansehen, dann die anderen sechs.

Szenen: cinema-welcome, enterprise-lounge, scene-02, scene-07, scene-13, scene-19, scene-25

### Stufe 2 · Die Stimmungen — Credits: 24 Clips à 10 s

Die übrigen 24 Szenen der Bibliothek (Kapitel-Sprünge aus dem Gesprächsraum). Nur nach Stufe 1, und nur die Orte, die Bene wirklich besucht.

Szenen: scene-01, scene-03, scene-04, scene-05, scene-06, scene-08, scene-09, scene-10, scene-11, scene-12, scene-14, scene-15, scene-16, scene-17, scene-18, scene-20, scene-21, scene-22, scene-23, scene-24, scene-26, scene-27, scene-28, scene-29, scene-30

### Stufe 3 · Ein Trailer — Credits: ein Film, 60–90 s, mit Musik

Aus den 30 Skriptzeilen ein Vorspann mit Calliopes Sprecher- und Musikspur — für die Brücke, nicht für den Raum. Der Raum spricht live mit John; ein fertig gesprochener Film würde dort lügen.

Szenen: trailer

## 6 · Besetzung und Ton (Regie, keine Behauptung verfügbarer Stimmen)

- **Mona · Madeleine** — Klug, warm und spielerisch; eine verführerische Stimme mit dezentem französischem Akzent. Natürlich sprechen, ohne Akzent-Parodie. _(Casting offen · Browserstimme ist eine Vorschau)_
- **John** — Sonor, lässig, charmant und mit trockenem Humor. Benes Casting-Referenz: die deutsche John-Travolta-Synchronwirkung. In CEO-Momenten klar und ruhig. _(Casting offen · keine Original-Synchronstimme)_
- **Picard · Empfang** — Ruhig, würdevoll, präzise und einladend; Atempausen statt Pathos. _(Casting offen · synthetische Vorschau)_

Mix: Gespräch hat Vorrang. Musik während Sprache deutlich absenken, weiche Übergänge zwischen Orten, kein automatischer Ton beim Öffnen. Raumgeräusche bleiben leise. Eine eigens produzierte oder entsprechend lizenzierte Aufnahme verwenden.

## 7 · Die Szenen

### cinema-welcome · Empfang

**Ort:** Empfang im Hotel Vaikuntha · **Stimmung:** Ankommen · **Tugend:** Gastfreundschaft  
**Startbild:** `holodeck-assets/cinema-welcome.png` · **Ziel:** `holodeck-assets/motion/cinema-welcome.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 12 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: the reception of Hotel Vaikuntha: a dignified concierge beside the door to the bar, lotus emblem, warm evening light. Cast: the concierge exactly as in the reference frame, dignified and calm. Motion: he stands ready, a small welcoming gesture toward the door, breathing, warm light flicker; nobody speaks. Camera: locked-off, very slow push-in (about 2 %).

**Kamera (Regie):** 35 mm · Establishing Shot, Blick zur Tür; Picard ruhig, eine Geste.

**Musik:** Akustischer Kontrabass, Besen auf dem Schlagzeug, warmes Klavier und sparsame Jazzharmonik · 60 bpm · Viel Stille, ausklingende Töne; kein antreibender Rhythmus.

### enterprise-lounge · Enterprise-Lounge

**Ort:** Auf der Enterprise · **Stimmung:** Coaching zwischen den Sternen · **Tugend:** Weitblick  
**Startbild:** `holodeck-assets/enterprise-lounge.png` · **Ziel:** `holodeck-assets/motion/enterprise-lounge.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 24 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: the lounge of a starship: a wide observation window with slowly drifting stars, soft blue-white panel light, two armchairs. Cast: everyone exactly as in the reference frame. Motion: stars drift slowly past the window, panel light breathes, the people are almost still; nobody speaks. Camera: locked-off, very slow push-in (about 2 %).

**Kamera (Regie):** 28 mm · weite Totale, Sterne ziehen langsam, Figuren fast still.

**Musik:** Weite Flächen, tiefe Streicher, ein einzelner Klavierton · 58 bpm · Viel Stille, ausklingende Töne; kein antreibender Rhythmus.

### scene-01 · Erst einmal landen

**Ort:** Bar im Hotel Vaikuntha · **Stimmung:** Ruhe & Buddha-Vibe · **Tugend:** Mitgefühl und Besonnenheit  
**Startbild:** `holodeck-assets/scene-01.png` · **Ziel:** `holodeck-assets/motion/scene-01.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 24 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: the bar of Hotel Vaikuntha at night: warm amber light, dark wood counter, brass fixtures, a lotus emblem, glasses catching the light. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: almost still: natural breathing, a slow blink, candle or fire flicker, subtle ambient motion; nobody speaks. Camera: locked-off, very slow push-in (about 2 %). Mood: Ruhe & Buddha-Vibe (Mitgefühl und Besonnenheit).

**Kamera (Regie):** 24 mm · langsame Annäherung, dann ruhige Halbtotale. Atempausen, Wind oder leises Raumgeräusch.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Lass uns erst ankommen. Welcher Gedanke sitzt heute mit Dir an diesem Tisch?
- **John:** Ich lasse das Telefon liegen. Heute hören wir einander wirklich zu.

**Musik:** Akustischer Kontrabass, Besen auf dem Schlagzeug, warmes Klavier und sparsame Jazzharmonik · 72 bpm · Viel Stille, ausklingende Töne; kein antreibender Rhythmus.

### scene-02 · Die eine klare Entscheidung

**Ort:** Bar im Hotel Vaikuntha · **Stimmung:** Geschäftlich smart · **Tugend:** Ehrlichkeit und Verlässlichkeit  
**Startbild:** `holodeck-assets/scene-02.png` · **Ziel:** `holodeck-assets/motion/scene-02.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 26 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: the bar of Hotel Vaikuntha at night: warm amber light, dark wood counter, brass fixtures, a lotus emblem, glasses catching the light. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: small purposeful gestures: a hand on the notebook, an exchanged glance, a short nod; nobody speaks. Camera: slow push-in toward the faces (about 4 %). Mood: Geschäftlich smart (Ehrlichkeit und Verlässlichkeit).

**Kamera (Regie):** 50 mm · Blickwechsel und Hand am Notizbuch. Präzise Sätze, eine Pause vor der Entscheidung.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Wenn wir für John und Madeleine heute nur eine Verbindung verbessern: welche würde Deinen Alltag am meisten erleichtern?
- **Madeleine:** Dann prüfen wir zuerst, was schon funktioniert, bevor wir etwas versprechen.

**Musik:** Akustischer Kontrabass, Besen auf dem Schlagzeug, warmes Klavier und sparsame Jazzharmonik · 72 bpm · Leichter, regelmäßiger Puls; beim entscheidenden Satz fast ganz ausblenden.

### scene-03 · Der letzte Toast

**Ort:** Bar im Hotel Vaikuntha · **Stimmung:** Ein Glas zu viel · **Tugend:** Verantwortung und Freundschaft  
**Startbild:** `holodeck-assets/scene-03.png` · **Ziel:** `holodeck-assets/motion/scene-03.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 28 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: the bar of Hotel Vaikuntha at night: warm amber light, dark wood counter, brass fixtures, a lotus emblem, glasses catching the light. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: relaxed warmth: quiet laughter, glasses raised gently, loose easy movement; nobody speaks. Camera: gentle lateral drift left to right, no zoom. Mood: Ein Glas zu viel (Verantwortung und Freundschaft).

**Kamera (Regie):** 35 mm · kleine Verzögerung beim Antworten, warmes Lachen; ein Freund schiebt Wasser heran. Heimfahrt bleibt organisiert.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Mein nächster genialer Einfall lautet: Wasser. Über große Zusagen sprechen wir morgen mit klarem Kopf.
- **Madeleine:** Einverstanden. Wir können feiern und trotzdem aufeinander aufpassen.

**Musik:** Akustischer Kontrabass, Besen auf dem Schlagzeug, warmes Klavier und sparsame Jazzharmonik · 72 bpm · Wärmer und rhythmischer, lockere kleine Akzente; Musik verdeckt keine Sprache.

### scene-04 · Ein Blick über den Glasrand

**Ort:** Bar im Hotel Vaikuntha · **Stimmung:** Flirt & Abendglanz · **Tugend:** Respekt und Aufrichtigkeit  
**Startbild:** `holodeck-assets/scene-04.png` · **Ziel:** `holodeck-assets/motion/scene-04.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 30 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: the bar of Hotel Vaikuntha at night: warm amber light, dark wood counter, brass fixtures, a lotus emblem, glasses catching the light. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: a held glance, a small smile, a slight lean in, hair moving in a light breeze; nobody speaks. Camera: slow push-in toward the faces (about 3 %). Mood: Flirt & Abendglanz (Respekt und Aufrichtigkeit).

**Kamera (Regie):** 85 mm · Blick, kleines Lächeln, dann bewusster Gegenschnitt. Humor und freie Antwort, kein Druck.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Du siehst aus, als würdest Du gleich eine spannende Frage stellen. Ich hoffe, sie ist schwieriger als mein Cocktail.
- **John:** Ich halte mich für einen Moment an mein Glas. Diese Frage gehört Euch.

**Musik:** Akustischer Kontrabass, Besen auf dem Schlagzeug, warmes Klavier und sparsame Jazzharmonik · 72 bpm · Wenige warme Töne, Platz für Blickkontakt und Pausen; keine übertriebene Verführungsmusik.

### scene-05 · Klartext an der Bar

**Ort:** Bar im Hotel Vaikuntha · **Stimmung:** Sauer, aber fair · **Tugend:** Gerechtigkeit und Selbstbeherrschung  
**Startbild:** `holodeck-assets/scene-05.png` · **Ziel:** `holodeck-assets/motion/scene-05.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 32 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: the bar of Hotel Vaikuntha at night: warm amber light, dark wood counter, brass fixtures, a lotus emblem, glasses catching the light. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: tense stillness: a slow exhale, one person looks away and back, hands still; nobody speaks. Camera: gentle lateral drift right to left, slightly tighter frame. Mood: Sauer, aber fair (Gerechtigkeit und Selbstbeherrschung).

**Kamera (Regie):** 50 mm · zunächst feste Kamera und Abstand, beim Zuhören weicher Gegenschnitt. Ärger bekommt klare Worte.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Ich ärgere mich, wenn ein Versprechen größer klingt als das Ergebnis. Lass uns konkret werden.
- **John:** Was hat gefehlt? Ich höre zu und verteidige mich danach, falls es noch nötig ist.

**Musik:** Akustischer Kontrabass, Besen auf dem Schlagzeug, warmes Klavier und sparsame Jazzharmonik · 72 bpm · Rhythmus zurücknehmen, Spannung sparsam halten; beim Zuhören Raum für Stille lassen.

### scene-06 · Der kleine Irrtum

**Ort:** Bar im Hotel Vaikuntha · **Stimmung:** Besserwissen & Umdenken · **Tugend:** Wahrhaftigkeit und Demut  
**Startbild:** `holodeck-assets/scene-06.png` · **Ziel:** `holodeck-assets/motion/scene-06.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 34 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: the bar of Hotel Vaikuntha at night: warm amber light, dark wood counter, brass fixtures, a lotus emblem, glasses catching the light. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: a moment of realization: a face brightens, the light shifts a little, everyone settles; nobody speaks. Camera: slow pull-back from a tight frame to the half-total. Mood: Besserwissen & Umdenken (Wahrhaftigkeit und Demut).

**Kamera (Regie):** 50 mm · selbstsicherer Einsatz, Pause beim Gegenargument, entspanntes Zurücklehnen beim Eingeständnis.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Ich wollte gerade behaupten, das sei ganz einfach. Das war womöglich mein erster Fehler.
- **Madeleine:** Gut. Dann müssen wir jetzt nur noch herausfinden, was daran wirklich schwierig ist.

**Musik:** Akustischer Kontrabass, Besen auf dem Schlagzeug, warmes Klavier und sparsame Jazzharmonik · 72 bpm · Kurzer heller Akzent beim Perspektivwechsel, dann ruhige offene Harmonie.

### scene-07 · Stille vor den Gipfeln

**Ort:** Berghütte · **Stimmung:** Ruhe & Buddha-Vibe · **Tugend:** Mitgefühl und Besonnenheit  
**Startbild:** `holodeck-assets/scene-07.png` · **Ziel:** `holodeck-assets/motion/scene-07.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 24 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a mountain cabin interior by a crackling fireplace: wooden table, wool blankets, firelight, cool snow light in the window. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: almost still: natural breathing, a slow blink, candle or fire flicker, subtle ambient motion; nobody speaks. Camera: locked-off, very slow push-in (about 2 %). Mood: Ruhe & Buddha-Vibe (Mitgefühl und Besonnenheit).

**Kamera (Regie):** 24 mm · langsame Annäherung, dann ruhige Halbtotale. Atempausen, Wind oder leises Raumgeräusch.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Hier oben müssen wir nichts beeindrucken. Was möchtest Du für einen Moment loslassen?
- **John:** Wir können still sein. Ein guter Plan hält eine Pause aus.

**Musik:** Akustische Gitarre, warmes Cello, leise Holzpercussion und Kaminatmosphäre · 64 bpm · Viel Stille, ausklingende Töne; kein antreibender Rhythmus.

### scene-08 · Ein Plan mit Bodenhaftung

**Ort:** Berghütte · **Stimmung:** Geschäftlich smart · **Tugend:** Ehrlichkeit und Verlässlichkeit  
**Startbild:** `holodeck-assets/scene-08.png` · **Ziel:** `holodeck-assets/motion/scene-08.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 26 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a mountain cabin interior by a crackling fireplace: wooden table, wool blankets, firelight, cool snow light in the window. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: small purposeful gestures: a hand on the notebook, an exchanged glance, a short nod; nobody speaks. Camera: slow push-in toward the faces (about 4 %). Mood: Geschäftlich smart (Ehrlichkeit und Verlässlichkeit).

**Kamera (Regie):** 50 mm · Blickwechsel und Hand am Notizbuch. Präzise Sätze, eine Pause vor der Entscheidung.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Was nehmen wir mit auf den nächsten Abschnitt, und was macht den Rucksack nur schwerer?
- **Madeleine:** Ich schreibe nur auf, was Du wirklich gewählt hast. Der Rest bleibt Möglichkeit.

**Musik:** Akustische Gitarre, warmes Cello, leise Holzpercussion und Kaminatmosphäre · 64 bpm · Leichter, regelmäßiger Puls; beim entscheidenden Satz fast ganz ausblenden.

### scene-09 · Hüttenabend mit Wasserpause

**Ort:** Berghütte · **Stimmung:** Ein Glas zu viel · **Tugend:** Verantwortung und Freundschaft  
**Startbild:** `holodeck-assets/scene-09.png` · **Ziel:** `holodeck-assets/motion/scene-09.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 28 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a mountain cabin interior by a crackling fireplace: wooden table, wool blankets, firelight, cool snow light in the window. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: relaxed warmth: quiet laughter, glasses raised gently, loose easy movement; nobody speaks. Camera: gentle lateral drift left to right, no zoom. Mood: Ein Glas zu viel (Verantwortung und Freundschaft).

**Kamera (Regie):** 35 mm · kleine Verzögerung beim Antworten, warmes Lachen; ein Freund schiebt Wasser heran. Heimfahrt bleibt organisiert.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Auf den Abend. Und auf die vernünftige Entscheidung, heute nirgendwo mehr hinfahren zu müssen.
- **Madeleine:** Wasser steht bereit. Die besten Geschichten brauchen keinen Beweis durch ein weiteres Glas.

**Musik:** Akustische Gitarre, warmes Cello, leise Holzpercussion und Kaminatmosphäre · 64 bpm · Wärmer und rhythmischer, lockere kleine Akzente; Musik verdeckt keine Sprache.

### scene-10 · Feuerlicht und Gegenfragen

**Ort:** Berghütte · **Stimmung:** Flirt & Abendglanz · **Tugend:** Respekt und Aufrichtigkeit  
**Startbild:** `holodeck-assets/scene-10.png` · **Ziel:** `holodeck-assets/motion/scene-10.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 30 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a mountain cabin interior by a crackling fireplace: wooden table, wool blankets, firelight, cool snow light in the window. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: a held glance, a small smile, a slight lean in, hair moving in a light breeze; nobody speaks. Camera: slow push-in toward the faces (about 3 %). Mood: Flirt & Abendglanz (Respekt und Aufrichtigkeit).

**Kamera (Regie):** 85 mm · Blick, kleines Lächeln, dann bewusster Gegenschnitt. Humor und freie Antwort, kein Druck.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Du stellst am Kamin erstaunlich ernste Fragen. Ist das Deine Art, interessant zu sein?
- **John:** Er hat jedenfalls gute Gesellschaft. Jetzt muss die Antwort nur noch mithalten.

**Musik:** Akustische Gitarre, warmes Cello, leise Holzpercussion und Kaminatmosphäre · 64 bpm · Wenige warme Töne, Platz für Blickkontakt und Pausen; keine übertriebene Verführungsmusik.

### scene-11 · Wenn Nähe Reibung macht

**Ort:** Berghütte · **Stimmung:** Sauer, aber fair · **Tugend:** Gerechtigkeit und Selbstbeherrschung  
**Startbild:** `holodeck-assets/scene-11.png` · **Ziel:** `holodeck-assets/motion/scene-11.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 32 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a mountain cabin interior by a crackling fireplace: wooden table, wool blankets, firelight, cool snow light in the window. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: tense stillness: a slow exhale, one person looks away and back, hands still; nobody speaks. Camera: gentle lateral drift right to left, slightly tighter frame. Mood: Sauer, aber fair (Gerechtigkeit und Selbstbeherrschung).

**Kamera (Regie):** 50 mm · zunächst feste Kamera und Abstand, beim Zuhören weicher Gegenschnitt. Ärger bekommt klare Worte.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Ich brauche gerade etwas Abstand, damit ich fair bleiben kann. Wir sprechen gleich weiter.
- **John:** Nimm ihn Dir. Eine Pause ist keine Niederlage, wenn wir danach ehrlicher reden.

**Musik:** Akustische Gitarre, warmes Cello, leise Holzpercussion und Kaminatmosphäre · 64 bpm · Rhythmus zurücknehmen, Spannung sparsam halten; beim Zuhören Raum für Stille lassen.

### scene-12 · Die Karte ist nicht der Berg

**Ort:** Berghütte · **Stimmung:** Besserwissen & Umdenken · **Tugend:** Wahrhaftigkeit und Demut  
**Startbild:** `holodeck-assets/scene-12.png` · **Ziel:** `holodeck-assets/motion/scene-12.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 34 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a mountain cabin interior by a crackling fireplace: wooden table, wool blankets, firelight, cool snow light in the window. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: a moment of realization: a face brightens, the light shifts a little, everyone settles; nobody speaks. Camera: slow pull-back from a tight frame to the half-total. Mood: Besserwissen & Umdenken (Wahrhaftigkeit und Demut).

**Kamera (Regie):** 50 mm · selbstsicherer Einsatz, Pause beim Gegenargument, entspanntes Zurücklehnen beim Eingeständnis.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Die Karte sah leichter aus als dieser Weg. Ich hätte früher fragen sollen.
- **Madeleine:** Dann fragen wir jetzt. Der Berg verhandelt ohnehin nicht mit unserer Eitelkeit.

**Musik:** Akustische Gitarre, warmes Cello, leise Holzpercussion und Kaminatmosphäre · 64 bpm · Kurzer heller Akzent beim Perspektivwechsel, dann ruhige offene Harmonie.

### scene-13 · Atem über dem Meer

**Ort:** Goa · **Stimmung:** Ruhe & Buddha-Vibe · **Tugend:** Mitgefühl und Besonnenheit  
**Startbild:** `holodeck-assets/scene-13.png` · **Ziel:** `holodeck-assets/motion/scene-13.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 24 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a beach in Goa at golden hour: palms, soft surf, a low table with drinks in the sand, warm haze. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: almost still: natural breathing, a slow blink, candle or fire flicker, subtle ambient motion; nobody speaks. Camera: locked-off, very slow push-in (about 2 %). Mood: Ruhe & Buddha-Vibe (Mitgefühl und Besonnenheit).

**Kamera (Regie):** 24 mm · langsame Annäherung, dann ruhige Halbtotale. Atempausen, Wind oder leises Raumgeräusch.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Hör einen Moment auf die Wellen. Was bleibt von Deiner Frage übrig, wenn wir den Zeitdruck herausnehmen?
- **John:** Vielleicht etwas Kleineres, das sich wirklich beantworten lässt.

**Musik:** Organische Downtempo-Elektronik, dezente Handpercussion, weiche Bassimpulse und Meeresatmosphäre · 94 bpm · Viel Stille, ausklingende Töne; kein antreibender Rhythmus.

### scene-14 · Geschäfte mit Weitblick

**Ort:** Goa · **Stimmung:** Geschäftlich smart · **Tugend:** Ehrlichkeit und Verlässlichkeit  
**Startbild:** `holodeck-assets/scene-14.png` · **Ziel:** `holodeck-assets/motion/scene-14.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 26 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a beach in Goa at golden hour: palms, soft surf, a low table with drinks in the sand, warm haze. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: small purposeful gestures: a hand on the notebook, an exchanged glance, a short nod; nobody speaks. Camera: slow push-in toward the faces (about 4 %). Mood: Geschäftlich smart (Ehrlichkeit und Verlässlichkeit).

**Kamera (Regie):** 50 mm · Blickwechsel und Hand am Notizbuch. Präzise Sätze, eine Pause vor der Entscheidung.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Was würde den Menschen im Verein den nächsten Schritt leichter machen?
- **Madeleine:** Und wen sollten wir zuerst fragen, statt seine Bedürfnisse nur zu vermuten?

**Musik:** Organische Downtempo-Elektronik, dezente Handpercussion, weiche Bassimpulse und Meeresatmosphäre · 94 bpm · Leichter, regelmäßiger Puls; beim entscheidenden Satz fast ganz ausblenden.

### scene-15 · Nach der Goa-Party

**Ort:** Goa · **Stimmung:** Ein Glas zu viel · **Tugend:** Verantwortung und Freundschaft  
**Startbild:** `holodeck-assets/scene-15.png` · **Ziel:** `holodeck-assets/motion/scene-15.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 28 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a beach in Goa at golden hour: palms, soft surf, a low table with drinks in the sand, warm haze. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: relaxed warmth: quiet laughter, glasses raised gently, loose easy movement; nobody speaks. Camera: gentle lateral drift left to right, no zoom. Mood: Ein Glas zu viel (Verantwortung und Freundschaft).

**Kamera (Regie):** 35 mm · kleine Verzögerung beim Antworten, warmes Lachen; ein Freund schiebt Wasser heran. Heimfahrt bleibt organisiert.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Die Party war gut. Meine Verhandlung mit dem Schlaf wird jetzt allerdings sehr kurz.
- **Madeleine:** Wasser, eine sichere Heimfahrt und morgen keine Heldengeschichten über vergessene Details.

**Musik:** Organische Downtempo-Elektronik, dezente Handpercussion, weiche Bassimpulse und Meeresatmosphäre · 94 bpm · Wärmer und rhythmischer, lockere kleine Akzente; Musik verdeckt keine Sprache.

### scene-16 · Barfuß mit Abendglanz

**Ort:** Goa · **Stimmung:** Flirt & Abendglanz · **Tugend:** Respekt und Aufrichtigkeit  
**Startbild:** `holodeck-assets/scene-16.png` · **Ziel:** `holodeck-assets/motion/scene-16.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 30 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a beach in Goa at golden hour: palms, soft surf, a low table with drinks in the sand, warm haze. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: a held glance, a small smile, a slight lean in, hair moving in a light breeze; nobody speaks. Camera: slow push-in toward the faces (about 3 %). Mood: Flirt & Abendglanz (Respekt und Aufrichtigkeit).

**Kamera (Regie):** 85 mm · Blick, kleines Lächeln, dann bewusster Gegenschnitt. Humor und freie Antwort, kein Druck.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Barfuß wirkt selbst Dein Business-Blick ein wenig weniger gefährlich. Was hast Du wirklich vor?
- **John:** Ich hole uns einen Tisch. Hier darf eine Antwort auch einmal Zeit brauchen.

**Musik:** Organische Downtempo-Elektronik, dezente Handpercussion, weiche Bassimpulse und Meeresatmosphäre · 94 bpm · Wenige warme Töne, Platz für Blickkontakt und Pausen; keine übertriebene Verführungsmusik.

### scene-17 · Grenzen am Strand

**Ort:** Goa · **Stimmung:** Sauer, aber fair · **Tugend:** Gerechtigkeit und Selbstbeherrschung  
**Startbild:** `holodeck-assets/scene-17.png` · **Ziel:** `holodeck-assets/motion/scene-17.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 32 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a beach in Goa at golden hour: palms, soft surf, a low table with drinks in the sand, warm haze. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: tense stillness: a slow exhale, one person looks away and back, hands still; nobody speaks. Camera: gentle lateral drift right to left, slightly tighter frame. Mood: Sauer, aber fair (Gerechtigkeit und Selbstbeherrschung).

**Kamera (Regie):** 50 mm · zunächst feste Kamera und Abstand, beim Zuhören weicher Gegenschnitt. Ärger bekommt klare Worte.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Ich mag spontane Ideen. Aber ich möchte vorher wissen, was Du von mir erwartest.
- **John:** Dann sagen wir es klar. Ein Nein darf genauso leicht sein wie ein Ja.

**Musik:** Organische Downtempo-Elektronik, dezente Handpercussion, weiche Bassimpulse und Meeresatmosphäre · 94 bpm · Rhythmus zurücknehmen, Spannung sparsam halten; beim Zuhören Raum für Stille lassen.

### scene-18 · Nicht jede Gewissheit stimmt

**Ort:** Goa · **Stimmung:** Besserwissen & Umdenken · **Tugend:** Wahrhaftigkeit und Demut  
**Startbild:** `holodeck-assets/scene-18.png` · **Ziel:** `holodeck-assets/motion/scene-18.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 34 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a beach in Goa at golden hour: palms, soft surf, a low table with drinks in the sand, warm haze. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: a moment of realization: a face brightens, the light shifts a little, everyone settles; nobody speaks. Camera: slow pull-back from a tight frame to the half-total. Mood: Besserwissen & Umdenken (Wahrhaftigkeit und Demut).

**Kamera (Regie):** 50 mm · selbstsicherer Einsatz, Pause beim Gegenargument, entspanntes Zurücklehnen beim Eingeständnis.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Ich hielt meine Erfahrung für einen Beweis. Vielleicht war sie nur eine einzelne Geschichte.
- **Madeleine:** Lass uns eine zweite Perspektive suchen, bevor wir daraus eine Regel machen.

**Musik:** Organische Downtempo-Elektronik, dezente Handpercussion, weiche Bassimpulse und Meeresatmosphäre · 94 bpm · Kurzer heller Akzent beim Perspektivwechsel, dann ruhige offene Harmonie.

### scene-19 · Weite im Kopf

**Ort:** Anden · **Stimmung:** Ruhe & Buddha-Vibe · **Tugend:** Mitgefühl und Besonnenheit  
**Startbild:** `holodeck-assets/scene-19.png` · **Ziel:** `holodeck-assets/motion/scene-19.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 24 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a high Andean plateau at dawn: wide sky, distant snow peaks, thin cool light, wind in the grass. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: almost still: natural breathing, a slow blink, candle or fire flicker, subtle ambient motion; nobody speaks. Camera: locked-off, very slow push-in (about 2 %). Mood: Ruhe & Buddha-Vibe (Mitgefühl und Besonnenheit).

**Kamera (Regie):** 24 mm · langsame Annäherung, dann ruhige Halbtotale. Atempausen, Wind oder leises Raumgeräusch.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Die Weite löst unsere Frage nicht. Aber sie erinnert daran, dass wir mehr als eine Möglichkeit haben.
- **John:** Welche davon möchtest Du heute ernsthaft betrachten?

**Musik:** Behutsam eingesetzte Zupfsaiten, zurückhaltende Flötenfarbe, tiefe Streicher und weiter Raum · 66 bpm · Viel Stille, ausklingende Töne; kein antreibender Rhythmus.

### scene-20 · Ein Schritt über den Pass

**Ort:** Anden · **Stimmung:** Geschäftlich smart · **Tugend:** Ehrlichkeit und Verlässlichkeit  
**Startbild:** `holodeck-assets/scene-20.png` · **Ziel:** `holodeck-assets/motion/scene-20.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 26 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a high Andean plateau at dawn: wide sky, distant snow peaks, thin cool light, wind in the grass. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: small purposeful gestures: a hand on the notebook, an exchanged glance, a short nod; nobody speaks. Camera: slow push-in toward the faces (about 4 %). Mood: Geschäftlich smart (Ehrlichkeit und Verlässlichkeit).

**Kamera (Regie):** 50 mm · Blickwechsel und Hand am Notizbuch. Präzise Sätze, eine Pause vor der Entscheidung.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Welcher nächste Schritt ist klein genug, dass wir ihn tatsächlich gehen können?
- **Madeleine:** Und wer übernimmt ihn aus eigener Zusage? Namen schreiben wir erst danach dazu.

**Musik:** Behutsam eingesetzte Zupfsaiten, zurückhaltende Flötenfarbe, tiefe Streicher und weiter Raum · 66 bpm · Leichter, regelmäßiger Puls; beim entscheidenden Satz fast ganz ausblenden.

### scene-21 · Ein Toast auf den Weg

**Ort:** Anden · **Stimmung:** Ein Glas zu viel · **Tugend:** Verantwortung und Freundschaft  
**Startbild:** `holodeck-assets/scene-21.png` · **Ziel:** `holodeck-assets/motion/scene-21.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 28 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a high Andean plateau at dawn: wide sky, distant snow peaks, thin cool light, wind in the grass. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: relaxed warmth: quiet laughter, glasses raised gently, loose easy movement; nobody speaks. Camera: gentle lateral drift left to right, no zoom. Mood: Ein Glas zu viel (Verantwortung und Freundschaft).

**Kamera (Regie):** 35 mm · kleine Verzögerung beim Antworten, warmes Lachen; ein Freund schiebt Wasser heran. Heimfahrt bleibt organisiert.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Ich möchte auf die Mühe anstoßen. Einen Erfolg behaupten wir erst, wenn Du ihn bestätigt hast.
- **Madeleine:** Genau. Auch ein noch offener Weg verdient einen freundlichen Abend.

**Musik:** Behutsam eingesetzte Zupfsaiten, zurückhaltende Flötenfarbe, tiefe Streicher und weiter Raum · 66 bpm · Wärmer und rhythmischer, lockere kleine Akzente; Musik verdeckt keine Sprache.

### scene-22 · Ein Lächeln über den Wolken

**Ort:** Anden · **Stimmung:** Flirt & Abendglanz · **Tugend:** Respekt und Aufrichtigkeit  
**Startbild:** `holodeck-assets/scene-22.png` · **Ziel:** `holodeck-assets/motion/scene-22.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 30 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a high Andean plateau at dawn: wide sky, distant snow peaks, thin cool light, wind in the grass. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: a held glance, a small smile, a slight lean in, hair moving in a light breeze; nobody speaks. Camera: slow push-in toward the faces (about 3 %). Mood: Flirt & Abendglanz (Respekt und Aufrichtigkeit).

**Kamera (Regie):** 85 mm · Blick, kleines Lächeln, dann bewusster Gegenschnitt. Humor und freie Antwort, kein Druck.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** So viel Aussicht, und Du schaust trotzdem herüber. Das ist mindestens eine gute Gesprächseröffnung.
- **John:** Ich gebe zu: Gegen diesen Satz kommt mein Bergwissen gerade nicht an.

**Musik:** Behutsam eingesetzte Zupfsaiten, zurückhaltende Flötenfarbe, tiefe Streicher und weiter Raum · 66 bpm · Wenige warme Töne, Platz für Blickkontakt und Pausen; keine übertriebene Verführungsmusik.

### scene-23 · Gegenwind zulassen

**Ort:** Anden · **Stimmung:** Sauer, aber fair · **Tugend:** Gerechtigkeit und Selbstbeherrschung  
**Startbild:** `holodeck-assets/scene-23.png` · **Ziel:** `holodeck-assets/motion/scene-23.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 32 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a high Andean plateau at dawn: wide sky, distant snow peaks, thin cool light, wind in the grass. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: tense stillness: a slow exhale, one person looks away and back, hands still; nobody speaks. Camera: gentle lateral drift right to left, slightly tighter frame. Mood: Sauer, aber fair (Gerechtigkeit und Selbstbeherrschung).

**Kamera (Regie):** 50 mm · zunächst feste Kamera und Abstand, beim Zuhören weicher Gegenschnitt. Ärger bekommt klare Worte.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Wir sehen dieselbe Lage und ziehen verschiedene Schlüsse. Das macht mich ungeduldig, aber Dich nicht falsch.
- **John:** Dann trennen wir Beobachtung und Deutung. Mit welcher Tatsache sind wir beide einverstanden?

**Musik:** Behutsam eingesetzte Zupfsaiten, zurückhaltende Flötenfarbe, tiefe Streicher und weiter Raum · 66 bpm · Rhythmus zurücknehmen, Spannung sparsam halten; beim Zuhören Raum für Stille lassen.

### scene-24 · Die andere Perspektive

**Ort:** Anden · **Stimmung:** Besserwissen & Umdenken · **Tugend:** Wahrhaftigkeit und Demut  
**Startbild:** `holodeck-assets/scene-24.png` · **Ziel:** `holodeck-assets/motion/scene-24.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 34 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a high Andean plateau at dawn: wide sky, distant snow peaks, thin cool light, wind in the grass. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: a moment of realization: a face brightens, the light shifts a little, everyone settles; nobody speaks. Camera: slow pull-back from a tight frame to the half-total. Mood: Besserwissen & Umdenken (Wahrhaftigkeit und Demut).

**Kamera (Regie):** 50 mm · selbstsicherer Einsatz, Pause beim Gegenargument, entspanntes Zurücklehnen beim Eingeständnis.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Von hier sieht der Weg anders aus. Ich nehme meine erste Einschätzung zurück.
- **Madeleine:** Das ist eine nützliche Fähigkeit. Was ändern wir aufgrund der neuen Sicht?

**Musik:** Behutsam eingesetzte Zupfsaiten, zurückhaltende Flötenfarbe, tiefe Streicher und weiter Raum · 66 bpm · Kurzer heller Akzent beim Perspektivwechsel, dann ruhige offene Harmonie.

### scene-25 · Morgenlicht am Brunnen

**Ort:** Altstadt von Rom · **Stimmung:** Ruhe & Buddha-Vibe · **Tugend:** Mitgefühl und Besonnenheit  
**Startbild:** `holodeck-assets/scene-25.png` · **Ziel:** `holodeck-assets/motion/scene-25.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 24 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a small Roman piazza in the evening: warm stone, a fountain, café tables, strings of light. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: almost still: natural breathing, a slow blink, candle or fire flicker, subtle ambient motion; nobody speaks. Camera: locked-off, very slow push-in (about 2 %). Mood: Ruhe & Buddha-Vibe (Mitgefühl und Besonnenheit).

**Kamera (Regie):** 24 mm · langsame Annäherung, dann ruhige Halbtotale. Atempausen, Wind oder leises Raumgeräusch.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Bevor die Stadt laut wird: Welche eine Sache möchtest Du heute mit Aufmerksamkeit tun?
- **John:** Wir dürfen einen ruhigen Anfang wählen, ohne den ganzen Tag schon zu verplanen.

**Musik:** Nylongitarre, Kontrabass und einzelne Klaviertöne; leises Leben auf dem Platz · 78 bpm · Viel Stille, ausklingende Töne; kein antreibender Rhythmus.

### scene-26 · Eine Sache zu Ende bringen

**Ort:** Altstadt von Rom · **Stimmung:** Geschäftlich smart · **Tugend:** Ehrlichkeit und Verlässlichkeit  
**Startbild:** `holodeck-assets/scene-26.png` · **Ziel:** `holodeck-assets/motion/scene-26.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 26 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a small Roman piazza in the evening: warm stone, a fountain, café tables, strings of light. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: small purposeful gestures: a hand on the notebook, an exchanged glance, a short nod; nobody speaks. Camera: slow push-in toward the faces (about 4 %). Mood: Geschäftlich smart (Ehrlichkeit und Verlässlichkeit).

**Kamera (Regie):** 50 mm · Blickwechsel und Hand am Notizbuch. Präzise Sätze, eine Pause vor der Entscheidung.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Welche Entscheidung von uns braucht jetzt eine konkrete Handlung?
- **Madeleine:** Wenn wir noch keine getroffen haben, sagen wir das. Ein schöner Satz ist noch kein Beschluss.

**Musik:** Nylongitarre, Kontrabass und einzelne Klaviertöne; leises Leben auf dem Platz · 78 bpm · Leichter, regelmäßiger Puls; beim entscheidenden Satz fast ganz ausblenden.

### scene-27 · Die letzte Runde am Platz

**Ort:** Altstadt von Rom · **Stimmung:** Ein Glas zu viel · **Tugend:** Verantwortung und Freundschaft  
**Startbild:** `holodeck-assets/scene-27.png` · **Ziel:** `holodeck-assets/motion/scene-27.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 28 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a small Roman piazza in the evening: warm stone, a fountain, café tables, strings of light. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: relaxed warmth: quiet laughter, glasses raised gently, loose easy movement; nobody speaks. Camera: gentle lateral drift left to right, no zoom. Mood: Ein Glas zu viel (Verantwortung und Freundschaft).

**Kamera (Regie):** 35 mm · kleine Verzögerung beim Antworten, warmes Lachen; ein Freund schiebt Wasser heran. Heimfahrt bleibt organisiert.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Eine letzte Runde am Platz, dann Wasser und ein geordneter Heimweg. Das ist mein heutiger Luxus.
- **Madeleine:** Meiner ist, morgen ohne Ausreden an diesen Abend denken zu können.

**Musik:** Nylongitarre, Kontrabass und einzelne Klaviertöne; leises Leben auf dem Platz · 78 bpm · Wärmer und rhythmischer, lockere kleine Akzente; Musik verdeckt keine Sprache.

### scene-28 · Dolce vita, klare Absichten

**Ort:** Altstadt von Rom · **Stimmung:** Flirt & Abendglanz · **Tugend:** Respekt und Aufrichtigkeit  
**Startbild:** `holodeck-assets/scene-28.png` · **Ziel:** `holodeck-assets/motion/scene-28.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 30 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a small Roman piazza in the evening: warm stone, a fountain, café tables, strings of light. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: a held glance, a small smile, a slight lean in, hair moving in a light breeze; nobody speaks. Camera: slow push-in toward the faces (about 3 %). Mood: Flirt & Abendglanz (Respekt und Aufrichtigkeit).

**Kamera (Regie):** 85 mm · Blick, kleines Lächeln, dann bewusster Gegenschnitt. Humor und freie Antwort, kein Druck.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Rom kann gut mit Andeutungen. Ich mag irgendwann trotzdem eine ehrliche Frage.
- **John:** Dann ist das jetzt ein ausgezeichneter Moment, sie zu stellen.

**Musik:** Nylongitarre, Kontrabass und einzelne Klaviertöne; leises Leben auf dem Platz · 78 bpm · Wenige warme Töne, Platz für Blickkontakt und Pausen; keine übertriebene Verführungsmusik.

### scene-29 · Ein Streit ohne Verlierer

**Ort:** Altstadt von Rom · **Stimmung:** Sauer, aber fair · **Tugend:** Gerechtigkeit und Selbstbeherrschung  
**Startbild:** `holodeck-assets/scene-29.png` · **Ziel:** `holodeck-assets/motion/scene-29.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 32 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a small Roman piazza in the evening: warm stone, a fountain, café tables, strings of light. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: tense stillness: a slow exhale, one person looks away and back, hands still; nobody speaks. Camera: gentle lateral drift right to left, slightly tighter frame. Mood: Sauer, aber fair (Gerechtigkeit und Selbstbeherrschung).

**Kamera (Regie):** 50 mm · zunächst feste Kamera und Abstand, beim Zuhören weicher Gegenschnitt. Ärger bekommt klare Worte.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **Madeleine:** Ich möchte nicht gewinnen und dabei unser Gespräch verlieren. Was ist Dir an diesem Punkt besonders wichtig?
- **John:** Ich sage es Dir. Und dann höre ich mir an, was ich bei Dir übersehen habe.

**Musik:** Nylongitarre, Kontrabass und einzelne Klaviertöne; leises Leben auf dem Platz · 78 bpm · Rhythmus zurücknehmen, Spannung sparsam halten; beim Zuhören Raum für Stille lassen.

### scene-30 · Sokratische Espresso-Pause

**Ort:** Altstadt von Rom · **Stimmung:** Besserwissen & Umdenken · **Tugend:** Wahrhaftigkeit und Demut  
**Startbild:** `holodeck-assets/scene-30.png` · **Ziel:** `holodeck-assets/motion/scene-30.mp4` · **Loop:** 10 s (Filmlänge laut Regie: 34 s)

**Prompt (Image-to-Video):** Image-to-video from the reference frame. Setting: a small Roman piazza in the evening: warm stone, a fountain, café tables, strings of light. Cast: the host: slim, athletic build, exactly as in the reference frame; Madeleine: dark hair, warm and attentive, exactly as in the reference frame; John: relaxed, charming, dry humour in his face, exactly as in the reference frame. Motion: a moment of realization: a face brightens, the light shifts a little, everyone settles; nobody speaks. Camera: slow pull-back from a tight frame to the half-total. Mood: Besserwissen & Umdenken (Wahrhaftigkeit und Demut).

**Kamera (Regie):** 50 mm · selbstsicherer Einsatz, Pause beim Gegenargument, entspanntes Zurücklehnen beim Eingeständnis.

**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**

- **John:** Mein Espresso ist stark. Meine Gewissheit war es offenbar zu früh.
- **Madeleine:** Dann behalten wir den Espresso und verbessern die Begründung. Welche Frage ist noch offen?

**Musik:** Nylongitarre, Kontrabass und einzelne Klaviertöne; leises Leben auf dem Platz · 78 bpm · Kurzer heller Akzent beim Perspektivwechsel, dann ruhige offene Harmonie.

