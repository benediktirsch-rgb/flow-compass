import {createStudioAudio} from './studio-audio.js';
import {safeMediaURL} from './studio-direction.js';

// The room lifecycle is independent of model availability. No entry action sends a prompt.
export function mountHolodeck(host, options = {}) {
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  };
  const button = (text, action, cls = '') => {
    const node = make('button', cls, text); node.type = 'button';
    node.addEventListener('click', action); return node;
  };
  // Unterbrechen beendet Stimme und Antwortempfang. Es beendet NICHT den Modellprozess
  // auf dem Server — ein abgebrochener HTTP-Aufruf beweist das nicht. Der Vertrag für
  // einen bestätigten Stopp steht in docs/protokoll.md; gebaut ist er noch nicht, also
  // sagt der Knopf, was er wirklich tut (Entscheidung Bene, 15.09.2026).
  const interruptButton = () => {
    const node = button('Unterbrechen · Empfang aus',
      () => { stopGuide(); stopMotion(); options.onInterrupt?.(); });
    node.title = 'Beendet Stimme und Antwortempfang. John kann auf dem Server weiterdenken; ein bestätigter Modellstopp ist hier noch nicht eingebaut.';
    return node;
  };
  const base = new URL('../holodeck-assets/', import.meta.url).href;
  const root = make('section', 'holo-experience'); root.dataset.phase = 'arrival';
  root.setAttribute('aria-label', 'Holodeck Erlebnisraum');
  const image = make('img', 'holo-background'); image.alt = 'Empfang im Holodeck';
  const shade = make('div', 'holo-shade');
  const top = make('div', 'holo-top');
  const state = make('span', '', 'ANKOMMEN');
  const availability = make('span', '', 'Verbindung wird geprüft'); availability.setAttribute('role', 'status');
  top.append(state, availability);
  const center = make('div', 'holo-center');
  const subtitle = make('div', 'holo-subtitle'); subtitle.hidden = true; subtitle.setAttribute('role', 'status');
  const bottom = make('div', 'holo-bottom');
  const mediaLabel = make('small', 'holo-media-label', 'Raumkulisse · Standbild');
  const sound = button('Raumklang einschalten', () => audio.getState().enabled ? audio.stop() : audio.start());
  sound.setAttribute('aria-pressed', 'false');
  const audio = createStudioAudio((enabled, message) => {
    sound.textContent = enabled ? 'Raumklang ausschalten' : 'Raumklang einschalten';
    sound.setAttribute('aria-pressed', String(enabled)); if (message) availability.textContent = message;
  });
  root.append(image, shade, top, center, subtitle, bottom, mediaLabel); host.replaceChildren(root);
  let phase = 'arrival', place = options.place || 'bar', connected = false;
  let disposed = false, paused = false, speaker = null, listening = false;
  let video = null, clipTimer, mediaVersion = 0, currentAsset = 'cinema-welcome';
  let guide = null, guideTimer, transitionTimer, wantsSound = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const controller = new AbortController();
  const motionController = new AbortController();
  let motion = {}, portrait = null, portraitVideo = null, entranceVideo = null;
  let motionEpoch = 0, entranceTimer, portraitTimer;
  const motionTimer = setTimeout(() => motionController.abort(), 2500);
  fetch(base + 'motion-manifest.json', {signal:motionController.signal, credentials:'same-origin'})
    .then(r => r.ok ? r.json() : {})
    .then(data => { if (data.version === 1 && !disposed) { motion = data; if (phase === 'conversation' && !paused) showJohn(); } })
    .catch(() => {}).finally(() => clearTimeout(motionTimer));
  function stopMotion() {
    motionEpoch++; clearTimeout(entranceTimer); clearTimeout(portraitTimer);
    portraitVideo?.pause(); entranceVideo?.pause();
  }
  function clearMotion() {
    stopMotion();
    for (const clip of [portraitVideo, entranceVideo]) if (clip) { clip.removeAttribute('src'); clip.load(); clip.remove(); }
    portrait?.remove(); portrait = portraitVideo = entranceVideo = null;
  }
  function playPortrait() {
    if (!portraitVideo || paused || disposed || speaker || guide || reduced) return;
    const clip = portraitVideo, epoch = ++motionEpoch;
    clip.currentTime = 0;
    clip.play().then(() => { if (epoch !== motionEpoch || paused || disposed || speaker || guide) clip.pause(); })
      .catch(() => { if (portraitVideo === clip) { clip.hidden = true; portrait.dataset.media = 'poster'; } });
  }
  function showJohn() {
    if (portrait || phase !== 'conversation' || paused || disposed) return;
    const poster = safeMediaURL(base, motion.john?.poster), url = safeMediaURL(base, motion.john?.video);
    if (!poster) return;
    portrait = make('aside','holo-john'); portrait.setAttribute('aria-label','John · vorbereitete Nahaufnahme');
    const still = make('img',''); still.src = poster; still.alt = 'John am Kamin · vorbereitete Nahaufnahme';
    const caption = make('small','','John · vorbereitete Mimik · Kaminaufnahme');
    portrait.append(still, caption, button('Nahaufnahme schließen', () => { clearMotion(); }));
    root.append(portrait); portrait.dataset.media = 'poster';
    if (!url || reduced) return;
    const clip = make('video',''); portraitVideo = clip;
    clip.muted = true; clip.playsInline = true; clip.loop = false; clip.poster = poster;
    clip.setAttribute('aria-label','John bewegt Gesicht und Kopf · ohne Lippensynchronität');
    const fallback = () => { if (portraitVideo === clip) { clearTimeout(portraitTimer); clip.pause(); clip.hidden = true; portrait.dataset.media = 'poster'; } };
    clip.addEventListener('error',fallback,{once:true});
    clip.addEventListener('loadeddata',() => { if (portraitVideo !== clip || disposed) return; clearTimeout(portraitTimer); portrait.dataset.media = 'video'; playPortrait(); },{once:true});
    portrait.insertBefore(clip,caption); clip.src = url; clip.load();
    portraitTimer = setTimeout(fallback,6000);
  }
  function enter() {
    const url = safeMediaURL(base,motion.reception?.video);
    if (!url || reduced || paused) { seating(); return; }
    clearMotion(); clearVideo(); setPhase('entrance');
    center.append(make('h3','','Willkommen an Bord.'),button('Weiter zur Platzwahl',seating,'holo-primary'));
    const clip = make('video','holo-background'); entranceVideo = clip;
    clip.muted = true; clip.playsInline = true; clip.loop = false;
    clip.poster = safeMediaURL(base,motion.reception?.poster) || image.src;
    root.insertBefore(clip,shade); mediaLabel.textContent = 'Vorbereitete Empfangssequenz · stumm';
    const finish = () => { if (entranceVideo === clip && !disposed && !paused) seating(); };
    clip.addEventListener('ended',finish,{once:true}); clip.addEventListener('error',finish,{once:true});
    clip.src = url; clip.play().catch(finish); entranceTimer = setTimeout(finish,6000);
  }
  let manifest = {};
  const manifestTimer = setTimeout(() => controller.abort(), 2500);
  fetch(base + 'manifest.json', {signal: controller.signal, credentials: 'same-origin'})
    .then(r => r.ok ? r.json() : {})
    .then(data => { manifest = data.assets || {}; if (!disposed && !paused) showAsset(currentAsset); })
    .catch(() => {}).finally(() => clearTimeout(manifestTimer));

  function clearVideo() {
    clearTimeout(clipTimer);
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); video.remove(); video = null; }
    image.hidden = false;
    mediaLabel.textContent = 'Raumkulisse · Standbild';
  }
  function showAsset(asset) {
    currentAsset = asset; const version = ++mediaVersion; clearVideo();
    image.onerror = () => {
      if (version !== mediaVersion) return;
      image.onerror = () => { image.onerror = null; mediaLabel.textContent = 'Bild nicht verfügbar · der Raum bleibt bedienbar'; };
      image.src = base + asset + '.png';
    };
    image.src = safeMediaURL(base, manifest[asset]?.poster) || base + asset + '.webp';
    const url = safeMediaURL(base, manifest[asset]?.video);
    if (!url || reduced || paused) return;
    const clip = make('video', 'holo-background'); video = clip;
    clip.muted = true; clip.playsInline = true; clip.loop = true; clip.poster = image.src;
    root.insertBefore(clip, shade);
    const fallback = () => { if (video === clip) clearVideo(); };
    clip.addEventListener('error', fallback, {once: true}); clipTimer = setTimeout(fallback, 6000);
    clip.addEventListener('loadeddata', () => {
      if (disposed || paused || version !== mediaVersion || video !== clip) return;
      clearTimeout(clipTimer);
      clip.play().then(() => {
        if (video !== clip || paused || disposed) return;
        image.hidden = true; mediaLabel.textContent = 'Bewegungsclip · keine Live-Lippensynchronität';
      }).catch(fallback);
    }, {once: true});
    clip.src = url; clip.load();
  }
  function setPhase(next) {
    phase = next; root.dataset.phase = next;
    state.textContent = ({arrival:'ANKOMMEN',seating:'DEIN PLATZ',transition:'PLATZ NEHMEN',conversation:'IM GESPRÄCH',goodbye:'BIS BALD'})[next];
    center.replaceChildren(); bottom.replaceChildren(); options.onPhase?.(next);
  }
  function stopGuide() {
    clearTimeout(guideTimer);
    if (guide) { guide = null; window.speechSynthesis?.cancel(); }
    audio.setVoice(false);
  }
  function focusSpeaker(who) {
    // On narrow viewports the still must show the named speaker rather than the centre person.
    image.style.objectPosition = who === 'john' ? '82% center' : '50% center';
    if (video) video.style.objectPosition = image.style.objectPosition;
  }
  function arrival() {
    clearMotion();
    stopGuide(); clearTimeout(transitionTimer); setPhase('arrival'); showAsset('cinema-welcome');
    center.append(make('p','holo-eyebrow','VAIKUNTHA · DEIN HOLODECK'), make('h3','','Lass den Tag draußen.'),
      make('p','','John wartet auf dich. Komm erst einmal an.'));
    center.append(button('Eintreten · mit Raumklang', () => { wantsSound = true; void audio.start(); enter(); }, 'holo-primary'),
      button('In Ruhe eintreten', () => { wantsSound = false; audio.stop(); enter(); }));
    center.append(make('small','','Beim Eintreten bleibt dein Mikrofon aus.'));
  }
  function seating() {
    clearMotion();
    stopGuide(); setPhase('seating'); subtitle.hidden = true;
    center.append(make('p','holo-eyebrow','WO MÖCHTEST DU SEIN?'),make('h3','','Such dir einen Platz.'));
    const seats = make('div','holo-seats');
    for (const [key, title, detail] of [['enterprise','Auf die Enterprise','Coaching zwischen den Sternen'],['bar','An die Bar','Ein lockerer Austausch'],['huette','An den Tisch','Zeit für ein wichtiges Thema'],['goa','An den Strand','Durchatmen und Gedanken sortieren']]) {
      const seat = button(title, () => sit(key), 'holo-seat'); seat.append(make('small','',detail)); seats.append(seat);
    }
    center.append(seats); bottom.append(sound);
  }
  function sit(key) {
    clearMotion();
    place = key; options.onPlace?.(key); audio.setScene(key);
    setPhase('transition'); showAsset(({enterprise:'enterprise-lounge',bar:'scene-02',huette:'scene-07',goa:'scene-13',anden:'scene-19',rom:'scene-25'})[key] || 'scene-02');
    image.alt = (options.places?.[key] || key) + ' mit John und Madeleine';
    center.append(make('h3','','Hier ist dein Platz.'),button('Platz nehmen', converse, 'holo-primary'));
    clearTimeout(transitionTimer); transitionTimer = setTimeout(converse, reduced ? 0 : 1400);
  }
  function converse() {
    if (disposed || paused || phase === 'conversation') return;
    clearTimeout(transitionTimer); setPhase('conversation');
    const prompts = make('div','holo-prompts');
    for (const [title, prompt] of [
      ['Wie geht es dir?', 'John, wie geht es dir heute? Beginne ein natürliches kurzes Gespräch mit mir, ohne reale Erlebnisse zu erfinden.'],
      ['Was liegt heute an?', 'Was liegt heute an? Frage mich zunächst, was mich heute beschäftigt. Behaupte keine Termine, die du nicht kennst.'],
      ['Ein wichtiges Thema', 'Ich habe ein wichtiges Thema. Frage mich zunächst, worum es geht, und höre zu. Stelle eine Frage auf einmal.']
    ]) prompts.append(button(title, () => {
      if (!connected) { reflection(); return; }
      const result = options.onBriefing?.({title,prompt,an:'beide'});
      if (result) { subtitle.textContent = result; subtitle.hidden = false; }
    }));
    center.append(prompts);
    bottom.append(button('Sprechen', () => options.onVoice?.(), 'holo-primary'),
      interruptButton(),
      button('John näher ansehen', showJohn),
      button('Schreiben', () => options.onPanel?.('write')),
      button('Anderer Platz', seating), sound,
      button('Verabschieden', goodbye));
    subtitle.replaceChildren(make('small','','Vorbereitete Begrüßung · John'),make('p','','Schön, dass du da bist. Wie geht es dir heute?')); subtitle.hidden = false;
    focusSpeaker('john');
    showJohn();
    if (wantsSound && window.speechSynthesis && window.SpeechSynthesisUtterance) {
      const utterance = new SpeechSynthesisUtterance('Schön, dass du da bist. Wie geht es dir heute?');
      utterance.lang = options.getLanguage?.() || 'de-DE';
      if (utterance.lang !== 'de-DE') return;
      utterance.voice = options.getHostVoice?.() || null; guide = utterance; stopMotion();
      const done = () => { if (guide !== utterance) return; guide = null; clearTimeout(guideTimer); audio.setVoice(false); };
      utterance.onend = done; utterance.onerror = done; audio.setVoice(true);
      guideTimer = setTimeout(stopGuide, 12000); speechSynthesis.speak(utterance);
    }
  }
  function reflection() {
    stopGuide(); subtitle.replaceChildren(make('small','','Vorbereitete Reflexion · ohne KI'),
      make('p','','Was beschäftigt dich gerade? Was weißt du sicher, und was möchtest du klären?'));
    subtitle.hidden = false; options.onPanel?.('offline');
  }
  function goodbye() {
    clearMotion();
    stopGuide(); options.onInterrupt?.(); audio.stop(); clearVideo();
    setPhase('goodbye'); subtitle.hidden = true;
    center.append(make('h3','','Nimm dir den Moment mit.'),make('p','','Mikrofon und Ton sind aus. Einen laufenden Auftrag prüfen wir auf Stopp.'),
      button('Zurück zum Empfang', arrival),button('Raum verlassen', () => options.onClose?.(), 'holo-primary'));
  }
  function pause() {
    stopMotion();
    paused = true; clearTimeout(transitionTimer); stopGuide(); audio.stop(); video?.pause();
    listening = false; speaker = null; root.dataset.activity = 'idle';
  }
  function visibility() { if (document.hidden) pause(); }
  document.addEventListener('visibilitychange', visibility);
  arrival();
  return {
    setPlace(value) { if (value === place) return; place = value; if (phase === 'conversation') sit(value); },
    setConnection(value) {
      connected = value === 'local';
      availability.textContent = connected ? 'Gespräch verfügbar' : value === 'unknown' ? 'Verbindung wird geprüft' : 'Ohne KI · Raum bleibt offen';
      root.dataset.connection = connected ? 'online' : 'offline';
    },
    setSpeaker(who) { speaker = who; if (who) stopMotion(); root.dataset.activity = who ? 'speaking' : listening ? 'listening' : 'idle'; audio.setVoice(!!who || listening); },
    setListening(active) { const wasListening = listening; listening = !!active; root.dataset.activity = active ? 'listening' : speaker ? 'speaking' : 'idle'; if (active) { stopGuide(); if (!wasListening) playPortrait(); } else stopMotion(); audio.setVoice(active || !!speaker); },
    setSubtitle(who, text = '') { subtitle.hidden = !who || !text; subtitle.replaceChildren(); if (who && text) { focusSpeaker(who); subtitle.append(make('small','',who === 'john' ? 'John' : who === 'madeleine' ? 'Madeleine' : who),make('p','',text)); } },
    setOutfit() {}, setAction() {}, stopGuide, pause,
    resume() { paused = false; if (phase === 'transition') converse(); if (phase === 'entrance') seating(); },
    getPlaybackState() { return {phase,place,media:video ? 'video' : 'still',motionReady:motion.version === 1,portraitMedia:portrait?.dataset.media || 'none',paused,listening,audio:audio.getState()}; },
    dispose() { disposed = true; pause(); clearMotion(); clearVideo(); controller.abort(); motionController.abort(); clearTimeout(motionTimer); clearTimeout(manifestTimer); audio.dispose(); document.removeEventListener('visibilitychange', visibility); root.remove(); }
  };
}
