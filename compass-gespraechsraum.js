/* Gesprächsraum: Compass → lokale Tür; Rezeption ausschließlich für Stand und Stopp.
 * Einbau: Script nach der Compass-Konfiguration laden. johnGespraechsraum.oeffnen()
 * ist auch als Anschluss für einen eigenen Knopf verfügbar. Keine Gesprächsspeicherung im Browser.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.johnGespraechsraum) return;
  // Die eigene Instanz definiert JOHN_API immer — lokal (localhost:8787) als leere Zeichenkette (same-origin),
  // deshalb zählt schon, dass es sie gibt. Die Demo bindet dieses Skript gar nicht erst ein.
  const configured = window.JOHN_TUER || window.JOHN_HUB || typeof JOHN_API === 'string';
  if (!configured) return; // In einer unkonfigurierten Demo weder UI noch Netzwerk.
  const door = (window.JOHN_TUER || 'http://127.0.0.1:8788').replace(/\/$/, '');
  const hub = (window.JOHN_HUB || '').replace(/\/$/, '');
  // Der eigene Build setzt den Browser-Schlüssel; niemals Geräte-Token einsetzen.
  const token = window.JOHN_HUB_TOKEN_BROWSER || window.JOHN_HUB_TOKEN || '';
  const names = { bene: 'Du', john: 'John', madeleine: 'Madeleine', system: 'Hinweis' };
  const labels = { offen: 'Wartet', laeuft: 'Denkt gerade', fertig: 'Beendet', gestoppt: 'Stopp angefordert', verfallen: 'Verfallen' };
  const drafts = new Map();
  let mode = 'unknown', id = '', turns = new Map(), timer, round = 0, epoch = 0;
  let busy = false, polling = false, opener, rooms = [], lastRun = null, waiting = [];
  let dialog, list, log, status, error, form, input, topic, recipient, stop, send, fresh, stage, place;
  let portraitUrl = '', listSignature = '';
  const places = { bar: 'Bar im Hotel Vaikuntha', huette: 'Berghütte', goa: 'Goa', anden: 'Anden', rom: 'Altstadt von Rom' };
  const e = (tag, attrs = {}, text) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function time(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  async function request(url, body, headers = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(url, { method: body ? 'POST' : 'GET', cache: 'no-store',
        credentials: 'omit', signal: controller.signal,
        headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
        ...(body ? { body: JSON.stringify(body) } : {}) });
      let data;
      try { data = await response.json(); } catch (_) { throw new Error('Die Antwort ist nicht lesbar. Bitte erneut nachsehen.'); }
      if (!response.ok || data.ok === false) {
        const messages = { 400: 'Die Eingabe ist ungültig.', 403: 'Dieser Zugang ist nicht freigegeben.',
          404: 'Der Raum oder Beitrag ist nicht mehr vorhanden.', 405: 'Diese Handlung ist hier nicht erlaubt.',
          409: 'Der Auftrag wurde inzwischen beendet oder gestoppt.', 413: 'Die Nachricht darf höchstens 8000 Zeichen haben.' };
        const failure = new Error(messages[response.status] || 'Die Anfrage ist fehlgeschlagen. Bitte erneut nachsehen.');
        failure.code = response.status;
        throw failure;
      }
      return data;
    } finally { clearTimeout(timeout); }
  }
  const local = (path, body) => request(door + path, body);
  const reception = (action, body) => request(hub + '/api.php?w=' + action, body, { 'X-John-Token': token });
  // Gezeichnete Figuren sind Rollenbilder, keine behaupteten Porträts realer Personen.
  const assetBase = new URL('holodeck-assets/', document.currentScript?.src || location.href).href;
  const wardrobe = {
    bene: ['Elegant', 'Lässig', 'Naturbursche', 'Offizier', 'Pilot', 'Mönch', 'Vishnu · künstlerisch', 'Goa'],
    madeleine: ['Business-Model', 'Seide & Stil', 'Abendkleid', 'Sari', 'Goa-Boho', 'Cocktail'],
    john: ['Resort-Luxus', 'CEO', 'Kurta', 'Sherwani', 'Goa-Party', 'An der Bar']
  };
  const costume = {}, wardrobeSelects = {};
  let madeleineSource = 'madeleine';
  const localDay = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Berlin'}).format(new Date());
  function outfitIndex(who) {
    if (costume[who] !== undefined && costume[who] !== 'auto') return Number(costume[who]);
    const day = Math.floor(Date.parse(localDay() + 'T12:00:00Z') / 86400000);
    return (day + Object.keys(wardrobe).indexOf(who)) % wardrobe[who].length;
  }
  let transitionTimer;
  function materialize() {
    if (!stage) return;
    clearTimeout(transitionTimer);
    stage.classList.remove('jgr-arrive');
    void stage.offsetWidth;
    stage.classList.add('jgr-arrive');
    transitionTimer = setTimeout(() => stage?.classList.remove('jgr-arrive'), 1900);
  }
  function holoSymbol() {
    return '<svg viewBox="0 0 160 50" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5"><path d="M25 39Q3 31 10 16Q25 19 25 39Q18 18 25 5Q36 20 25 39Q47 30 40 16Q28 22 25 39ZM10 40H40"/><circle cx="80" cy="25" r="19"/><circle cx="80" cy="25" r="5"/><path d="M80 6V20M80 30V44M61 25H75M85 25H99M67 12L77 22M83 28L93 38M67 38L77 28M83 22L93 12M127 39Q153 25 145 13Q135 1 124 14Q116 28 138 24Q149 31 127 39ZM126 39L123 46L134 42"/></g></svg>';
  }
  function paintScene() {
    const theme = place.value;
    stage.replaceChildren();
    stage.dataset.place = theme;
    const backdrop = e('img', {class:'jgr-world', src:assetBase + theme + '.png', alt:places[theme], decoding:'async'});
    backdrop.addEventListener('error', () => { backdrop.hidden = true; stage.style.background = '#172e39'; });
    stage.append(backdrop);
    const sigil = e('div', {class:'jgr-sigil'}); sigil.innerHTML = holoSymbol();
    sigil.append(e('span', {}, 'VISHNU · VAIKUNTHA'));
    stage.append(sigil, e('div', {class:'jgr-world-title'}, places[theme]));
    const cast = e('div', {class:'jgr-cast'});
    for (const who of ['john','bene','madeleine']) {
      const i = outfitIndex(who), cols = who === 'bene' ? 4 : 3;
      const actor = e('figure', {class:'jgr-actor jgr-person-' + who});
      const portrait = e('div', {class:'jgr-avatar', role:'img', 'aria-label':(who === 'bene' ? 'Bene' : names[who]) + ' · ' + wardrobe[who][i] + (who === 'john' ? ' · vorläufiger Konzeptavatar' : ' · nach Fotovorlage')});
      const sprite = e('div',{class:'jgr-sprite'});
      const source = who === 'madeleine' ? madeleineSource : who;
      const split = {bene:500,john:496,madeleine:488,mona:512}[source];
      const rowHeight = Math.floor(i / cols) ? 1024 - split : split;
      sprite.style.aspectRatio = String((1536 / cols) / rowHeight);
      sprite.style.backgroundImage = 'url("' + assetBase + source + '-wardrobe.png")';
      sprite.style.backgroundSize = (cols * 100) + '% ' + (1024 / rowHeight * 100) + '%';
      sprite.style.backgroundPosition = ((i % cols) * 100 / (cols - 1)) + '% ' + (Math.floor(i / cols) * 100) + '%';
      if (who === 'bene' && portraitUrl) {
        sprite.style.backgroundImage = 'url("' + portraitUrl + '")'; sprite.style.backgroundSize = 'contain'; sprite.style.backgroundPosition = 'center';
      }
      portrait.append(sprite);
      actor.append(portrait, e('figcaption', {}, (who === 'bene' ? 'Bene' : names[who]) + ' · ' + wardrobe[who][i]));
      if (who === 'john') actor.append(e('small', {}, 'Konzept · Foto noch offen'));
      cast.append(actor);
    }
    const grid = e('div', {class:'jgr-holo-grid', 'aria-hidden':'true'});
    stage.append(cast, grid, e('div',{class:'jgr-door jgr-door-left','aria-hidden':'true'}), e('div',{class:'jgr-door jgr-door-right','aria-hidden':'true'}));
    animateSpeaker(); materialize();
  }
  function wardrobeControls() {
    const details = e('details',{class:'jgr-wardrobe'});
    details.append(e('summary',{},'Garderobe & Rollen · täglich neu'));
    const panel = e('div',{class:'jgr-wardrobe-panel'});
    for (const who of ['bene','madeleine','john']) {
      const label = e('label',{},who === 'bene' ? 'Meine Rolle' : names[who]);
      const select = e('select',{'aria-label':who === 'bene' ? 'Meine Rolle' : names[who] + ' Garderobe'});
      select.append(e('option',{value:'auto'},'Tageslook · automatisch'));
      wardrobe[who].forEach((v,i) => select.append(e('option',{value:String(i)},v)));
      try { const saved = localStorage.getItem('holodeckOutfit-' + who); if (saved === 'auto' || wardrobe[who][Number(saved)] && saved !== null) select.value = saved; } catch (_) {}
      costume[who] = select.value; wardrobeSelects[who] = select;
      select.addEventListener('change',()=>{ costume[who] = select.value; try { localStorage.setItem('holodeckOutfit-' + who,select.value); } catch (_) {} paintScene(); });
      label.append(select); panel.append(label);
    }
    const sourceLabel = e('label',{},'Madeleines Fotovorlage');
    const sourceSelect = e('select',{'aria-label':'Madeleines Fotovorlage'});
    sourceSelect.append(e('option',{value:'madeleine'},'Erste Fotovorlage'),e('option',{value:'mona'},'Mona'));
    try { if (localStorage.getItem('holodeckMadeleineSource') === 'mona') sourceSelect.value = 'mona'; } catch (_) {}
    madeleineSource = sourceSelect.value;
    sourceSelect.addEventListener('change',()=>{ madeleineSource = sourceSelect.value; try { localStorage.setItem('holodeckMadeleineSource',madeleineSource); } catch (_) {} paintScene(); });
    sourceLabel.append(sourceSelect);panel.append(sourceLabel);
    panel.append(e('small',{},'Tageslooks wechseln nach Berliner Datum. Deine manuelle Auswahl bleibt erhalten. Rollen ändern hier den Look; Gesprächscharaktere folgen über John und Madeleine.'));
    details.append(panel); return details;
  }

  function animateSpeaker() {
    if (!stage) return;
    for (const who of ['john', 'madeleine']) stage.querySelector('.jgr-person-' + who)?.classList.toggle('jgr-active', mode === 'local' && lastRun?.an === who);
  }
  function fail(cause, mutation = false) {
    error.textContent = (cause instanceof TypeError || cause.name === 'AbortError')
      ? (mutation ? 'Keine Bestätigung erhalten. Bitte den Stand prüfen, bevor Du erneut sendest.' : 'Die Verbindung ist unterbrochen. Der angezeigte Stand kann veraltet sein.')
      : cause.message;
  }
  function controls() {
    const writable = mode === 'local' && !busy;
    form.hidden = mode !== 'local';
    input.disabled = topic.disabled = recipient.disabled = !writable;
    send.disabled = !writable || !input.value.trim() || [...input.value].length > 8000;
    fresh.disabled = !writable;
    stop.hidden = mode !== 'local';
    stop.disabled = !writable || !id || (!lastRun && !waiting.length);
    list.querySelectorAll('button').forEach(button => { button.disabled = busy; });
  }
  function saveDraft() { drafts.set(id, { text: input.value, topic: topic.value, an: recipient.value }); }
  function select(nextId) {
    if (busy) return;
    saveDraft();
    id = nextId; epoch++; turns = new Map(); lastRun = null; waiting = [];
    const draft = drafts.get(id) || { text: '', topic: '', an: 'beide' };
    input.value = draft.text; topic.value = draft.topic; recipient.value = draft.an;
    topic.closest('label').hidden = !!id;
    log.replaceChildren(e('p', {}, id ? 'Beiträge werden geladen …' : 'Neuer Raum. Mit Deiner ersten Nachricht beginnt das Gespräch.'));
    status.textContent = id ? 'Raum wird geladen …' : 'Bereit für ein neues Gespräch.';
    error.textContent = '';
    renderRooms(); controls();
    clearTimeout(timer); schedule(0);
  }
  function renderRooms() {
    const signature = JSON.stringify([id, rooms]);
    if (signature === listSignature && list.childNodes.length) return;
    listSignature = signature;
    list.replaceChildren();
    if (!rooms.length) list.append(e('p', {}, 'Noch keine Räume vorhanden.'));
    for (const room of rooms) {
      const button = e('button', { type: 'button', 'aria-pressed': String(room.id === id) });
      button.append(e('strong', {}, room.thema || 'Gespräch'), e('small', {}, time(room.zuletzt) + (room.laeuft ? ' · Gespräch läuft' : '')));
      button.addEventListener('click', () => select(room.id));
      list.append(button);
    }
  }
  function paintTurns() {
    const nearEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    const oldScroll = log.scrollTop;
    const focusTurn = log.contains(document.activeElement) ? document.activeElement.dataset.turn : null;
    log.replaceChildren();
    if (!turns.size) log.append(e('p', {}, 'In diesem Raum gibt es noch keine Beiträge.'));
    for (const turn of [...turns.values()].sort((a, b) => a.zug - b.zug)) {
      const article = e('article', { class: 'jgr-turn jgr-' + (names[turn.wer] ? turn.wer : 'system') });
      const header = e('header');
      header.append(e('strong', {}, names[turn.wer] || 'Hinweis'), e('time', { datetime: turn.zeit || '' }, time(turn.zeit)));
      article.append(header, e('p', {}, turn.text || 'Dieser Beitrag enthält keinen Text.'));
      const hold = e('button', { type: 'button', 'data-turn': turn.zug, 'aria-pressed': String(turn.weitergeben === false),
        title: 'Gilt für künftige Antworten. Bereits gelesene Beiträge werden nicht zurückgerufen.' },
      turn.weitergeben === false ? 'Zurückgehalten · wieder weitergeben' : 'Nicht weitergeben');
      hold.disabled = busy || mode !== 'local';
      hold.addEventListener('click', () => mutate(async () => {
        const result = await local('/raum/weitergeben', { id, zug: turn.zug, weitergeben: turn.weitergeben === false });
        turn.weitergeben = result.weitergeben;
        paintTurns();
      }));
      article.append(hold); log.append(article);
    }
    if (focusTurn) log.querySelector('[data-turn="' + Number(focusTurn) + '"]')?.focus({ preventScroll: true });
    log.scrollTop = nearEnd ? log.scrollHeight : oldScroll;
  }
  async function refreshRoom() {
    const selected = id, version = epoch;
    if (!selected) return;
    const full = round % 5 === 0;
    const since = full ? 0 : Math.max(0, ...turns.keys());
    const data = await local('/raum?id=' + encodeURIComponent(selected) + '&seit=' + since);
    if (selected !== id || version !== epoch || !dialog.open || busy) return;
    let changed = full && JSON.stringify([...turns.values()]) !== JSON.stringify(data.zuege || []);
    if (full) turns = new Map();
    for (const turn of data.zuege || []) {
      if (!Number.isInteger(turn.zug)) continue;
      if (!full && JSON.stringify(turns.get(turn.zug)) !== JSON.stringify(turn)) changed = true;
      turns.set(turn.zug, turn);
    }
    lastRun = data.laeuft; waiting = data.wartet || [];
    status.textContent = lastRun ? (names[lastRun.an] || 'Ein Teilnehmer') + ' denkt gerade' + (lastRun.seit ? ' · seit ' + time(lastRun.seit) : '')
      : waiting.length ? 'Wartet — John ist beschäftigt. Der Raum kommt vor dem nächsten Takt dran.' : 'Bereit.';
    if (lastRun && waiting.length) status.textContent += ' · Danach: ' + waiting.map(who => names[who] || who).join(', ');
    animateSpeaker();
    if (changed) paintTurns();
  }
  async function remoteStand() {
    mode = 'remote'; animateSpeaker(); controls(); list.replaceChildren();
    status.textContent = 'Die lokale Tür ist nicht erreichbar. Hier sind nur Stand und Stopp verfügbar.';
    if (!hub || !token) {
      log.replaceChildren(e('p', {}, 'Keine Rezeption mit Browser-Zugang eingerichtet. Gesprächsinhalte sind nur am Rechner erreichbar.'));
      return;
    }
    const data = await reception('stand');
    if (!dialog.open || busy) return;
    log.replaceChildren(e('p', {}, 'Stand aus der Rezeption. Gesprächsinhalte bleiben am Rechner.'));
    if (!data.raeume?.length) log.append(e('p', {}, 'Die Rezeption kennt noch keine Raum-Aufträge.'));
    for (const job of data.raeume || []) {
      const article = e('article', { class: 'jgr-turn' });
      article.append(e('strong', {}, job.thema || 'Gespräch'),
        e('p', {}, (names[job.an] || job.an || 'Teilnehmer') + ' · ' + (labels[job.status] || 'Unbekannter Stand') + ' · ' + time(job.erstellt)));
      if (job.status === 'offen' || job.status === 'laeuft') {
        const button = e('button', { type: 'button' }, 'Diesen Zug stoppen');
        button.addEventListener('click', () => mutate(async () => {
          await reception('stopp', { id: job.id, wer: 'handy' });
          button.disabled = true; button.textContent = 'Stopp angefordert';
          status.textContent = 'Stopp an die Rezeption übergeben. Das Gerät übernimmt ihn beim nächsten Puls, im Gespräch etwa innerhalb von 10 Sekunden.';
        }));
        article.append(button);
      }
      log.append(article);
    }
  }
  async function poll() {
    if (!dialog.open || document.hidden || busy || polling) return;
    polling = true;
    try {
      let data;
      try { data = await local('/raeume'); }
      catch (cause) {
        if (Number.isInteger(cause.code) && cause.code >= 400) { fail(cause); return; }
        await remoteStand(); return;
      }
      if (!dialog.open || busy) return;
      const recovering = mode !== 'local';
      mode = 'local'; rooms = data.raeume || []; renderRooms();
      if (recovering) { turns = new Map(); round = 0; }
      if (!id) {
        log.replaceChildren(e('p', {}, 'Wähle einen Raum oder beginne ein neues Gespräch.'));
        status.textContent = 'Die Tür ist erreichbar. Bereit für Dein Gespräch.';
      } else await refreshRoom();
      round++;
    } catch (cause) { fail(cause); }
    finally { polling = false; controls(); schedule(2000); }
  }
  function schedule(delay) {
    clearTimeout(timer);
    if (dialog.open && !document.hidden) timer = setTimeout(poll, delay);
  }
  async function mutate(action) {
    if (busy) return;
    busy = true; epoch++; error.textContent = ''; controls();
    log.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try { await action(); }
    catch (cause) { fail(cause, true); }
    finally {
      busy = false; controls();
      log.querySelectorAll('button').forEach(button => { button.disabled = button.textContent === 'Stopp angefordert'; });
      schedule(0);
    }
  }
  function build() {
    const style = e('style'); style.textContent = `
      .jgr{--panel:#141c23;--panel2:#202d37;--ink:#e9eee4;--line2:#485b65;box-sizing:border-box;width:min(1040px,calc(100% - 24px));max-height:92vh;padding:0;border:1px solid var(--line2,#48533d);border-radius:16px;background:var(--panel,#141712);color:var(--ink,#e9eee4);font:16px/1.5 system-ui,sans-serif}
      .jgr::backdrop{background:#080b09b8}.jgr [hidden]{display:none!important}.jgr *{box-sizing:border-box}
      .jgr button,.jgr select,.jgr input,.jgr textarea{font:inherit;color:inherit;background:var(--panel2,#20271c);border:1px solid var(--line2,#48533d);border-radius:8px;padding:9px 12px}
      .jgr button{cursor:pointer}.jgr button:disabled{opacity:.5;cursor:default}.jgr :focus-visible,.jgr-open:focus-visible{outline:3px solid #b5df83;outline-offset:3px}
      .jgr button[aria-pressed=true]{border-color:#b5df83;background:#334428}.jgr h2{font-size:22px;margin:0}.jgr p{margin:8px 0}
      .jgr-head{display:flex;gap:16px;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--line2,#48533d)}
      .jgr-layout{display:grid;grid-template-columns:220px minmax(0,1fr)}.jgr-side{padding:18px;border-right:1px solid var(--line2,#48533d);overflow:auto;max-height:75vh}
      .jgr-rooms{display:grid;gap:8px;margin-top:12px}.jgr-rooms button{text-align:left;overflow-wrap:anywhere}.jgr small{display:block;font-size:14px;color:#bbc7b1}
      .jgr-main{min-width:0;padding:18px 22px}.jgr-status{font-size:14px;color:#c8ddb5;min-height:24px}.jgr-error{color:#ffc6b9;font-size:14px}.jgr-error:empty{display:none}
      .jgr-log{height:36vh;min-height:170px;overflow:auto;overscroll-behavior:contain;padding-right:8px}.jgr-turn{margin:14px 0;padding:12px 14px;border-left:3px solid #719253;background:#ffffff06;border-radius:0 8px 8px 0}
      .jgr-bene{border-color:#91b9cb}.jgr-madeleine{border-color:#b4a0cf}.jgr-system{border-color:#d7b371}.jgr-turn header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .jgr-turn time{font-size:14px;color:#bbc7b1}.jgr-turn p{white-space:pre-wrap;overflow-wrap:anywhere}.jgr-turn button{font-size:14px;padding:5px 8px}
      .jgr form{border-top:1px solid var(--line2,#48533d);padding-top:12px;margin-top:12px}.jgr label{display:block;font-size:14px}.jgr textarea,.jgr input{display:block;width:100%;margin:5px 0 10px}.jgr textarea{resize:vertical;min-height:90px}
      .jgr-actions{display:flex;align-items:end;gap:10px;flex-wrap:wrap}.jgr-actions label{margin-right:auto}.jgr-send{background:#456c27!important;color:#fff!important}.jgr-note{font-size:14px;color:#bbc7b1}
      .jgr-open{font:inherit;padding:8px 12px;border:1px solid var(--line2,#48533d);border-radius:9px;background:var(--panel2,#20271c);color:var(--ink,#e9eee4);cursor:pointer;margin:8px 0}
      .jgr-scene{background:#263b48;border-bottom:1px solid #48533d;overflow:hidden}.jgr-scene svg{display:block;width:100%;max-height:300px}.jgr-setting{color:#e9eee4;display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding:10px 20px;background:#14212b}.jgr-setting label{display:flex;gap:8px;align-items:center}.jgr-setting input[type=file]{max-width:220px;font-size:14px;padding:4px}.jgr-setting small{font-size:13px}.jgr-speaking{opacity:0}.jgr-active .jgr-speaking{opacity:1;animation:jgrPulse 1.5s ease-in-out infinite}.jgr-body{animation:jgrBreathe 5s ease-in-out infinite;transform-box:fill-box;transform-origin:bottom center}.jgr-person-madeleine .jgr-body{animation-delay:-2s}.jgr-eyes{animation:jgrBlink 7s infinite;transform-box:fill-box;transform-origin:center}.jgr-glow{animation:jgrLight 4s ease-in-out infinite}.jgr-water{animation:jgrDrift 9s ease-in-out infinite alternate}.jgr-cloud{animation:jgrDrift 20s ease-in-out infinite alternate}.jgr-flame{animation:jgrLight 1.2s ease-in-out infinite alternate}
      @keyframes jgrBreathe{50%{transform:translateY(-2px)}}@keyframes jgrBlink{0%,44%,48%,100%{transform:scaleY(1)}46%{transform:scaleY(.1)}}@keyframes jgrLight{50%{opacity:.65}}@keyframes jgrPulse{50%{opacity:.3}}@keyframes jgrDrift{to{transform:translateX(15px)}}
      @media(prefers-reduced-motion:reduce){.jgr *{animation:none!important;scroll-behavior:auto!important}}
      @media(min-width:651px){.jgr[open]{display:flex;flex-direction:column;height:94vh;max-height:1000px}.jgr-head{padding:10px 20px}.jgr-scene{flex:none}.jgr-scene svg{height:21vh;max-height:220px}.jgr-layout{flex:1;min-height:0}.jgr-main{display:flex;flex-direction:column;min-height:0;padding:10px 18px}.jgr-log{height:auto;flex:1;min-height:75px}.jgr form{padding-top:6px;margin-top:6px}.jgr textarea{min-height:55px;height:60px;margin-bottom:6px}.jgr input{margin:3px 0 6px;padding:5px 10px}.jgr-note{margin:4px 0!important}.jgr-side{max-height:none}.jgr-setting{padding:6px 20px}.jgr-setting select{padding:5px 8px}.jgr-setting small{font-size:12px}.jgr-status{margin:3px 0!important}.jgr-main>button{align-self:flex-start;padding:4px 10px}}
      @media(max-width:650px){.jgr-layout{grid-template-columns:1fr}.jgr-side{border-right:0;border-bottom:1px solid #48533d;max-height:150px;padding:12px}.jgr-rooms{display:flex;overflow:auto}.jgr-rooms button{min-width:150px}.jgr-main{padding:12px}.jgr-head{padding:12px}.jgr-log{height:28vh}.jgr{max-height:96vh}}
.jgr{width:min(1440px,calc(100% - 20px));border-color:#b59c62;border-radius:18px;background:#081018;--panel:#081018;--panel2:#142433;--line2:#3e5360;color:#edf2f4}
.jgr-head{background:linear-gradient(100deg,#132636,#081018);border-bottom:1px solid #b79d6266}.jgr-head h2{letter-spacing:.035em}.jgr-head h2::before{content:'✧ ';color:#efd494}.jgr-head button{font-size:13px}
.jgr-setting{background:#101e29}.jgr-wardrobe{padding:7px 20px;background:#0b1721;border-bottom:1px solid #b79d6244;font-size:13px}.jgr-wardrobe summary{cursor:pointer;color:#e4ce96}.jgr-wardrobe-panel{display:flex;flex-wrap:wrap;gap:12px;padding:10px 0}.jgr-wardrobe-panel label{flex:1;min-width:150px}.jgr-wardrobe-panel select{display:block;width:100%;margin-top:5px}.jgr-wardrobe-panel small{flex-basis:100%;font-size:12px}
.jgr-scene{position:relative;isolation:isolate;height:32vh;min-height:245px;max-height:430px;background:#081018;overflow:hidden;border-bottom:1px solid #c4a35b88}.jgr-world{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:jgrWorldDrift 28s ease-in-out infinite alternate}.jgr-scene::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,#07101a55,transparent 35%,#07101aa6);z-index:1}.jgr-sigil{position:absolute;left:24px;top:17px;color:#ffdf99;z-index:3;text-shadow:0 1px 8px #000;display:grid;gap:4px;justify-items:center;font-size:10px;letter-spacing:.2em}.jgr-sigil svg{width:104px!important;height:34px!important;max-height:none!important}.jgr-world-title{position:absolute;right:24px;top:24px;z-index:3;color:#fff2ce;font-size:13px;letter-spacing:.07em;text-shadow:0 2px 7px #000;background:#08101866;border:1px solid #d8ba6f55;border-radius:30px;padding:6px 14px}
.jgr-cast{position:absolute;inset:20px 12% 8px;z-index:2;display:flex;justify-content:center;gap:24px;align-items:end}.jgr-actor{height:92%;width:25%;max-width:215px;margin:0;text-align:center;position:relative}.jgr-avatar{height:calc(100% - 32px);width:100%;background-repeat:no-repeat;background-color:#081018;mask-image:linear-gradient(to right,transparent,#000 9%,#000 91%,transparent);border-radius:14px 14px 40% 40%;animation:jgrBreathe 6s ease-in-out infinite;box-shadow:0 0 40px #6bd2ff22}.jgr-actor figcaption{font-size:11px;color:#fff4d4;background:#081018cc;border:1px solid #bba56966;border-radius:20px;display:inline-block;padding:3px 9px;position:relative;white-space:nowrap}.jgr-actor small{font-size:9px;color:#d7dedf;text-shadow:0 1px 3px #000}.jgr-active .jgr-avatar{filter:drop-shadow(0 0 8px #70e9ff)}.jgr-active figcaption::before{content:'● ';color:#8ff0ff}.jgr-person-madeleine .jgr-avatar{animation-delay:-2s}
.jgr-holo-grid{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0;background-color:#060e18;background-image:linear-gradient(#edc75b88 1px,transparent 1px),linear-gradient(90deg,#edc75b88 1px,transparent 1px);background-size:55px 55px}.jgr-arrive .jgr-holo-grid{animation:jgrMaterialize 1.8s ease-out both}.jgr-door{position:absolute;top:0;bottom:0;width:50%;z-index:6;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 65px,#c9daea0c 66px 67px),linear-gradient(100deg,#122333,#3d5260,#10212d);border:1px solid #81949c}.jgr-door::after{content:'';position:absolute;top:12%;bottom:12%;width:3px;background:#ffdb85;box-shadow:0 0 15px #edcc74}.jgr-door-left{left:0;transform:translateX(-101%)}.jgr-door-right{right:0;transform:translateX(101%)}.jgr-door-left::after{right:10px}.jgr-door-right::after{left:10px}.jgr-arrive .jgr-door-left{animation:jgrDoorLeft 1.1s cubic-bezier(.6,0,.2,1) both}.jgr-arrive .jgr-door-right{animation:jgrDoorRight 1.1s cubic-bezier(.6,0,.2,1) both}
.jgr.jgr-immersive .jgr-layout{display:none}.jgr.jgr-immersive .jgr-scene{flex:1;height:auto;max-height:none}.jgr.jgr-immersive .jgr-actor{max-width:290px}.jgr-open{background:linear-gradient(110deg,#122838,#244352)!important;border:1px solid #d8bb78!important;color:#ffedc2!important;box-shadow:inset 0 0 0 3px #08121a,0 4px 12px #0002;letter-spacing:.015em}.jgr-open::before{content:'⇧ ';color:#f3cf7b}.jgr-open:hover{box-shadow:inset 0 0 0 3px #08121a,0 0 18px #e4be6b55}.jgr-open:focus-visible{outline:3px solid #80ddff!important}
@keyframes jgrMaterialize{0%,25%{opacity:1}100%{opacity:0}}@keyframes jgrDoorLeft{0%,15%{transform:translateX(0)}100%{transform:translateX(-101%)}}@keyframes jgrDoorRight{0%,15%{transform:translateX(0)}100%{transform:translateX(101%)}}@keyframes jgrWorldDrift{to{transform:scale(1.055)}}
@media(min-width:651px){.jgr[open]{height:96vh;max-height:1200px}.jgr-log{min-height:65px}.jgr-layout{grid-template-columns:190px minmax(0,1fr)}}
@media(max-width:650px){.jgr{width:100%;max-height:100dvh;border-radius:0}.jgr-head{flex-wrap:wrap;gap:7px}.jgr h2{font-size:18px}.jgr-scene{height:290px;min-height:290px}.jgr-cast{inset:55px 2% 10px;gap:2px}.jgr-actor{width:33%}.jgr-actor figcaption{font-size:9px;padding:3px 5px;white-space:normal}.jgr-sigil{left:12px;top:9px}.jgr-world-title{right:10px;top:20px;font-size:11px}.jgr-setting{padding:8px 12px}.jgr-wardrobe{padding:7px 12px}.jgr.jgr-immersive .jgr-scene{height:65dvh}.jgr-setting input[type=file]{max-width:175px}.jgr-log{height:27vh}}
@media(prefers-reduced-motion:reduce){.jgr *{animation:none!important;transition:none!important}.jgr-holo-grid{display:none}.jgr-door-left{transform:translateX(-101%)}.jgr-door-right{transform:translateX(101%)}}

.jgr-avatar{position:relative;overflow:hidden}.jgr-sprite{position:absolute;left:50%;top:0;height:100%;transform:translateX(-50%);background-repeat:no-repeat}

    `; document.head.append(style);
    dialog = e('dialog', { class: 'jgr', 'aria-labelledby': 'jgr-title' });
    const head = e('div', { class: 'jgr-head' });
    const close = e('button', { type: 'button', 'aria-label': 'Gesprächsraum schließen' }, 'Schließen');
    close.addEventListener('click', () => dialog.close());
    const expand = e('button', {type:'button', 'aria-pressed':'false'}, 'Raum groß ansehen');
    expand.addEventListener('click', () => { const on = dialog.classList.toggle('jgr-immersive'); expand.textContent = on ? 'Gespräch anzeigen' : 'Raum groß ansehen'; expand.setAttribute('aria-pressed', String(on)); });
    head.append(e('h2', { id: 'jgr-title' }, 'Vaikuntha · Holodeck'), expand, close);
    const settings = e('div', { class: 'jgr-setting' });
    const placeLabel = e('label', {}, 'Unser Ort'); place = e('select', { 'aria-label': 'Unser Ort' });
    for (const [value, label] of Object.entries(places)) place.append(e('option', { value }, label));
    try { const saved = localStorage.getItem('compassRaumOrt'); if (places[saved]) place.value = saved; } catch (_) { /* optional preference */ }
    place.addEventListener('change', () => { paintScene(); try { localStorage.setItem('compassRaumOrt', place.value); } catch (_) { /* optional preference */ } });
    placeLabel.append(place);
    const photoLabel = e('label', {}, 'Mein Porträt');
    const photo = e('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'aria-label': 'Foto für meine Figur wählen' });
    photo.addEventListener('change', () => {
      const file = photo.files[0]; if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
        error.textContent = 'Bitte ein PNG-, JPG- oder WebP-Porträt mit höchstens 8 MB wählen.'; return;
      }
      if (portraitUrl) URL.revokeObjectURL(portraitUrl);
      portraitUrl = URL.createObjectURL(file); paintScene();
    });
    photoLabel.append(photo); settings.append(placeLabel, photoLabel, e('small', {}, 'Dein Foto bleibt in dieser Browser-Sitzung.'));
    const wardrobePanel = wardrobeControls();
    stage = e('div', { class: 'jgr-scene' }); paintScene();
    const layout = e('div', { class: 'jgr-layout' }), side = e('nav', { class: 'jgr-side', 'aria-label': 'Räume' });
    fresh = e('button', { type: 'button' }, 'Neuer Raum'); fresh.addEventListener('click', () => select(''));
    list = e('div', { class: 'jgr-rooms' }); side.append(fresh, list);
    const main = e('div', { class: 'jgr-main' });
    status = e('p', { class: 'jgr-status', role: 'status' }, 'Verbindung wird geprüft …');
    error = e('p', { class: 'jgr-error', role: 'alert' });
    log = e('section', { class: 'jgr-log', 'aria-label': 'Gesprächsverlauf', tabindex: '0' });
    form = e('form');
    const topicLabel = e('label', {}, 'Thema (optional, auch in der Rezeption sichtbar)');
    topic = e('input', { maxlength: '80' }); topicLabel.append(topic);
    const inputLabel = e('label', {}, 'Deine Nachricht');
    input = e('textarea', { rows: '3', maxlength: '8000', placeholder: 'Was möchtest Du besprechen?' }); inputLabel.append(input);
    input.addEventListener('input', controls);
    const actions = e('div', { class: 'jgr-actions' }), to = e('label', {}, 'Antwort von');
    recipient = e('select');
    for (const [value, label] of [['beide', 'John, dann Madeleine'], ['john', 'John'], ['madeleine', 'Madeleine']]) recipient.append(e('option', { value }, label));
    to.append(recipient); send = e('button', { type: 'submit', class: 'jgr-send' }, 'Senden');
    actions.append(to, send);
    form.append(topicLabel, inputLabel, actions, e('p', { class: 'jgr-note' }, 'Bis 8000 Zeichen. „Nicht weitergeben“ gilt für künftige Antworten.'));
    form.addEventListener('submit', event => {
      event.preventDefault(); if (mode !== 'local' || send.disabled) return;
      const text = input.value.trim();
      mutate(async () => {
        const previous = id;
        // Neutrales Thema verhindert, dass der Server den ersten Satz als Hub-Thema übernimmt.
        const result = await local('/raum', { ...(id ? { id } : { thema: topic.value.trim() || 'Gespräch' }), text, an: recipient.value });
        id = result.id; input.value = ''; drafts.delete(previous); turns = previous === id ? turns : new Map();
        topic.closest('label').hidden = true;
        status.textContent = result.wartet ? 'Wartet — John ist beschäftigt. Der Raum ist eingereiht.' : 'Nachricht übergeben. Die Antwort wird vorbereitet.';
        round = 0;
      });
    });
    stop = e('button', { type: 'button' }, 'Gespräch stoppen');
    stop.addEventListener('click', () => mutate(async () => {
      const result = await local('/stopp', { id });
      status.textContent = result.gestoppt ? 'Gespräch gestoppt.' : 'Es läuft und wartet gerade kein Zug.';
      lastRun = null; waiting = [];
    }));
    main.append(status, error, log, stop, form); layout.append(side, main); dialog.append(head, settings, wardrobePanel, stage, layout); document.body.append(dialog);
    dialog.addEventListener('close', () => { clearTimeout(timer); epoch++; saveDraft(); opener?.focus(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else schedule(0); });
    controls();
  }
  function open() {
    if (!dialog) build();
    if (dialog.open) return;
    opener = document.activeElement; dialog.showModal(); paintScene(); schedule(0);
  }
  function attach() {
    for (const target of ['rhythm', 'stapelBody']) {
    const card = document.getElementById(target);
    if (card && !card.querySelector('.jgr-open')) {
      const button = e('button', { type: 'button', class: 'jgr-open' }, 'Aufzug zum Holodeck');
      button.addEventListener('click', open); card.prepend(button);
    }
  }
  }
  function fromLink() { if (['#hotel-lobby','#holodeck'].includes(location.hash)) open(); }
  function start() {
    const entryStyle = e('style');
    entryStyle.textContent = '.jgr-open{font:inherit;padding:10px 15px;border:1px solid #aab795;border-radius:9px;background:#dbe7c0;color:#253b2a;cursor:pointer;margin:8px 0}.jgr-open:focus-visible{outline:3px solid #ad6b2a;outline-offset:3px}';
    document.head.append(entryStyle);
    let wardrobeDay = localDay();
    setInterval(() => { const today = localDay(); if (today !== wardrobeDay) { wardrobeDay = today; if (dialog?.open) paintScene(); } }, 60000);
    attach(); new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', fromLink); fromLink();
  }
  window.johnGespraechsraum = { oeffnen: open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
