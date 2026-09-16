/* compass-fragen-rezeption.js — Rückfragen aus Johns Rezeption im Compass (16.09.2026)

   Bene: „Ich will Madelene gleichberechtigten Zugriff auf meinen Compass geben und auch alle
   Rückfragen von ihr dort sehen."

   Bis heute kamen Rückfragen nur aus rhythmus-data.js — schreiben konnte sie nur, wer auf Benes
   Rechner Dateien anfasst. Madelene (Astra, Codex in ChatGPT Work) hat keinen Zugang zu diesem
   Rechner. Deshalb liegen Rückfragen jetzt auch in der Rezeption (hotel-vaikuntha.de/john,
   docs/protokoll.md › Rückfragen). Diese Datei
     1. holt die offenen Rückfragen von dort und hängt sie an offeneFragen() — Banner „Fragen an
        dich", Ritual „Rückfragen", Board-Spalte „wartet", alles wie bei Claudes Fragen;
     2. schreibt jede Antwort zusätzlich dorthin zurück (w=rueckfrage-antwort), damit die
        Fragende sie lesen kann — auf jedem Gerät, auch wenn kein Compass-Server erreichbar ist;
     3. reicht Antworten nach, die in diesem Browser schon gegeben, an der Rezeption aber noch offen
        sind (Netz weg, Tab zu).

   „später" zählt im Compass als beantwortet (S.antworten) und geht deshalb auch hierher — die
   Fragende sieht „später" und stellt die Frage bei Bedarf unter neuer Kennung neu.

   Steht dieselbe Kennung schon in rhythmus-data.js (falls Claudes Fragen einmal in die Rezeption
   gespiegelt werden), gewinnt die Datei: keine Frage erscheint zweimal.

   Hängt sich von außen an wie compass-live.js: überschreibt offeneFragen, antwortText und
   antwortSenden über den globalen Namen und ruft die alten Fassungen weiter auf.
   Ohne Rezeption (Demo, Kundeninstanz) tut die Datei nichts.

   Quelle: C:\dev\john-agent\compass\ — nach flow-compass kopiert geraet\john-aufgaben.ps1 -Sync. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.__rezeptionFragen) return;
  window.__rezeptionFragen = true;

  const lies = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const HUB = String(window.JOHN_HUB || lies('compassJohnHub')).replace(/\/$/, '');
  const TOKEN = String(window.JOHN_HUB_TOKEN || lies('compassJohnHubToken'));
  if (!HUB || !TOKEN) return;
  if (typeof offeneFragen !== 'function' || typeof antwortSenden !== 'function') return;

  const SPEICHER = 'compassRezeptionFragen';
  const TAKT_MS = 3 * 60 * 1000;
  const NAMEN = { madelene: '👩‍💼 Madelene', madeleine: '👩‍💼 Madeleine', claude: '🤖 Claude', john: '🧭 John' };

  const RZF = { list: [], stand: null, fehler: null, geladen: false, gesendet: {} };
  window.RZF = RZF;
  try { const alt = JSON.parse(lies(SPEICHER) || 'null'); if (alt && Array.isArray(alt.list)) { RZF.list = alt.list; RZF.stand = alt.stand || null; } } catch (e) { }

  const tag = () => (typeof heute === 'function' ? heute() : new Date().toLocaleDateString('sv-SE'));
  const ausDatei = id => (((window.RHYTHM || {}).rueckfragen) || []).some(q => q.id === id);
  function fuerCompass(q) {
    const wer = NAMEN[q.von] || q.von || '';
    const projekt = String(q.projekt || '');
    const name = wer.replace(/^\S+\s/, '');
    return {
      id: q.id,
      projekt: (wer && projekt.indexOf(name) !== 0) ? (wer + ' · ' + projekt) : (projekt || wer),
      frage: q.frage || '', warum: q.warum || '', optionen: (q.optionen || []).slice(0, 4),
      wann: q.wann || '', link: q.link || null, von: q.von || '', quelle: 'rezeption'
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

  /* ---------- an den Compass anhängen ------------------------------------------------------ */
  const altOffen = offeneFragen;
  /* Gleichberechtigt heißt auch: nicht hinten anstellen. Das Ritual zeigt drei Fragen auf einmal; hinter
     30 offenen Fragen aus der Datei sähe Bene Madelenes Frage erst nach 30 Entscheidungen. Deshalb nach
     `wann` einsortieren — vor die erste ältere Frage, bei gleichem Tag dahinter (die Datei steht jüngste zuerst). */
  window.offeneFragen = function () {
    const basis = (altOffen.apply(this, arguments) || []).slice();
    const da = new Set(basis.map(q => q.id));
    const neu = rezeptionFragen().filter(q => !da.has(q.id));
    const wannVon = id => { const q = RZF.list.find(x => x.id === id); return (q && q.wann) || ''; };
    neu.sort((a, b) => wannVon(b.id).localeCompare(wannVon(a.id))).reverse().forEach(q => {
      const w = wannVon(q.id);
      let i = basis.findIndex(x => String(x.wann || '') < w);
      if (i < 0) i = basis.length;
      basis.splice(i, 0, q);
    });
    return basis;
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

  /* ---------- Rezeption -------------------------------------------------------------------- */
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
    const schluessel = id + '|' + a;
    if (RZF.gesendet[schluessel]) return;
    RZF.gesendet[schluessel] = true;
    const w = (typeof S !== 'undefined' && S.antworten && S.antworten[id]) || {};
    const ts = w.ts || tag();
    try {
      const { status } = await ruf('rueckfrage-antwort', { id, a, ts, wer: 'compass' });
      if (status >= 200 && status < 300) {
        const q = RZF.list.find(x => x.id === id);
        if (q) { q.status = 'beantwortet'; q.antwort = { a, ts, wer: 'compass' }; merken(); }
      } else if (status !== 404 && status !== 409) {
        delete RZF.gesendet[schluessel];            /* 5xx, 429: der nächste Abgleich versucht es wieder */
      }
    } catch (e) { delete RZF.gesendet[schluessel]; }
  }

  async function laden(still) {
    let antwort;
    try { antwort = await ruf('rueckfragen', null, '&status=offen'); }
    catch (e) { RZF.fehler = 'Rezeption nicht erreichbar'; RZF.geladen = true; return; }
    const { status, d } = antwort;
    if (status !== 200 || !d || !d.ok) { RZF.fehler = (d && d.fehler) || ('HTTP ' + status); RZF.geladen = true; return; }
    const vorher = rezeptionFragen().map(q => q.id).join(',');
    RZF.list = d.rueckfragen || []; RZF.stand = d.jetzt || null; RZF.fehler = null; RZF.geladen = true;
    merken();
    /* Nachreichen: in diesem Browser beantwortet, an der Rezeption noch offen. */
    const antw = (typeof S !== 'undefined' && S.antworten) || {};
    RZF.list.forEach(q => { if (q.status === 'offen' && antw[q.id] && antw[q.id].a) zurueck(q.id, antw[q.id].a); });
    const nachher = rezeptionFragen().map(q => q.id).join(',');
    if (!still || vorher !== nachher) neuMalen();
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
    if (rezeptionFragen().length) neuMalen();          // erst der gemerkte Stand, dann frisch
    laden(true);
    setInterval(() => { if (!document.hidden) laden(true); }, TAKT_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) laden(true); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();
