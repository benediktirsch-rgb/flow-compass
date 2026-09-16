/* compass-fragen-rezeption.js — Rückfragen aus Johns Rezeption im Compass (16.09.2026)

   Bene: „Ich will Madelene gleichberechtigten Zugriff auf meinen Compass geben und auch alle
   Rückfragen von ihr dort sehen." Und am selben Tag genauer: „Gleichberechtigt bedeutet: Madelenes
   Fragen erreichen mich genauso zuverlässig und lassen sich genauso gut beantworten wie deine. Es
   bedeutet keinen pauschalen Zugriff auf alle Informationen. Achtet bei der Sortierung darauf, dass
   offene oder wichtige Fragen nicht untergehen."

   Madelene (Astra, Codex in ChatGPT Work) hat keinen Zugang zu Benes Rechner. Ihre Rückfragen liegen
   deshalb in der Rezeption (hotel-vaikuntha.de/john, docs/protokoll.md › Rückfragen). Diese Datei
     1. holt die offenen Rückfragen von dort und hängt sie an offeneFragen() — Banner „Fragen an
        dich", Ritual „Rückfragen", Board-Spalte „wartet", alles wie bei Claudes Fragen;
     2. schreibt jede Antwort zusätzlich dorthin zurück (w=rueckfrage-antwort) und reicht nach, was
        in diesem Browser beantwortet, an der Rezeption aber noch offen ist;
     3. ordnet ALLE offenen Fragen gleich, egal von wem: dringende zuerst, und die am längsten
        wartende Frage (ab 3 Tagen) rückt auf Platz 3 — so geht nichts unter, auch nicht bei Claude;
     4. sagt es, wenn die Rezeption nicht erreichbar oder nicht eingerichtet ist (leer heißt nie nichts);
     5. kennt die Rezeption auch im lokalen Compass (localhost:8787): dort lädt sie die gitignorierte
        rezeption-lokal.js nach, die john-aufgaben.ps1 -Sync schreibt.

   „später" zählt im Compass als beantwortet (S.antworten) und geht deshalb auch hierher — die
   Fragende sieht „später" und stellt die Frage bei Bedarf unter neuer Kennung neu.

   Hängt sich von außen an wie compass-live.js: überschreibt offeneFragen, antwortText und
   antwortSenden über den globalen Namen und ruft die alten Fassungen weiter auf.
   Ohne Rezeption und außerhalb von localhost (Demo, Kundeninstanz) tut die Datei nichts.

   Quelle: C:\dev\john-agent\compass\ — nach flow-compass kopiert geraet\john-aufgaben.ps1 -Sync. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.__rezeptionFragen) return;
  window.__rezeptionFragen = true;

  const lies = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const LOKAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const konfig = () => ({
    hub: String(window.JOHN_HUB || lies('compassJohnHub')).replace(/\/$/, ''),
    token: String(window.JOHN_HUB_TOKEN || lies('compassJohnHubToken'))
  });

  if (!konfig().hub && LOKAL_HOST) {
    const s = document.createElement('script');
    s.src = 'rezeption-lokal.js';
    s.onload = () => los();
    s.onerror = () => los();
    document.head.appendChild(s);
  } else {
    los();
  }

  function los() {
    if (typeof offeneFragen !== 'function' || typeof antwortSenden !== 'function') return;
    const { hub: HUB, token: TOKEN } = konfig();
    const SPEICHER = 'compassRezeptionFragen';
    const TAKT_MS = 3 * 60 * 1000;
    const WARTET_TAGE = 3;          // ab so vielen Tagen rückt die älteste offene Frage nach vorn
    const NACH_VORN = 2;            // … auf diesen Platz (0-basiert): das Ritual zeigt drei auf einmal
    const NAMEN = { madelene: '👩‍💼 Madelene', madeleine: '👩‍💼 Madeleine', claude: '🤖 Claude', john: '🧭 John' };

    const RZF = { list: [], stand: null, fehler: null, geladen: false, gesendet: {}, eingerichtet: !!(HUB && TOKEN) };
    window.RZF = RZF;
    if (!RZF.eingerichtet) {
      if (!LOKAL_HOST) return;      // Demo, Kundeninstanz: nichts anzeigen, nichts tun
      RZF.fehler = 'auf diesem Gerät nicht eingerichtet (john-agent\\geraet\\john-aufgaben.ps1 -Sync)';
    }
    try { const alt = JSON.parse(lies(SPEICHER) || 'null'); if (alt && Array.isArray(alt.list)) { RZF.list = alt.list; RZF.stand = alt.stand || null; } } catch (e) { }

    const tag = () => (typeof heute === 'function' ? heute() : new Date().toLocaleDateString('sv-SE'));
    const tage = (von, bis) => {
      const a = Date.parse(von + 'T12:00:00'), b = Date.parse(bis + 'T12:00:00');
      return (isNaN(a) || isNaN(b)) ? 0 : Math.round((b - a) / 86400000);
    };
    const ausDatei = id => (((window.RHYTHM || {}).rueckfragen) || []).some(q => q.id === id);
    function fuerCompass(q) {
      const wer = NAMEN[q.von] || q.von || '';
      const projekt = String(q.projekt || '');
      const name = wer.replace(/^\S+\s/, '');
      const bezug = (q.bezug || []).length ? ' · 📎 bittet um Kontext zu: ' + q.bezug.map(b => kurzText(frageZu(b) || b, 60)).join(' | ') : '';
      return {
        id: q.id,
        projekt: (wer && projekt.indexOf(name) !== 0) ? (wer + ' · ' + projekt) : (projekt || wer),
        frage: q.frage || '', warum: (q.warum || '') + bezug, optionen: (q.optionen || []).slice(0, 4),
        wann: q.wann || '', dringend: !!q.dringend, link: q.link || null, von: q.von || '', quelle: 'rezeption'
      };
    }
    function rezeptionFragen() {
      const t = tag();
      return RZF.list
        .filter(q => q && q.status === 'offen' && !ausDatei(q.id) && (!q.wann || q.wann <= t))
        .map(fuerCompass)
        .filter(q => !(typeof beantwortet === 'function' && beantwortet(q)));
    }
    window.rezeptionFragen = rezeptionFragen;

    /* Eine Ordnung für alle, egal von wem die Frage kommt:
       1. dringende zuerst (Feld `dringend`, gilt auch für Einträge in rhythmus-data.js),
       2. dann die bisherige Reihenfolge — Rezeptionsfragen nach `wann` zwischen die Datei-Fragen,
       3. die am längsten wartende Frage (ab WARTET_TAGE) rückt auf Platz NACH_VORN, mit Kennzeichen. */
    function ordnen(liste) {
      const t = tag();
      const markiert = (q, vorsatz) => Object.assign({}, q, { projekt: vorsatz + ' · ' + (q.projekt || '') });
      let out = liste.filter(q => q.dringend).map(q => markiert(q, '❗ dringend')).concat(liste.filter(q => !q.dringend));
      let aelteste = -1;
      out.forEach((q, i) => {
        if (q.dringend || !q.wann || tage(q.wann, t) < WARTET_TAGE) return;
        if (aelteste < 0 || q.wann < out[aelteste].wann) aelteste = i;
      });
      if (aelteste > NACH_VORN) {
        const q = out[aelteste];
        out.splice(aelteste, 1);
        out.splice(NACH_VORN, 0, markiert(q, '⏳ wartet seit ' + tage(q.wann, t) + ' Tagen'));
      }
      return out;
    }

    /* ---------- an den Compass anhängen ---------------------------------------------------- */
    const altOffen = offeneFragen;
    window.offeneFragen = function () {
      const basis = (altOffen.apply(this, arguments) || []).slice();
      const da = new Set(basis.map(q => q.id));
      const neu = rezeptionFragen().filter(q => !da.has(q.id));
      neu.sort((a, b) => String(a.wann).localeCompare(String(b.wann))).forEach(q => {
        let i = basis.findIndex(x => String(x.wann || '') < q.wann);
        if (i < 0) i = basis.length;
        basis.splice(i, 0, q);
      });
      return ordnen(basis);
    };
    if (typeof antwortText === 'function') {
      const altText = antwortText;
      window.antwortText = function (id) {
        const t = altText.apply(this, arguments);
        if (t) return t;
        const q = RZF.list.find(x => x.id === id);
        return q ? q.frage : '';
      };
    }
    const altSenden = antwortSenden;
    window.antwortSenden = function (id, a) {
      const r = altSenden.apply(this, arguments);
      if (RZF.list.some(q => q.id === id && q.status === 'offen')) zurueck(id, a);
      return r;
    };

    /* ---------- sagen, wenn etwas fehlt ---------------------------------------------------- */
    function hinweis() {
      const liste = document.getElementById('fragenListe');
      const alt = document.getElementById('rzfHinweis');
      if (!liste || !RZF.fehler) { if (alt) alt.remove(); return; }
      const stand = RZF.stand ? ' — gezeigt wird der Stand von ' + new Date(RZF.stand).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      const text = '👩‍💼 Madelenes Rückfragen: ' + RZF.fehler + stand + '.';
      if (alt && alt.textContent === text) return;
      const el = alt || document.createElement('div');
      el.id = 'rzfHinweis'; el.className = 'hint'; el.style.margin = '8px 0'; el.textContent = text;
      if (!alt) liste.parentNode.insertBefore(el, liste);
    }
    let geplant = false;
    new MutationObserver(() => {
      if (geplant) return;
      geplant = true;
      setTimeout(() => { geplant = false; hinweis(); schmuecken(); }, 50);   // kein rAF: steht in Hintergrund-Tabs still
    }).observe(document.body, { childList: true, subtree: true });

    /* ---------- Freigaben für Madelene (16.09.2026) -----------------------------------------
       Rückfrage madelene-freigabe-modell, Bene: „Nur pro Frage, mit Vorschau und 30 Tagen" — und
       „Madelene ist eine Person". An jeder Rückfrage (Ritual, Banner) und jeder Zeile „entschieden"
       steht „🔓 Für Madelene". Die Vorschau zeigt genau den Text, der hinausgeht: die Frage ist
       vorbelegt, die Antwort nur auf Wunsch, die Begründung wird nie angeboten. Beträge, IBAN,
       Mailadressen, Telefonnummern und bekannte Namen blockieren, bis Bene ausdrücklich „trotzdem"
       sagt. Die Namensliste bleibt im Browser; die Rezeption prüft die vier Muster noch einmal. */
    const FG = { liste: [], geladen: false, namen: null };
    window.FG = FG;
    const MUSTER = [
      ['betrag', t => /\d[\d.,]*\s?(€|eur\b|euro\b|\$|usd\b|tsd\b|t€|k€)|(€|\$)\s?\d|\b\d+(?:[.,]\d+)?\s?k\b/i.test(t)],
      ['iban', t => /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}/.test(t.toUpperCase())],
      ['mail', t => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(t)],
      ['telefon', t => /(?:\+|\b00)\d[\d \/-]{7,}\d|\b0\d{2,5}[ \/-]?\d{3,}[\d -]{2,}\d\b/.test(t)]
    ];
    function kurzText(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
    function frageZu(id) {
      const r = window.RHYTHM || {};
      const q = (r.rueckfragen || []).find(x => x.id === id) || RZF.list.find(x => x.id === id);
      if (q) return q.frage || '';
      if (typeof umsZeile === 'function') { const z = umsZeile(id); if (z) return z[2] || ''; }
      if (typeof antwortText === 'function') return antwortText(id) || '';
      return '';
    }
    async function namenLaden() {
      if (FG.namen) return FG.namen;
      FG.namen = [];
      try {
        const api = (typeof JOHN_API !== 'undefined' && JOHN_API) ? JOHN_API : '';
        const r = await fetch(api + '/api/pool', { cache: 'no-store', signal: AbortSignal.timeout(6000) });
        const d = await r.json();
        (d.personen || []).forEach(p => { if (p && p.anzeigename) FG.namen.push(String(p.anzeigename)); });
      } catch (e) { /* ohne Namensliste prüfen nur die vier Muster */ }
      return FG.namen;
    }
    function treffer(text) {
      const t = String(text || '');
      const m = MUSTER.filter(([, pruef]) => pruef(t)).map(([n]) => n);
      const klein = t.toLowerCase();
      const namen = (FG.namen || []).filter(n => {
        const teile = n.toLowerCase().split(/\s+/).filter(x => x.length >= 4);
        return klein.includes(n.toLowerCase()) || teile.some(x => new RegExp('(^|[^a-zäöüß])' + x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-zäöüß])').test(klein));
      });
      if (namen.length) m.push('name: ' + namen.slice(0, 3).join(', '));
      return m;
    }
    async function freigabenLaden() {
      if (!RZF.eingerichtet) return;
      try {
        const { status, d } = await ruf('freigaben', null, '&fuer=madelene');
        if (status === 200 && d.ok) { FG.liste = d.freigaben || []; FG.geladen = true; schmuecken(true); }
      } catch (e) { }
    }
    const aktiv = id => FG.liste.find(f => f.bezug === id);
    function knopf(id, label) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fg-knopf'; b.dataset.fg = id;
      const f = aktiv(id);
      b.textContent = label || (f ? '🔓 für Madelene bis ' + f.bis.slice(8, 10) + '.' + f.bis.slice(5, 7) + '.' : '🔓 Für Madelene …');
      b.title = 'Diesen Kontext gezielt für Madelene freigeben — mit Vorschau, höchstens 30 Tage, jederzeit widerrufbar';
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); dialog(id); });
      return b;
    }
    function schmuecken(neu) {
      if (!RZF.eingerichtet) return;
      document.querySelectorAll('.qa[data-q] .opts, .item.ums[data-ums] > .body > .opts').forEach(opts => {
        const box = opts.closest('[data-q],[data-ums]');
        const id = box.dataset.q || box.dataset.ums;
        let b = opts.querySelector('.fg-knopf[data-fg="' + CSS.escape(id) + '"]');
        if (b && neu) { b.replaceWith(knopf(id)); b = true; }
        if (!b) opts.appendChild(knopf(id));
        const q = RZF.list.find(x => x.id === id);
        (q && q.bezug || []).forEach(bz => {
          if (!opts.querySelector('.fg-knopf[data-fg="' + CSS.escape(bz) + '"]')) opts.appendChild(knopf(bz, '📎 Kontext „' + kurzText(frageZu(bz) || bz, 28) + '" freigeben'));
        });
      });
    }
    function dialog(id) {
      if (!RZF.eingerichtet) return;
      namenLaden();
      const alt = document.getElementById('fgDlg'); if (alt) alt.remove();
      const f = aktiv(id);
      const antwort = (typeof S !== 'undefined' && S.antworten && S.antworten[id] && S.antworten[id].a) || '';
      const ov = document.createElement('div');
      ov.id = 'fgDlg';
      ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px';
      /* Farben aus dem Compass (--panel/--ink/--line/--bg), damit die Vorschau hell und dunkel lesbar bleibt. */
      ov.innerHTML = `<style>#fgDlg textarea,#fgDlg select{background:var(--bg,#fff);color:var(--ink,#111);border:1px solid var(--line,#ccc);border-radius:8px;padding:6px;font:inherit}#fgDlg label,#fgDlg .hint,#fgDlg .mini,#fgDlg h3{color:var(--ink,#111)}#fgDlg button{color:var(--ink,#111);background:var(--bg,#fff);border:1px solid var(--line,#ccc);border-radius:8px;padding:6px 10px;cursor:pointer}</style>
        <div class="card" style="max-width:640px;width:100%;max-height:90vh;overflow:auto;background:var(--panel,#fff);color:var(--ink,#111);border:1px solid var(--line,#ccc);padding:18px;border-radius:14px">
        <h3 style="margin-top:0">🔓 Für Madelene freigeben</h3>
        <div class="hint">Madelene (Astra) sieht nur diesen Text, höchstens bis zum Ablaufdatum. Begründungen werden nie mitgeschickt.</div>
        <label style="display:block;margin-top:10px"><input type="checkbox" checked disabled> Frage</label>
        <textarea data-f="frage" rows="3" style="width:100%"></textarea>
        <label style="display:block;margin-top:8px"><input type="checkbox" data-f="mitAntwort"> Deine Antwort</label>
        <textarea data-f="antwort" rows="2" style="width:100%" placeholder="(keine Antwort gespeichert)"></textarea>
        <label style="display:block;margin-top:8px">Eine Notiz von dir (optional)</label>
        <textarea data-f="notiz" rows="2" style="width:100%" placeholder="z. B. Kontext: wir bleiben bei Variante B"></textarea>
        <label style="display:block;margin-top:8px">Sichtbar für <select data-f="tage"><option value="7">7 Tage</option><option value="14">14 Tage</option><option value="30" selected>30 Tage</option></select></label>
        <div class="mini" style="margin-top:10px">So liest Madelene es:</div>
        <pre data-f="vorschau" style="white-space:pre-wrap;background:rgba(127,127,127,.12);padding:8px;border-radius:8px;margin:4px 0"></pre>
        <div data-f="warnung" class="hint" style="color:#b45309"></div>
        <label data-f="trotzdemZeile" style="display:none"><input type="checkbox" data-f="trotzdem"> Ich habe den Text geprüft — trotzdem senden</label>
        <div class="opts" style="margin-top:10px">
          <button type="button" class="a" data-f="senden">🔓 Freigeben</button>
          ${f ? '<button type="button" data-f="widerrufen">✕ Freigabe widerrufen</button>' : ''}
          <button type="button" data-f="zu">Abbrechen</button></div>
        <div data-f="status" class="mini"></div>
        <div data-f="liste" class="mini" style="margin-top:12px"></div></div>`;
      document.body.appendChild(ov);
      const $ = n => ov.querySelector('[data-f="' + n + '"]');
      $('frage').value = f ? f.frage : frageZu(id);
      $('antwort').value = f && f.antwort ? f.antwort : antwort;
      $('mitAntwort').checked = !!(f && f.antwort);
      $('notiz').value = f && f.notiz ? f.notiz : '';
      const text = () => [$('frage').value.trim(), $('mitAntwort').checked && $('antwort').value.trim() ? 'Antwort: ' + $('antwort').value.trim() : '', $('notiz').value.trim() ? 'Notiz: ' + $('notiz').value.trim() : ''].filter(Boolean).join('\n');
      const pruefen = () => {
        $('vorschau').textContent = text() + '\n— sichtbar bis ' + new Date(Date.now() + (+$('tage').value) * 86400000).toLocaleDateString('de-DE');
        const t = treffer(text());
        $('warnung').textContent = t.length ? '⚠ Sieht vertraulich aus: ' + t.join(' · ') + '. Bitte kürzen — oder ausdrücklich bestätigen.' : '';
        $('trotzdemZeile').style.display = t.length ? 'block' : 'none';
        return t;
      };
      ov.addEventListener('input', pruefen); ov.addEventListener('change', pruefen); pruefen();
      namenLaden().then(pruefen);
      const liste = () => {
        const andere = FG.liste.filter(x => x.bezug !== id);
        $('liste').innerHTML = andere.length ? '<b>Aktive Freigaben</b><br>' + andere.map(x => `${kurzText(x.frage, 70).replace(/</g, '&lt;')} · bis ${x.bis} <button type="button" data-weg="${x.id}" title="widerrufen">✕</button>`).join('<br>') : '';
      };
      liste();
      ov.addEventListener('click', async e => {
        if (e.target === ov || e.target.dataset.f === 'zu') { ov.remove(); return; }
        const weg = e.target.dataset.weg || (e.target.dataset.f === 'widerrufen' && f && f.id);
        if (weg) {
          const { status } = await ruf('freigabe', { id: weg, widerrufen: true });
          $('status').textContent = status === 200 || status === 404 ? '✓ widerrufen — der Eintrag ist in der Rezeption gelöscht.' : 'Widerruf gescheitert (HTTP ' + status + ').';
          FG.liste = FG.liste.filter(x => x.id !== weg); liste(); schmuecken(true);
          if (e.target.dataset.f === 'widerrufen') setTimeout(() => ov.remove(), 900);
          return;
        }
        if (e.target.dataset.f !== 'senden') return;
        const t = pruefen();
        if (!$('frage').value.trim()) { $('status').textContent = 'Die Frage darf nicht leer sein.'; return; }
        if (t.length && !$('trotzdem').checked) { $('status').textContent = 'Erst kürzen oder „trotzdem senden" ankreuzen.'; return; }
        const body = { fuer: 'madelene', bezug: id, frage: $('frage').value.trim(), notiz: $('notiz').value.trim(), tage: +$('tage').value, trotzdem: !!(t.length && $('trotzdem').checked) };
        if ($('mitAntwort').checked) body.antwort = $('antwort').value.trim();
        if (f) body.id = f.id;
        $('status').textContent = 'sende …';
        try {
          const { status, d } = await ruf('freigabe', body);
          if (status === 200 && d.ok) {
            $('status').textContent = '✓ freigegeben bis ' + d.bis + '.';
            await freigabenLaden(); setTimeout(() => ov.remove(), 900);
          } else if (status === 422) {
            $('status').textContent = 'Die Rezeption hat Vertrauliches erkannt (' + (d.muster || []).join(', ') + ') — kürzen oder bestätigen.';
            $('trotzdemZeile').style.display = 'block';
          } else { $('status').textContent = 'Nicht freigegeben: ' + (d.fehler || 'HTTP ' + status); }
        } catch (err) { $('status').textContent = 'Rezeption nicht erreichbar — nichts freigegeben.'; }
      });
    }
    window.madeleneFreigabe = dialog;

    /* ---------- Rezeption ------------------------------------------------------------------ */
    async function ruf(w, body, q) {
      const r = await fetch(HUB + '/api.php?w=' + w + (q || ''), {
        method: body ? 'POST' : 'GET', cache: 'no-store',
        headers: Object.assign({ 'X-John-Token': TOKEN }, body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8000)
      });
      const d = await r.json().catch(() => ({}));
      return { status: r.status, d };
    }
    function merken() { try { localStorage.setItem(SPEICHER, JSON.stringify({ list: RZF.list, stand: RZF.stand })); } catch (e) { } }
    async function zurueck(id, a) {
      if (!RZF.eingerichtet) return;
      const schluessel = id + '|' + a;
      if (RZF.gesendet[schluessel]) return;
      RZF.gesendet[schluessel] = true;
      const w = (typeof S !== 'undefined' && S.antworten && S.antworten[id]) || {};
      const ts = w.ts || tag();
      try {
        /* Gleiche Antwort nochmal ist unschädlich (Rezeption: unveraendert) — deshalb darf hier wiederholt werden. */
        const { status } = await ruf('rueckfrage-antwort', { id, a, ts, wer: 'compass' });
        if (status >= 200 && status < 300) {
          const q = RZF.list.find(x => x.id === id);
          if (q) { q.status = 'beantwortet'; q.antwort = { a, ts, wer: 'compass' }; merken(); }
        } else if (status !== 404 && status !== 409) {
          delete RZF.gesendet[schluessel];          /* 5xx, 429: der nächste Abgleich versucht es wieder */
        }
      } catch (e) { delete RZF.gesendet[schluessel]; }
    }

    async function laden(still) {
      if (!RZF.eingerichtet) { hinweis(); return; }
      let antwort;
      try { antwort = await ruf('rueckfragen', null, '&status=offen'); }
      catch (e) { RZF.fehler = 'Rezeption nicht erreichbar'; RZF.geladen = true; hinweis(); return; }
      const { status, d } = antwort;
      if (status !== 200 || !d || !d.ok) {
        RZF.fehler = 'Rezeption antwortet nicht richtig (' + ((d && d.fehler) || ('HTTP ' + status)) + ')';
        RZF.geladen = true; hinweis(); return;
      }
      const vorher = rezeptionFragen().map(q => q.id).join(',');
      RZF.list = d.rueckfragen || []; RZF.stand = d.jetzt || null; RZF.fehler = null; RZF.geladen = true;
      merken();
      const antw = (typeof S !== 'undefined' && S.antworten) || {};
      RZF.list.forEach(q => { if (q.status === 'offen' && antw[q.id] && antw[q.id].a) zurueck(q.id, antw[q.id].a); });
      const nachher = rezeptionFragen().map(q => q.id).join(',');
      if (!still || vorher !== nachher) neuMalen();
      hinweis();
    }
    function neuMalen() {
      try {
        if (typeof render === 'function' && typeof aktuell !== 'undefined') render(aktuell);
        if (typeof kopfMalen === 'function') kopfMalen();
        if (typeof rhythmMalen === 'function') rhythmMalen();
      } catch (e) { console.warn('Rückfragen aus der Rezeption: Neuzeichnen', e); }
    }
    window.rezeptionFragenLaden = () => laden(false);

    const start = () => {
      /* Nur neu zeichnen, wenn Ordnung oder gemerkter Stand wirklich etwas verschieben. */
      const ohne = (altOffen() || []).map(q => q.id).join(',');
      if (window.offeneFragen().map(q => q.id + (q.projekt || '')).join(',') !== (altOffen() || []).map(q => q.id + (q.projekt || '')).join(',') || !ohne) neuMalen();
      laden(true);
      freigabenLaden();
      setInterval(() => { if (!document.hidden) { laden(true); freigabenLaden(); } }, TAKT_MS);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) laden(true); });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
  }
})();
