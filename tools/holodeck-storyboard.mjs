// Holodeck → Calliope: erzeugt aus der Regie-Bibliothek (scenes.js, production.js,
// studio-direction.js) eine Produktionsmappe, die ein Video-Werkzeug direkt lesen kann.
//
//   node tools/holodeck-storyboard.mjs
//
// schreibt docs/holodeck-storyboard.json (maschinenlesbar, je Szene: Startbild, Bewegungs-Prompt,
// Kamera, Skriptzeilen, Musik, Gesichtsanker) und docs/holodeck-calliope.md (für Menschen: Anschluss
// des Connectors, Credit-Plan, Ablauf, alle Szenenbriefe). Diese Datei ist die einzige Quelle für
// beide — nichts davon von Hand nachpflegen, sondern scenes.js ändern und neu erzeugen.
import {writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {scenes} = await import('../holodeck-engine/scenes.js');
const {voiceDirection, musicDirection, moodMusic, mixDirection} = await import('../holodeck-engine/production.js');
const {anchorsFor, directionFor} = await import('../holodeck-engine/studio-direction.js');

// Orte, wie sie auf den freigegebenen Stills stehen. Englisch, weil Video-Modelle englische
// Prompts am zuverlässigsten lesen; die deutschen Namen bleiben im Feld placeLabel.
const places = {
  bar: 'the bar of Hotel Vaikuntha at night: warm amber light, dark wood counter, brass fixtures, a lotus emblem, glasses catching the light',
  huette: 'a mountain cabin interior by a crackling fireplace: wooden table, wool blankets, firelight, cool snow light in the window',
  goa: 'a beach in Goa at golden hour: palms, soft surf, a low table with drinks in the sand, warm haze',
  anden: 'a high Andean plateau at dawn: wide sky, distant snow peaks, thin cool light, wind in the grass',
  rom: 'a small Roman piazza in the evening: warm stone, a fountain, café tables, strings of light',
  enterprise: 'the lounge of a starship: a wide observation window with slowly drifting stars, soft blue-white panel light, two armchairs',
  reception: 'the reception of Hotel Vaikuntha: a dignified concierge beside the door to the bar, lotus emblem, warm evening light',
  bruecke: 'the bridge of a starship, original design: a wide curved viewscreen showing a slow starfield, a raised captain\'s chair and two console seats in front of it, brushed metal and dark wood, soft amber and blue panel light; no emblems, no insignia, no lettering',
  aussicht: 'an observation lounge on a starship, original design: floor-to-ceiling windows on a nebula, a bar counter with a few glasses, low round tables, warm downlights against the cool light from outside; no emblems, no lettering',
  maschinenraum: 'the engine room of a starship, original design: a tall pulsing reactor column of blue-white light, catwalks and railings, a standing console, steam and haze in the depth; no emblems, no lettering'
};
const moodMotion = {
  ruhe: 'almost still: natural breathing, a slow blink, candle or fire flicker, subtle ambient motion; nobody speaks',
  business: 'small purposeful gestures: a hand on the notebook, an exchanged glance, a short nod; nobody speaks',
  feier: 'relaxed warmth: quiet laughter, glasses raised gently, loose easy movement; nobody speaks',
  flirt: 'a held glance, a small smile, a slight lean in, hair moving in a light breeze; nobody speaks',
  konflikt: 'tense stillness: a slow exhale, one person looks away and back, hands still; nobody speaks',
  erkenntnis: 'a moment of realization: a face brightens, the light shifts a little, everyone settles; nobody speaks'
};
const cameraWords = {
  ruhe: 'locked-off, very slow push-in (about 2 %)',
  business: 'slow push-in toward the faces (about 4 %)',
  feier: 'gentle lateral drift left to right, no zoom',
  konflikt: 'gentle lateral drift right to left, slightly tighter frame',
  flirt: 'slow push-in toward the faces (about 3 %)',
  erkenntnis: 'slow pull-back from a tight frame to the half-total'
};
const cast = {
  bene: 'the host: slim, athletic build, exactly as in the reference frame',
  madeleine: 'Madeleine: dark hair, warm and attentive, exactly as in the reference frame',
  john: 'John: relaxed, charming, dry humour in his face, exactly as in the reference frame'
};
const globalRules = [
  'Start from the reference frame (the approved still). Keep every person exactly as shown: face, hair, clothing, seat and position. Do not add, remove or replace people.',
  'No spoken words, no lip movement, no captions, no text, no logos. Dialogue is spoken live by the app on top of the clip.',
  'Loopable: the last frame must return to the pose and framing of the first frame. The app plays the clip muted in a loop.',
  '16:9 landscape, 1920 x 1080, H.264 in MP4, no audio track needed (the app mutes it anyway).',
  'Photographic, calm, no stylisation, no fast cuts, no camera shake.'
];
// Plätze im Erlebnisraum (experience.js › sit()) und der Empfang — das ist die erste Charge.
const placeDefault = {enterprise:'enterprise-lounge', bar:'scene-02', huette:'scene-07', goa:'scene-13', anden:'scene-19', rom:'scene-25'};
const LOOP = 10;

function sceneBrief(s) {
  return {
    asset: s.asset, id: s.id, title: s.title,
    place: s.place, placeLabel: s.placeLabel, mood: s.mood, moodLabel: s.moodLabel, virtue: s.virtue,
    referenceFrame: `holodeck-assets/${s.asset}.png`,
    target: `holodeck-assets/motion/${s.asset}.mp4`,
    filmDurationSeconds: s.duration, loopDurationSeconds: LOOP,
    visualPrompt: `Image-to-video from the reference frame. Setting: ${places[s.place]}. Cast: ${cast.bene}; ${cast.madeleine}; ${cast.john}. Motion: ${moodMotion[s.mood]}. Camera: ${cameraWords[s.mood]}. Mood: ${s.moodLabel} (${s.virtue}).`,
    cameraDe: s.motion,
    cameraCss: directionFor(s),
    script: s.lines.map(([speaker, text]) => ({speaker, text})),
    music: {palette: musicDirection[s.place]?.palette, tempo: musicDirection[s.place]?.tempo, mood: moodMusic[s.mood]},
    anchors: anchorsFor(s.asset)
  };
}
const extra = [
  {asset:'cinema-welcome', id:'00', title:'Empfang', place:'reception', placeLabel:'Empfang im Hotel Vaikuntha', mood:'ruhe', moodLabel:'Ankommen', virtue:'Gastfreundschaft',
   referenceFrame:'holodeck-assets/cinema-welcome.png', target:'holodeck-assets/motion/cinema-welcome.mp4', filmDurationSeconds:12, loopDurationSeconds:LOOP,
   visualPrompt:`Image-to-video from the reference frame. Setting: ${places.reception}. Cast: the concierge exactly as in the reference frame, dignified and calm. Motion: he stands ready, a small welcoming gesture toward the door, breathing, warm light flicker; nobody speaks. Camera: ${cameraWords.ruhe}.`,
   cameraDe:'35 mm · Establishing Shot, Blick zur Tür; Picard ruhig, eine Geste.', cameraCss: directionFor({mood:'ruhe'}), script:[],
   music:{palette:musicDirection.bar.palette, tempo:60, mood:moodMusic.ruhe}, anchors:{}},
  {asset:'enterprise-lounge', id:'E1', title:'Enterprise-Lounge', place:'enterprise', placeLabel:'Auf der Enterprise', mood:'ruhe', moodLabel:'Coaching zwischen den Sternen', virtue:'Weitblick',
   referenceFrame:'holodeck-assets/enterprise-lounge.png', target:'holodeck-assets/motion/enterprise-lounge.mp4', filmDurationSeconds:24, loopDurationSeconds:LOOP,
   visualPrompt:`Image-to-video from the reference frame. Setting: ${places.enterprise}. Cast: everyone exactly as in the reference frame. Motion: stars drift slowly past the window, panel light breathes, the people are almost still; nobody speaks. Camera: ${cameraWords.ruhe}.`,
   cameraDe:'28 mm · weite Totale, Sterne ziehen langsam, Figuren fast still.', cameraCss: directionFor({mood:'ruhe'}), script:[],
   music:{palette:'Weite Flächen, tiefe Streicher, ein einzelner Klavierton', tempo:58, mood:moodMusic.ruhe}, anchors:{}}
];
// Drei weitere Enterprise-Sets (16.09.2026, Bene: „mache es"). Eigene Entwürfe im Stil der Serie — keine Abzeichen, keine
// Schriftzüge, keine Gesichter echter Schauspieler. Erst als Standbild (Imagegen über Astra, Referenz enterprise-lounge.png
// + Avatar-Referenzen), dann optional als Loop. Einbau: tools/holodeck-clip-einbauen.ps1 -Standbild … -Platz "…".
// Benes Vorlagen (16.09.2026, OneDriveDesktopholodeck): Standbilder und Fan-Renderings der Serie. Sie gehen an
// Astra NUR als Stimmungsvorlage — übernommen werden Raumform, Licht und Materialien, nie Emblem, LCARS-Schrift, Banner oder Personen.
const VORLAGEN = {
  bruecke: {ordner:'brücke', dateien:['183546-436428-436425.png','GalaxyBr%3Fcke.webp','Deckenfenster_auf_der_Br%3Fcke_der_Enterprise-D.webp','star-trek-raumschiff-enterprise-bridge-replica.jpg'],
    uebernehmen:'Halbrunde Kommandoebene mit geschwungenem Holzgeländer, drei Sessel in der Mitte, beige Polster, helles Oberlicht als Kuppel, Wand aus Konsolen mit warmem Bernsteinlicht und einem kühlen blauen Lichtband.'},
  aussicht: {ordner:'enterprise', dateien:['skc3a4rmbild-212.jpg'],
    uebernehmen:'Gebogene Portale in Blauviolett, weiße Lichtbänder in Boden- und Deckenhöhe, Teppich in Graublau, eine freistehende Konsole als Blickpunkt — ins Warme gedreht und mit Panoramafenster statt Wandanzeigen.'},
  maschinenraum: {ordner:'maschinenraum', dateien:['Warpkern_der_Galaxy-Klasse.webp','Voyager_Maschinenraum.webp','NXMaschinen.webp'],
    uebernehmen:'Senkrechte, gerippte Lichtsäule in Blauweiß über zwei Ebenen, Galerie mit Geländer, Wände in Rotorange, ringförmige Plattform am Fuß der Säule.'},
  gitter: {ordner:'holodeck', dateien:['Holodeck_empty.webp'],
    uebernehmen:'Schwarzer Raum mit gelbem Gitter auf Boden und Wänden, eine Tür in der Rückwand — umgesetzt als eigene Animation beim Eintreten, kein Bild.'}
};
const castStill = 'the host (slim, athletic build), Madeleine (dark hair, warm) and John (relaxed, charming) exactly as on the reference images, seated or standing naturally in the set, mid-conversation, nobody looks into the camera';
const enterpriseSets = [
  {asset:'enterprise-bruecke', id:'E2', title:'Auf der Brücke', place:'bruecke', placeLabel:'Auf der Brücke', mood:'business', moodLabel:'Weitblick und klare Entscheidungen', virtue:'Verantwortung',
   platz:'bruecke|Auf die Brücke|Weitblick und klare Entscheidungen|bruecke', cameraDe:'28 mm · leicht erhöhte Totale von hinten links, der Sternenschirm füllt das obere Drittel.'},
  {asset:'enterprise-aussicht', id:'E3', title:'In der Aussichtslounge', place:'aussicht', placeLabel:'In der Aussichtslounge', mood:'ruhe', moodLabel:'Durchatmen mit Blick auf den Nebel', virtue:'Gelassenheit',
   platz:'aussicht|In die Aussichtslounge|Durchatmen mit Blick auf den Nebel|aussicht', cameraDe:'35 mm · Halbtotale, die Fenster als Lichtquelle im Rücken, Gläser im Vordergrund.'},
  {asset:'enterprise-maschinenraum', id:'E4', title:'Im Maschinenraum', place:'maschinenraum', placeLabel:'Im Maschinenraum', mood:'konflikt', moodLabel:'Unter Druck, aber am Werk', virtue:'Klarheit',
   platz:'maschinenraum|In den Maschinenraum|Unter Druck, aber am Werk|maschinenraum', cameraDe:'24 mm · Untersicht am Geländer, die Reaktorsäule als Lichtachse.'}
].map(s => ({...s, vorlagen:VORLAGEN[s.place],
  referenceFrame:'kein Still — Stilreferenz holodeck-assets/enterprise-lounge.png, Figurenreferenz bene-wardrobe-v2.png · madeleine-portrait.png · john-wardrobe-v2.png',
  target:`holodeck-assets/${s.asset}.png (Standbild 1672×941 oder 1920×1080), danach holodeck-assets/motion/${s.asset}.mp4`,
  filmDurationSeconds:24, loopDurationSeconds:LOOP,
  visualPrompt:`Still image, text-to-image with reference images. Setting: ${places[s.place]}. Cast: ${castStill}. Mood: ${s.moodLabel}. Light and palette matching the reference still of the lounge. Photographic, calm, 16:9.`,
  cameraCss:directionFor({mood:s.mood}), script:[], music:{palette:'Weite Flächen, tiefe Streicher, ein einzelner Klavierton', tempo:58, mood:moodMusic[s.mood]}, anchors:{}}));
const briefs = [...extra, ...enterpriseSets, ...scenes.map(sceneBrief)];
const batches = [
  {name:'Stufe 0 · Skript und Storyboard', credits:'keine', assets:briefs.map(b => b.asset),
   note:'Diese Mappe. Calliopes Gratis-Werkzeuge (Scriptwriting, Storyboard) dürfen sie prüfen und in Benes Stimme glätten — das kostet nichts.'},
  {name:'Stufe 1 · Die sieben Räume', credits:`7 Clips à ${LOOP} s`, assets:['cinema-welcome', ...Object.values(placeDefault)],
   note:'Ein Clip je Platz plus Empfang. Das sind die Bilder, die bei jedem Besuch laufen — hier lohnt jeder Credit. Erst EINEN Test-Clip (scene-02) rendern, einbauen, im Raum ansehen, dann die anderen sechs.'},
  {name:'Stufe 2 · Die Stimmungen', credits:`24 Clips à ${LOOP} s`, assets:scenes.map(s => s.asset).filter(a => !Object.values(placeDefault).includes(a)),
   note:'Die übrigen 24 Szenen der Bibliothek (Kapitel-Sprünge aus dem Gesprächsraum). Nur nach Stufe 1, und nur die Orte, die Bene wirklich besucht.'},
  {name:'Stufe 3 · Ein Trailer', credits:'ein Film, 60–90 s, mit Musik', assets:['trailer'],
   note:'Aus den 30 Skriptzeilen ein Vorspann mit Calliopes Sprecher- und Musikspur — für die Brücke, nicht für den Raum. Der Raum spricht live mit John; ein fertig gesprochener Film würde dort lügen.'}
];
const json = {
  version: 1, generatedAt: new Date().toISOString().slice(0, 10),
  source: 'holodeck-engine/scenes.js · production.js · studio-direction.js', generator: 'tools/holodeck-storyboard.mjs',
  cast, voiceDirection, mixDirection, globalRules, places, placeDefault, batches, scenes: briefs
};
writeFileSync(join(root, 'docs/holodeck-storyboard.json'), JSON.stringify(json, null, 2) + '\n');

const name = who => who === 'john' ? 'John' : who === 'madeleine' ? 'Madeleine' : who;
const md = [];
md.push('# Holodeck · Produktionsmappe für Calliope', '',
  `> Erzeugt am ${json.generatedAt} von \`tools/holodeck-storyboard.mjs\` aus \`holodeck-engine/scenes.js\`, \`production.js\`, \`studio-direction.js\`.`,
  '> Nichts hier von Hand ändern — Quelle anpassen, Generator neu laufen lassen. Maschinenlesbar: `docs/holodeck-storyboard.json`.', '',
  '## 1 · Calliope anschließen (Benes Schritt, einmalig)', '',
  'Calliope (calliopelabs.co) ist ein eigener MCP-Connector, nicht im Claude-Verzeichnis. Anmeldung und Zustimmung kann nur Bene geben.', '',
  '1. Claude Desktop → **Customize → Connectors** → **+** → **Add custom connector**.',
  '2. Name `Calliope`, URL `https://www.calliopelabs.co/api/mcp` → **Add**.',
  '3. **Connect** → Calliope-Konto anmelden (oder anlegen) → Zustimmung bestätigen.',
  '4. Im Chat **+ → Connectors** → Calliope einschalten.', '',
  'Gratis-Plan: genau **ein** eigener Connector. Ist der Platz belegt, erst den anderen entfernen.',
  'Für Claude Code (CLI, ohne OAuth-Fenster) bräuchte es einen Calliope-API-Key als User-Umgebungsvariable — nie in einer Datei im Repo.', '',
  '## 2 · Was kostet was', '',
  '| Werkzeug | Credits | Wofür hier |', '|---|---|---|',
  '| Scriptwriting, Storyboard | keine | diese Mappe prüfen und glätten |',
  '| Video aus Brief / Skript / Sprecher-Audio | ja | die Raum-Clips (Stufe 1–2), der Trailer (Stufe 3) |',
  '| Timeline (split, retime, regenerate), Render, Download | ja | Nachbessern einzelner Clips |', '',
  'Rate-Limits laut Anbieter: Starter 100/min · 5 000/Tag, Pro ×2, Creator ×4. Die Claude-Nutzungsgrenzen des Gratis-Plans drosseln lange Mehrschritt-Läufe — deshalb **ein Clip je Chat-Runde**, nicht „alle 32 auf einmal“.', '',
  '**Geprüft am 16.09.2026 mit dem verbundenen Connector (Gratis-Plan):** frei sind nur `free_tools` (Skript, Storyboard) und `estimate_generation_cost`. Alles, was Aufträge liest oder anlegt (`list_templates`, `list_jobs`, `get_editor`, `read_skill`, Render), antwortet mit „Upgrade required“. Rendern beginnt mit **Starter, 39 $/Monat = 3 900 Credits** (Pro 79 $/8 000, Creator 149 $/15 000).', '',
  '| Gemessene Schätzung | Credits | Modelle |', '|---|---|---|',
  '| 10 s Loop, Qualität medium, animiert, ohne Sprecher | 83 | Bild High · Video Medium |',
  '| 12 s Loop, Qualität high, animiert, ohne Sprecher | 185 | Bild Extra High · Video High |',
  '| 60 s Trailer, Qualität high, animiert, mit Sprecher | 936 | Bild Extra High · Video High |', '',
  'Stufe 1 (sieben Räume) kostet damit rund 580 Credits in medium oder 1 300 in high — beides passt in einen Starter-Monat. **Offen bleibt, ob Calliopes Render ein Startbild annimmt:** die Werkzeuge kennen `character_reference` (Referenzbilder für ein Figuren-Blatt) und `register_upload` (eigene Bilder/Videos in die Timeline), aber kein Image-to-Video aus einem exakten Still. Die drei Gesichter bleiben also ein Test mit Referenzblatt, kein sicherer Treffer.', '',
  '## 3 · Der Ablauf, sobald Calliope verbunden ist', '',
  '1. **Test:** „Nimm `docs/holodeck-storyboard.json`, Szene `scene-02`. Lass Calliope Storyboard und Prompt prüfen (Gratis-Werkzeug), dann **einen** Clip rendern: 10 s, 16:9, stumm, loopbar, Startbild `holodeck-assets/scene-02.png`.“',
  '2. **Herunterladen** (MP4) — der Download ist ein Schritt, den Bene freigibt.',
  '3. **Einbauen:** `powershell -NoProfile -File tools/holodeck-clip-einbauen.ps1 -Szene scene-02 -Clip "<Downloads>/scene-02.mp4" -Optimieren` — prüft Länge, Codec und Größe, legt den Clip in **beide** Asset-Ordner (flow-compass und john-agent) und trägt `video` im Manifest ein. `-Liste` zeigt den Stand, `-Entfernen` nimmt einen Clip wieder heraus (der Raum fällt still aufs Standbild zurück).',
  '4. **Ansehen:** `build-compass.ps1` → john-server :8787 → Holodeck → „An die Bar“. Läuft der Clip, steht unten „Bewegungsclip · keine Live-Lippensynchronität“.',
  '5. **Ausrollen:** `publish-compass.ps1` (oder die Aufgabe „Vishnu Flow Compass publish“ abwarten) — `motion/` und das Manifest gehen mit.',
  '6. Erst dann die nächsten sechs Räume (Stufe 1), dann Stufe 2.', '',
  '**Offen, bis Calliope verbunden ist:** ob Calliope ein **Startbild** (Image-to-Video) annimmt. Ohne Startbild trifft kein Modell die drei Gesichter — dann taugen die Clips nur für Räume **ohne Menschen** (Empfang vor dem Eintritt, Enterprise-Fenster), und die 30 Szenen bleiben Stills. Das entscheidet sich beim ersten Test-Clip.', '',
  '## 4 · Regeln für jeden Clip', '', ...globalRules.map(r => `- ${r}`), '',
  '## 5 · Chargen', '', ...batches.flatMap(b => [`### ${b.name} — Credits: ${b.credits}`, '', b.note, '', `Szenen: ${b.assets.join(', ')}`, '']),
  '## 6 · Besetzung und Ton (Regie, keine Behauptung verfügbarer Stimmen)', '',
  ...Object.values(voiceDirection).map(v => `- **${v.name}** — ${v.character} _(${v.status})_`), '', `Mix: ${mixDirection}`, '',
  '## 7 · Die Szenen', '');
for (const b of briefs) {
  md.push(`### ${b.asset} · ${b.title}`, '',
    `**Ort:** ${b.placeLabel} · **Stimmung:** ${b.moodLabel} · **Tugend:** ${b.virtue}  `,
    `**Startbild:** \`${b.referenceFrame}\` · **Ziel:** \`${b.target}\` · **Loop:** ${b.loopDurationSeconds} s (Filmlänge laut Regie: ${b.filmDurationSeconds} s)`, '',
    `**Prompt (Image-to-Video):** ${b.visualPrompt}`, '', `**Kamera (Regie):** ${b.cameraDe}`, '');
  if (b.script.length) md.push('**Skript (Vorspann — wird live vom Raum gesprochen, nicht in den Clip):**', '', ...b.script.map(l => `- **${name(l.speaker)}:** ${l.text}`), '');
  md.push(`**Musik:** ${b.music.palette}${b.music.tempo ? ` · ${b.music.tempo} bpm` : ''} · ${b.music.mood}`, '');
}
md.push('## 8 · Auftrag an Astra: drei Enterprise-Sets als Standbilder', '',
  'Bene (16.09.2026): eigene Sets im Stil der Serie, keine echten Serienszenen. Regeln: **keine Abzeichen, keine Schriftzüge, keine Gesichter echter Schauspieler**; die drei Avatare exakt wie auf den Referenzbildern; Licht und Palette wie `enterprise-lounge.png`; 16:9, mindestens 1672 × 941. Ein Bild je Set, kein Text im Bild.', '',
  ...enterpriseSets.flatMap(s => [`**${s.asset}** — ${s.title}`, '', `Prompt: ${s.visualPrompt}`, '', `Kamera: ${s.cameraDe}`, '',
    'Vorlagen aus Benes Ordner `OneDrive/Desktop/holodeck/' + s.vorlagen.ordner + '`: ' + s.vorlagen.dateien.map(d => '`' + d + '`').join(', '), '', 'Übernehmen: ' + s.vorlagen.uebernehmen, '', '**Nicht übernehmen:** Föderationsemblem, LCARS-Schrift und -Anzeigen, Werbebanner, Uniformen, Personen aus der Serie.', '',
    'Einbau, sobald das PNG als `Downloads/' + s.asset + '.png` liegt (aus jedem Ordner):', '', '```',
    'powershell -NoProfile -ExecutionPolicy Bypass -File C:/dev/persoenliches-dashboard/tools/holodeck-clip-einbauen.ps1 -Szene ' + s.asset + ' -Standbild "$env:USERPROFILE/Downloads/' + s.asset + '.png" -Platz "' + s.platz + '"', '```', '']),
  'Das Skript legt PNG + WebP in beide Asset-Ordner, trägt das Bild und den Platz im Manifest ein; der Erlebnisraum zeigt den neuen Knopf bei der Platzwahl von selbst. Jeder Platz hat seinen eigenen Raumklang (Brücke: Konsolen-Zirpen, Maschinenraum: pochender Kern, Aussichtslounge: weite Flächen). Ein Loop kommt später über `-Clip`, wie bei jeder anderen Szene.', '',
  'Das Holodeck-Gitter aus `' + VORLAGEN.gitter.ordner + '/' + VORLAGEN.gitter.dateien[0] + '` ist kein Bildauftrag: ' + VORLAGEN.gitter.uebernehmen, '',
  '**Ton:** Die Sets klingen nach eigenen, im Browser erzeugten Klängen (`holodeck-engine/studio-audio.js`). Aufnahmen aus Videos der Serie oder Fan-Touren werden nicht übernommen.', '');
writeFileSync(join(root, 'docs/holodeck-calliope.md'), md.join('\n') + '\n');
console.log(`${briefs.length} Szenen → docs/holodeck-storyboard.json + docs/holodeck-calliope.md`);
