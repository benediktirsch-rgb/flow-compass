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
      return {
        id: q.id,
        projekt: (wer && projekt.indexOf(name) !== 0) ? (wer + ' · ' + projekt) : (projekt || wer),
        frage: q.frage || '', warum: q.warum || '', optionen: (q.optionen || []).slice(0, 4),
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
      setTimeout(() => { geplant = false; hinweis(); }, 50);   // kein rAF: steht in Hintergrund-Tabs still
    }).observe(document.body, { childList: true, subtree: true });

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
      setInterval(() => { if (!document.hidden) laden(true); }, TAKT_MS);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) laden(true); });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
  }
})();
