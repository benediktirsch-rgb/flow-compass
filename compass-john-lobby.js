/* compass-john-lobby.js — Johns Lobby (10.09.2026)

   Benes Bestellung: „sobald John weg ist, geb mir ein Layover-Fenster, das ihn direkt startet."

   Die Lobby ist der Warteraum vor Johns Zimmer. Sie erscheint genau dann, wenn John gerade nicht
   antworten kann, und tut drei Dinge:
     1. sie sagt, WAS ist — belegt, aus, oder dieses Gerät kann ihn nicht starten. Bis heute stand
        an 18 Stellen in dashboard.html derselbe Satz („John-Server nicht erreichbar") für drei
        völlig verschiedene Lagen;
     2. sie zeigt Johns letzten Stand aus der Rezeption (hotel-vaikuntha.de/john/), damit eine
        Unterbrechung nicht wie „nichts zu tun" aussieht;
     3. sie startet ihn — über die Tür des Geräte-Workers (127.0.0.1:8788), nicht über eine
        Anleitung zum Abtippen.

   Sie verschwindet von selbst, sobald John wieder antwortet, und drängt nicht: kein Blinken,
   kein Druck. Ruhiger Mentor, auch im Fehlerfall.

   Hängt sich wie compass-live.js von außen an; dashboard.html bleibt bis auf das <script>-Tag
   unberührt. Ist kein Coach-Server eingerichtet (Demo, fremde Instanz), tut die Datei nichts.

   Quelle dieser Datei: C:\dev\john-agent\compass\ — dort wird sie gepflegt, nach flow-compass
   kopiert sie geraet\john-aufgaben.ps1 -Sync.                                                    */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__johnLobby) return;                       // zweimal geladen: einmal reicht

  /* ---------- Umgebung ------------------------------------------------------------------ */
  const API = () => (typeof JOHN_API === 'string' ? JOHN_API : '');
  const esc = (typeof window.esc === 'function') ? window.esc
    : (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const sag = (m, art) => { try { if (typeof toast === 'function') toast(m, art); else console.log(m); } catch (e) { } };

  /* Die Tür des Geräte-Workers. Vom Handy oder aus dem Netz ist sie nicht erreichbar — das ist
     kein Fehler, sondern der Grund, warum es die Rezeption gibt. */
  const TUER = (window.JOHN_TUER || 'http://127.0.0.1:8788').replace(/\/$/, '');
  /* Rezeption: beim Bauen der eigenen Instanz eingesetzt (build-compass.ps1), sonst aus dem
     Browser-Speicher. Ohne Rezeption bleibt die Lobby ehrlich und zeigt keinen Stand. */
  const HUB = (window.JOHN_HUB || localStorage.getItem('compassJohnHub') || '').replace(/\/$/, '');
  const HUB_TOKEN = window.JOHN_HUB_TOKEN || localStorage.getItem('compassJohnHubToken') || '';

  /* Hat dieser Browser Johns Tür je erreicht? Wenn nie und wir nicht auf localhost sind, ist es
     ein Handy oder ein fremder Rechner — dort startet niemand John, und das Fenster bleibt zu. */
  const TUER_GESEHEN = 'compassJohnTuer';
  const FERNGERAET = () => {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return false;
    try { return !localStorage.getItem(TUER_GESEHEN); } catch (e) { return true; }
  };

  const KEIN_JOHN = !API() && !location.port && !HUB && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  const SNOOZE_MS = 10 * 60 * 1000;   // „Später" hält zehn Minuten
  const PROBE_MS_ZU = 30 * 1000;      // Lobby geschlossen: alle 30 s nachsehen
  const PROBE_MS_OFFEN = 5 * 1000;    // Lobby offen: alle 5 s
  const T_TUER = 1500, T_SERVER = 4000, T_HUB = 6000;

  /* ---------- Stil ---------------------------------------------------------------------- */
  const css = document.createElement('style');
  css.textContent = `
.jlb-hg{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;
  background:rgba(8,10,9,.62);backdrop-filter:blur(3px);animation:jlbAuf .18s ease-out}
.jlb-hg[hidden]{display:none!important}
@keyframes jlbAuf{from{opacity:0}to{opacity:1}}
.jlb{width:100%;max-width:540px;max-height:88vh;overflow:auto;background:var(--panel,#141712);color:var(--ink,#e9eee4);
  border:1px solid var(--line2,#39412f);border-radius:16px;padding:18px 18px 14px;box-shadow:0 24px 60px rgba(0,0,0,.45)}
.jlb h2{margin:0 0 2px;font-size:19px;font-weight:650;letter-spacing:.1px}
.jlb .jlb-sub{color:var(--dim,#9aa48c);font-size:12.5px;margin:0 0 12px}
.jlb .jlb-lage{background:var(--panel2,#1b1f18);border:1px solid var(--line,#2b3124);border-radius:12px;padding:10px 12px;margin:0 0 12px;font-size:13.5px;line-height:1.55}
.jlb .jlb-lage b{color:var(--ink,#e9eee4)}
.jlb .jlb-lage .jlb-warum{display:block;color:var(--dim,#9aa48c);font-size:12px;margin-top:4px}
.jlb .jlb-stand{margin:0 0 12px}
.jlb .jlb-stand .jlb-kopf{font-size:11.5px;color:var(--dim,#9aa48c);text-transform:uppercase;letter-spacing:.6px;margin:0 0 6px}
.jlb .jlb-p{border-left:2px solid var(--line2,#39412f);padding:2px 0 2px 10px;margin:0 0 8px;font-size:13px;opacity:.86}
.jlb .jlb-p b{display:block;font-weight:600}
.jlb .jlb-p span{color:var(--dim,#9aa48c);font-size:12px}
.jlb .jlb-tasten{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}
.jlb .jlb-b{appearance:none;cursor:pointer;font:inherit;font-size:13px;padding:8px 14px;border-radius:10px;
  border:1px solid var(--line2,#39412f);background:var(--panel2,#1b1f18);color:var(--ink,#e9eee4)}
.jlb .jlb-b:hover{border-color:var(--va-l,#8fd14f)}
.jlb .jlb-b.jlb-haupt{background:var(--va,#5b8c1f);border-color:var(--va,#5b8c1f);color:#fff;font-weight:600}
.jlb .jlb-b.jlb-haupt:hover{filter:brightness(1.1)}
.jlb .jlb-b:disabled{opacity:.55;cursor:wait}
.jlb .jlb-b.jlb-still{background:transparent;border-color:transparent;color:var(--dim,#9aa48c);padding-left:6px;padding-right:6px}
.jlb .jlb-fuss{margin:12px 0 0;font-size:11.5px;color:var(--dim,#9aa48c);line-height:1.5}
.jlb .jlb-hilfe{margin:10px 0 0;padding:10px 12px;background:var(--panel2,#1b1f18);border:1px solid var(--line,#2b3124);
  border-radius:10px;font-size:12.5px;line-height:1.6}
.jlb .jlb-hilfe code{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;background:rgba(0,0,0,.28);padding:1px 5px;border-radius:5px;word-break:break-all}
.jlb-pille{position:fixed;right:14px;bottom:14px;z-index:8500;display:flex;align-items:center;gap:7px;cursor:pointer;
  font:inherit;font-size:12px;padding:7px 12px;border-radius:999px;border:1px solid var(--line2,#39412f);
  background:var(--panel,#141712);color:var(--dim,#9aa48c);box-shadow:0 6px 18px rgba(0,0,0,.3)}
.jlb-pille[hidden]{display:none!important}
.jlb-pille:hover{color:var(--ink,#e9eee4);border-color:var(--va-l,#8fd14f)}
.jlb-pille .jlb-pkt{width:7px;height:7px;border-radius:50%;background:#d9a13b;flex:none}
.jlb-pille.jlb-aus .jlb-pkt{background:#c46a5e}
@media(max-width:520px){.jlb{padding:14px 14px 12px}.jlb .jlb-tasten .jlb-b{flex:1 1 auto}}
`;
  document.head.appendChild(css);

  /* ---------- Zustand ------------------------------------------------------------------- */
  const Z = {
    hg: null, box: null, pille: null,
    offen: false, snoozeBis: 0, timer: null,
    fehlschlaege: 0,          // zwei in Folge, dann erst die Lobby (ein Aussetzer ist kein Ausfall)
    lage: null,               // 'ok' | 'belegt' | 'aus' | 'fremd'
    tuer: null,               // Antwort des Workers
    hub: null,                // Antwort der Rezeption
    startLaeuft: false,
    seit: 0
  };

  /* ---------- Fragen stellen ------------------------------------------------------------ */
  async function hol(url, ms, kopf) {
    const opt = { cache: 'no-store', signal: AbortSignal.timeout(ms) };
    if (kopf) opt.headers = kopf;
    const r = await fetch(url, opt);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }
  const fragTuer = () => hol(TUER + '/stand', T_TUER).catch(() => null);
  const fragServer = () => hol(API() + '/api/john/status', T_SERVER).catch(() => null);
  const fragHub = () => (HUB && HUB_TOKEN)
    ? hol(HUB + '/api.php?w=stand', T_HUB, { 'X-John-Token': HUB_TOKEN }).catch(() => null)
    : Promise.resolve(null);

  /* Eine Runde: erst das Gerät (schnell und auskunftsfähig), dann der Cockpit-Server,
     dann die Rezeption. Die Reihenfolge ist Absicht — die Tür ist die einzige Stelle, die
     „belegt" von „aus" unterscheiden kann, weil sie neben dem Server lebt und nicht in ihm. */
  async function runde() {
    const [tuer, server] = await Promise.all([fragTuer(), fragServer()]);
    Z.tuer = tuer;
    if (tuer) { try { localStorage.setItem(TUER_GESEHEN, String(Date.now())); } catch (e) { } }
    if (server && server.ok) {
      Z.lage = 'ok'; Z.fehlschlaege = 0;
      return true;
    }
    Z.fehlschlaege++;
    if (tuer) {
      /* Der Worker lebt und weiß, wie es dem großen Server geht — vier verschiedene Lagen,
         die von außen alle gleich aussehen. Der wichtigste Fall ist der erste: der Server
         läuft und antwortet dem Gerät, nur diese Seite kommt nicht an ihn heran. Das ist
         kein Ausfall, sondern eine falsche Adresse — und das hat vorher niemand gesehen. */
      if (tuer.denkt) Z.lage = 'belegt';
      else if (tuer.serverOk === true) Z.lage = 'adresse';
      else if (tuer.serverLaeuft) Z.lage = 'haengt';
      else Z.lage = 'aus';
    } else if (KEIN_JOHN || FERNGERAET()) {
      Z.lage = 'fremd';
    } else {
      Z.lage = 'unklar';
    }
    Z.hub = await fragHub();
    return false;
  }

  /* ---------- Sätze — vier Lagen, vier Sätze, nie einer für alles --------------------- */
  function lageText() {
    const g = (Z.hub && Array.isArray(Z.hub.geraete)) ? Z.hub.geraete.filter(x => x && x.wach) : [];
    switch (Z.lage) {
      case 'belegt':
        return { titel: 'John denkt gerade',
          text: '<b>Er ist da, aber belegt.</b> Ein Denkvorgang dauert bis zu 90 Sekunden; solange beantwortet er nichts anderes.',
          warum: 'Das Gerät meldet: Prozess läuft' + (Z.tuer && Z.tuer.denktSeit ? ', denkt seit ' + esc(uhr(Z.tuer.denktSeit)) : '') + '.',
          startbar: false };
      case 'adresse':
        return { titel: 'John läuft — diese Seite erreicht ihn nicht',
          text: '<b>Auf dem Gerät antwortet er.</b> Nur der Weg von dieser Seite dorthin ist zu: '
            + (API() ? '<code>' + esc(API()) + '</code>' : 'gleiche Adresse wie diese Seite')
            + ' liefert nichts.',
          warum: 'Meist ist die Adresse im Compass falsch gesetzt (Browser-Speicher <code>compassJohnApi</code>) oder der Browser blockt den Weg ins lokale Netz.',
          startbar: false };
      case 'haengt':
        return { titel: 'John hängt',
          text: '<b>Sein Server lebt, antwortet aber nicht mehr.</b> Ein Neustart holt ihn zurück — ich mache das von hier.',
          warum: 'Das Gerät meldet: Prozess läuft, letzte Antwort ' + (Z.tuer && Z.tuer.serverAntwortZeit ? esc(uhr(Z.tuer.serverAntwortZeit)) : 'unbekannt') + '.',
          startbar: true };
      case 'aus':
        return { titel: 'John ist aus',
          text: '<b>Auf diesem Rechner läuft sein Server nicht.</b> Ich kann ihn von hier starten.',
          warum: 'Das Gerät ist wach, der Cockpit-Server auf Port 8787 nicht.',
          startbar: true };
      case 'fremd':
        return { titel: 'John wohnt nicht auf diesem Gerät',
          text: '<b>Von hier kann ich ihn nicht starten</b> — er denkt auf deinem Rechner. Seine Kachel kommt hier aus seinem Zimmer im Netz; OK und ⏰ wirken trotzdem überall.',
          warum: HUB ? 'Dieses Gerät hat Johns Tür noch nie erreicht — typisch fürs Handy oder einen fremden Rechner.' : 'Kein lokaler Coach-Server und keine Rezeption hinterlegt.',
          startbar: false };
      default:
        return { titel: 'John antwortet nicht',
          text: g.length
            ? '<b>Sein Stand lebt weiter</b> — die Rezeption kennt ihn. Nur dieses Gerät erreicht ihn gerade nicht.'
            : '<b>Entweder denkt er gerade, oder er ist aus.</b> Sicher sagen kann das nur der Geräte-Worker; der antwortet hier nicht.',
          warum: 'Kein Wort von Port 8787' + (Z.fehlschlaege > 1 ? ' (' + Z.fehlschlaege + ' Versuche)' : '') + ', keine Tür auf 8788.',
          startbar: true };
    }
  }

  function uhr(iso) {
    try {
      const d = new Date(iso); if (isNaN(d)) return '';
      const heute = new Date();
      const t = d.toDateString() === heute.toDateString();
      return (t ? '' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ')
        + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  /* Johns Stapel in der Lobby = derselbe wie auf der Kachel (11.09.2026): erst der gespiegelte
     Compass-Stapel aus dem Zimmer, gefiltert wie stapelOffen() — sonst stand in der Lobby ein
     anderer Stapel als eine Handbreit daneben auf der Kachel. Johns eigene Takt-Funde folgen
     getrennt darunter; sie fließen erst beim nächsten Sortieren in die Kachel. */
  function offenAus(punkte, stand) {
    const jetzt = Date.now();
    return (punkte || []).filter(p => {
      const st = (stand || {})[p.key];
      if (!st) return true;
      if (st.status === 'ok') return false;
      if (st.status === 'wieder') { const bis = Date.parse(st.bis || ''); return !(bis && bis > jetzt); }
      return true;
    });
  }
  function zeilen(liste) {
    return liste.map(p => '<div class="jlb-p"><b>' + esc(p.titel || p.text || '—') + '</b>'
      + ((p.satz || p.warum) ? '<span>' + esc(p.satz || p.warum) + '</span>' : '') + '</div>').join('');
  }
  function standHtml() {
    let punkte = null, um = '', quelle = '';
    const c = Z.hub && Z.hub.compass;
    if (c && Array.isArray(c.punkte) && c.punkte.length) {
      punkte = offenAus(c.punkte, c.stand).slice(0, 3); um = c.stand_um; quelle = 'aus Johns Zimmer';
    } else if (hatKachel() && (STAPEL.punkte || []).length && typeof stapelOffen === 'function') {
      punkte = stapelOffen(); um = STAPEL.standUm; quelle = 'Kopie in diesem Browser';
    }
    let html;
    if (!punkte) {
      html = '<div class="jlb-stand"><p class="jlb-kopf">Sein Stapel</p>'
        + '<div class="jlb-p"><span>Kein Stand hinterlegt. <b style="display:inline;font-weight:600">Leer heißt hier nicht „nichts zu tun"</b> — es heißt: von dieser Stelle aus ist sein Stapel nicht lesbar.</span></div></div>';
    } else {
      html = '<div class="jlb-stand"><p class="jlb-kopf">Sein Stapel' + (um ? ' · Stand ' + esc(uhr(um)) : '') + ' · ' + esc(quelle) + '</p>'
        + (punkte.length ? zeilen(punkte) : '<div class="jlb-p"><span>Alles abgeräumt oder auf Wiedervorlage.</span></div>') + '</div>';
    }
    const t = Z.hub && Z.hub.stapel;
    if (t && Array.isArray(t.punkte) && t.punkte.length) {
      html += '<div class="jlb-stand"><p class="jlb-kopf">Von selbst gesehen · Takt ' + esc(uhr(t.stand)) + '</p>' + zeilen(t.punkte.slice(0, 3)) + '</div>';
    }
    return html;
  }
  function fussHtml() {
    const teile = [];
    teile.push('Die Aufgabe „John Server" versucht es <b>jede Minute</b> von selbst — meist ist er von allein wieder da.');
    if (Z.hub) {
      const wach = (Z.hub.geraete || []).filter(g => g && g.wach).map(g => g.name);
      teile.push('Rezeption: ' + (wach.length ? 'wach auf ' + esc(wach.join(', ')) : '<b>kein Gerät wach</b> — Johns Hände schlafen, sein Zimmer ist besetzt.'));
    } else if (HUB) {
      teile.push('Rezeption (' + esc(HUB) + ') antwortet nicht.');
    } else {
      teile.push('Keine Rezeption hinterlegt — sein Stand hängt an diesem Rechner. (john-agent, <code>docs/kas-schritte.md</code>)');
    }
    /* Wann hat John zuletzt von selbst gedacht? Es gibt Logs, aber niemand liest Logs — diese
       eine Zeile ist der Wächter, den Madeleine und ich beide als größte Lücke gesehen haben. */
    const tk = (Z.hub && Z.hub.takt && Z.hub.takt.letzter) || (Z.tuer && Z.tuer.takt && Z.tuer.takt.letzter) || null;
    if (tk) {
      const tage = Math.floor((Date.now() - new Date(tk).getTime()) / 86400000);
      teile.push('Johns letzter eigener Takt: ' + esc(uhr(tk))
        + (tage >= 2 ? ' — <b>seit ' + tage + ' Tagen still.</b> Das ist zu lang; lies <code>geraet\\john-auftrag.log</code>.' : ''));
    } else if (Z.hub || Z.tuer) {
      teile.push('Ein eigener Takt ist noch nicht gelaufen (Fenster Mo–Fr 6:30–21:30).');
    }
    return '<p class="jlb-fuss">' + teile.join('<br>') + '</p>';
  }

  /* ---------- Bauen ---------------------------------------------------------------------- */
  function bauen() {
    if (Z.hg) return;
    Z.hg = document.createElement('div');
    Z.hg.className = 'jlb-hg'; Z.hg.hidden = true;
    Z.hg.setAttribute('role', 'dialog'); Z.hg.setAttribute('aria-modal', 'true'); Z.hg.setAttribute('aria-label', 'Johns Lobby');
    Z.box = document.createElement('div'); Z.box.className = 'jlb';
    Z.hg.appendChild(Z.box);
    document.body.appendChild(Z.hg);
    Z.hg.addEventListener('click', e => { if (e.target === Z.hg) spaeter(); });
    document.addEventListener('keydown', e => { if (Z.offen && e.key === 'Escape') { e.stopPropagation(); spaeter(); } }, true);

    Z.pille = document.createElement('button');
    Z.pille.type = 'button'; Z.pille.className = 'jlb-pille'; Z.pille.hidden = true;
    Z.pille.addEventListener('click', () => oeffnen());
    document.body.appendChild(Z.pille);
  }

  function malen() {
    const l = lageText();
    const wartezeit = Z.seit ? Math.round((Date.now() - Z.seit) / 1000) : 0;
    Z.box.innerHTML =
      '<h2>🤵 ' + esc(l.titel) + '</h2>'
      + '<p class="jlb-sub">Johns Lobby' + (wartezeit > 20 ? ' · seit ' + Math.round(wartezeit / 60 || 1) + ' Min hier' : '') + '</p>'
      + '<div class="jlb-lage">' + l.text + '<span class="jlb-warum">' + l.warum + '</span></div>'
      + standHtml()
      + '<div class="jlb-tasten">'
      + (l.startbar ? '<button type="button" class="jlb-b jlb-haupt" data-t="start">▶ John starten</button>' : '')
      + '<button type="button" class="jlb-b" data-t="neu">↻ Nochmal nachsehen</button>'
      + '<button type="button" class="jlb-b jlb-still" data-t="spaeter">Später</button>'
      + '</div>'
      + '<div id="jlbHilfe"></div>'
      + fussHtml();
    Z.box.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
      const t = b.getAttribute('data-t');
      if (t === 'start') starten(b);
      else if (t === 'neu') nachsehen(b);
      else spaeter();
    }));
  }

  /* ---------- Starten ------------------------------------------------------------------- */
  /* Erst die Tür des Workers (der lebt neben dem Server und darf Prozesse starten), dann das
     Protokoll john:// (einmalig eingerichtet von geraet\john-protokoll.ps1). Klappt beides
     nicht, sagt die Lobby genau das — statt eine Anleitung zum Abtippen zu geben. */
  async function starten(knopf) {
    if (Z.startLaeuft) return;
    Z.startLaeuft = true;
    const alt = knopf ? knopf.textContent : '';
    if (knopf) { knopf.disabled = true; knopf.textContent = '… wird gestartet'; }
    const hilfe = document.getElementById('jlbHilfe');
    let geschafft = false, weg = '';
    try {
      const r = await fetch(TUER + '/wecken', { method: 'POST', signal: AbortSignal.timeout(8000) });
      if (r.ok) { geschafft = true; weg = 'Tür des Geräts'; }
    } catch (e) { }
    if (!geschafft) {
      try { window.location.href = 'john://start'; weg = 'john://start'; } catch (e) { }
      await new Promise(r => setTimeout(r, 2500));
      const nach = await fragTuer().catch(() => null) || await fragServer().catch(() => null);
      if (nach) { geschafft = true; }
    }
    if (knopf) { knopf.disabled = false; knopf.textContent = alt; }
    Z.startLaeuft = false;
    if (geschafft) {
      sag('John wird gestartet' + (weg ? ' (' + weg + ')' : '') + ' — ich sehe alle 5 Sekunden nach.', 'ok');
      if (hilfe) hilfe.innerHTML = '';
      warten();
      return;
    }
    if (hilfe) {
      hilfe.innerHTML = '<div class="jlb-hilfe">Von hier aus kam ich nicht an ihn heran: die Tür des Geräts '
        + '(<code>127.0.0.1:8788</code>) antwortet nicht, und <code>john://start</code> ist auf diesem Rechner '
        + 'nicht eingerichtet.<br><br><b>Zwei Dinge helfen dauerhaft:</b><br>'
        + '· Worker + Aufgaben einrichten: <code>john-agent\\geraet\\john-aufgaben.ps1 -Register</code><br>'
        + '· Startbefehl im Browser erlauben: <code>john-agent\\geraet\\john-protokoll.ps1 -Register</code><br><br>'
        + 'Bis dahin holt ihn die geplante Aufgabe „John Server" innerhalb einer Minute selbst zurück — '
        + 'dieses Fenster schließt sich dann von allein.</div>';
    }
    sag('Start von hier nicht möglich — die Aufgabe holt ihn innerhalb einer Minute zurück.', 'warn');
  }

  async function nachsehen(knopf) {
    const alt = knopf ? knopf.textContent : '';
    if (knopf) { knopf.disabled = true; knopf.textContent = '… sehe nach'; }
    const da = await runde();
    if (knopf) { knopf.disabled = false; knopf.textContent = alt; }
    if (da) wiederDa(); else malen();
  }

  /* ---------- Auf und zu ---------------------------------------------------------------- */
  function oeffnen() {
    bauen();
    if (!Z.seit) Z.seit = Date.now();
    Z.offen = true; Z.snoozeBis = 0;
    malen();
    Z.hg.hidden = false;
    if (Z.pille) Z.pille.hidden = true;
    takt(PROBE_MS_OFFEN);
  }
  function schliessen() {
    if (Z.hg) Z.hg.hidden = true;
    Z.offen = false;
  }
  function spaeter() {
    Z.snoozeBis = Date.now() + SNOOZE_MS;
    schliessen();
    pilleZeigen();
    takt(PROBE_MS_ZU);
  }
  function pilleZeigen() {
    if (!Z.pille) return;
    Z.pille.hidden = false;
    Z.pille.className = 'jlb-pille' + (Z.lage === 'aus' ? ' jlb-aus' : '');
    const wort = { belegt: 'John denkt', aus: 'John ist aus', haengt: 'John hängt',
                   adresse: 'John: falsche Adresse', fremd: 'John: anderes Gerät', schlaeft: 'Johns Hände schlafen' };
    Z.pille.innerHTML = '<span class="jlb-pkt"></span>🤵 ' + (wort[Z.lage] || 'John antwortet nicht');
  }
  function wiederDa() {
    const warEr = Z.offen || (Z.pille && !Z.pille.hidden);
    schliessen();
    if (Z.pille) Z.pille.hidden = true;
    Z.seit = 0; Z.snoozeBis = 0; Z.fehlschlaege = 0;
    if (warEr) sag('🤵 John ist wieder da.', 'ok');
    takt(PROBE_MS_ZU);
  }
  function warten() { takt(PROBE_MS_OFFEN); }

  /* ---------- Der eigene Takt ----------------------------------------------------------- */
  function takt(ms) {
    if (Z.timer) clearTimeout(Z.timer);
    Z.timer = setTimeout(schlag, ms);
  }
  async function schlag() {
    if (document.hidden) { takt(PROBE_MS_ZU); return; }   // im Hintergrund niemanden befragen
    const da = await runde();
    if (da) { wiederDa(); return; }
    /* Erst der zweite Fehlschlag in Folge öffnet die Lobby. Ein einzelner Aussetzer während
       eines Denkvorgangs ist kein Ausfall, und ein Fenster, das grundlos aufgeht, verliert
       jedes Vertrauen. Die Gegenprobe kommt aber schnell (4 s) — Bene soll nicht eine halbe
       Minute auf Karten starren, die „nicht erreichbar" sagen. */
    if (Z.fehlschlaege < 2) { takt(4000); return; }
    /* Handy oder fremder Rechner (11.09.2026): hier kann niemand John starten, also springt auch
       kein Fenster auf — bei jedem Besuch wäre das nur Lärm. Die Kachel kommt aus dem Zimmer.
       Eine Pille gibt es nur, wenn John nirgends wach ist; läuft er auf dem Rechner, ist alles gut. */
    if (Z.lage === 'fremd' && !Z.offen) {
      if (Z.hub && Z.hub.wach) { if (Z.pille) Z.pille.hidden = true; }
      else { Z.lage = Z.hub ? 'schlaeft' : 'fremd'; pilleZeigen(); Z.lage = 'fremd'; }
      takt(PROBE_MS_ZU * 4); return;
    }
    if (Z.offen) { malen(); takt(PROBE_MS_OFFEN); return; }
    if (Date.now() < Z.snoozeBis) { pilleZeigen(); takt(PROBE_MS_ZU); return; }
    oeffnen();
  }

  /* ---------- Johns Kachel überall (11.09.2026) ----------------------------------------
     Die Kachel holt ihren Stapel vom Cockpit-Server auf Benes Rechner (stapelLaden). Am Handy
     gibt es den nicht — die Kachel war dort leer. Der Worker spiegelt den Stapel in Johns
     Zimmer (w=spiegel); hier liest die Kachel ihn dort, sobald der Server nicht erreichbar ist,
     und jedes OK / ⏰ geht zusätzlich ins Zimmer (w=stapelstand). Der Worker reicht es an den
     Server nach. So ist ein Punkt, der irgendwo abgeräumt wurde, überall weg.

     Gebaut als Umhüllung der Seitenfunktionen (wie compass-live.js): Funktionsdeklarationen
     sind überschreibbar, und die Aufrufer schlagen den Namen erst beim Aufruf nach.
     Mail-Entwürfe und Claude-Aufträge liegen nicht im Zimmer (nurAmRechner) — dort sagt die
     Kachel „am Rechner", statt einen leeren Entwurf zu öffnen. */
  function hatKachel() {
    try { return typeof STAPEL === 'object' && STAPEL && typeof stapelMalen === 'function' && typeof stapelLaden === 'function'; }
    catch (e) { return false; }
  }
  /* Zeitstempel als Zeit vergleichen, nicht als Text: der Server schreibt „…+02:00", der
     Browser „…Z" — als Zeichenkette verglichen gewinnt dann oft der ältere. */
  const zeitVon = s => { const n = Date.parse(s || ''); return isNaN(n) ? 0 : n; };
  function standAusZimmer(neu) {
    const s = STAPEL.stand;
    Object.keys(neu || {}).forEach(k => {
      const a = neu[k], b = s[k];
      if (!a || !a.status) return;
      if (b && zeitVon(b.ts) > zeitVon(a.ts)) return;       // lokal jünger: bleibt
      if (a.status === 'offen') delete s[k]; else s[k] = a;
    });
  }
  async function kachelAusZimmer() {
    if (!hatKachel() || !HUB || !HUB_TOKEN) return false;
    const h = await fragHub();
    if (!h || !h.compass || !Array.isArray(h.compass.punkte)) return false;
    Z.hub = h;
    if (!h.compass.punkte.length && !Object.keys(h.compass.stand || {}).length) return false;
    STAPEL.punkte = h.compass.punkte;
    standAusZimmer(h.compass.stand || {});
    STAPEL.standUm = h.compass.stand_um || STAPEL.standUm;
    STAPEL.geladen = true; STAPEL.fehler = null; STAPEL.ausZimmer = true;
    try { stapelMerken(); } catch (e) { }
    stapelMalen();
    return true;
  }
  async function insZimmer(key, eintrag) {
    if (!HUB || !HUB_TOKEN) return false;
    try {
      const r = await fetch(HUB + '/api.php?w=stapelstand', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-John-Token': HUB_TOKEN },
        body: JSON.stringify(Object.assign({ key }, eintrag)), signal: AbortSignal.timeout(8000) });
      const j = await r.json(); return !!(j && j.ok);
    } catch (e) { return false; }
  }
  if (!KEIN_JOHN && hatKachel()) {
    const orgLaden = window.stapelLaden, orgAktion = window.stapelAktion, orgMalen = window.stapelMalen;
    window.stapelLaden = async function (force) {
      await orgLaden.apply(this, arguments);
      if (STAPEL.offline || (!(STAPEL.punkte || []).length && !STAPEL.fehler)) await kachelAusZimmer();
      else STAPEL.ausZimmer = false;
    };
    /* Neu geschrieben statt umhüllt: das Original meldet „nur lokal gemerkt", sobald der Server
       fehlt — auch dann, wenn das Zimmer den Stand längst hat. Gleiche Felder, gleiche Wirkung. */
    window.stapelStand = async function (key, status, extra) {
      extra = extra || {};
      const p = (STAPEL.punkte || []).find(x => x.key === key) || {};
      const eintrag = { status, ts: new Date().toISOString(),
        bis: status === 'wieder' ? new Date(Date.now() + (extra.stunden || 24) * 3600e3).toISOString() : '',
        aktion: extra.aktion || '', titel: p.titel || extra.titel || '' };
      if (status === 'offen') delete STAPEL.stand[key]; else STAPEL.stand[key] = eintrag;
      try { stapelMerken(); } catch (e) { }
      stapelMalen();
      const zimmer = insZimmer(key, eintrag);
      let server = false;
      if (!STAPEL.ausZimmer) {
        try {
          const r = await fetch(API() + '/api/john/stapel/stand', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, status, aktion: eintrag.aktion, titel: eintrag.titel, stunden: extra.stunden || 24, auftrag: extra.auftrag || '' }),
            signal: AbortSignal.timeout(15000) });
          const j = await r.json();
          if (j && j.ok) { if (typeof stapelStandMischen === 'function') stapelStandMischen(j.stand); try { stapelMerken(); } catch (e) { } server = true; }
        } catch (e) { }
      }
      const imZimmer = await zimmer;
      if (server) return true;
      if (imZimmer) { sag('In Johns Zimmer gemerkt — dein Rechner übernimmt es, sobald er wach ist.', 'ok'); return true; }
      sag('Stand nur lokal gemerkt — weder dein Rechner noch Johns Zimmer waren erreichbar.', 'warn');
      return false;
    };
    window.stapelAktion = function (key) {
      const p = (STAPEL.punkte || []).find(x => x.key === key);
      if (p && p.aktion && p.aktion.nurAmRechner) {
        sag('Den Entwurf dazu hat John auf deinem Rechner — dort ist es ein Klick. Von hier: ✓ OK oder ⏰ 24 h.', 'warn');
        return;
      }
      return orgAktion.apply(this, arguments);
    };
    window.stapelMalen = function () {
      orgMalen.apply(this, arguments);
      const b = document.getElementById('stapelBody');
      if (!b) return;
      try {
        if (STAPEL.ausZimmer && !b.querySelector('.jlb-zimmer')) {
          const d = document.createElement('div');
          d.className = 'hint jlb-zimmer';
          d.innerHTML = '🏨 Aus Johns Zimmer' + (STAPEL.standUm ? ' · Stand ' + esc(uhr(STAPEL.standUm)) : '')
            + ' — dein Rechner ist von hier nicht erreichbar. OK und ⏰ wirken trotzdem überall.';
          b.prepend(d);
        }
      } catch (e) { }
      try { taktBlock(b); } catch (e) { }
    };
    /* Johns Takt auf der Kachel (11.09.2026). Was John von selbst gefunden hat, stand bis hier nur
       in john/coaching/takt.md — eine Datei, die niemand liest. Der Server liest sie zwar beim
       Sortieren mit, sortiert aber nur alle paar Stunden neu; automatisch nachsortieren hieße einen
       weiteren 90-Sekunden-Aufruf, der den Server blockiert. Also: die Funde hier zeigen, ohne
       Aufruf, auf jedem Gerät — und Bene entscheidet mit einem Knopf, ob John neu sortiert.
       „Gesehen" blendet diesen einen Takt auf diesem Gerät aus; der nächste Takt kommt wieder. */
    const TAKT_GESEHEN = 'compassJohnTaktGesehen';
    function taktBlock(b) {
      const alt = b.querySelector('.jlb-takt'); if (alt) alt.remove();
      const t = Z.hub && Z.hub.stapel;
      if (!t || !Array.isArray(t.punkte) || !t.punkte.length || !t.stand) return;
      const alter = Date.now() - zeitVon(t.stand);
      if (alter > 12 * 3600e3) return;                                   // älter als ein halber Tag: vorbei
      if (zeitVon(STAPEL.standUm) > zeitVon(t.stand)) return;             // die Kachel ist schon jünger sortiert
      let gesehen = ''; try { gesehen = localStorage.getItem(TAKT_GESEHEN) || ''; } catch (e) { }
      if (gesehen === t.stand) return;
      const d = document.createElement('div');
      d.className = 'jlb-takt';
      d.style.cssText = 'margin:10px 0 4px;padding:10px 12px;border:1px dashed var(--line2,#39412f);border-radius:12px;font-size:12.5px;line-height:1.5';
      d.innerHTML = '<div style="font-weight:600;margin:0 0 6px">🔔 Von selbst gesehen · Johns Takt ' + esc(uhr(t.stand)) + '</div>'
        + t.punkte.slice(0, 3).map(p => '<div style="margin:0 0 6px"><b>' + esc(p.titel || '') + '</b>'
          + (p.warum ? '<br><span class="muted">' + esc(p.warum) + '</span>' : '')
          + (p.aktion ? '<br><span class="muted">→ ' + esc(p.aktion) + '</span>' : '') + '</div>').join('')
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'
        + (STAPEL.ausZimmer ? '' : '<button class="jm2" data-jt="sortieren" title="John sortiert den Stapel neu — mit diesen Funden. Dauert bis zu 90 Sekunden.">↻ In den Stapel sortieren</button>')
        + '<button class="jm2" data-jt="gesehen" title="Diesen Takt auf diesem Gerät ausblenden">✓ Gesehen</button></div>';
      const fuss = b.querySelector('.spfuss');
      if (fuss) b.insertBefore(d, fuss); else b.appendChild(d);
      d.querySelectorAll('[data-jt]').forEach(k => k.addEventListener('click', () => {
        if (k.getAttribute('data-jt') === 'gesehen') { try { localStorage.setItem(TAKT_GESEHEN, t.stand); } catch (e) { } d.remove(); }
        else { try { localStorage.setItem(TAKT_GESEHEN, t.stand); } catch (e) { } stapelLaden(true); }
      }));
    }
    /* Das Zimmer auch dann lesen, wenn der Server antwortet — sonst sieht die Kachel am Rechner
       Johns Takt nie. Einmal nach dem Laden, dann alle fünf Minuten bei sichtbarer Seite. */
    const zimmerLesen = async () => { if (!HUB || !HUB_TOKEN || document.hidden) return; const h = await fragHub(); if (h) { Z.hub = h; stapelMalen(); } };
    setTimeout(zimmerLesen, 4000);
    setInterval(zimmerLesen, 300000);
    /* Der erste Aufbau lief schon, bevor diese Datei geladen war — einmal nachziehen, und
       solange die Kachel aus dem Zimmer kommt, alle zwei Minuten nachsehen (OKs vom Rechner). */
    setTimeout(() => { if (STAPEL.offline || !(STAPEL.punkte || []).length) kachelAusZimmer(); }, 3000);
    setInterval(() => { if (STAPEL.ausZimmer && !document.hidden) kachelAusZimmer(); }, 120000);
  }

  /* ---------- Anlaufen ------------------------------------------------------------------ */
  if (KEIN_JOHN) return;   // Demo oder fremde Instanz: nichts anzeigen, nichts abfragen
  bauen();
  /* Zwei Sekunden Anlauf: beim Laden fragen ohnehin ein Dutzend Karten den Server, und wer
     gerade F5 gedrückt hat, will nicht als erstes ein Fenster sehen. */
  setTimeout(() => { takt(0); }, 2000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !Z.offen) takt(1200); });

  window.__johnLobby = true;
  window.johnLobby = {
    oeffnen, schliessen, starten, nachsehen,
    stand: () => ({ lage: Z.lage, tuer: Z.tuer, hub: Z.hub, fehlschlaege: Z.fehlschlaege, tuerUrl: TUER, hubUrl: HUB || null })
  };
})();
