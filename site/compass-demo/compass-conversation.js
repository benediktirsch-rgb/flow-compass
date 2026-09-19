/* Shared conversation surface. Uses the existing John/Madeleine endpoints and owner ticket. */
(() => {
  'use strict';
  if (typeof JOHN_API === 'undefined') return;
  const key = 'compassConversationV1';
  const names = {john:'John', madeleine:'Madeleine', user:'Du'};
  let messages = [], draft = '', target = 'auto', busy = '', error = '', controller;
  let madeleineState = 'unknown', probed = false;
  try { const stored = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(stored)) messages = stored.filter(m => m && ['john','madeleine','user'].includes(m.who) && typeof m.text === 'string').slice(-60);
  } catch (_) {}
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const save = () => { try { localStorage.setItem(key, JSON.stringify(messages.slice(-60))); } catch (_) {} };
  const roots = () => [...document.querySelectorAll('[data-compass-conversation]')];
  function participants(text) {
    if (target !== 'auto') return [target];
    const addressed = text.match(/(?:^\s*(?:(?:hey|hallo|bitte)\s+)?|@)(john|madeleine|madlene|madele)\b/i)
      || text.match(/,\s*(john|madeleine|madlene|madele)\s*[?!.]*$/i);
    if (addressed) return [addressed[1].toLowerCase() === 'john' ? 'john' : 'madeleine'];
    return [messages.filter(m => m.who !== 'user').at(-1)?.who || 'john'];
  }
  function history(root) {
    const log = root.querySelector('.cc-log');
    const oldTop = log.scrollTop;
    const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    log.innerHTML = messages.length ? messages.map(m => `<article class="cc-message cc-${m.who}"><b>${names[m.who]}</b><p>${esc(m.text)}</p></article>`).join('') :
      '<div class="cc-welcome"><span>RAUM FÜR KLARHEIT</span><h4>Was beschäftigt dich gerade?</h4><p>John hilft dir, den nächsten Schritt zu finden.<br>Madeleine bringt Zahlen und Struktur dazu.</p></div>';
    log.scrollTop = atEnd || busy ? log.scrollHeight : oldTop;
    root.querySelector('.cc-status').textContent = busy ? `${names[busy]} denkt nach …` : error || 'Dein Gespräch bleibt auf diesem Gerät erhalten.';
    root.querySelector('.cc-status').classList.toggle('cc-error', !!error);
    root.querySelector('.cc-send').disabled = !!busy || !draft.trim();
    root.querySelector('.cc-stop').hidden = !busy;
    root.querySelector('select').disabled = !!busy;
    root.querySelector('option[value="madeleine"]').disabled = madeleineState === 'unavailable';
    root.querySelectorAll('[data-person]').forEach(el => {
      el.classList.toggle('cc-thinking', el.dataset.person === busy);
      const unavailable = el.dataset.person === 'madeleine' && madeleineState === 'unavailable';
      el.querySelector('.cc-presence').textContent = unavailable ? 'Noch nicht angebunden' : busy === el.dataset.person ? 'Ist gerade dran' : busy ? 'Hört zu' : 'Ansprechen';
      el.disabled = !!busy || unavailable;
    });
  }
  function update() { roots().forEach(history); }
  async function probe() {
    if (probed || !roots().length) return;
    probed = true;
    try {
      const response = await fetch(JOHN_API + '/api/madeleine/status', {cache:'no-store', signal:AbortSignal.timeout(10000)});
      const data = await response.json();
      if (response.status === 404 || (response.ok && (!data.ok || !data.key))) madeleineState = 'unavailable';
      else if (response.ok && data.ok && data.key) madeleineState = 'ready';
    } catch (_) { /* A temporary network failure is not proof of a missing integration. */ }
    update();
  }
  async function headers(who) {
    const result = {'Content-Type':'application/json'};
    if (who === 'madeleine' && /^https:/.test(JOHN_API) && location.protocol === 'https:') {
      const r = await fetch('/gate.php?wer=1', {credentials:'same-origin', cache:'no-store', signal:controller.signal});
      if (!r.ok) throw new Error('Bitte melde dich erneut an.');
      const d = await r.json();
      if (d.madeleine) result['X-Mad-Ticket'] = String(d.madeleine);
    }
    return result;
  }
  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    const people = participants(text);
    if (people[0] === 'madeleine' && madeleineState === 'unavailable') {
      error = 'Madeleine ist in dieser Instanz noch nicht angebunden. Deine Nachricht bleibt stehen; du kannst John auswählen.';
      update(); return;
    }
    messages.push({who:'user', text}); save(); draft = ''; error = '';
    roots().forEach(root => { root.querySelector('textarea').value = ''; });
    controller = new AbortController();
    let timeout;
    try {
      for (const who of people) {
        busy = who; update();
        timeout = setTimeout(() => controller.abort(), 300000);
        const context = (typeof johnKontext === 'function' ? johnKontext() : '') +
          `\nGesprächsform: Du bist ${names[who]}. Nur du bist jetzt angesprochen; der andere Berater hört zu. Sprich den Menschen direkt mit du an. Antworte als du selbst, erfinde keine Beiträge anderer Teilnehmer. Stelle bei Klärungsbedarf eine konkrete Frage an den Menschen und warte danach auf seine Antwort. Keine automatische Beraterrunde, kein Zwang zu einer Frage nach jeder Antwort.`;
        const response = await fetch(JOHN_API + '/api/' + who, {
          method:'POST', headers:await headers(who), signal:controller.signal,
          body:JSON.stringify({messages:messages.slice(-60).map(m => ({
            role:m.who === 'user' ? 'user' : 'assistant',
            content:m.who === 'user' ? m.text : `${names[m.who]}: ${m.text}`
          })), context})
        });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.hint || data.error || `Antwort nicht verfügbar (${response.status}).`);
        if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('Es kam keine Antwort zurück.');
        messages.push({who, text:data.text}); save(); update(); clearTimeout(timeout);
      }
    } catch (e) {
      error = e.name === 'AbortError' ? 'Warten beendet. Eine bereits gestartete Verarbeitung kann noch weiterlaufen.' : `${names[busy]} konnte nicht antworten: ${e.message}`;
      // Keep the submitted message in the transcript; never silently resend a possibly processed request.
    } finally {
      clearTimeout(timeout); busy = ''; controller = null; update();
    }
  }
  function mount() {
    // Product instances have the coach card but no private finance/round-history card.
    if (!document.getElementById('madKachel')) {
      const card = document.getElementById('johnKachel');
      if (card && !card.querySelector('[data-compass-conversation]')) {
        const archive = document.createElement('details'); archive.className = 'cc-archive';
        const summary = document.createElement('summary'); summary.textContent = 'Impulse, Aufgaben & bisheriger Chat'; archive.append(summary);
        [...card.children].filter(el => el.tagName !== 'H3').forEach(el => archive.append(el));
        const host = document.createElement('div'); host.setAttribute('data-compass-conversation', '');
        card.append(host, archive);
      }
    }
    roots().filter(root => !root.dataset.ready).forEach(root => {
      root.dataset.ready = 'true';
      root.innerHTML = `<div class="cc-room"><aside class="cc-guides" aria-label="Deine Gesprächspartner">
        <div class="cc-eyebrow">DEINE BEGLEITER</div>
        <div class="cc-people">
          <button type="button" class="cc-person" data-person="john" aria-label="John ansprechen"><span class="cc-portrait cc-portrait-john" role="img" aria-label="John aus dem Holodeck"></span><span class="cc-person-name">John<span>Coaching & Perspektive</span><small class="cc-presence"></small></span></button>
          <button type="button" class="cc-person" data-person="madeleine" aria-label="Madeleine ansprechen"><span class="cc-portrait cc-portrait-madeleine" role="img" aria-label="Madeleine aus dem Holodeck"></span><span class="cc-person-name">Madeleine<span>Finanzen & Organisation</span><small class="cc-presence"></small></span></button>
        </div><p class="cc-invitation">Zwei Perspektiven.<br>Dein nächster Schritt.</p>
      </aside><div class="cc-dialog"><div class="cc-dialog-head"><div><strong>Im Gespräch</strong><span>Eine Stimme. Raum für deine Antwort.</span></div><label>An wen? <select aria-label="Gesprächspartner"><option value="auto">Gespräch</option><option value="john">John</option><option value="madeleine">Madeleine</option></select></label></div>
      <div class="cc-log" role="log" aria-label="Gemeinsamer Gesprächsverlauf" aria-live="polite" tabindex="0"></div>
      <div class="cc-suggestions"><button type="button" data-prompt="Hilf mir, meine Prioritäten für heute zu sortieren.">Prioritäten sortieren</button><button type="button" data-prompt="Ich möchte eine Entscheidung mit euch durchdenken.">Entscheidung durchdenken</button></div>
      <form class="cc-compose"><label class="cc-input-label">Deine Nachricht<textarea rows="2" maxlength="12000" placeholder="Schreib, was dich beschäftigt …"></textarea></label><button class="cc-send" type="submit">Senden ↗</button></form>
      <div class="cc-footer"><span class="cc-status" role="status"></span><button class="cc-stop" type="button" hidden>Warten beenden</button></div></div></div>`;
      root.querySelector('textarea').value = draft;
      root.querySelector('select').value = target;
      root.querySelector('select').addEventListener('change', e => { target = e.target.value; });
      root.querySelectorAll('[data-person]').forEach(button => button.addEventListener('click', () => {
        target = button.dataset.person; root.querySelector('select').value = target; root.querySelector('textarea').focus();
      }));
      root.querySelector('textarea').addEventListener('input', e => { draft = e.target.value; root.querySelector('.cc-send').disabled = !!busy || !draft.trim(); });
      root.querySelector('textarea').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
      });
      root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); send(); });
      root.querySelector('.cc-stop').addEventListener('click', () => controller?.abort());
      root.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => {
        draft = button.dataset.prompt; const input = root.querySelector('textarea'); input.value = draft; input.focus(); history(root);
      }));
      history(root);
    });
    probe();
  }
  mount();
  new MutationObserver(mount).observe(document.getElementById('grid') || document.body, {childList:true, subtree:true});
})();
