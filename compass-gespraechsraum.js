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
  function person(who, x, coat, hair, skin) {
    return `<g class="jgr-person jgr-person-${who}" transform="translate(${x} 172)">
      <ellipse cx="0" cy="124" rx="48" ry="8" fill="#0c171e" opacity=".25"/>
      <g class="jgr-body"><path d="M-26 70L-25 116Q-17 124-9 116L-3 82 5 117Q14 124 23 116L27 70" fill="#293344"/>
      <path d="M-29 25Q-43 27-48 62L-35 70-22 45 23 45 36 70 48 62Q40 29 28 25Z" fill="${coat}"/>
      <path d="M-23 23Q0 13 23 23L30 80Q0 91-30 80Z" fill="${coat}"/>
      <path d="M-8 22L0 48 9 22" fill="#f3e1c6"/>
      <path d="M-36 59Q-47 64-42 72L-22 76-20 68Z M36 59Q47 64 42 72L22 76 20 68Z" fill="${skin}"/>
      <rect x="-7" y="7" width="14" height="19" rx="5" fill="${skin}"/>
      <g class="jgr-head-figure"><path d="M-23-13Q-26-43 0-45Q30-43 23-10L21 21-21 21Z" fill="${hair}"/>
      <ellipse cy="-11" rx="20" ry="27" fill="${skin}"/>
      <path d="M-21-15Q-26-42 0-42Q22-43 23-15L13-29Q-8-18-15-30Z" fill="${hair}"/>
      <g class="jgr-eyes"><ellipse cx="-7" cy="-11" rx="2" ry="2.4" fill="#273039"/><ellipse cx="7" cy="-11" rx="2" ry="2.4" fill="#273039"/></g>
      <path d="M-5 1Q0 5 6 0" stroke="#8b5149" stroke-width="1.7" fill="none" stroke-linecap="round"/>
      ${who === 'bene' ? '<image class="jgr-portrait" x="-21" y="-39" width="42" height="57" preserveAspectRatio="xMidYMid slice" clip-path="url(#jgr-portrait-clip)"/>' : ''}
      </g></g>
      <g transform="translate(-70 137)"><rect width="140" height="28" rx="14" fill="#0b1e2c" fill-opacity=".82"/><text x="70" y="19" text-anchor="middle" fill="#fff" font-size="14" font-family="system-ui">${who === 'bene' ? 'Du · Platzhalter' : names[who]}</text></g>
      <circle class="jgr-speaking" cx="33" cy="-32" r="7" fill="#d3f3a3"/>
    </g>`;
  }
  function scenery(theme) {
    const defs = `<defs><linearGradient id="jgr-sky" x2="0" y2="1"><stop stop-color="${theme === 'bar' ? '#152336' : theme === 'huette' ? '#8da2b7' : theme === 'rom' ? '#d78e79' : '#e49e94'}"/><stop offset="1" stop-color="#f2d8ae"/></linearGradient><linearGradient id="jgr-floor" x2="0" y2="1"><stop stop-color="#967254"/><stop offset="1" stop-color="#352d34"/></linearGradient><clipPath id="jgr-portrait-clip"><ellipse cy="-11" rx="20" ry="27"/></clipPath></defs>`;
    const base = '<rect width="900" height="360" fill="url(#jgr-sky)"/>';
    const stars = '<g fill="#ffe8b4" opacity=".65"><circle cx="84" cy="38" r="1.5"/><circle cx="266" cy="23" r="1"/><circle cx="470" cy="65" r="2"/><circle cx="614" cy="28" r="1"/><circle cx="822" cy="46" r="1.5"/></g>';
    let landscape = '';
    if (theme === 'bar') landscape = `${stars}<path d="M0 0H900V34H0Z" fill="#0e1724"/><rect y="199" width="900" height="161" fill="url(#jgr-floor)"/>
      <rect x="286" y="49" width="328" height="132" rx="65" fill="#40586a" stroke="#cca575" stroke-width="5"/>
      <path d="M309 144Q400 75 449 129T590 111" fill="none" stroke="#c99a6c" stroke-width="2" opacity=".6"/>
      <text x="450" y="98" text-anchor="middle" font-family="Georgia" font-size="29" fill="#f8e1b9">VA I K U N T H A</text>
      <text x="450" y="125" text-anchor="middle" font-family="system-ui" font-size="11" letter-spacing="5" fill="#f8e1b9">DIE BAR</text>
      <g fill="#142432" stroke="#806e57" stroke-width="3"><rect x="52" y="58" width="177" height="130" rx="7"/><rect x="671" y="58" width="177" height="130" rx="7"/></g>
      <g stroke="#ac8961" stroke-width="5"><path d="M53 119H230M670 119H847M53 163H230M670 163H847"/></g>
      ${[80,110,145,178,705,739,776,811].map((x,i)=>`<path d="M${x} 113V87L${x+5} 83V70H${x+12}V83L${x+17} 87V113Z" fill="${i%2?'#b97a50':'#6e9b86'}"/>`).join('')}
      <rect x="30" y="186" width="840" height="28" rx="8" fill="#ceaa78"/><rect x="45" y="212" width="810" height="25" fill="#4a3733"/>
      <g class="jgr-glow" fill="#ffdc94"><ellipse cx="182" cy="56" rx="39" ry="10"/><ellipse cx="716" cy="56" rx="39" ry="10"/></g><path d="M182 0V48M716 0V48" stroke="#d5b983" stroke-width="3"/>`;
    if (theme === 'huette') landscape = `<path d="M0 178L112 52 228 177 384 42 553 176 682 60 900 177V260H0" fill="#728793"/><path d="M60 113L112 52 158 110 131 101 114 118 99 96ZM311 111L384 42 451 111 410 91 383 116 363 88Z" fill="#e9e7de"/>
      <rect y="223" width="900" height="137" fill="#504039"/><path d="M0 0H900V23H0ZM0 0L72 0 72 253H0ZM830 0H900V253H830Z" fill="#4a342b"/>
      <path d="M71 20L450 0 830 20M72 181H830" stroke="#73513a" stroke-width="14"/>
      <path d="M96 256L210 254 210 360H96" fill="#392d2c"/><path d="M116 240Q111 183 149 159Q170 190 160 205Q187 181 188 235Z" class="jgr-flame" fill="#f6b25c"/>
      <path d="M0 311H900M285 226L237 360M660 225L705 360" stroke="#b2916e" opacity=".3" stroke-width="2"/>
      <g fill="#314e48"><path d="M90 193L123 130 155 193ZM722 203L768 115 814 203Z"/></g>`;
    if (theme === 'goa') landscape = `<circle cx="595" cy="107" r="36" fill="#ffe1a6"/><rect y="152" width="900" height="104" fill="#4b9b9f"/>
      <g class="jgr-water" fill="none" stroke="#d9e8ca" stroke-width="3" opacity=".6"><path d="M0 173Q120 159 240 173T480 173T720 173T960 173M-30 207Q110 194 250 207T530 207T930 207M0 236Q150 219 300 236T600 236T960 236"/></g>
      <path d="M0 252Q266 218 469 253T900 235V360H0Z" fill="#d4b88e"/>
      <path d="M96 266Q137 144 102 50M805 255Q781 141 806 64" fill="none" stroke="#664f45" stroke-width="13"/>
      <g fill="#345d52"><path d="M104 53Q17 6 0 83Q55 49 104 53Q31 73 37 134Q66 79 104 53Q158 1 224 61Q155 40 104 53Q187 48 197 112Q147 70 104 53Z"/><path d="M806 66Q730 17 685 89Q747 65 806 66Q872 4 900 45L900 78Q844 53 806 66Q877 82 873 140Q852 87 806 66Z"/></g>`;
    if (theme === 'anden') landscape = `<circle cx="730" cy="72" r="31" fill="#ffe6bb"/>
      <path d="M0 224L141 78 270 201 464 21 664 220 803 81 900 181V360H0Z" fill="#8a7c89"/>
      <path d="M76 146L141 78 195 145 163 127 142 149 126 124ZM365 125L464 21 557 114 504 97 469 132 437 95Z" fill="#eee7e3"/>
      <path d="M0 256L188 174 315 270 566 164 740 267 900 211V360H0Z" fill="#77795c"/><path d="M0 306Q256 239 466 296T900 287V360H0Z" fill="#9c8c63"/>
      <path d="M4 295L204 257 292 279M539 255L657 292 863 260" stroke="#bdb487" stroke-width="7" fill="none"/>
      <g class="jgr-cloud" fill="#fff1dc" opacity=".38"><ellipse cx="255" cy="79" rx="76" ry="13"/><ellipse cx="644" cy="137" rx="65" ry="9"/></g>`;
    if (theme === 'rom') landscape = `<path d="M0 28H244V266H0ZM658 0H900V277H658Z" fill="#bf805e"/><path d="M244 86H389V254H244ZM535 64H658V257H535Z" fill="#e6bb86"/>
      <path d="M389 177Q450 48 535 177V260H389" fill="#b79d85"/><path d="M437 130V75H465V130M430 75H472L451 48Z" fill="#b59a83"/>
      ${[37,112,186,687,766,840].map(x=>`<path d="M${x} 86V58Q${x+17} 33 ${x+34} 58V86Z" fill="#4c6260"/><rect x="${x}" y="123" width="34" height="49" fill="#526762"/><path d="M${x-4} 178H${x+39}" stroke="#483e38" stroke-width="4"/>`).join('')}
      <path d="M0 263L396 240H533L900 273V360H0Z" fill="#9a8a80"/>
      <path d="M80 360L409 245M303 360L439 245M612 360L479 245M840 360L514 245M0 313H900M71 277H832" stroke="#c4b3a0" stroke-width="2" opacity=".6"/>
      <path d="M0 211H270L243 239H0Z" fill="#a74840"/><path d="M663 211H900V239H681Z" fill="#78805d"/>
      <path d="M0 13Q444 127 900 13" stroke="#594737" stroke-width="2" fill="none"/>
      <g class="jgr-glow" fill="#ffe3a7">${[75,200,325,450,575,700,825].map((x,i)=>`<circle cx="${x}" cy="${i<4?30+i*13:69-(i-3)*13}" r="4"/>`).join('')}</g>`;
    return defs + base + landscape;
  }
  function paintScene() {
    const theme = place.value;
    stage.innerHTML = `<svg viewBox="0 0 900 360" role="img" aria-label="${places[theme]}. Gezeichnete Figuren von John, Dir und Madeleine.">${scenery(theme)}
      ${person('john', 260, '#63796c', '#c6c7bb', '#c89f83')}${person('bene', 450, '#668195', '#65564d', '#c8a58f')}${person('madeleine', 640, '#9a6974', '#493c3b', '#d7b09a')}
      <ellipse cx="450" cy="281" rx="172" ry="25" fill="#805d4a"/><ellipse cx="450" cy="277" rx="172" ry="23" fill="#c9a276"/>
      <path d="M447 295V331M426 335H472" stroke="#443c37" stroke-width="9"/>
      <g fill="#f1e6d3"><path d="M342 254H360L357 270H345Z"/><path d="M538 254H556L553 270H541Z"/></g>
      <circle cx="449" cy="261" r="8" fill="#ffdfa2" class="jgr-glow"/></svg>`;
    if (portraitUrl) {
      stage.querySelector('.jgr-portrait').setAttribute('href', portraitUrl);
      stage.querySelector('.jgr-person-bene text').textContent = 'Du';
    }
    animateSpeaker();
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
    `; document.head.append(style);
    dialog = e('dialog', { class: 'jgr', 'aria-labelledby': 'jgr-title' });
    const head = e('div', { class: 'jgr-head' });
    const close = e('button', { type: 'button', 'aria-label': 'Gesprächsraum schließen' }, 'Schließen');
    close.addEventListener('click', () => dialog.close());
    head.append(e('h2', { id: 'jgr-title' }, 'Hotel Vaikuntha · Lobby'), close);
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
    main.append(status, error, log, stop, form); layout.append(side, main); dialog.append(head, settings, stage, layout); document.body.append(dialog);
    dialog.addEventListener('close', () => { clearTimeout(timer); epoch++; saveDraft(); opener?.focus(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else schedule(0); });
    controls();
  }
  function open() {
    if (!dialog) build();
    if (dialog.open) return;
    opener = document.activeElement; dialog.showModal(); schedule(0);
  }
  function attach() {
    for (const target of ['rhythm', 'stapelBody']) {
    const card = document.getElementById(target);
    if (card && !card.querySelector('.jgr-open')) {
      const button = e('button', { type: 'button', class: 'jgr-open' }, 'Hotel-Lobby öffnen');
      button.addEventListener('click', open); card.prepend(button);
    }
  }
  }
  function fromLink() { if (location.hash === '#hotel-lobby') open(); }
  function start() {
    const entryStyle = e('style');
    entryStyle.textContent = '.jgr-open{font:inherit;padding:10px 15px;border:1px solid #aab795;border-radius:9px;background:#dbe7c0;color:#253b2a;cursor:pointer;margin:8px 0}.jgr-open:focus-visible{outline:3px solid #ad6b2a;outline-offset:3px}';
    document.head.append(entryStyle);
    attach(); new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', fromLink); fromLink();
  }
  window.johnGespraechsraum = { oeffnen: open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
